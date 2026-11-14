'use client';

import { BellOff, FlaskConical } from 'lucide-react';
import Link from 'next/link';
import { useMemo, useState } from 'react';

import { DataSourceBanner } from '@/components/health';
import { Badge, Card, EmptyState, FindingKindBadge, Notice, PageHeader, Section, Segmented, SeverityBadge, alertCategory } from '@/components/ui';
import { findingCategory } from '@/engine';
import { AUTONOMY_COPY } from '@/engine/risk';
import { ALERT_STATE_COPY } from '@/features/intelligence/intel';
import { ago } from '@/features/health/vitals';
import { useNow } from '@/hooks/use-now';
import { useEngine } from '@/store/engine-runner';
import { useHealth } from '@/store/health';

type Filter = 'open' | 'all' | 'resolved';

export default function AlertsPage() {
  const now = useNow(60_000);
  const engine = useEngine();
  const alerts = useHealth((s) => s.alerts);
  const autonomy = useHealth((s) => s.autonomy);
  const [filter, setFilter] = useState<Filter>('open');
  const list = useMemo(() => alerts.filter((a) => (filter === 'open' ? a.state !== 'resolved' : filter === 'resolved' ? a.state === 'resolved' : true)).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)), [alerts, filter]);
  const counts = useMemo(() => {
    const c = { Normal: 0, Warning: 0, Critical: 0 };
    engine.findings.forEach((f) => c[alertCategory(f.severity).label]++);
    return c;
  }, [engine.findings]);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader overline="Intelligence" title="Alerts & recommendations" subtitle="Findings from the on-board engine, sorted by severity, each with the measurement, your baseline, the evidence and the next step." />
      <DataSourceBanner compact />
      {autonomy < 2 && <Notice tone="warning" title="Alerts are off">Autonomy level 1 ({AUTONOMY_COPY[1].name}) collects data without interpretation. Change it in Settings.</Notice>}

      <div className="grid grid-cols-3 gap-3">
        {(['Normal', 'Warning', 'Critical'] as const).map((k) => (
          <Card key={k} className="flex flex-col gap-1">
            <Badge label={k} tone={k === 'Critical' ? 'critical' : k === 'Warning' ? 'warning' : 'success'} className="self-start" />
            <p className="t-metric-lg">{counts[k]}</p>
            <p className="t-caption text-ink-3">{k === 'Normal' ? 'informational findings' : k === 'Warning' ? 'attention / medical review' : 'urgent findings'}</p>
          </Card>
        ))}
      </div>

      <Section title="Current findings" description="Re-computed every minute from your data. Categories: Normal = informational, Warning = attention or medical review recommended, Critical = urgent attention.">
        <div className="grid gap-3 lg:grid-cols-2">
          {engine.findings.length === 0 && (
            <Card className="lg:col-span-2">
              <EmptyState icon={BellOff} title="No findings" body="Your recent readings sit within your personal baselines and mission rules." />
            </Card>
          )}
          {engine.findings.map((f) => {
            const cat = alertCategory(f.severity);
            return (
              <Link key={f.id} href={`/alerts/${encodeURIComponent(f.id)}`} className="card flex flex-col gap-2 p-4 transition-transform hover:-translate-y-0.5 sm:p-5">
                <div className="flex flex-wrap gap-1.5">
                  <Badge label={cat.label} tone={cat.tone} />
                  <Badge label={findingCategory(f)} />
                  <FindingKindBadge kind={f.kind} />
                  <SeverityBadge severity={f.severity} />
                  {f.simulated && <Badge label="SYNTHETIC" tone="demo" icon={FlaskConical} />}
                </div>
                <p className="t-headline">{f.title}</p>
                <p className="t-callout text-ink-2">{f.summary}</p>
                <p className="t-callout"><span className="font-medium">Next step: </span><span className="text-ink-2">{f.nextStep}</span></p>
              </Link>
            );
          })}
        </div>
      </Section>

      <Section title="Alert log" description="One alert per condition (deduplicated by fingerprint). Simulated alerts never trigger escalation or system notifications.">
        <Segmented label="Filter alerts" value={filter} onChange={setFilter} options={[{ value: 'open', label: 'Open' }, { value: 'resolved', label: 'Resolved' }, { value: 'all', label: 'All' }]} />
        <Card className="py-2">
          {list.length === 0 && <p className="t-callout px-2 py-6 text-center text-ink-3">No alerts in this view.</p>}
          {list.map((a) => (
            <Link key={a.id} href={`/alerts/${encodeURIComponent(a.insightId)}`} className="flex flex-wrap items-center gap-3 rounded-[16px] px-2 py-3 hover:bg-sunken">
              <div className="min-w-0 flex-1">
                <p className="t-callout font-medium">{a.title}</p>
                <p className="t-telemetry text-ink-3">
                  raised {ago(a.createdAt, now)} · updated {ago(a.updatedAt, now)} {a.escalation ? `· escalated to ${a.escalation.replace(/_/g, ' ')}` : ''}
                </p>
              </div>
              {a.simulated && <Badge label="SYNTHETIC" tone="demo" />}
              <Badge label={ALERT_STATE_COPY[a.state].label} tone={ALERT_STATE_COPY[a.state].tone} />
              <SeverityBadge severity={a.severity} />
            </Link>
          ))}
        </Card>
      </Section>
    </div>
  );
}
