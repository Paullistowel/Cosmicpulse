'use client';
import { useMemo } from 'react';

import { uid } from '@/data/demo/random';
import { runEngine, type EngineResult } from '@/engine';
import { useNow } from '@/hooks/use-now';
import { hazardProfiles } from '@/intel/hazard-profile';
import { pullGroundVitals } from '@/services/device-data';
import { linkState, startConnectivity, useConnectivity } from '@/services/connectivity';
import { isAstronautSession, useSession } from '@/services/session';
import { configureSync, registerAckHandler, registerInboundHandler, syncNow } from '@/services/sync';
import { useHealth } from './health';

/**
 * Autonomous operations loop (web port of the mobile engine-runner).
 * Re-runs the shared Intelligence Engine when data changes and every minute,
 * applies alert changes idempotently, raises in-app notifications (and a
 * browser notification for REAL high-severity alerts when permitted), syncs
 * the outbox and pulls phone-synced device data when signed in.
 */
type Snapshot = Pick<ReturnType<typeof useHealth.getState>, 'mission' | 'phaseStartedAt' | 'measurements' | 'environment' | 'sleepRecords' | 'alerts' | 'autonomy'>;

function pass(s: Snapshot, now = Date.now()): EngineResult {
  return runEngine(
    { mission: s.mission, phaseStartedAt: s.phaseStartedAt, measurements: s.measurements, environment: s.environment, sleep: s.sleepRecords, alerts: s.alerts, autonomy: s.autonomy, now },
    () => uid('al'),
  );
}

export function runEngineOnce(now = Date.now()) {
  const s = useHealth.getState();
  const r = pass(s, now);
  if (r.alertChanges.length) {
    s.applyAlertChanges(r.alertChanges);
    for (const c of r.alertChanges) {
      if (c.type !== 'create' || (c.alert.severity !== 'high' && c.alert.severity !== 'critical')) continue;
      s.pushNotification({
        category: 'insight',
        title: c.alert.simulated ? `SIMULATED · ${c.alert.title}` : c.alert.title,
        body: c.alert.simulated ? 'Demo-data alert — not a real health event. Open to see how CosmicPulse explains it.' : `New ${c.alert.severity === 'critical' ? 'urgent' : 'medical-review'} alert — open to see why.`,
        sensitive: true,
        href: `/alerts/${encodeURIComponent(c.alert.insightId)}`,
      });
      if (!c.alert.simulated && typeof Notification !== 'undefined' && Notification.permission === 'granted') {
        try {
          new Notification('CosmicPulse health alert', { body: 'A new alert needs review. Open CosmicPulse for details.', tag: c.alert.fingerprint });
        } catch {
          /* notifications unsupported in this context */
        }
      }
    }
  }
  return r;
}

let started = false;

export function startEngineRunner(): () => void {
  if (started) return () => {};
  started = true;
  registerInboundHandler((c) => useHealth.getState().applyInbound(c));
  registerAckHandler((entity, entityId) => {
    if (entity !== 'message') return;
    useHealth.setState((s) => ({ messages: s.messages.map((m) => (m.id === entityId && m.delivery === 'queued' ? { ...m, delivery: 'sent' } : m)) }));
  });
  const identify = () => configureSync({ deviceId: useSession.getState().deviceId, astronautId: useSession.getState().user?.astronautId ?? useHealth.getState().astronautId });
  identify();
  const unsubSession = useSession.subscribe(identify);

  const groundCycle = () => {
    if (!isAstronautSession() || linkState() !== 'online') return;
    void syncNow().catch(() => {});
    void pullGroundVitals().catch(() => {});
  };

  let timer: ReturnType<typeof setTimeout> | null = null;
  const schedule = () => {
    if (timer) return;
    timer = setTimeout(() => {
      timer = null;
      runEngineOnce();
    }, 500);
  };
  const unsub = useHealth.subscribe((s, prev) => {
    if (s.measurements !== prev.measurements || s.environment !== prev.environment || s.sleepRecords !== prev.sleepRecords || s.autonomy !== prev.autonomy || s.mission !== prev.mission) schedule();
  });
  runEngineOnce();
  const stopLink = startConnectivity(groundCycle);
  const unsubConn = useConnectivity.subscribe((s, p) => {
    if (s.configured !== p.configured || s.ground !== p.ground) groundCycle();
  });
  const minute = setInterval(() => {
    runEngineOnce();
    groundCycle();
  }, 60_000);
  const vis = () => {
    if (document.visibilityState === 'visible') {
      runEngineOnce();
      groundCycle();
    }
  };
  document.addEventListener('visibilitychange', vis);
  return () => {
    started = false;
    unsub();
    unsubSession();
    unsubConn();
    stopLink();
    clearInterval(minute);
    document.removeEventListener('visibilitychange', vis);
  };
}

export function useEngine(): EngineResult {
  const mission = useHealth((s) => s.mission);
  const phaseStartedAt = useHealth((s) => s.phaseStartedAt);
  const measurements = useHealth((s) => s.measurements);
  const environment = useHealth((s) => s.environment);
  const sleepRecords = useHealth((s) => s.sleepRecords);
  const alerts = useHealth((s) => s.alerts);
  const autonomy = useHealth((s) => s.autonomy);
  const now = useNow(60_000);
  return useMemo(() => pass({ mission, phaseStartedAt, measurements, environment, sleepRecords, alerts, autonomy }, now), [mission, phaseStartedAt, measurements, environment, sleepRecords, alerts, autonomy, now]);
}

export function useHazards() {
  const engine = useEngine();
  const mission = useHealth((s) => s.mission);
  const measurements = useHealth((s) => s.measurements);
  const sleep = useHealth((s) => s.sleepRecords);
  const exercise = useHealth((s) => s.exercise);
  const environment = useHealth((s) => s.environment);
  const moods = useHealth((s) => s.moods);
  const checkins = useHealth((s) => s.checkins);
  const link = useConnectivity((s) => linkState(s));
  const now = useNow(60_000);
  return useMemo(
    () => hazardProfiles({ mission, measurements, baselines: engine.baselines, rules: engine.rules, findings: engine.findings, sleep, exercise, environment, moods, checkins, linkOnline: link === 'online' || link === 'not_configured', now }),
    [mission, measurements, engine, sleep, exercise, environment, moods, checkins, link, now],
  );
}
