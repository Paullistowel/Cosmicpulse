import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { uid } from '@/data/demo/random';
import { buildPool, mergeDemo, poolIsStale, sameRecords, type DemoPool } from '@/data/demo/pool';
import { DEFAULT_SCENARIO, buildScenario, type Dataset, type ScenarioId } from '@/data/demo/scenarios';
import type { AlertChange } from '@/engine/autonomy';
import type { PullChange } from '@/shared/contract';
import { enqueue } from '@/services/sync';
import type { ConfinementCheckin } from '@/intel/checkins';
import { scoreCheckin } from '@/intel/checkins';
import type {
  Administration,
  AlertState,
  AutonomyLevel,
  CrewMessage,
  HealthAlert,
  Incident,
  IncidentStatus,
  AppNotification,
  Appointment,
  ChatMessage,
  Conversation,
  Device,
  DeviceCategory,
  DoseLog,
  DoseStatus,
  GeneratedReport,
  JournalEntry,
  LabResult,
  Measurement,
  MedicalRecord,
  Medication,
  MoodEntry,
  ReviewStatus,
  ScreeningResult,
  UserProfile,
} from '@/data/types';
import { VITAL_META } from '@/data/vitals';
import { useSettings } from './settings';
import { vaultStorage } from './vault';

/**
 * Adapted from the CosmicPulse mobile app (src/store/health.ts): same actions,
 * same REAL / DEMO / MIXED merge semantics. Web changes: encrypted IndexedDB
 * vault storage, web sync outbox, confinement check-ins, manual sleep entry.
 *
 * Local data store. In demo mode this IS the data source; in live mode it acts as
 * the offline cache that repositories hydrate from the API. Screens never mutate
 * state directly — they call these actions (or repository functions that do).
 */
type HealthState = Dataset & {
  insightStatus: Record<string, ReviewStatus>;
  autonomy: AutonomyLevel;
  conversations: Conversation[];
  reports: GeneratedReport[];
  checkins: ConfinementCheckin[];
  hydratedAt?: string;

  /** Persisted simulated dataset used to fill metrics that have no real data. */
  demoPool?: DemoPool;
  loadScenario: (id: ScenarioId) => void;
  /**
   * Re-applies the demo fallback: simulated series only for metrics without
   * real readings. Call after any data or setting change. Idempotent.
   */
  reconcileDemo: (opts?: { regenerate?: boolean }) => void;
  updateProfile: (p: Partial<UserProfile>) => void;

  addMeasurement: (m: Omit<Measurement, 'id'>) => Measurement;
  /** Insert-or-replace by id (platform sync). Returns how many were new. */
  upsertMeasurements: (list: Measurement[]) => number;
  /** Removes synthetic readings and simulated devices (used once real device data is connected). */
  removeSimulated: () => number;
  deleteMeasurement: (id: string) => void;

  setInsightStatus: (id: string, status: ReviewStatus) => void;

  addLabResults: (labs: Omit<LabResult, 'id'>[], record?: Omit<MedicalRecord, 'id'>) => void;
  addRecord: (r: Omit<MedicalRecord, 'id'>) => MedicalRecord;
  deleteRecord: (id: string) => void;

  addMedication: (m: Omit<Medication, 'id'>) => Medication;
  updateMedication: (id: string, patch: Partial<Medication>) => void;
  removeMedication: (id: string) => void;
  logDose: (doseId: string, status: DoseStatus) => void;
  logAsNeeded: (medicationId: string) => void;

  addMood: (m: Omit<MoodEntry, 'id' | 'at'>) => void;
  addJournal: (j: Omit<JournalEntry, 'id' | 'at'>) => void;
  updateJournal: (id: string, patch: Partial<JournalEntry>) => void;
  deleteJournal: (id: string) => void;
  deleteAllJournal: () => void;
  addScreening: (s: Omit<ScreeningResult, 'id' | 'at'>) => ScreeningResult;
  addCheckin: (answers: Record<string, number>, note?: string) => ConfinementCheckin;
  deleteCheckin: (id: string) => void;
  deleteMood: (id: string) => void;
  /** Manual sleep entry: stores a sleep record and the matching `sleep` measurement. */
  addSleep: (r: { night: string; hours: number; quality: number; disruptions: number; note?: string }) => void;

  pairDevice: (category: DeviceCategory, name: string) => Device;
  setDeviceState: (id: string, state: Device['state']) => void;
  syncDevice: (id: string) => Promise<{ ok: boolean; records: number; message?: string }>;
  removeDevice: (id: string) => void;

  requestAppointment: (a: Omit<Appointment, 'id' | 'status' | 'followUps'>) => Appointment;
  cancelAppointment: (id: string) => void;
  toggleFollowUp: (appointmentId: string, item: string) => void;

  markNotificationRead: (id: string) => void;
  markAllNotificationsRead: () => void;
  pushNotification: (n: Omit<AppNotification, 'id' | 'at' | 'read'>) => void;

  togglePreventive: (id: string) => void;

  upsertConversation: (c: Conversation) => void;
  appendMessage: (conversationId: string, m: ChatMessage) => void;
  deleteConversation: (id: string) => void;
  clearConversations: (channel?: Conversation['channel']) => void;

  addReport: (r: Omit<GeneratedReport, 'id' | 'createdAt'>) => GeneratedReport;

  /* Mission & medical */
  setAutonomy: (l: AutonomyLevel) => void;
  applyAlertChanges: (changes: AlertChange[]) => void;
  transitionAlert: (id: string, to: AlertState, by: string, note?: string) => void;
  reportIncident: (i: Omit<Incident, 'id' | 'openedAt' | 'updatedAt' | 'timeline' | 'status'> & { status?: IncidentStatus }) => Incident;
  addIncidentEntry: (id: string, text: string, by: string, kind?: 'note' | 'instruction') => void;
  setIncidentStatus: (id: string, status: IncidentStatus, by: string) => void;
  sendCrewMessage: (body: string, to: string, incidentId?: string) => CrewMessage;
  recordAdministration: (a: Omit<Administration, 'id' | 'at'>) => { ok: boolean; error?: string };
  applyInbound: (c: PullChange) => void;

  wipe: () => void;
};

