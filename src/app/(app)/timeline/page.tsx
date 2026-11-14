'use client';

import { SectionIntro } from '@/components/story';
import { AlertTriangle, BedDouble, Brain, CalendarDays, CheckCircle2, Footprints, Info, Sparkles } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';

import { DataSourceBanner, useUnits } from '@/components/health';
import { Badge, Card, Overline, Segmented, cn } from '@/components/ui';
import { TrendChart } from '@/components/viz';
import type { VitalType } from '@/data/types';
import { VITAL_META, displayUnit, toDisplay } from '@/data/vitals';
import { dateKey } from '@/engine/activity';
import { RISK_COPY, projectTrend, riskHistory } from '@/features/intelligence/intel';
import { PHASE_LABEL, baselineBand } from '@/features/health/vitals';
import { ACTIVITY, award, dayKey, useProgress } from '@/game/progress';
import { useNow } from '@/hooks/use-now';
import { dailyMeans } from '@/lib/series';
import { useFollowUps } from '@/sentinel/sentinel';
import { useResolvedActivity } from '@/store/activity';
import { useEngine } from '@/store/engine-runner';
import { useHealth } from '@/store/health';
import { TONE_CLASS } from '@/theme';

type Range = '14' | '30' | 'phase' | 'mission';
const INDICATORS: VitalType[] = ['heart_rate', 'hrv', 'spo2', 'temperature', 'respiratory_rate', 'blood_pressure', 'sleep', 'weight'];
const DAY = 86_400_000;

