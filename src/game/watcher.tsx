'use client';
import { useEffect } from 'react';

import { useNow } from '@/hooks/use-now';
import { ACHIEVEMENTS, WEEKLY, weekKey, weeklyProgress } from './objectives';
import { useProgress } from './progress';

/** Unlocks achievements and weekly-mission bonuses as participation events arrive. */
export function GameWatcher() {
  const events = useProgress((s) => s.events);
  const unlocked = useProgress((s) => s.achievements);
  const now = useNow(60_000);
  useEffect(() => {
    const st = useProgress.getState();
    for (const m of WEEKLY) if (weeklyProgress(m, events, now).complete) st.award('weekly_mission', `${m.id}:${weekKey(now)}`);
    for (const a of ACHIEVEMENTS) if (!unlocked[a.id] && a.test(events, unlocked)) st.unlock(a.id, `Achievement unlocked: ${a.title}`, a.detail);
  }, [events, unlocked, now]);
  return null;
}