const nowIso = () => new Date().toISOString();

const isSynthetic = (src: { kind: string }) => src.kind === 'simulated' || src.kind === 'demo';

/**
 * Removes every synthetic reading (vitals, sleep, exercise, cabin environment),
 * simulated devices and the alerts/notifications derived from them. Real data
 * (synced, manual, clinician, imported) is untouched.
 */
export function stripSimulated(s: Pick<Dataset, 'measurements' | 'environment' | 'sleepRecords' | 'exercise' | 'devices' | 'alerts' | 'notifications'>) {
  return {
    measurements: s.measurements.filter((m) => !isSynthetic(m.source)),
    environment: s.environment.filter((e) => !isSynthetic(e.source)),
    sleepRecords: s.sleepRecords.filter((r) => !isSynthetic(r.source)),
    exercise: s.exercise.filter((x) => !isSynthetic(x.source)),
    devices: s.devices.filter((d) => !d.simulated),
    // Alerts are re-derived by the engine from what remains.
    alerts: [] as HealthAlert[],
    notifications: s.notifications.filter((n) => n.category !== 'insight' && n.category !== 'measurement'),
  };
}

function fresh(id: ScenarioId) {
  const d = buildScenario(id);
  const st = useSettings.getState();
  const demoPool = buildPool(id, st.demoCondition ?? 'none');
  // Scenario supplies mission context; health readings come only through the demo merge.
  const data = { ...d, ...stripSimulated(d), ...mergeDemo({ measurements: [], environment: [], sleepRecords: [], exercise: [], devices: [] }, demoPool, st.demoFallback) };
  return {
    ...data,
    demoPool,
    insightStatus: {},
    autonomy: 3 as AutonomyLevel,
    conversations: [],
    reports: [],
    checkins: [],
    hydratedAt: nowIso(),
  };
}

/**
 * Rebuilds today's still-pending dose slots for a medication from its schedule.
 * Settled doses (taken/skipped/missed/snoozed) are kept; as-needed and weekly
 * medications get no automatic daily slots.
 */
