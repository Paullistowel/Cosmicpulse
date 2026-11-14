'use client';

import { BedDouble, Plus, ShieldAlert } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';

import { award } from '@/game/progress';

import { DataSourceBanner, useUnits } from '@/components/health';
import { Badge, ButtonLink, Card, EmptyState, Notice, Overline, PageHeader, ProgressBar, Section, Segmented, SourceBadge, Stat } from '@/components/ui';
import { DailyBars, TrendChart } from '@/components/viz';
import { findProtocol } from '@/engine';
import { baselineBand } from '@/features/health/vitals';
import { useNow } from '@/hooks/use-now';
import { sleepSignal } from '@/intel/hazard-profile';
import { trendPoints } from '@/lib/series';
import { useEngine } from '@/store/engine-runner';
import { useHealth } from '@/store/health';

export default function SleepPage() {
  const now = useNow(60_000);
  const units = useUnits();
  const engine = useEngine();
  const sleep = useHealth((s) => s.sleepRecords);
  const moods = useHealth((s) => s.moods);
  const ms = useHealth((s) => s.measurements);
  const [days, setDays] = useState<'14' | '30' | '90'>('30');
  const nights = useMemo(() => [...sleep].filter((r) => new Date(r.night).getTime() > now - Number(days) * 86_400_000).sort((a, b) => a.night.localeCompare(b.night)), [sleep, now, days]);
  const last7 = nights.slice(-7);
  const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : NaN);
  const avgH = avg(last7.map((r) => r.hours));
  const debt = last7.reduce((a, r) => a + Math.max(0, 7 - r.hours), 0);
  const quality = avg(last7.map((r) => r.quality));
  const disruptions = avg(last7.map((r) => r.disruptions));
  const signal = sleepSignal(sleep, now);
  const recovery = engine.findings.filter((f) => f.module === 'recovery' || f.id === 'pattern:physiological-strain');
  const energy = moods.filter((m) => new Date(m.at).getTime() > now - 7 * 86_400_000).map((m) => m.energy);
  const latest = nights[nights.length - 1];
  const bh = findProtocol('AEG-BH-001');
  useEffect(() => {
    if (sleep.length) award('sleep_review');
  }, [sleep.length]);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader overline="Monitoring" title="Sleep & recovery" subtitle="Sleep duration, quality and patterns, recovery against your baseline and fatigue signals." actions={<><Segmented label="Period" value={days} onChange={setDays} options={[{ value: '14', label: '14 n' }, { value: '30', label: '30 n' }, { value: '90', label: '90 n' }]} /><ButtonLink href="/record?tab=sleep" icon={Plus} size="sm">Log sleep</ButtonLink></>} />
      <DataSourceBanner compact />
      {!nights.length ? (
        <Card><EmptyState icon={BedDouble} title="No sleep records" body="Log a night manually, sync from the CosmicPulse phone app, or turn on simulation." action={<ButtonLink href="/record?tab=sleep" size="sm">Log sleep</ButtonLink>} /></Card>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Card><Stat label="7-night average" value={avgH.toFixed(1)} unit="h" detail={avgH >= 7 ? 'meets 7 h target' : 'below 7 h target'} tone={avgH >= 7 ? 'success' : avgH >= 6 ? 'warning' : 'critical'} /></Card>
            <Card><Stat label="Sleep debt (7 n)" value={debt.toFixed(1)} unit="h" detail="vs 7 h per night" /></Card>
            <Card><Stat label="Quality" value={Number.isFinite(quality) ? Math.round(quality) : '—'} unit="/100" detail="device or self-reported" /></Card>
            <Card><Stat label="Wake-ups" value={Number.isFinite(disruptions) ? disruptions.toFixed(1) : '—'} unit="/night" detail={`latest: ${latest.disruptions}`} /></Card>
          </div>
          {signal && <Notice tone={signal.level === 'attention' ? 'warning' : 'info'} title={signal.label}>{signal.detail} Reduced sleep is a NASA HRP behavioural risk linked to isolation and confinement. <Link href="/risk/isolation" className="font-medium text-primary hover:underline">See hazard →</Link></Notice>}
          <div className="grid gap-6 xl:grid-cols-3">
            <Card className="flex flex-col gap-2 xl:col-span-2">
              <Overline>Hours per night</Overline>
              <DailyBars ariaLabel="Sleep hours per night" data={nights.map((r) => ({ label: new Date(r.night).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }), v: r.hours, synthetic: r.source.kind === 'simulated' || r.source.kind === 'demo', note: `quality ${r.quality} · ${r.disruptions} wake-ups${r.medicationAssisted ? ' · medication-assisted' : ''}` }))} unit="h" goal={7} goalLabel="7 h target" decimals={1} />
              <div className="flex flex-wrap items-center gap-2"><span className="t-caption text-ink-3">Latest night:</span><SourceBadge source={latest.source} /></div>
            </Card>
            <Card className="flex flex-col gap-3">
              <Overline>Quality trend</Overline>
              {nights.slice(-10).reverse().map((r) => (
                <div key={r.id}>
                  <div className="t-caption flex justify-between text-ink-2"><span>{new Date(r.night).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })}</span><span className="tabular">{r.hours.toFixed(1)} h · {r.quality}</span></div>
                  <ProgressBar value={r.quality} max={100} tone={r.quality >= 70 ? 'success' : r.quality >= 50 ? 'warning' : 'critical'} label={`Sleep quality ${r.quality}`} />
                </div>
              ))}
            </Card>
          </div>
        </>
      )}
      <div className="grid gap-6 xl:grid-cols-2">
        <Section title="Recovery">
          <Card className="flex flex-col gap-3">
            <TrendChart ariaLabel="HRV trend (recovery)" points={trendPoints(ms, 'hrv', '30d', now, units)} unit="ms" band={baselineBand(engine.baselines.hrv, 'hrv', units)} height={200} />
            <p className="t-callout text-ink-2">Readiness: <span className="font-medium text-ink">{engine.readiness.score ?? '—'} ({engine.readiness.label})</span>.</p>
            {recovery.map((f) => <Link key={f.id} href={`/alerts/${encodeURIComponent(f.id)}`} className="t-callout font-medium text-primary hover:underline">{f.title} →</Link>)}
          </Card>
        </Section>
        <Section title="Fatigue monitoring">
          <Card className="flex flex-col gap-3">
            <p className="t-callout text-ink-2">Energy check-ins this week: {energy.length ? <span className="font-medium text-ink">{avg(energy).toFixed(1)}/5 average ({energy.length})</span> : 'none yet'}.</p>
            {energy.length > 0 && avg(energy) <= 2.5 && <Badge label="Low energy reported" tone="warning" className="self-start" />}
            <ButtonLink href="/record?tab=mood" variant="secondary" size="sm" className="self-start">Add a check-in</ButtonLink>
            {bh && (
              <div className="rounded-[16px] bg-sunken p-3">
                <p className="t-headline flex items-center gap-2"><ShieldAlert size={15} className="text-accent" /> {bh.id} v{bh.version} · {bh.title}</p>
                <p className="t-callout text-ink-2">{bh.summary}</p>
                <ul className="t-callout mt-1 list-disc pl-5 text-ink-2">{bh.steps.slice(0, 4).map((s) => <li key={s.text}>{s.text}</li>)}</ul>
                <p className="t-caption mt-1 text-ink-3">Demonstration knowledge base — not flight-approved.</p>
              </div>
            )}
          </Card>
        </Section>
      </div>
    </div>
  );
}
