/* Copied verbatim from the CosmicPulse mobile app (src/features/medical/lib.ts) by scripts/sync-mobile-core.mjs.
 * Edit the mobile original and re-run `npm run sync:mobile`; do not edit this copy. */
import type {
  Astronaut,
  CrewMessage,
  Incident,
  IncidentSeverity,
  IncidentStatus,
  InventoryItem,
  Measurement,
  MedicalRecord,
  Mission,
  Protocol,
  VitalType,
} from '@/data/types';
import { VITAL_META } from '@/data/vitals';
import { findProtocol } from '@/engine/knowledge/protocols';
import { citation } from '@/engine/knowledge/retrieval';

/**
 * Pure helpers for the MEDICAL area (inventory, incidents, comms, emergency).
 * No React / native imports so they can be unit-tested directly.
 */

export const DAY = 86_400_000;

/* ================================ Inventory ================================ */

/** Items expiring within this many days are flagged. */
export const EXPIRY_WARN_DAYS = 60;

export type StockFlag = 'out' | 'expired' | 'low' | 'expiring';

export type StockStatus = {
  daysToExpiry: number;
  out: boolean;
  expired: boolean;
  /** At or below the kit minimum (but not zero). */
  low: boolean;
  /** Not yet expired, expires within EXPIRY_WARN_DAYS. */
  expiring: boolean;
  flags: StockFlag[];
  level: 'critical' | 'warning' | 'ok';
  /** Most important condition, in words. */
  label: string;
};

export function stockStatus(item: Pick<InventoryItem, 'quantity' | 'minimum' | 'expiresAt'>, now: number): StockStatus {
  const exp = new Date(item.expiresAt).getTime();
  const daysToExpiry = Math.floor((exp - now) / DAY);
  const expired = exp <= now;
  const expiring = !expired && daysToExpiry <= EXPIRY_WARN_DAYS;
  const out = item.quantity <= 0;
  const low = !out && item.quantity <= item.minimum;
  const flags: StockFlag[] = [];
  if (out) flags.push('out');
  if (expired) flags.push('expired');
  if (low) flags.push('low');
  if (expiring) flags.push('expiring');
  const level = out || expired ? 'critical' : low || expiring ? 'warning' : 'ok';
  const label = out
    ? 'Out of stock'
    : expired
      ? 'Expired'
      : low
        ? item.quantity < item.minimum
          ? 'Below minimum'
          : 'At minimum'
        : expiring
          ? daysToExpiry <= 0
            ? 'Expires today'
            : `Expires in ${daysToExpiry} day${daysToExpiry === 1 ? '' : 's'}`
          : 'In stock';
  return { daysToExpiry, out, expired, low, expiring, flags, level, label };
}

export type InventoryFilter = 'all' | 'low' | 'expiring' | 'expired';

export function filterInventory(items: InventoryItem[], opts: { query?: string; filter?: InventoryFilter; kit?: string }, now: number): InventoryItem[] {
  const q = (opts.query ?? '').trim().toLowerCase();
  return items.filter((i) => {
    if (opts.kit && i.kit !== opts.kit) return false;
    if (q && ![i.name, i.strength, i.form, i.kit, i.lot].some((s) => s.toLowerCase().includes(q))) return false;
    const s = stockStatus(i, now);
    switch (opts.filter ?? 'all') {
      case 'low':
        return s.low || s.out;
      case 'expiring':
        return s.expiring;
      case 'expired':
        return s.expired;
      default:
        return true;
    }
  });
}

export function groupByKit(items: InventoryItem[]): { kit: string; items: InventoryItem[] }[] {
  const map = new Map<string, InventoryItem[]>();
  for (const i of items) map.set(i.kit, [...(map.get(i.kit) ?? []), i]);
  return [...map.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([kit, list]) => ({ kit, items: [...list].sort((a, b) => a.name.localeCompare(b.name)) }));
}

export function inventorySummary(items: InventoryItem[], now: number) {
  let low = 0;
  let expiring = 0;
  let expired = 0;
  let out = 0;
  for (const i of items) {
    const s = stockStatus(i, now);
    if (s.low) low++;
    if (s.expiring) expiring++;
    if (s.expired) expired++;
    if (s.out) out++;
  }
  return { total: items.length, low, expiring, expired, out, kits: new Set(items.map((i) => i.kit)).size, attention: low + expiring + expired + out };
}

/* ================================ Incidents ================================ */