export function syncTodayDoses(med: Medication, logs: DoseLog[]): DoseLog[] {
  const today = new Date().toDateString();
  const isToday = (d: DoseLog) => d.medicationId === med.id && new Date(d.scheduledFor).toDateString() === today;
  const kept = logs.filter((d) => !(isToday(d) && d.status === 'pending'));
  if (!med.active || med.schedule.frequency === 'as_needed' || med.schedule.frequency === 'weekly') return kept;
  const settled = new Set(kept.filter(isToday).map((d) => new Date(d.scheduledFor).toTimeString().slice(0, 5)));
  const fresh: DoseLog[] = med.schedule.times
    .filter((t) => !settled.has(t))
    .map((t) => {
      const [h, m] = t.split(':').map(Number);
      const at = new Date();
      at.setHours(h, m, 0, 0);
      return { id: `dose-${med.id}-${at.toISOString().slice(0, 10)}-${t}`, medicationId: med.id, scheduledFor: at.toISOString(), status: 'pending' as const };
    });
  return [...kept, ...fresh];
}

export const DEVICE_MEASURES: Record<DeviceCategory, Device['measures']> = {
  smartwatch: ['heart_rate', 'spo2', 'sleep', 'steps'],
  heart_rate_monitor: ['heart_rate'],
  bp_monitor: ['blood_pressure', 'heart_rate'],
  pulse_oximeter: ['spo2', 'heart_rate'],
  thermometer: ['temperature'],
  ecg: ['ecg', 'heart_rate'],
  cgm: ['glucose'],
  scale: ['weight'],
};

