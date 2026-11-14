/* Copied verbatim from the CosmicPulse mobile app (src/engine/index.ts) by scripts/sync-mobile-core.mjs.
 * Edit the mobile original and re-run `npm run sync:mobile`; do not edit this copy. */
import type { Insight, AutonomyLevel, EnvironmentReading, HealthAlert, Measurement, Mission, SleepRecord } from '@/data/types';
import { analyse } from './analysis';
import { applyAlertChanges, reconcileAlerts, type AlertChange } from './autonomy';
import { computeBaselines } from './baseline';
import { rulesFor } from './mission-rules';
import { assessRisk, readiness } from './risk';

export * from './analysis';
export * from './assistant';
export * from './autonomy';
export * from './baseline';
export * from './knowledge/protocols';
export * from './knowledge/retrieval';
export * from './mission-rules';
export * from './risk';

export type EngineInput = {
  mission: Mission;
  phaseStartedAt?: string;
  measurements: Measurement[];
  environment: EnvironmentReading[];
  sleep: SleepRecord[];
  alerts: HealthAlert[];
  autonomy: AutonomyLevel;
  now: number;
};

const synthetic = (k: string) => k === 'simulated' || k === 'demo';

/**
 * A finding is "simulated" when every record it rests on (last 7 days of the
 * metrics it names, or the sleep/environment records for those modules) is
 * simulated. Simulated findings never trigger real notifications or escalation.
 */
export function markSimulated(findings: Insight[], input: Pick<EngineInput, 'measurements' | 'environment' | 'sleep' | 'now'>): Insight[] {
  const week = (iso: string) => input.now - new Date(iso).getTime() < 7 * 86_400_000;
  return findings.map((f) => {
    const types = new Set<string>(f.contributing.map((c) => c.measurementType).filter(Boolean) as string[]);
    const fromId = f.id.match(/^(?:anomaly|rule|quality:stale):([a-z_0-9]+)/);
    if (fromId) types.add(fromId[1]);
    let records: { kind: string }[] = [];
    if (f.module === 'environment') records = input.environment.filter((e) => week(e.at)).map((e) => e.source);
    else if (f.module === 'recovery' && !types.size) records = input.sleep.filter((r) => week(r.night)).map((r) => r.source);
    else records = input.measurements.filter((m) => types.has(m.type) && week(m.takenAt)).map((m) => m.source);
    if (f.id.startsWith('quality:reading:')) {
      const m = input.measurements.find((x) => `quality:reading:${x.id}` === f.id);
      records = m ? [m.source] : [];
    }
    return { ...f, simulated: records.length > 0 && records.every((r) => synthetic(r.kind)) };
  });
}

/** One full engine pass. Pure; the store applies `alertChanges`. */
export function runEngine(input: EngineInput, newId: () => string) {
  const rules = rulesFor(input.mission.type);
  const baselines = computeBaselines(input.measurements, { mission: input.mission, phaseStartedAt: input.phaseStartedAt, now: input.now });
  const findings =
    input.autonomy >= 2
      ? markSimulated(analyse({ measurements: input.measurements, baselines, rules, now: input.now, environment: input.environment, sleep: input.sleep }), input)
      : [];
  const nowIso = new Date(input.now).toISOString();
  const alertChanges: AlertChange[] = reconcileAlerts(findings, input.alerts, input.autonomy, nowIso, newId);
  const alerts = applyAlertChanges(input.alerts, alertChanges);
  const open = alerts.filter((a) => a.state !== 'resolved').length;
  return {
    rules,
    baselines,
    findings: input.autonomy >= 3 ? findings : findings.map((f) => ({ ...f, protocolIds: undefined })),
    risk: assessRisk(findings),
    readiness: readiness({ measurements: input.measurements, baselines, rules, sleep: input.sleep, activeAlerts: open, now: input.now }),
    alertChanges,
    alerts,
  };
}

export type EngineResult = ReturnType<typeof runEngine>;
export * from './explain';
