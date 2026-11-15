'use client';

import { ArrowRight, Lock } from 'lucide-react';
import dynamic from 'next/dynamic';
import Image from 'next/image';
import Link from 'next/link';
import { useState } from 'react';

import { useClientValue, usePrefersReducedMotion } from '@/hooks/use-client-value';

import { webglAvailable } from '@/components/twin/body-map';
import { MODULES, type ModuleId } from '@/components/station/modules';
import { SectionIntro } from '@/components/story';
import { Badge, Card, cn } from '@/components/ui';
import { RANKS, award, rankFor, totalXp, useProgress } from '@/game/progress';
import { useSettings } from '@/store/settings';

const StationScene = dynamic(() => import('@/components/station/station-scene'), { ssr: false, loading: () => <p className="t-telemetry flex h-full items-center justify-center text-white/60">DOCKING…</p> });

export default function StationPage() {
  const xp = useProgress((s) => totalXp(s.events));
  const r = rankFor(xp);
  const motion = useSettings((s) => s.motion);
  const [sel, setSel] = useState<ModuleId | null>(null);
  const gl = useClientValue(webglAvailable, true);
  const still = usePrefersReducedMotion(motion);
  const m = MODULES.find((x) => x.id === sel);
  const locked = m ? r.index < m.minRank : false;
  const select = (id: ModuleId | null) => {
    setSel(id);
    if (!id) return;
    const mod = MODULES.find((x) => x.id === id)!;
    if (r.index >= mod.minRank) award('station_visited', id);
  };
  return (
    <div className="flex flex-col gap-5">
      <SectionIntro chapter="dangers" title="Station tour" say="This is the real International Space Station! Tap a glowing module to fly there." pose="wave" image="/images/nasa/iss-orbit.jpg" />
      <div className="grid gap-5 xl:grid-cols-[1.4fr_1fr]">
        <section className="relative h-[min(72vh,680px)] min-h-[480px] overflow-hidden rounded-[30px] bg-[#02040A] shadow-card" aria-label="International Space Station model">
          {gl ? <StationScene rankIndex={r.index} selected={sel} onSelect={select} still={still} /> : <p className="t-callout p-6 text-white/70">3D is unavailable in this browser — choose a module from the list.</p>}
          <div className="absolute inset-x-3 bottom-3 flex gap-1.5 overflow-x-auto pb-1">
            {MODULES.map((x) => (
              <button key={x.id} onClick={() => select(x.id)} aria-pressed={sel === x.id} className={cn('t-caption flex shrink-0 items-center gap-1.5 rounded-full bg-white/10 px-3 py-1.5 text-white backdrop-blur hover:bg-white/20', sel === x.id && 'ring-2 ring-[#62D2E6]')}>
                {r.index < x.minRank && <Lock size={11} />}{x.name}
              </button>
            ))}
          </div>
        </section>
        <Card className="flex flex-col gap-4">
          {m ? (
            <>
              <div className="relative h-48 overflow-hidden rounded-[20px]" title={m.caption}><Image src={m.image} alt={m.caption} fill sizes="(min-width: 1280px) 30vw, 100vw" className={cn('object-cover', locked && 'grayscale')} /></div>
              <h2 className="t-title2">{m.name}</h2>
              <p className="t-caption -mt-3 text-ink-3">On the ISS: {m.issName}</p>
              <p className="t-callout text-ink-2">{m.body}</p>
              {locked ? (
                <Badge label={`Unlocks at ${RANKS[m.minRank].name} (${RANKS[m.minRank].xp} XP)`} tone="neutral" icon={Lock} size="md" className="self-start" />
              ) : (
                <Link href={m.href} className="inline-flex h-11 items-center gap-2 self-start rounded-full bg-pill px-5 text-sm font-medium text-on-pill">Enter {m.name.toLowerCase()} <ArrowRight size={16} /></Link>
              )}
            </>
          ) : (
            <>
              <h2 className="t-title3">Pick a module 🛰️</h2>
              <ul className="flex flex-col gap-1">{MODULES.map((x) => <li key={x.id}><button onClick={() => select(x.id)} className="t-callout flex w-full items-center gap-2 rounded-[12px] px-2 py-1.5 text-left hover:bg-sunken"><span className="size-2.5 rounded-full" style={{ background: x.color }} />{x.name}{r.index < x.minRank && <Lock size={12} className="ml-auto text-ink-3" />}</button></li>)}</ul>
            </>
          )}
        </Card>
      </div>
    </div>
  );
}
