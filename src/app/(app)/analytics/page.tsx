'use client';

import { ChevronDown } from 'lucide-react';
import Link from 'next/link';
import { useMemo, useState } from 'react';

import { DataSourceBanner, useUnits } from '@/components/health';
import { SectionIntro } from '@/components/story';
import { Badge, Card, Overline, Section, Segmented, Stat, cn, LearnMore } from '@/components/ui';
import { DailyBars, TrendChart } from '@/components/viz';
import type { VitalType } from '@/data/types';
import { VITAL_META, displayUnit, toDisplay } from '@/data/vitals';
import { persistentDays } from '@/engine';
import { PHASE_LABEL, baselineBand } from '@/features/health/vitals';
import { useNow } from '@/hooks/use-now';
import { dailyMeans, isSynthetic } from '@/lib/series';
import { useDataSource } from '@/services/data-source';
import { useEngine } from '@/store/engine-runner';
import { useHealth } from '@/store/health';

const METRICS: VitalType[] = ['heart_rate', 'hrv', 'spo2', 'temperature', 'respiratory_rate', 'blood_pressure', 'sleep', 'weight'];

export default function AnalyticsPage() {
  const now = useNow(60_000);
  const units = useUnits();
  const engine = useEngine();
  const ms = useHealth((s) => s.measurements);
  const mission = useHealth((s) => s.mission);
  const ds = useDataSource();
  const [days, setDays] = useState<'7' | '30' | '90'>('30');
  const [open, setOpen] = useState<VitalType | null>('heart_rate');

  const rows = useMemo(
    () =>
      METRICS.map((m) => {
        const week = dailyMeans(ms, m, 7, now);
        const prev = dailyMeans(ms, m, 14, now).filter((d) => d.t < now - 7 * 86_400_000);
        const avg = (xs: { v: number }[]) => (xs.length ? xs.reduce((a, x) => a + x.v, 0) / xs.length : NaN);
        const b = engine.baselines[m];
        const ctx = { measurements: ms, baselines: engine.baselines, rules: engine.rules, now };
        const sustained = Math.max(persistentDays(ctx, m, 'high'), persistentDays(ctx, m, 'low'));
        const today = dailyMeans(ms, m, 1, now);
        return { m, week: avg(week), prev: avg(prev), today: avg(today), base: b && b.quality !== 'insufficient' ? b.median : NaN, sustained };
      }),
    [ms, now, engine],
  );

  const coverage = useMemo(() => {
    const out: { label: string; v: number; synthetic: boolean }[] = [];
    const n = Number(days);
    for (let i = n - 1; i >= 0; i--) {
      const d0 = new Date(now - i * 86_400_000).toISOString().slice(0, 10);
      const day = ms.filter((m) => m.takenAt.slice(0, 10) === d0);
      out.push({ label: d0.slice(5), v: day.length, synthetic: day.length > 0 && day.every(isSynthetic) });
    }
    return out;
  }, [ms, now, days]);
  const day = Math.floor((now - new Date(mission.launchedAt).getTime()) / 86_400_000);

  return (
    <div className="flex flex-col gap-6">
      <SectionIntro chapter="story" title="Today’s health" say="Here’s how today compares with your usual. Green means usual for you — tap anything to dig deeper." actions={<Segmented label="Period" value={days} onChange={setDays} options={[{ value: '7', label: '7 days' }, { value: '30', label: '30 days' }, { value: '90', label: '90 days' }]} />} />
      <DataSourceBanner compact />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Card><Stat label="Mission day" value={day} detail={`${PHASE_LABEL[mission.phase]} · of ${mission.plannedDays}`} /></Card>
        <Card><Stat label="Findings" value={engine.findings.length} detail={`${engine.findings.filter((f) => f.severity === 'high' || f.severity === 'critical').length} need medical review`} /></Card>
        <Card><Stat label="Readings stored" value={ms.length.toLocaleString('en-US')} detail={`${ds.breakdown.synthetic.toLocaleString('en-US')} synthetic · ${(ds.breakdown.manual + ds.breakdown.live + ds.breakdown.synced).toLocaleString('en-US')} real`} /></Card>
        <Card><Stat label="Established baselines" value={`${Object.values(engine.baselines).filter((b) => b?.quality === 'established').length}/${METRICS.length}`} detail="personal norms" /></Card>
      </div>

      <Section title="Current vs daily vs weekly vs baseline" description="Click a metric to expand its trend.">
        <Card className="p-0 sm:p-0">
          <div className="t-overline hidden grid-cols-[1.4fr_repeat(5,1fr)_24px] gap-2 border-b border-line px-5 py-3 text-ink-3 md:grid">
            <span>Metric</span><span>Today avg</span><span>7-day avg</span><span>Prior 7 days</span><span>Baseline</span><span>Sustained</span><span />
          </div>
          {rows.map((r) => {
            const meta = VITAL_META[r.m];
            const dec = meta.decimals;
            const f = (v: number) => (Number.isFinite(v) ? toDisplay(r.m, v, units).toFixed(dec) : '—');
            const wow = Number.isFinite(r.week) && Number.isFinite(r.prev) && r.prev ? ((r.week - r.prev) / r.prev) * 100 : NaN;
            const expanded = open === r.m;
            return (
              <div key={r.m} className="border-b border-line last:border-0">
                <button onClick={() => setOpen(expanded ? null : r.m)} aria-expanded={expanded} className="grid w-full grid-cols-2 gap-2 px-5 py-3 text-left hover:bg-sunken md:grid-cols-[1.4fr_repeat(5,1fr)_24px]">
                  <span className="t-callout col-span-2 font-medium md:col-span-1">{meta.label} <span className="t-telemetry text-ink-3">{displayUnit(r.m, units)}</span></span>
                  <span className="t-callout tabular"><span className="t-caption text-ink-3 md:hidden">Today </span>{f(r.today)}</span>
                  <span className="t-callout tabular"><span className="t-caption text-ink-3 md:hidden">7 d </span>{f(r.week)}</span>
                  <span className="t-callout tabular"><span className="t-caption text-ink-3 md:hidden">Prior </span>{f(r.prev)} {Number.isFinite(wow) && <span className={cn('t-caption', Math.abs(wow) >= 5 ? 'text-warning-ink' : 'text-ink-3')}>{wow > 0 ? '+' : ''}{wow.toFixed(1)}%</span>}</span>
                  <span className="t-callout tabular"><span className="t-caption text-ink-3 md:hidden">Baseline </span>{f(r.base)}</span>
                  <span>{r.sustained >= 2 ? <Badge label={`${r.sustained} days outside`} tone="warning" /> : <span className="t-caption text-ink-3">—</span>}</span>
                  <ChevronDown size={16} className={cn('hidden text-ink-3 transition-transform md:block', expanded && 'rotate-180')} />
                </button>
                {expanded && (
                  <div className="px-5 pb-5">
                    <TrendChart ariaLabel={`${meta.label} daily mean`} points={dailyMeans(ms, r.m, Number(days), now).map((d) => ({ t: d.t, v: toDisplay(r.m, d.v, units), synthetic: d.synthetic, source: `daily mean of ${d.n}` }))} unit={displayUnit(r.m, units)} decimals={dec === 0 ? 1 : dec} band={baselineBand(engine.baselines[r.m], r.m, units)} height={220} launchAt={new Date(mission.launchedAt).getTime()} />
                    <Link href={`/vitals/${r.m}`} className="t-caption font-medium text-primary hover:underline">Open {meta.label.toLowerCase()} detail →</Link>
                  </div>
                )}
              </div>
            );
          })}
        </Card>
        <LearnMore title="How changes are measured">“Sustained” counts consecutive recent days whose median sits outside your p10–p90 band. Week-over-week changes ≥ 5% are highlighted.</LearnMore>
      </Section>

      <Section title="Data coverage" description="Readings per day across the selected period — gaps make baselines and findings less certain.">
        <Card>
          <Overline className="mb-2">Readings per day</Overline>
          <DailyBars ariaLabel="Readings per day" data={coverage} unit="readings" height={180} color="var(--chart-muted)" />
        </Card>
      </Section>
    </div>
  );
}