export const SEVERITY_ORDER: Record<IncidentSeverity, number> = { critical: 0, serious: 1, moderate: 2, minor: 3 };
export const SEVERITY_LABEL: Record<IncidentSeverity, string> = { critical: 'Critical', serious: 'Serious', moderate: 'Moderate', minor: 'Minor' };
export const STATUS_FLOW: IncidentStatus[] = ['open', 'in_progress', 'awaiting_ground', 'resolved'];
export const STATUS_LABEL: Record<IncidentStatus, string> = { open: 'Open', in_progress: 'In progress', awaiting_ground: 'Awaiting ground', resolved: 'Resolved' };
export const CATEGORY_LABEL: Record<Incident['category'], string> = {
  injury: 'Injury',
  illness: 'Illness',
  environmental: 'Environmental',
  equipment: 'Equipment',
  behavioral: 'Behavioural',
  other: 'Other',
};

export const isOpen = (i: Pick<Incident, 'status'>) => i.status !== 'resolved';

/** Unresolved first, then most severe, then most recently updated. */
export function sortIncidents(list: Incident[]): Incident[] {
  return [...list].sort((a, b) => Number(isOpen(b)) - Number(isOpen(a)) || SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity] || b.updatedAt.localeCompare(a.updatedAt));
}

export function filterIncidents(list: Incident[], opts: { status?: 'open' | 'resolved' | 'all'; severity?: IncidentSeverity | 'all' }): Incident[] {
  return sortIncidents(
    list.filter((i) => {
      if (opts.status === 'open' && !isOpen(i)) return false;
      if (opts.status === 'resolved' && isOpen(i)) return false;
      if (opts.severity && opts.severity !== 'all' && i.severity !== opts.severity) return false;
      return true;
    }),
  );
}

/* ================================== Vitals ================================= */

/** Vitals captured in an incident snapshot / emergency summary. */
export const SNAPSHOT_TYPES: VitalType[] = ['heart_rate', 'spo2', 'blood_pressure', 'temperature', 'respiratory_rate'];

/** Display value with unit, canonical (metric) units — e.g. "104 bpm", "118/76 mmHg". */
export function formatVital(m: Pick<Measurement, 'type' | 'value' | 'value2'>): string {
  const meta = VITAL_META[m.type];
  if (m.type === 'blood_pressure') return `${Math.round(m.value)}/${Math.round(m.value2 ?? 0)} ${meta.unit}`;
  return `${m.value.toFixed(meta.decimals)} ${meta.unit}`;
}

/** Latest quality-passing reading for each requested vital (missing types are omitted). */
export function latestVitals(measurements: Measurement[], types: VitalType[] = SNAPSHOT_TYPES): Measurement[] {
  const out: Measurement[] = [];
  for (const type of types) {
    let best: Measurement | undefined;
    for (const m of measurements) {
      if (m.type !== type || m.qualityFlag) continue;
      if (!best || m.takenAt > best.takenAt) best = m;
    }
    if (best) out.push(best);
  }
  return out;
}

/** Snapshot stored on an incident at report time. */
export function vitalsSnapshot(measurements: Measurement[]): Incident['vitalsSnapshot'] {
  return latestVitals(measurements).map((m) => ({ type: m.type, value: formatVital(m), at: m.takenAt }));
}

/* ============================ Protocol checklists =========================== */

const TICK = '✓';
const UNTICK = '↺';

/** Timeline text recorded when a protocol step is ticked. */
export const stepDoneText = (p: Protocol, index: number) => `${TICK} ${citation(p)} · step ${index + 1}: ${p.steps[index]?.text ?? ''}`.trim();
/** Timeline text recorded when a ticked step is unticked. */
export const stepUndoneText = (p: Protocol, index: number) => `${UNTICK} ${citation(p)} · step ${index + 1} unchecked`;

/**
 * Reconstructs which steps of a protocol are completed from an incident's
 * timeline (ticks and unticks are logged as notes, so they persist and sync).
 */
export function completedSteps(timeline: Incident['timeline'], p: Protocol): Set<number> {
  const done = new Set<number>();
  const re = new RegExp(`^([${TICK}${UNTICK}]) ${p.id.replace(/[-]/g, '\\-')} v\\S+ · step (\\d+)`);
  for (const e of timeline) {
    const m = re.exec(e.text);
    if (!m) continue;
    const idx = Number(m[2]) - 1;
    if (m[1] === TICK) done.add(idx);
    else done.delete(idx);
  }
  return done;
}

/** Protocols linked to an incident, resolved against the knowledge base (unknown ids dropped). */
export const linkedProtocols = (ids: string[]): Protocol[] => ids.map(findProtocol).filter((p): p is Protocol => !!p);

