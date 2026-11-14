'use client';

import { Dumbbell, Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';

import { DataSourceBanner } from '@/components/health';
import { toast } from '@/components/toast';
import { Badge, ButtonLink, Card, Field, IconButton, Input, Overline, PageHeader, ProgressBar, Section, Segmented, SourceBadge, Stat } from '@/components/ui';
import { DailyBars } from '@/components/viz';
import { PERIOD_LABEL, distanceProvenance, fmtDistance, keyToDate, summarize, type Period } from '@/engine/activity';
import { ago, stamp } from '@/features/health/vitals';
import { useNow } from '@/hooks/use-now';
import { exerciseSignal } from '@/intel/hazard-profile';
import { useActivity, useResolvedActivity } from '@/store/activity';
import { useHealth } from '@/store/health';

const DEVICE_LABEL = { treadmill: 'Treadmill', cycle_ergometer: 'Cycle ergometer', resistive: 'Resistive exercise', eva: 'EVA', other: 'Other' } as const;

export default function ActivityPage() {
  const now = useNow(60_000);
  const act = useResolvedActivity();
  const prefs = useActivity((s) => s.prefs);
  const setPrefs = useActivity((s) => s.setPrefs);
  const manual = useActivity((s) => s.manual);
  const delManual = useActivity((s) => s.deleteManual);
  const exercise = useHealth((s) => s.exercise);
  const [period, setPeriod] = useState<Period>('week');
  const [goal, setGoal] = useState(String(prefs.stepGoal));
  const s = summarize(act.days, period, now, prefs);
  const sig = exerciseSignal(exercise, now);
  const sessions = [...exercise].sort((a, b) => b.at.localeCompare(a.at));

  return (
    <div className="flex flex-col gap-6">
      <PageHeader overline="Monitoring" title="Activity" subtitle="Steps, distance, exercise sessions and history — the countermeasures that protect bone, muscle and cardiovascular fitness." actions={<ButtonLink href="/record?tab=activity" icon={Plus} size="sm">Log activity</ButtonLink>} />
      <DataSourceBanner compact />
      <Segmented label="Period" value={period} onChange={setPeriod} options={(['day', 'week', 'month', 'year', 'lifetime'] as Period[]).map((p) => ({ value: p, label: PERIOD_LABEL[p] }))} />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Card className="col-span-2 flex flex-col gap-2 lg:col-span-1">
          <Overline>{period === 'day' ? 'Steps today' : 'Average steps / day'}</Overline>
          <p className="t-metric-lg">{Math.round(period === 'day' ? s.steps : s.avgStepsPerDay).toLocaleString('en-US')}</p>
          <ProgressBar value={s.goalProgress} label="Goal progress" />
          <p className="t-caption text-ink-3">Goal {s.goal.toLocaleString('en-US')} · {act.demo ? 'SYNTHETIC' : 'real data'}</p>
        </Card>
        <Card><Stat label="Distance" value={fmtDistance(s.distanceM)} detail={distanceProvenance(s)} /></Card>
        <Card><Stat label="Exercise" value={Math.round(s.exerciseMin)} unit="min" detail={`${s.daysWithData} days with data`} /></Card>
        <Card><Stat label="Goal consistency" value={`${Math.round(s.consistency * 100)}%`} detail={s.changePct !== undefined ? `${s.changePct > 0 ? '+' : ''}${Math.round(s.changePct * 100)}% vs previous` : 'no previous period'} /></Card>
      </div>
      {sig && <Badge label={`${sig.label}: ${sig.detail}`} tone={sig.level === 'attention' ? 'warning' : 'info'} size="md" className="self-start whitespace-normal" />}
      <Card className="flex flex-col gap-2">
        <div className="flex items-center justify-between"><Overline>Daily steps</Overline>{act.demo && <Badge label="SYNTHETIC" tone="demo" />}</div>
        <DailyBars ariaLabel="Daily steps" data={s.series.slice(-60).map((d) => ({ label: keyToDate(d.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }), v: d.steps, synthetic: d.source === 'demo', note: d.origins.join(', ') }))} unit="steps" goal={s.goal} goalLabel={`Goal ${s.goal.toLocaleString('en-US')}`} />
        {s.mostActive && <p className="t-caption text-ink-3">Most active: {keyToDate(s.mostActive.date).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'short' })} · {s.mostActive.steps.toLocaleString('en-US')} steps</p>}
      </Card>
      <div className="grid gap-6 xl:grid-cols-2">
        <Section title="Exercise sessions" description="Countermeasure sessions from the habitat devices.">
          <Card className="flex flex-col gap-1 py-2">
            {sessions.length === 0 && <p className="t-callout px-2 py-4 text-ink-3">No exercise sessions recorded.</p>}
            {sessions.slice(0, 14).map((x) => (
              <div key={x.id} className="flex flex-wrap items-center gap-3 rounded-[14px] px-2 py-2.5">
                <span className="flex size-9 items-center justify-center rounded-full bg-sunken text-ink-2"><Dumbbell size={16} /></span>
                <div className="min-w-0 flex-1">
                  <p className="t-callout font-medium">{DEVICE_LABEL[x.device]} · {x.minutes} min</p>
                  <p className="t-caption text-ink-3">{stamp(x.at)}{x.avgHr ? ` · avg HR ${x.avgHr}` : ''}{x.peakHr ? ` · peak ${x.peakHr}` : ''}{x.load ? ` · ${x.load}` : ''}</p>
                </div>
                <SourceBadge source={x.source} />
              </div>
            ))}
          </Card>
        </Section>
        <Section title="Goal & manual entries">
          <Card className="flex flex-col gap-4">
            <form className="flex items-end gap-2" onSubmit={(e) => { e.preventDefault(); const g = Number(goal); if (!Number.isInteger(g) || g < 1000 || g > 50000) return toast('Goal must be 1,000–50,000 steps', 'warning'); setPrefs({ stepGoal: g }); toast('Step goal updated'); }}>
              <Field label="Daily step goal" htmlFor="goal" className="flex-1"><Input id="goal" inputMode="numeric" value={goal} onChange={(e) => setGoal(e.target.value)} /></Field>
              <button className="h-11 rounded-full bg-pill px-5 text-sm font-medium text-on-pill">Save</button>
            </form>
            <div className="flex flex-col gap-1">
              <Overline>Manual entries</Overline>
              {manual.length === 0 && <p className="t-callout text-ink-3">None yet.</p>}
              {[...manual].reverse().map((m) => (
                <div key={m.id} className="flex items-center gap-2 rounded-[14px] px-1 py-1.5">
                  <span className="t-callout flex-1">{keyToDate(m.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })} · {m.steps?.toLocaleString('en-US') ?? '—'} steps{m.distanceM ? ` · ${fmtDistance(m.distanceM)}` : ''}{m.exerciseMin ? ` · ${m.exerciseMin} min` : ''}</span>
                  <span className="t-telemetry text-ink-3">{ago(m.syncedAt, now)}</span>
                  <IconButton icon={Trash2} label="Delete entry" onClick={() => { delManual(m.id); toast('Entry deleted'); }} />
                </div>
              ))}
            </div>
          </Card>
        </Section>
      </div>
    </div>
  );
}
