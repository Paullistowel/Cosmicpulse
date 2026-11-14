'use client';

import { SectionIntro } from '@/components/story';
import { Lock } from 'lucide-react';

import { BadgeArt, RankMeter } from '@/components/game';
import { cn } from '@/components/ui';
import { ACHIEVEMENTS } from '@/game/objectives';
import { useProgress } from '@/game/progress';
import { stamp } from '@/features/health/vitals';

export default function AchievementsPage() {
  const unlocked = useProgress((s) => s.achievements);
  const n = ACHIEVEMENTS.filter((a) => unlocked[a.id]).length;
  return (
    <div className="flex flex-col gap-6">
      <SectionIntro chapter="mission" title="Mission insignia" pose="celebrate" say={`You’ve earned ${n} of ${ACHIEVEMENTS.length}. Each one marks a habit that keeps astronauts healthy.`} actions={<div className="w-full sm:w-80"><RankMeter /></div>} />
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
        {ACHIEVEMENTS.map((a) => {
          const at = unlocked[a.id];
          return (
            <article key={a.id} className={cn('card flex flex-col items-center gap-2 p-4 text-center transition-transform', at ? 'hover:-translate-y-1' : 'opacity-90')} aria-label={`${a.title}: ${at ? 'earned' : 'locked'}`}>
              <div className="relative">
                <BadgeArt a={a} unlocked={!!at} size={104} />
                {!at && <span className="absolute -right-1 -bottom-1 flex size-7 items-center justify-center rounded-full bg-sunken text-ink-3"><Lock size={13} /></span>}
              </div>
              <p className="t-headline">{a.title}</p>
              <p className="t-caption text-ink-2">{at ? a.detail : a.hint}</p>
              <p className="t-telemetry text-ink-3">{at ? `EARNED ${stamp(at)}` : 'LOCKED'}</p>
            </article>
          );
        })}
      </div>
    </div>
  );
}
