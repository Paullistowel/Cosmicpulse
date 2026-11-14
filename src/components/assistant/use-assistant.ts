'use client';
import { usePathname } from 'next/navigation';
import { useCallback, useState } from 'react';
import { create } from 'zustand';

import { uid } from '@/data/demo/random';
import type { Conversation } from '@/data/types';
import type { AssistantData } from '@/engine';
import { buildContext } from '@/features/assistant/context';
import { bloodTypeFor } from '@/features/medical/lib';
import { screenFor } from '@/lib/nav';
import { ask, type AssistantMessage, type AssistantResult } from '@/services/assistant';
import { summarise } from '@/services/data-source';
import { useDeviceLink } from '@/services/device-data';
import { useSession } from '@/services/session';
import { resolvedActivityNow, useActivity } from '@/store/activity';
import { runEngineOnce } from '@/store/engine-runner';
import { useHealth } from '@/store/health';
import { useSettings } from '@/store/settings';

export const useDock = create<{ open: boolean; setOpen: (v: boolean) => void; pending?: string; queue: (q: string) => void }>((set) => ({
  open: false,
  setOpen: (open) => set({ open }),
  queue: (q) => set({ open: true, pending: q }),
}));

/** Snapshot of everything the assistant may use — all numbers from the deterministic engine. */
export function assistantSnapshot(question: string, screen: string) {
  const now = Date.now();
  const h = useHealth.getState();
  const engine = runEngineOnce(now);
  const act = resolvedActivityNow(now);
  const prefs = useActivity.getState().prefs;
  const ds = summarise({ measurements: h.measurements, activityReal: act.real, activityDemo: act.demo, simulationOn: useSettings.getState().demoFallback, signedIn: !!useSession.getState().user, lastDeviceSyncAt: useDeviceLink.getState().lastPullAt, bleConnected: false });
  const meds = h.medications.filter((m) => m.active);
  const activity = { days: act.days, prefs, demo: act.demo, sourceLabel: act.demo ? 'SIMULATED demo activity' : 'Synced / manual activity' };
  const data: AssistantData = {
    measurements: h.measurements,
    baselines: engine.baselines,
    findings: engine.findings,
    alerts: h.alerts,
    mission: h.mission,
    medications: meds.map((m) => `${m.name} ${m.strength}`),
    now,
    activity,
    dataSource: { state: ds.state === 'empty' ? 'real' : ds.state, reason: ds.reason },
  };
  const context = buildContext({
    question,
    screen,
    now,
    mission: h.mission,
    measurements: h.measurements,
    baselines: engine.baselines,
    findings: engine.findings,
    alerts: h.alerts,
    activity,
    medical: { allergies: h.profile.allergies, conditions: h.profile.conditions, medications: meds.map((m) => ({ name: m.name, strength: m.strength })), records: h.records, bloodType: bloodTypeFor(h.crew, h.astronautId, h.records) },
    incidents: h.incidents,
    devices: { platform: 'CosmicPulse Web', status: useSession.getState().user ? 'ground session' : 'standalone', lastSyncAt: useDeviceLink.getState().lastPullAt, sources: useDeviceLink.getState().sources },
  });
  return { data, context: { ...context, dataMode: ds.state, dataModeNote: ds.state !== 'real' ? `Some or all readings are SYNTHETIC demo data (${ds.reason ?? 'simulation'}). Always say so.` : undefined } };
}

/** Conversation + send, persisted in the encrypted health store. */
export function useAssistantChat() {
  const pathname = usePathname();
  const conversations = useHealth((s) => s.conversations);
  const upsert = useHealth((s) => s.upsertConversation);
  const append = useHealth((s) => s.appendMessage);
  const consent = useSettings((s) => s.aiCloudConsent);
  const [busy, setBusy] = useState(false);
  const [lastRoute, setLastRoute] = useState<AssistantResult | null>(null);
  const [activeId, setActiveId] = useState<string | undefined>(() => conversations.find((c) => c.channel === 'health')?.id);
  const conv = conversations.find((c) => c.id === activeId);

  const send = useCallback(
    async (text: string) => {
      const q = text.trim();
      if (!q || busy) return null;
      let id = activeId && useHealth.getState().conversations.some((c) => c.id === activeId) ? activeId : undefined;
      const at = new Date().toISOString();
      const userMsg = { id: uid('msg'), role: 'user' as const, text: q, at };
      if (!id) {
        const c: Conversation = { id: uid('conv'), channel: 'health', title: q.slice(0, 60), messages: [userMsg], updatedAt: at };
        upsert(c);
        id = c.id;
        setActiveId(id);
      } else append(id, userMsg);
      setBusy(true);
      try {
        const screen = screenFor(pathname);
        const { data, context } = assistantSnapshot(q, screen);
        const history = (useHealth.getState().conversations.find((c) => c.id === id)?.messages ?? []).filter((m) => m.role !== 'system').slice(-9, -1).map((m) => ({ role: m.role as 'user' | 'assistant', text: m.text }));
        const r = await ask(q, data, { consent, screen, history, context });
        append(id, r.message);
        setLastRoute(r);
        return r.message as AssistantMessage;
      } finally {
        setBusy(false);
      }
    },
    [activeId, append, busy, consent, pathname, upsert],
  );

  const newChat = () => setActiveId(undefined);
  return { conv, conversations: conversations.filter((c) => c.channel === 'health'), send, busy, lastRoute, newChat, setActiveId, activeId };
}