export const useHealth = create<HealthState>()(
  persist(
    (set, get) => ({
      ...fresh(DEFAULT_SCENARIO),

      // Switching scenario replaces demo/mission context but never discards real readings.
      loadScenario: (id) => {
        const keep = get();
        const f = fresh(id);
        set({ ...f, ...mergeDemo(keep, f.demoPool, useSettings.getState().demoFallback) });
      },
      reconcileDemo: (opts = {}) => {
        const st = useSettings.getState();
        const s0 = get();
        let pool = s0.demoPool;
        let regenerated = false;
        if (st.demoFallback && (opts.regenerate || poolIsStale(pool, s0.scenario, st.demoCondition ?? 'none'))) {
          pool = buildPool(s0.scenario, st.demoCondition ?? 'none');
          regenerated = true;
        }
        const merged = mergeDemo(s0, pool, st.demoFallback);
        const changed =
          regenerated ||
          !sameRecords(s0.measurements, merged.measurements) ||
          !sameRecords(s0.sleepRecords, merged.sleepRecords) ||
          !sameRecords(s0.environment, merged.environment) ||
          !sameRecords(s0.devices, merged.devices) ||
          !sameRecords(s0.exercise, merged.exercise);
        if (!changed) return;
        const now = nowIso();
        set({
          ...merged,
          demoPool: pool,
          // Demo data replaced: close open alerts that came from the old simulated data.
          alerts: regenerated || !st.demoFallback ? s0.alerts.map((a) => (a.simulated && a.state !== 'resolved' ? { ...a, state: 'resolved' as const, updatedAt: now, history: [...a.history, { at: now, state: 'resolved' as const, by: 'cosmicpulse-engine', note: 'Simulated data reset' }] } : a)) : s0.alerts,
        });
      },
      updateProfile: (p) => set((s) => ({ profile: { ...s.profile, ...p } })),

      upsertMeasurements: (list) => {
        if (!list.length) return 0;
        const existing = new Set(get().measurements.map((m) => m.id));
        const fresh = list.filter((m) => !existing.has(m.id));
        const byId = new Map(list.map((m) => [m.id, m]));
        set((s) => ({ measurements: [...s.measurements.map((m) => byId.get(m.id) ?? m), ...fresh] }));
        // Only genuinely new readings go to the ground outbox (bounded per sync).
        for (const m of fresh.slice(-500)) enqueue('measurement', 'upsert', m.id, m);
        // Real readings for a metric displace its simulated series (never the reverse).
        get().reconcileDemo();
        return fresh.length;
      },
      removeSimulated: () => {
        const before = get().measurements.length;
        set((s) => stripSimulated(s));
        return before - get().measurements.length;
      },

      addMeasurement: (m) => {
        const created = { ...m, id: uid('m') };
        set((s) => ({ measurements: [...s.measurements, created] }));
        enqueue('measurement', 'upsert', created.id, created);
        get().reconcileDemo();
        return created;
      },
      deleteMeasurement: (id) => {
        set((s) => ({ measurements: s.measurements.filter((m) => m.id !== id) }));
        enqueue('measurement', 'delete', id, null);
        get().reconcileDemo();
      },

      setInsightStatus: (id, status) => set((s) => ({ insightStatus: { ...s.insightStatus, [id]: status } })),

      addLabResults: (labs, record) =>
        set((s) => ({
          labs: [...s.labs, ...labs.map((l) => ({ ...l, id: uid('lab') }))],
          records: record ? [{ ...record, id: uid('rec') }, ...s.records] : s.records,
        })),
      addRecord: (r) => {
        const rec = { ...r, id: uid('rec') };
        set((s) => ({ records: [rec, ...s.records] }));
        enqueue('record', 'upsert', rec.id, rec);
        return rec;
      },
      deleteRecord: (id) => set((s) => ({ records: s.records.filter((r) => r.id !== id) })),

      addMedication: (m) => {
        const created = { ...m, id: uid('med') };
        set((s) => ({ medications: [...s.medications, created], doseLogs: syncTodayDoses(created, s.doseLogs) }));
        return created;
      },
      updateMedication: (id, patch) =>
        set((s) => {
          const medications = s.medications.map((m) => (m.id === id ? { ...m, ...patch } : m));
          const updated = medications.find((m) => m.id === id);
          return { medications, doseLogs: updated && patch.schedule ? syncTodayDoses(updated, s.doseLogs) : s.doseLogs };
        }),
      removeMedication: (id) =>
        set((s) => ({
          medications: s.medications.map((m) => (m.id === id ? { ...m, active: false } : m)),
          doseLogs: s.doseLogs.filter((d) => !(d.medicationId === id && d.status === 'pending')),
        })),
      logDose: (doseId, status) =>
        set((s) => {
          const dose = s.doseLogs.find((d) => d.id === doseId);
          const decrement = status === 'taken' && dose?.status !== 'taken';
          // Undoing a 'taken' dose returns the tablet to the supply count.
          const increment = status !== 'taken' && dose?.status === 'taken';
          return {
            doseLogs: s.doseLogs.map((d) => (d.id === doseId ? { ...d, status, recordedAt: nowIso() } : d)),
            medications:
              decrement || increment
                ? s.medications.map((m) =>
                    m.id === dose?.medicationId && m.supplyRemaining !== undefined
                      ? { ...m, supplyRemaining: Math.max(0, m.supplyRemaining + (decrement ? -1 : 1)) }
                      : m,
                  )
                : s.medications,
          };
        }),
      logAsNeeded: (medicationId) =>
        set((s) => ({
          doseLogs: [...s.doseLogs, { id: uid('dose'), medicationId, scheduledFor: nowIso(), status: 'taken', recordedAt: nowIso() } as DoseLog],
        })),

      addMood: (m) => set((s) => ({ moods: [...s.moods, { ...m, id: uid('mood'), at: nowIso() }] })),
      addJournal: (j) => set((s) => ({ journal: [{ ...j, id: uid('j'), at: nowIso() }, ...s.journal] })),
      updateJournal: (id, patch) => set((s) => ({ journal: s.journal.map((j) => (j.id === id ? { ...j, ...patch } : j)) })),
      deleteJournal: (id) => set((s) => ({ journal: s.journal.filter((j) => j.id !== id) })),
      deleteAllJournal: () => set({ journal: [] }),
      addCheckin: (answers, note) => {
        const { score, lowest } = scoreCheckin(answers);
        const created: ConfinementCheckin = { id: uid('chk'), at: nowIso(), answers, score, lowest, note };
        set((s) => ({ checkins: [...s.checkins, created] }));
        return created;
      },
      deleteCheckin: (id) => set((s) => ({ checkins: s.checkins.filter((c) => c.id !== id) })),
      deleteMood: (id) => set((s) => ({ moods: s.moods.filter((m) => m.id !== id) })),
      addSleep: (r) => {
        const source = { kind: 'manual' as const };
        const rec = { id: uid('slp'), night: r.night, hours: r.hours, quality: r.quality, disruptions: r.disruptions, medicationAssisted: false, source };
        const m: Measurement = { id: uid('m'), type: 'sleep', value: r.hours, unit: 'h', takenAt: r.night, source, note: r.note, provider: 'manual' };
        set((s) => ({ sleepRecords: [...s.sleepRecords, rec], measurements: [...s.measurements, m] }));
        enqueue('measurement', 'upsert', m.id, m);
        get().reconcileDemo();
      },
      addScreening: (r) => {
        const created = { ...r, id: uid('scr'), at: nowIso() };
        set((s) => ({ screenings: [...s.screenings, created] }));
        return created;
      },

      pairDevice: (category, name) => {
        const d: Device = {
          id: uid('dev'),
          name: `${name} (simulated)`,
          manufacturer: 'Demo Devices',
          category,
          state: 'connected',
          simulated: true,
          lastSyncAt: nowIso(),
          battery: 100,
          measures: DEVICE_MEASURES[category],
          syncHistory: [{ at: nowIso(), records: 0, ok: true, message: 'Paired' }],
        };
        set((s) => ({ devices: [...s.devices, d] }));
        return d;
      },
      setDeviceState: (id, state) =>
        set((s) => ({
          devices: s.devices.map((d) =>
            d.id === id ? { ...d, state, errorMessage: state === 'error' ? 'Simulated connection failure.' : undefined } : d,
          ),
        })),
      syncDevice: async (id) => {
        const device = get().devices.find((d) => d.id === id);
        if (!device) return { ok: false, records: 0, message: 'Device not found' };
        set((s) => ({ devices: s.devices.map((d) => (d.id === id ? { ...d, state: 'syncing' } : d)) }));
        await new Promise((r) => setTimeout(r, 1400));
        const failing = device.state === 'error' || device.state === 'disconnected' || (device.battery ?? 100) < 10;
        if (failing) {
          const message = (device.battery ?? 100) < 10 ? 'Battery too low to sync' : 'Device not reachable';
          set((s) => ({
            devices: s.devices.map((d) =>
              d.id === id
                ? { ...d, state: 'error', errorMessage: message, syncHistory: [{ at: nowIso(), records: 0, ok: false, message }, ...d.syncHistory] }
                : d,
            ),
          }));
          return { ok: false, records: 0, message };
        }
        // Simulated device emits one plausible reading per measure, labelled as synced from a simulated device.
        const source = { kind: 'synced' as const, deviceId: device.id, deviceName: device.name };
        const created: Measurement[] = device.measures
          .filter((t) => t !== 'ecg')
          .map((type) => {
            const sample: Record<string, [number, number?]> = {
              heart_rate: [64 + Math.round(Math.random() * 10)],
              blood_pressure: [118 + Math.round(Math.random() * 12), 74 + Math.round(Math.random() * 8)],
              spo2: [96 + Math.round(Math.random() * 3)],
              sleep: [Math.round((6.5 + Math.random() * 1.5) * 10) / 10],
              steps: [Math.round(4000 + Math.random() * 5000)],
              temperature: [Math.round((36.5 + Math.random() * 0.5) * 10) / 10],
              glucose: [95 + Math.round(Math.random() * 30)],
              weight: [get().profile.weightKg ?? 70],
            };
            const [value, value2] = sample[type] ?? [0];
            return {
              id: uid('m'),
              type,
              value,
              value2,
              unit: VITAL_META[type].unit,
              takenAt: nowIso(),
              source,
            } as Measurement;
          });
        set((s) => ({
          measurements: [...s.measurements, ...created],
          devices: s.devices.map((d) =>
            d.id === id
              ? { ...d, state: 'connected', lastSyncAt: nowIso(), errorMessage: undefined, syncHistory: [{ at: nowIso(), records: created.length, ok: true }, ...d.syncHistory] }
              : d,
          ),
        }));
        return { ok: true, records: created.length };
      },
      removeDevice: (id) => set((s) => ({ devices: s.devices.filter((d) => d.id !== id) })),

      requestAppointment: (a) => {
        const created: Appointment = { ...a, id: uid('apt'), status: 'requested', followUps: [] };
        set((s) => ({ appointments: [...s.appointments, created] }));
        return created;
      },
      cancelAppointment: (id) =>
        set((s) => ({ appointments: s.appointments.map((a) => (a.id === id ? { ...a, status: 'cancelled' } : a)) })),

      toggleFollowUp: (appointmentId, item) =>
        set((s) => ({
          appointments: s.appointments.map((a) => {
            if (a.id !== appointmentId) return a;
            const done = a.followUpsDone ?? [];
            return { ...a, followUpsDone: done.includes(item) ? done.filter((x) => x !== item) : [...done, item] };
          }),
        })),

      markNotificationRead: (id) =>
        set((s) => ({ notifications: s.notifications.map((n) => (n.id === id ? { ...n, read: true } : n)) })),
      markAllNotificationsRead: () => set((s) => ({ notifications: s.notifications.map((n) => ({ ...n, read: true })) })),
      pushNotification: (n) =>
        set((s) => ({ notifications: [{ ...n, id: uid('n'), at: nowIso(), read: false }, ...s.notifications] })),

      togglePreventive: (id) =>
        set((s) => ({
          prevention: s.prevention.map((p) => (p.id === id ? { ...p, completedAt: p.completedAt ? undefined : nowIso() } : p)),
        })),

      upsertConversation: (c) =>
        set((s) => ({ conversations: [c, ...s.conversations.filter((x) => x.id !== c.id)] })),
      appendMessage: (conversationId, m) =>
        set((s) => ({
          conversations: s.conversations.map((c) =>
            c.id === conversationId ? { ...c, messages: [...c.messages, m], updatedAt: m.at } : c,
          ),
        })),
      deleteConversation: (id) => set((s) => ({ conversations: s.conversations.filter((c) => c.id !== id) })),
      clearConversations: (channel) =>
        set((s) => ({ conversations: channel ? s.conversations.filter((c) => c.channel !== channel) : [] })),

      addReport: (r) => {
        const created = { ...r, id: uid('rep'), createdAt: nowIso() };
        set((s) => ({ reports: [created, ...s.reports] }));
        return created;
      },

      setAutonomy: (l) => set({ autonomy: l }),

      applyAlertChanges: (changes) => {
        if (!changes.length) return;
        set((s) => {
          const byId = new Map(s.alerts.map((a) => [a.id, a]));
          for (const c of changes) byId.set(c.alert.id, c.alert);
          return { alerts: [...byId.values()].sort((a, b) => b.createdAt.localeCompare(a.createdAt)) };
        });
        const latest = new Map(changes.map((c) => [c.alert.id, c.alert]));
        latest.forEach((a) => enqueue('alert', 'upsert', a.id, a));
      },

      transitionAlert: (id, to, by, note) => {
        const at = nowIso();
        let updated: HealthAlert | undefined;
        set((s) => ({
          alerts: s.alerts.map((a) => {
            if (a.id !== id) return a;
            updated = { ...a, state: to, updatedAt: at, escalation: to === 'escalated' ? 'flight_surgeon' : a.escalation, history: [...a.history, { at, state: to, by, note }] };
            return updated;
          }),
        }));
        if (updated) enqueue('alert', 'upsert', id, updated);
      },

      reportIncident: (i) => {
        const at = nowIso();
        const inc: Incident = { ...i, id: uid('inc'), status: i.status ?? 'open', openedAt: at, updatedAt: at, timeline: [{ at, by: i.reportedBy, text: 'Incident opened.', kind: 'status' }] };
        set((s) => ({ incidents: [inc, ...s.incidents] }));
        enqueue('incident', 'upsert', inc.id, inc);
        return inc;
      },

      addIncidentEntry: (id, text, by, kind = 'note') => {
        const at = nowIso();
        let updated: Incident | undefined;
        set((s) => ({
          incidents: s.incidents.map((x) => (x.id === id ? (updated = { ...x, updatedAt: at, timeline: [...x.timeline, { at, by, text, kind }] }) : x)),
        }));
        if (updated) enqueue('incident', 'upsert', id, updated);
      },

      setIncidentStatus: (id, status, by) => {
        const at = nowIso();
        let updated: Incident | undefined;
        set((s) => ({
          incidents: s.incidents.map((x) =>
            x.id === id ? (updated = { ...x, status, updatedAt: at, timeline: [...x.timeline, { at, by, text: `Status → ${status.replace('_', ' ')}`, kind: 'status' }] }) : x,
          ),
        }));
        if (updated) enqueue('incident', 'upsert', id, updated);
      },

      sendCrewMessage: (body, to, incidentId) => {
        const me = get().profile.name;
        const m: CrewMessage = { id: uid('msg'), from: me, to, body, at: nowIso(), direction: 'outbound', delivery: 'queued', incidentId };
        set((s) => ({ messages: [...s.messages, m] }));
        enqueue('message', 'upsert', m.id, m);
        return m;
      },

      recordAdministration: (a) => {
        const item = get().inventory.find((i) => i.id === a.itemId);
        if (!item) return { ok: false, error: 'Item not found in inventory.' };
        if (a.quantity <= 0) return { ok: false, error: 'Quantity must be at least 1.' };
        if (a.quantity > item.quantity) return { ok: false, error: `Only ${item.quantity} in stock.` };
        if (!a.authorisedBy.trim()) return { ok: false, error: 'Record who authorised this administration.' };
        const adm: Administration = { ...a, id: uid('adm'), at: nowIso() };
        set((s) => ({
          administrations: [adm, ...s.administrations],
          inventory: s.inventory.map((i) => (i.id === a.itemId ? { ...i, quantity: i.quantity - a.quantity } : i)),
        }));
        enqueue('administration', 'upsert', adm.id, adm);
        return { ok: true };
      },

      /**
       * Apply a change from ground. Ground is authoritative for clinician-owned
       * data (instructions, alert state changes by the flight surgeon, records);
       * crew-generated data is append-only, so it never conflicts.
       */
      applyInbound: (c) => {
        const p = c.payload as Record<string, unknown> | null;
        set((s) => {
          switch (c.entity) {
            case 'message': {
              if (!p) return {};
              const m = p as unknown as CrewMessage;
              const exists = s.messages.some((x) => x.id === m.id);
              return { messages: exists ? s.messages.map((x) => (x.id === m.id ? { ...x, ...m } : x)) : [...s.messages, m] };
            }
            case 'alert': {
              if (!p) return {};
              const a = p as unknown as HealthAlert;
              const exists = s.alerts.some((x) => x.id === a.id);
              return { alerts: exists ? s.alerts.map((x) => (x.id === a.id ? a : x)) : [a, ...s.alerts] };
            }
            case 'incident': {
              if (!p) return {};
              const inc = p as unknown as Incident;
              const exists = s.incidents.some((x) => x.id === inc.id);
              return { incidents: exists ? s.incidents.map((x) => (x.id === inc.id ? inc : x)) : [inc, ...s.incidents] };
            }
            case 'record': {
              if (c.op === 'delete') return { records: s.records.filter((r) => r.id !== c.entityId) };
              const r = p as unknown as MedicalRecord;
              const exists = s.records.some((x) => x.id === r.id);
              return { records: exists ? s.records.map((x) => (x.id === r.id ? r : x)) : [r, ...s.records] };
            }
            default:
              return {};
          }
        });
      },

      wipe: () => set({ ...fresh(get().scenario), journal: [], conversations: [], reports: [], checkins: [] }),
    }),
    { name: 'cosmicpulse.health.v1', storage: createJSONStorage(() => vaultStorage), version: 1, partialize: (s) => s, skipHydration: true },
  ),
);
