/* Copied verbatim from the CosmicPulse mobile app (src/engine/autonomy.ts) by scripts/sync-mobile-core.mjs.
 * Edit the mobile original and re-run `npm run sync:mobile`; do not edit this copy. */
import type { AutonomyLevel, HealthAlert, Insight, Severity } from '@/data/types';

/**
 * CosmicPulse Autonomous Operations — alert reconciliation.
 *
 * Turns the current set of findings into alert state changes. Deterministic
 * and idempotent: running it twice on the same inputs produces no changes the
 * second time, so it is safe to run on every data change and after a restart.
 *
 * - One open alert per fingerprint (the finding id) — no duplicates.
 * - An open alert whose condition is no longer detected is resolved by the engine.
 * - A resolved alert whose condition returns opens a new alert (new id, same fingerprint).
 * - Autonomy level gates behaviour (1: none, 2–3: alerts, 4: + auto-escalation).
 */

const ALERTABLE: Severity[] = ['low', 'moderate', 'high', 'critical'];
const ESCALATE: Severity[] = ['high', 'critical'];

export type AlertChange =
  | { type: 'create'; alert: HealthAlert }
  | { type: 'update'; alert: HealthAlert }
  | { type: 'escalate'; alert: HealthAlert };

export function reconcileAlerts(findings: Insight[], existing: HealthAlert[], level: AutonomyLevel, nowIso: string, newId: () => string): AlertChange[] {
  if (level < 2) return [];
  const changes: AlertChange[] = [];
  const open = new Map(existing.filter((a) => a.state !== 'resolved').map((a) => [a.fingerprint, a]));
  const current = new Map(findings.filter((f) => ALERTABLE.includes(f.severity) && f.status !== 'dismissed').map((f) => [f.id, f]));

  for (const [fp, f] of current) {
    const a = open.get(fp);
    if (!a) {
      const alert: HealthAlert = {
        id: newId(),
        fingerprint: fp,
        insightId: f.id,
        kind: f.kind,
        severity: f.severity,
        title: f.title,
        state: 'active',
        createdAt: nowIso,
        updatedAt: nowIso,
        history: [{ at: nowIso, state: 'active', by: 'cosmicpulse-engine' }],
        ...(f.simulated ? { simulated: true } : {}),
      };
      changes.push({ type: 'create', alert });
      // Simulated findings are never escalated to a real flight surgeon.
      if (level >= 4 && ESCALATE.includes(f.severity) && !f.simulated) {
        changes.push({ type: 'escalate', alert: escalate(alert, nowIso) });
      }
    } else if (a.severity !== f.severity || a.title !== f.title || !!a.simulated !== !!f.simulated) {
      // Severity changed for the same condition: update in place (and escalate if it became high).
      const updated: HealthAlert = {
        ...a,
        severity: f.severity,
        title: f.title,
        simulated: f.simulated || undefined,
        updatedAt: nowIso,
        history: [...a.history, { at: nowIso, state: a.state, by: 'cosmicpulse-engine', note: `Severity ${a.severity} → ${f.severity}` }],
      };
      changes.push({ type: 'update', alert: updated });
      if (level >= 4 && ESCALATE.includes(f.severity) && a.state !== 'escalated' && !f.simulated) changes.push({ type: 'escalate', alert: escalate(updated, nowIso) });
    }
  }
  for (const [fp, a] of open) {
    if (!current.has(fp) && a.state === 'active') {
      changes.push({
        type: 'update',
        alert: { ...a, state: 'resolved', updatedAt: nowIso, history: [...a.history, { at: nowIso, state: 'resolved', by: 'cosmicpulse-engine', note: 'Condition no longer detected' }] },
      });
    }
  }
  return changes;
}

function escalate(a: HealthAlert, nowIso: string): HealthAlert {
  return {
    ...a,
    state: 'escalated',
    escalation: 'flight_surgeon',
    updatedAt: nowIso,
    history: [...a.history, { at: nowIso, state: 'escalated', by: 'cosmicpulse-engine', note: 'Auto-escalated to flight surgeon (autonomy level 4)' }],
  };
}

/** Apply changes to an alert list (pure). Later changes for the same id win. */
export function applyAlertChanges(alerts: HealthAlert[], changes: AlertChange[]): HealthAlert[] {
  const byId = new Map(alerts.map((a) => [a.id, a]));
  for (const c of changes) byId.set(c.alert.id, c.alert);
  return [...byId.values()].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}