/** Union of equipment across protocols, de-duplicated, in first-seen order. */
export function protocolEquipment(ids: string[]): { item: string; protocols: string[] }[] {
  const map = new Map<string, string[]>();
  for (const p of linkedProtocols(ids)) for (const e of p.equipment) map.set(e, [...(map.get(e) ?? []), p.id]);
  return [...map.entries()].map(([item, protocols]) => ({ item, protocols }));
}

/* ================================== Comms ================================== */

export const FLIGHT_SURGEON = 'Flight surgeon (demo)';
/** One-way delay above which the mission is treated as deep-space (no real-time conversation). */
export const DEEP_SPACE_DELAY_SEC = 5;

export function formatDelay(sec: number): string {
  if (sec < 1) return `${Math.round(sec * 1000)} ms`;
  if (sec < 60) return `${Number(sec.toFixed(1))} s`;
  if (sec < 3600) return `${Math.round(sec / 60)} min`;
  const h = Math.floor(sec / 3600);
  const m = Math.round((sec % 3600) / 60);
  return m ? `${h} h ${m} min` : `${h} h`;
}

export function commTiming(mission: Pick<Mission, 'commDelaySec'>) {
  const oneWay = Math.max(0, mission.commDelaySec);
  return { oneWaySec: oneWay, roundTripSec: oneWay * 2, deepSpace: oneWay >= DEEP_SPACE_DELAY_SEC, oneWay: formatDelay(oneWay), roundTrip: formatDelay(oneWay * 2) };
}

/** Earliest a reply can arrive (send time + round-trip light time). */
export function earliestReplyAt(sentAt: string, mission: Pick<Mission, 'commDelaySec'>): string {
  return new Date(new Date(sentAt).getTime() + mission.commDelaySec * 2000).toISOString();
}

export const DELIVERY_STEPS: CrewMessage['delivery'][] = ['queued', 'sent', 'delivered'];
export const DELIVERY_LABEL: Record<CrewMessage['delivery'], string> = { queued: 'Queued on board', sent: 'Sent to ground', delivered: 'Delivered', failed: 'Failed' };

export function sortThread(messages: CrewMessage[], incidentId?: string): CrewMessage[] {
  return messages.filter((m) => !incidentId || m.incidentId === incidentId).sort((a, b) => a.at.localeCompare(b.at));
}

export function priorityMessageBody(opts: { callsign?: string; name: string; vitals: Incident['vitalsSnapshot']; incidentId?: string }): string {
  const who = opts.callsign ? `${opts.callsign} (${opts.name})` : opts.name;
  const v = opts.vitals.length ? ` Latest vitals: ${opts.vitals.map((x) => `${VITAL_META[x.type].shortLabel} ${x.value}`).join(', ')}.` : ' No recent vitals on board.';
  return `PRIORITY MEDICAL — emergency in progress for ${who}.${v}${opts.incidentId ? ` Incident ${opts.incidentId} opened in CosmicPulse.` : ''} Request flight surgeon support.`;
}

export const CONFERENCE_REQUEST = 'Requesting a private medical conference at the next available communication pass.';

/* ============================== Authorisation ============================== */

export type AuthKind = 'flight_surgeon' | 'cmo_protocol' | 'preapproved' | 'other';

export const AUTH_OPTIONS: { value: AuthKind; label: string }[] = [
  { value: 'flight_surgeon', label: 'Flight surgeon (ground instruction)' },
  { value: 'cmo_protocol', label: 'Crew medical officer per protocol' },
  { value: 'preapproved', label: 'Pre-approved crew medical plan' },
  { value: 'other', label: 'Other (specify)' },
];

/** Human-readable `authorisedBy` text. Returns '' when incomplete. */
export function authorisedByText(kind: AuthKind, opts: { protocolId?: string; other?: string }): string {
  switch (kind) {
    case 'flight_surgeon':
      return 'Flight surgeon (ground instruction)';
    case 'preapproved':
      return 'Pre-approved crew medical plan';
    case 'cmo_protocol': {
      const p = opts.protocolId ? findProtocol(opts.protocolId) : undefined;
      return p ? `Crew medical officer per protocol ${citation(p)}` : '';
    }
    default:
      return (opts.other ?? '').trim();
  }
}

/* ============================ Identity / summary ============================ */

export function bloodTypeFor(crew: Astronaut[], astronautId: string, records: MedicalRecord[]): string | undefined {
  const fromCrew = crew.find((c) => c.id === astronautId)?.bloodType;
  if (fromCrew) return fromCrew;
  const rec = records.find((r) => /^blood type\s+/i.test(r.title));
  return rec?.title.replace(/^blood type\s+/i, '').trim() || undefined;
}
