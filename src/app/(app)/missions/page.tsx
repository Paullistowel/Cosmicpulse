'use client';

import { Nova } from '@/components/companion';
import { CheckCircle2, Rocket } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';

import { MissionArt, RankMeter } from '@/components/game';
import { Badge, Card, ProgressBar, cn, LearnMore } from '@/components/ui';
import { DAILY, WEEKLY, dailyProgress, weeklyProgress, type Objective } from '@/game/objectives';
import { RANKS, rankFor, totalXp, useProgress, ACTIVITY } from '@/game/progress';
import { stamp } from '@/features/health/vitals';
import { useNow } from '@/hooks/use-now';

function ObjectiveCard({ o, done, target, complete, scope }: { o: Objective; done: number; target: number; complete: boolean; scope: 'today' | 'week' }) {
  return (
    <div className={cn('card relative flex flex-col gap-3 overflow-hidden p-5', complete && 'ring-1 ring-[var(--success)]')}>
      <div className="flex items-start gap-4">
        <MissionArt art={o.art} size={64} />
        <div className="min-w-0 flex-1">
          <p className="t-headline">{o.title}</p>
          <p className="t-callout text-ink-2">{o.explain}</p>
        </div>
        <Badge label={`+${o.xp} XP`} tone={complete ? 'success' : 'primary'} />
      </div>
      <ProgressBar value={done} max={target} tone={complete ? 'success' : 'accent'} label={`${o.title} progress`} />
      <div className="flex items-center justify-between">
        <span className="t-caption text-ink-3">{done}/{target} {scope === 'today' ? 'today' : 'this week'}</span>
        {complete ? <span className="t-caption flex items-center gap-1 font-semibold text-success"><CheckCircle2 size={14} /> Complete</span> : <Link href={o.href} className="t-callout rounded-full bg-pill px-3.5 py-1.5 font-medium text-on-pill">{o.action}</Link>}
      </div>
    </div>
  );
}

export default function MissionsPage() {
  const now = useNow(60_000);
  const events = useProgress((s) => s.events);
  const xp = totalXp(events);
  const r = rankFor(xp);
  const todayDone = DAILY.filter((o) => dailyProgress(o, events, now).complete).length;
  return (
    <div className="flex flex-col gap-8">
      <section data-tour="missions-hero" className="relative overflow-hidden rounded-[30px] p-6 text-white shadow-card sm:p-8">
        <Image src="/images/nasa/earth-night.jpg" alt="" fill priority sizes="100vw" className="object-cover" />
        <div className="absolute inset-0 bg-gradient-to-r from-[#05080D]/90 via-[#05080D]/60 to-transparent" />
        <div className="pointer-events-none absolute right-4 bottom-2 hidden md:block" aria-hidden><Nova pose={todayDone === DAILY.length ? 'celebrate' : 'wave'} size={190} /></div>
        <div className="relative flex max-w-2xl flex-col gap-3">
          <p className="t-overline text-[#9FE6F2]">Chapter 07 · Complete the mission</p>
          <h1 className="t-display">{r.rank.name}</h1>
          <p className="t-body text-white/85">Earn XP by taking part — never for your numbers.</p>
          <div className="max-w-md"><ProgressBar value={r.progress} label="Rank progress" /></div>
          <p className="t-telemetry text-white/80">{xp.toLocaleString('en-US')} XP · {r.next ? `${r.next.xp - xp} XP to ${r.next.name}` : 'Highest rank reached'} · {todayDone}/{DAILY.length} objectives today</p>
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="t-title2 px-1">Today’s objectives</h2>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {DAILY.map((o) => { const p = dailyProgress(o, events, now); return <ObjectiveCard key={o.id} o={o} done={p.done} target={o.target} complete={p.complete} scope="today" />; })}
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="t-title2 px-1">Weekly missions</h2>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {WEEKLY.map((m) => { const p = weeklyProgress(m, events, now); return <ObjectiveCard key={m.id} o={m} done={p.done} target={m.target} complete={p.complete} scope="week" />; })}
        </div>
      </section>

      <div className="grid gap-6 xl:grid-cols-2">
        <section className="flex flex-col gap-3">
          <h2 className="t-title2 px-1">Rank ladder</h2>
          <Card className="flex flex-col gap-1">
            {RANKS.map((k, i) => (
              <div key={k.id} className={cn('flex items-center gap-3 rounded-[14px] px-2 py-2.5', i === r.index && 'bg-sunken')}>
                <span className={cn('flex size-9 items-center justify-center rounded-full', i <= r.index ? 'bg-accent-soft text-accent' : 'bg-sunken text-ink-3')}><Rocket size={16} /></span>
                <span className="t-headline flex-1">{k.name}</span>
                <span className="t-telemetry text-ink-3">{k.xp.toLocaleString('en-US')} XP</span>
                {i < r.index && <CheckCircle2 size={16} className="text-success" />}
              </div>
            ))}
          </Card>
          <RankMeter />
        </section>
        <section className="flex flex-col gap-3">
          <h2 className="t-title2 px-1">Mission log</h2>
          <Card className="flex max-h-[520px] flex-col gap-1 overflow-y-auto py-2">
            {events.length === 0 && <p className="t-callout px-2 py-4 text-ink-3">No activity yet — start with today’s objectives.</p>}
            {[...events].reverse().slice(0, 40).map((e) => (
              <div key={e.id} className="flex items-center gap-2 rounded-[12px] px-2 py-1.5">
                <span className="t-callout flex-1">{ACTIVITY[e.type].label}</span>
                <span className="t-caption font-semibold text-accent">+{e.xp}</span>
                <span className="t-telemetry text-ink-3">{stamp(e.at)}</span>
              </div>
            ))}
          </Card>
          <LearnMore title="Fair-play rules">Each activity counts at most once per day (or once per item), XP is never tied to reading values, and symptoms or alerts should always be reported — never skipped for points.</LearnMore>
        </section>
      </div>
    </div>
  );
}
