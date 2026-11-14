'use client';

import { Gauge } from 'lucide-react';
import Link from 'next/link';
import { useEffect } from 'react';

import { award } from '@/game/progress';

import { DataSourceBanner, useUnits } from '@/components/health';
import { Badge, Card, Overline, PageHeader, ProgressBar, Section, Segmented, SeverityBadge, cn, LearnMore } from '@/components/ui';
import { HealthDial } from '@/components/viz';
import type { AutonomyLevel } from '@/data/types';
import { VITAL_META, toDisplay } from '@/data/vitals';
import { AUTONOMY_COPY, BASELINE_METRICS, BASELINE_SOURCE_COPY } from '@/engine';
import { ESCALATION_LABEL, QUALITY_COPY, RISK_COPY, riskHistory } from '@/features/intelligence/intel';
import { PHASE_LABEL } from '@/features/health/vitals';
import { useNow } from '@/hooks/use-now';
import { useEngine } from '@/store/engine-runner';
import { useHealth } from '@/store/health';
import { TONE_CLASS, TONE_TEXT } from '@/theme';

export default function AssessmentsPage() {
  const engine = useEngine();
  const now = useNow(60_000);
  const units = useUnits();
  const alerts = useHealth((s) => s.alerts);
  const autonomy = useHealth((s) => s.autonomy);
  const setAutonomy = useHealth((s) => s.setAutonomy);
  const r = RISK_COPY[engine.risk.level];
  const history = riskHistory(alerts, now, 14);
  useEffect(() => {
    award('assessment_review');
  }, []);
  return (
    <div className="flex flex-col gap-6">
      <PageHeader overline="Intelligence" title="Health assessments" subtitle="Overall risk level, readiness index and the personal baselines every assessment is measured against. All rule-based and transparent — not clinically validated." />
      <DataSourceBanner compact />
      <div className="grid gap-6 xl:grid-cols-2">
        <Card className="flex flex-col gap-4">
          <Overline>Risk assessment</Overline>
          <p className={cn('t-display', TONE_TEXT[r.tone])}>{r.label}</p>
          <Badge label={`Escalation: ${ESCALATION_LABEL[engine.risk.escalation]}`} tone={r.tone} size="md" className="self-start" />
          <p className="t-body">{engine.risk.escalationText}</p>
          {engine.risk.drivers.length > 0 && (
            <div className="flex flex-col gap-2">
              <Overline>Driven by</Overline>
              {engine.risk.drivers.map((f) => (
                <Link key={f.id} href={`/alerts/${encodeURIComponent(f.id)}`} className="flex items-center justify-between gap-2 rounded-[14px] bg-sunken px-3 py-2 hover:bg-line-strong/40">
                  <span className="t-callout font-medium">{f.title}</span>
                  <SeverityBadge severity={f.severity} />
                </Link>
              ))}
            </div>
          )}
          <div>
            <Overline className="mb-2">Last 14 days</Overline>
            <div className="flex gap-1" role="img" aria-label="Daily risk level for the last 14 days">
              {history.map((d) => (
                <div key={d.day} title={`${d.day}: ${RISK_COPY[d.level].label}${d.alerts.length ? ` — ${d.alerts.join(', ')}` : ''}`} className={cn('h-8 flex-1 rounded-md', TONE_CLASS[RISK_COPY[d.level].tone].split(' ')[1])} />
              ))}
            </div>
          </div>
          <p className="t-caption text-ink-3">{engine.risk.method}</p>
        </Card>
        <Card className="flex flex-col gap-3">
          <Overline>Readiness index</Overline>
          <HealthDial risk={engine.risk} readiness={engine.readiness} size={320} />
          <div className="flex flex-col gap-2.5">
            {engine.readiness.components.map((c) => (
              <div key={c.label}>
                <div className="t-callout flex justify-between"><span>{c.label}</span><span className="tabular font-medium">{c.points}/{c.max} <span className="t-caption text-ink-3">{c.detail}</span></span></div>
                <ProgressBar value={c.points} max={c.max} label={c.label} />
              </div>
            ))}
          </div>
          <p className="t-caption text-ink-3">{engine.readiness.method}</p>
        </Card>
      </div>

      <Section title="Personal baselines" description="Your own normal per metric — robust median and spread, chosen by mission phase. Never a population range.">
        <Card className="overflow-x-auto p-0 sm:p-0">
          <table className="w-full min-w-[720px] text-left">
            <thead>
              <tr className="t-overline border-b border-line text-ink-3">
                {['Metric', 'Median', 'Usual range (p10–p90)', 'Readings', 'Window', 'Quality'].map((h) => <th key={h} className="px-4 py-3 font-medium">{h}</th>)}
              </tr>
            </thead>
            <tbody>
              {BASELINE_METRICS.map((m) => {
                const b = engine.baselines[m];
                const dec = VITAL_META[m].decimals;
                const ok = b && b.quality !== 'insufficient';
                return (
                  <tr key={m} className="t-callout border-b border-line last:border-0">
                    <td className="px-4 py-3"><Link href={`/vitals/${m}`} className="font-medium hover:underline">{VITAL_META[m].label}</Link></td>
                    <td className="px-4 py-3 tabular">{ok ? `${toDisplay(m, b.median, units).toFixed(dec)}${m === 'blood_pressure' && b.median2 ? `/${Math.round(b.median2)}` : ''} ${VITAL_META[m].unit}` : '—'}</td>
                    <td className="px-4 py-3 tabular">{ok ? `${toDisplay(m, b.p10, units).toFixed(dec)}–${toDisplay(m, b.p90, units).toFixed(dec)}` : '—'}</td>
                    <td className="px-4 py-3 tabular">{b?.n ?? 0} / {b?.coverageDays ?? 0} d</td>
                    <td className="px-4 py-3 text-ink-2" title={b ? BASELINE_SOURCE_COPY[b.source] : ''}>{b ? PHASE_LABEL[b.phase] : '—'}</td>
                    <td className="px-4 py-3">{b && <Badge label={QUALITY_COPY[b.quality].label} tone={QUALITY_COPY[b.quality].tone} />}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Card>
        <LearnMore title="How baselines are rated">Insufficient &lt; 10 readings or &lt; 5 days; provisional &lt; 20 readings or &lt; 10 days; otherwise established. The latest 3 days are excluded from the window.</LearnMore>
      </Section>

      <Section title="Autonomy level" description="How much the on-board system interprets. No level prescribes, doses or intervenes.">
        <Card className="flex flex-col gap-3">
          <Segmented label="Autonomy level" value={String(autonomy) as '1'} onChange={(v) => setAutonomy(Number(v) as AutonomyLevel)} options={([1, 2, 3, 4] as const).map((l) => ({ value: String(l) as '1', label: `${l} · ${AUTONOMY_COPY[l].name}` }))} />
          <p className="t-callout flex items-start gap-2"><Gauge size={16} className="mt-0.5 shrink-0 text-primary" /> {AUTONOMY_COPY[autonomy].does} {AUTONOMY_COPY[autonomy].never}</p>
        </Card>
      </Section>
    </div>
  );
}