export default function TimelinePage() {
  const now = useNow(60_000);
  const units = useUnits();
  const engine = useEngine();
  const h = useHealth();
  const act = useResolvedActivity();
  const xp = useProgress((s) => s.events);
  const fu = useFollowUps((s) => s.list);
  const [range, setRange] = useState<Range>('30');
  const [metric, setMetric] = useState<VitalType>('heart_rate');
  const launch = new Date(h.mission.launchedAt).getTime();
  const phaseStart = new Date(h.phaseStartedAt ?? h.mission.launchedAt).getTime();
  const span = range === '14' ? 14 : range === '30' ? 30 : Math.min(180, Math.ceil((now - (range === 'phase' ? phaseStart : launch)) / DAY) + 1);
  const days = useMemo(() => riskHistory(h.alerts, now, span), [h.alerts, now, span]);
  const [sel, setSel] = useState<string>(() => new Date(now).toDateString());
  const strip = useRef<HTMLDivElement>(null);
  useEffect(() => {
    strip.current?.scrollTo({ left: strip.current.scrollWidth });
  }, [span]);
  const interacted = useRef(false);
  const touch = () => {
    if (!interacted.current) {
      interacted.current = true;
      award('timeline_explored');
    }
  };

  const summary = useMemo(() => {
    const d0 = new Date(sel);
    d0.setHours(0, 0, 0, 0);
    const from = d0.getTime();
    const to = from + DAY;
    const inDay = (iso: string) => new Date(iso).getTime() >= from && new Date(iso).getTime() < to;
    const means = (t: VitalType) => {
      const xs = h.measurements.filter((m) => m.type === t && !m.qualityFlag && inDay(m.takenAt)).map((m) => m.value);
      return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : undefined;
    };
    const sleep = h.sleepRecords.find((r) => inDay(r.night));
    const moods = h.moods.filter((m) => inDay(m.at));
    const actDay = act.days.find((d) => d.date === dateKey(from));
    const alertsOpened = h.alerts.filter((a) => inDay(a.createdAt));
    const resolved = h.alerts.filter((a) => a.history.some((x) => x.state === 'resolved' && inDay(x.at)));
    const objectives = xp.filter((e) => dayKey(e.at) === d0.toDateString());
    const followups = fu.filter((x) => inDay(x.dueAt) || (x.status === 'done' && inDay(x.createdAt)));
    return { from, means, sleep, moods, actDay, alertsOpened, resolved, objectives, followups, missionDay: Math.floor((from - launch) / DAY) };
  }, [sel, h, act.days, xp, fu, launch]);

  const daily = dailyMeans(h.measurements, metric, span, now);
  const proj = projectTrend(h.measurements, metric, engine.baselines[metric], now, { windowDays: 14, horizonDays: 7 });
  const projection = proj ? { t0: now, v0: toDisplay(metric, proj.fittedNow, units), t1: now + proj.horizonDays * DAY, v1: toDisplay(metric, proj.projected, units) } : undefined;
  const dec = VITAL_META[metric].decimals;

  return (
    <div className="flex flex-col gap-6">
      <SectionIntro chapter="story" title="Your health story" say="Every day of the mission becomes part of your story. Tap a day to look back." pose="think" />
      <header className="flex flex-wrap items-end justify-end gap-3">
        <Segmented label="Time range" value={range} onChange={(v: Range) => { setRange(v); touch(); }} options={[{ value: '14', label: '14 days' }, { value: '30', label: '30 days' }, { value: 'phase', label: PHASE_LABEL[h.mission.phase] }, { value: 'mission', label: 'Whole mission' }]} />
      </header>
      <DataSourceBanner compact />

      <Card className="flex flex-col gap-3 p-3 sm:p-4">
        <div className="flex items-center justify-between px-1"><Overline>Mission days</Overline><span className="t-caption text-ink-3">Colour = highest alert level open that day</span></div>
        <div ref={strip} className="flex gap-1.5 overflow-x-auto pb-2" role="listbox" aria-label="Select a day">
          {days.map((d) => {
            const date = new Date(d.day);
            const key = date.toDateString();
            const md = Math.floor((date.getTime() - launch) / DAY);
            const slp = h.sleepRecords.find((r) => new Date(r.night).toDateString() === key);
            const done = xp.some((e) => dayKey(e.at) === key);
            const mood = h.moods.some((m) => new Date(m.at).toDateString() === key);
            const isSel = key === sel;
            return (
              <button key={d.day} role="option" aria-selected={isSel} onClick={() => { setSel(key); touch(); }} title={`${date.toDateString()} · ${RISK_COPY[d.level].label}${d.alerts.length ? ` · ${d.alerts.join(', ')}` : ''}`} className={cn('flex w-12 shrink-0 flex-col items-center gap-1 rounded-[14px] px-1 py-2', isSel ? 'bg-pill text-on-pill' : 'hover:bg-sunken')}>
                <span className="t-telemetry text-[10px] opacity-70">{md >= 0 ? `D${md}` : `L${md}`}</span>
                <span className={cn('size-3 rounded-full', TONE_CLASS[RISK_COPY[d.level].tone].split(' ')[1], d.level !== 'nominal' && 'ring-2 ring-current', TONE_CLASS[RISK_COPY[d.level].tone].split(' ')[0])} />
                <span className="flex h-8 w-2 items-end overflow-hidden rounded-full bg-sunken" aria-hidden><span className="w-full rounded-full bg-[var(--violet)]" style={{ height: `${slp ? Math.min(100, (slp.hours / 9) * 100) : 0}%` }} /></span>
                <span className="flex gap-0.5" aria-hidden>{mood && <span className="size-1.5 rounded-full bg-[var(--series-1)]" />}{done && <span className="size-1.5 rounded-full bg-accent" />}</span>
                <span className="t-caption text-[10px]">{date.getDate()}</span>
              </button>
            );
          })}
        </div>
        <p className="t-caption flex flex-wrap gap-x-4 px-1 text-ink-3"><span><span className="mr-1 inline-block h-2 w-2 rounded-full bg-[var(--violet)]" />Bar: sleep hours</span><span><span className="mr-1 inline-block h-1.5 w-1.5 rounded-full bg-[var(--series-1)]" />Mood check-in</span><span><span className="mr-1 inline-block h-1.5 w-1.5 rounded-full bg-accent" />Wellness objective completed</span></p>
      </Card>

      <div className="grid gap-6 xl:grid-cols-[1fr_1.2fr]">
        <Card className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <div><Overline>{summary.missionDay >= 0 ? `Mission day ${summary.missionDay}` : `Pre-flight L${summary.missionDay}`}</Overline><h2 className="t-title2">{new Date(summary.from).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })}</h2></div>
            <CalendarDays size={20} className="text-ink-3" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            {(['heart_rate', 'hrv', 'spo2', 'temperature'] as VitalType[]).map((t) => {
              const v = summary.means(t);
              const b = engine.baselines[t];
              const z = v !== undefined && b && b.quality !== 'insufficient' ? (v - b.median) / b.spread : undefined;
              return (
                <div key={t} className="rounded-[16px] bg-sunken/60 p-3">
                  <p className="t-caption text-ink-3">{VITAL_META[t].shortLabel} · day mean</p>
                  <p className="t-headline tabular">{v !== undefined ? `${toDisplay(t, v, units).toFixed(VITAL_META[t].decimals)} ${displayUnit(t, units)}` : '—'}</p>
                  <p className={cn('t-caption', z === undefined ? 'text-ink-3' : Math.abs(z) >= 2.5 ? 'text-warning-ink' : 'text-success')}>{z === undefined ? 'no comparison' : Math.abs(z) < 1.5 ? 'within your usual range' : `${z > 0 ? 'above' : 'below'} baseline (z ${z.toFixed(1)})`}</p>
                </div>
              );
            })}
          </div>
          <ul className="flex flex-col gap-2">
            <li className="t-callout flex items-center gap-2"><BedDouble size={16} className="text-[var(--violet)]" />{summary.sleep ? `Slept ${summary.sleep.hours.toFixed(1)} h · quality ${summary.sleep.quality}` : 'No sleep record'}</li>
            <li className="t-callout flex items-center gap-2"><Footprints size={16} className="text-accent" />{summary.actDay ? `${summary.actDay.steps.toLocaleString('en-US')} steps${summary.actDay.exerciseMin ? ` · ${summary.actDay.exerciseMin} min exercise` : ''}${summary.actDay.source === 'demo' ? ' · synthetic' : ''}` : 'No activity record'}</li>
            <li className="t-callout flex items-center gap-2"><Brain size={16} className="text-[var(--series-1)]" />{summary.moods.length ? `Mood ${summary.moods.map((m) => m.mood).join(', ')} · stress ${summary.moods.map((m) => m.stress).join(', ')} (of 5)` : 'No mood check-in'}</li>
            {summary.alertsOpened.map((a) => <li key={a.id}><Link href={`/alerts/${encodeURIComponent(a.insightId)}`} className="t-callout flex items-center gap-2 hover:underline"><AlertTriangle size={16} className="text-warning-ink" />Alert raised: {a.title}{a.simulated ? ' (synthetic)' : ''}</Link></li>)}
            {summary.resolved.map((a) => <li key={a.id} className="t-callout flex items-center gap-2"><CheckCircle2 size={16} className="text-success" />Resolved: {a.title}</li>)}
            {summary.followups.map((x) => <li key={x.id} className="t-callout flex items-center gap-2"><Sparkles size={16} className="text-violet" />Follow-up: {x.title} — {x.status === 'done' ? x.outcome : 'due'}</li>)}
            {summary.objectives.map((e) => <li key={e.id} className="t-callout flex items-center gap-2"><CheckCircle2 size={16} className="text-accent" />{ACTIVITY[e.type].label} <span className="t-caption text-ink-3">+{e.xp} XP</span></li>)}
          </ul>
        </Card>

        <Card className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <Overline>Indicator over time</Overline>
            <select aria-label="Indicator" value={metric} onChange={(e) => { setMetric(e.target.value as VitalType); touch(); }} className="h-9 rounded-full border border-line-strong bg-raised px-3 text-[13px]">
              {INDICATORS.map((t) => <option key={t} value={t}>{VITAL_META[t].label}</option>)}
            </select>
          </div>
          <TrendChart ariaLabel={`${VITAL_META[metric].label} daily mean with baseline${projection ? ' and projected trend' : ''}`} points={daily.map((d) => ({ t: d.t, v: toDisplay(metric, d.v, units), synthetic: d.synthetic, source: `daily mean of ${d.n}` }))} unit={displayUnit(metric, units)} decimals={dec === 0 ? 1 : dec} band={baselineBand(engine.baselines[metric], metric, units)} projection={projection} height={300} launchAt={launch} />
          {proj ? (
            <div className="flex gap-2 rounded-[16px] bg-violet-soft p-3">
              <Info size={16} className="mt-0.5 shrink-0 text-violet" />
              <p className="t-callout text-ink-2">
                Over the last {Math.round(proj.spanDays)} days {VITAL_META[metric].label.toLowerCase()} has been {proj.direction} by about {Math.abs(toDisplay(metric, proj.slope, units)).toFixed(dec + 1)} {displayUnit(metric, units)}/day (R² {proj.r2.toFixed(2)}, {proj.n} readings). If that trend simply continued it would reach ~{toDisplay(metric, proj.projected, units).toFixed(dec)} in {proj.horizonDays} days{proj.leavesRangeInDays !== undefined ? `, leaving your usual range in about ${proj.leavesRangeInDays} days` : ''}. This is a straight-line extrapolation, not a medical prediction — trends often level off. Re-measure and talk to the crew medical officer if it continues.
              </p>
            </div>
          ) : (
            <p className="t-caption text-ink-3">No clear trend yet — so no projection.</p>
          )}
          <Badge label="Projections are qualified extrapolations — never guaranteed outcomes" tone="neutral" className="self-start" />
        </Card>
      </div>
    </div>
  );
}
