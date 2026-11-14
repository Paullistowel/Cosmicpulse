'use client';

import { Download, FileHeart, FileText, Printer, Sparkles, Stethoscope } from 'lucide-react';
import { useMemo, useRef, useState } from 'react';

import { useDock } from '@/components/assistant/use-assistant';
import { toast } from '@/components/toast';
import { Badge, Button, Card, Overline, PageHeader, Segmented, cn } from '@/components/ui';
import { buildEmergencySummary, buildHealthReport, renderHealthReportHtml, renderSummaryHtml, type ReportRange } from '@/features/medical/report-model';
import { stamp } from '@/features/health/vitals';
import { renderBriefHtml } from '@/lib/brief';
import { useDataSource } from '@/services/data-source';
import { useNow } from '@/hooks/use-now';
import { useEngine, useHazards } from '@/store/engine-runner';
import { useHealth } from '@/store/health';

type Kind = 'health' | 'summary' | 'brief';
const KINDS: { value: Kind; label: string; icon: typeof FileText; blurb: string }[] = [
  { value: 'brief', label: 'Flight surgeon brief', icon: Stethoscope, blurb: 'Every current finding with measurement, baseline, deviation, hazards, evidence and next steps.' },
  { value: 'health', label: 'Health report', icon: FileText, blurb: 'Vitals vs baseline, alerts, incidents and medication administrations for a period.' },
  { value: 'summary', label: 'Emergency medical summary', icon: FileHeart, blurb: 'One page: blood type, allergies, conditions, medications and latest vitals.' },
];

export default function ReportsPage() {
  const h = useHealth();
  const engine = useEngine();
  const hazards = useHazards();
  const ds = useDataSource();
  const queue = useDock((s) => s.queue);
  const [kind, setKind] = useState<Kind>('brief');
  const [range, setRange] = useState<ReportRange>(30);
  const frame = useRef<HTMLIFrameElement>(null);
  const demo = ds.state === 'demo' || ds.state === 'mixed';
  const now = useNow(60_000);
  const html = useMemo(() => {
    const base = { profile: h.profile, crew: h.crew, astronautId: h.astronautId, mission: h.mission, records: h.records, medications: h.medications, measurements: h.measurements, incidents: h.incidents, alerts: h.alerts, baselines: engine.baselines, demo, now };
    if (kind === 'summary') return renderSummaryHtml(buildEmergencySummary(base));
    if (kind === 'health') return renderHealthReportHtml(buildHealthReport({ ...base, administrations: h.administrations, inventory: h.inventory, rangeDays: range }));
    return renderBriefHtml({ name: h.profile.name, mission: `${h.mission.designator} · ${h.mission.name}`, findings: engine.findings, hazards, measurements: h.measurements, baselines: engine.baselines, demo, now });
  }, [kind, range, h, engine, hazards, demo, now]);
  const title = KINDS.find((k) => k.value === kind)!.label;

  const record = () => h.addReport({ title, config: { rangeDays: range, includeVitals: true, includeLabs: false, includeMedications: true, includeHistory: true, includeAiSummary: false, includeAlerts: true, includeMood: false } });

  return (
    <div className="flex flex-col gap-6">
      <PageHeader overline="Records" title="Medical reports" subtitle="Deterministic, printable reports built on this device from your records. Print or save as PDF, or download for the flight surgeon." />
      <div className="grid gap-3 md:grid-cols-3">
        {KINDS.map((k) => (
          <button key={k.value} onClick={() => setKind(k.value)} aria-pressed={kind === k.value} className={cn('card flex flex-col gap-1.5 p-4 text-left transition-transform hover:-translate-y-0.5', kind === k.value && 'ring-2 ring-[var(--pill)]')}>
            <k.icon size={18} className="text-ink-2" />
            <span className="t-headline">{k.label}</span>
            <span className="t-caption text-ink-2">{k.blurb}</span>
          </button>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {kind === 'health' && <Segmented label="Report period" value={String(range) as '30'} onChange={(v) => setRange(Number(v) as ReportRange)} options={[{ value: '7', label: '7 days' }, { value: '30', label: '30 days' }, { value: '90', label: '90 days' }]} />}
        {demo && <Badge label="Includes SYNTHETIC data — labelled in the report" tone="demo" size="md" />}
        <div className="ml-auto flex flex-wrap gap-2">
          <Button size="sm" variant="secondary" icon={Sparkles} onClick={() => queue('Prepare a medical summary for the flight surgeon')}>AI summary</Button>
          <Button size="sm" variant="outline" icon={Download} onClick={() => { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([html], { type: 'text/html' })); a.download = `cosmicpulse-${kind}-${new Date().toISOString().slice(0, 10)}.html`; a.click(); URL.revokeObjectURL(a.href); record(); toast('Report downloaded'); }}>Download</Button>
          <Button size="sm" icon={Printer} onClick={() => { frame.current?.contentWindow?.print(); record(); }}>Print / PDF</Button>
        </div>
      </div>
      <Card className="overflow-hidden p-0 sm:p-0">
        <iframe ref={frame} title={`${title} preview`} srcDoc={html} className="h-[75vh] w-full bg-white" sandbox="allow-modals allow-same-origin" />
      </Card>
      {h.reports.length > 0 && (
        <Card className="flex flex-col gap-1">
          <Overline>Generated</Overline>
          {h.reports.slice(0, 8).map((r) => <p key={r.id} className="t-caption text-ink-2">{stamp(r.createdAt)} · {r.title}</p>)}
        </Card>
      )}
    </div>
  );
}
