import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { vaultStorage } from '@/store/vault';

/**
 * CosmicPulse mission progression.
 *
 * Design rules (safety first):
 *  - XP is earned ONLY for participation: checking in, recording, reviewing,
 *    learning. NEVER for the value of a reading, for "good" or "perfect"
 *    health, for exercise volume beyond a session, or for dismissing alerts.
 *  - Each activity type is rewarded at most once per day (or once per item
 *    for learning content), so nothing can be farmed by repetition.
 *  - Progress persists in the encrypted vault.
 */

export type ActivityType =
  | 'onboarding'
  | 'vital_recorded'
  | 'mood_checkin'
  | 'confinement_checkin'
  | 'sleep_logged'
  | 'activity_logged'
  | 'sleep_review'
  | 'assessment_review'
  | 'briefing_viewed'
  | 'recommendation_reviewed'
  | 'followup_completed'
  | 'hazard_explored'
  | 'simulator_run'
  | 'research_read'
  | 'twin_explored'
  | 'timeline_explored'
  | 'station_visited'
  | 'weekly_mission';

export const ACTIVITY: Record<ActivityType, { label: string; xp: number; scope: 'once' | 'daily' | 'per_key' }> = {
  onboarding: { label: 'Completed mission briefing (onboarding)', xp: 100, scope: 'once' },
  vital_recorded: { label: 'Recorded a vital sign', xp: 20, scope: 'daily' },
  mood_checkin: { label: 'Mood & stress check-in', xp: 20, scope: 'daily' },
  confinement_checkin: { label: 'Confinement wellbeing check-in', xp: 30, scope: 'daily' },
  sleep_logged: { label: 'Logged a night of sleep', xp: 15, scope: 'daily' },
  activity_logged: { label: 'Logged a movement activity', xp: 15, scope: 'daily' },
  sleep_review: { label: 'Reviewed sleep & recovery report', xp: 10, scope: 'daily' },
  assessment_review: { label: 'Reviewed health assessment', xp: 15, scope: 'daily' },
  briefing_viewed: { label: 'Received Sentinel daily briefing', xp: 15, scope: 'daily' },
  recommendation_reviewed: { label: 'Reviewed a Sentinel recommendation', xp: 20, scope: 'per_key' },
  followup_completed: { label: 'Completed a follow-up reassessment', xp: 25, scope: 'per_key' },
  hazard_explored: { label: 'Explored a spaceflight hazard', xp: 25, scope: 'per_key' },
  simulator_run: { label: 'Ran a mission scenario simulation', xp: 20, scope: 'daily' },
  research_read: { label: 'Read a NASA / CSA research source', xp: 15, scope: 'per_key' },
  twin_explored: { label: 'Explored a body system on the digital twin', xp: 10, scope: 'per_key' },
  timeline_explored: { label: 'Explored the mission timeline', xp: 10, scope: 'daily' },
  station_visited: { label: 'Toured a station module', xp: 10, scope: 'per_key' },
  weekly_mission: { label: 'Weekly mission complete', xp: 60, scope: 'per_key' },
};

export const RANKS = [
  { id: 'cadet', name: 'Cadet', xp: 0 },
  { id: 'junior_explorer', name: 'Junior Explorer', xp: 150 },
  { id: 'mission_specialist', name: 'Mission Specialist', xp: 400 },
  { id: 'space_health_specialist', name: 'Space Health Specialist', xp: 800 },
  { id: 'senior_astronaut', name: 'Senior Astronaut', xp: 1400 },
  { id: 'mission_commander', name: 'Mission Commander', xp: 2200 },
] as const;
export type Rank = (typeof RANKS)[number];

export function rankFor(xp: number) {
  let i = 0;
  RANKS.forEach((r, k) => {
    if (xp >= r.xp) i = k;
  });
  const next = RANKS[i + 1];
  return { rank: RANKS[i], index: i, next, progress: next ? (xp - RANKS[i].xp) / (next.xp - RANKS[i].xp) : 1 };
}

export type XpEvent = { id: string; type: ActivityType; key?: string; at: string; xp: number };

export type Celebration = { id: string; kind: 'xp' | 'achievement' | 'rank'; title: string; detail: string; xp?: number; badge?: string };

type ProgressState = {
  events: XpEvent[];
  achievements: Record<string, string>;
  celebrations: Celebration[];
  award: (type: ActivityType, key?: string) => XpEvent | null;
  unlock: (id: string, title: string, detail: string) => void;
  dismiss: (id: string) => void;
  reset: () => void;
};

export const dayKey = (iso: string | number) => new Date(iso).toDateString();
export const totalXp = (events: XpEvent[]) => events.reduce((a, e) => a + e.xp, 0);

export function alreadyAwarded(events: XpEvent[], type: ActivityType, key: string | undefined, now = Date.now()) {
  const scope = ACTIVITY[type].scope;
  if (scope === 'once') return events.some((e) => e.type === type);
  if (scope === 'per_key') return events.some((e) => e.type === type && e.key === (key ?? ''));
  return events.some((e) => e.type === type && dayKey(e.at) === dayKey(now));
}

export const useProgress = create<ProgressState>()(
  persist(
    (set, get) => ({
      events: [],
      achievements: {},
      celebrations: [],
      award: (type, key) => {
        const s = get();
        if (alreadyAwarded(s.events, type, key)) return null;
        const before = rankFor(totalXp(s.events));
        const ev: XpEvent = { id: `xp-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, type, key: key ?? '', at: new Date().toISOString(), xp: ACTIVITY[type].xp };
        const events = [...s.events, ev];
        const after = rankFor(totalXp(events));
        const cel: Celebration[] = [{ id: ev.id, kind: 'xp', title: `+${ev.xp} XP`, detail: ACTIVITY[type].label, xp: ev.xp }];
        if (after.index > before.index) cel.push({ id: `${ev.id}-rank`, kind: 'rank', title: `Promoted to ${after.rank.name}`, detail: 'New station areas and briefings unlocked.' });
        set({ events, celebrations: [...s.celebrations, ...cel].slice(-4) });
        return ev;
      },
      unlock: (id, title, detail) => {
        if (get().achievements[id]) return;
        set((s) => ({ achievements: { ...s.achievements, [id]: new Date().toISOString() }, celebrations: [...s.celebrations, { id: `ach-${id}`, kind: 'achievement' as const, title, detail, badge: id }].slice(-4) }));
      },
      dismiss: (id) => set((s) => ({ celebrations: s.celebrations.filter((c) => c.id !== id) })),
      reset: () => set({ events: [], achievements: {}, celebrations: [] }),
    }),
    { name: 'cosmicpulse.progress.v1', storage: createJSONStorage(() => vaultStorage), version: 1, skipHydration: true, partialize: (s) => ({ events: s.events, achievements: s.achievements }) as ProgressState },
  ),
);

/** Fire-and-forget award (safe to call from any action handler). */
export const award = (type: ActivityType, key?: string) => useProgress.getState().award(type, key);
