'use client';

import { Activity, ArrowLeft, BookOpenText, CheckCheck, ClipboardCheck, ExternalLink, FlaskConical, Gauge, HelpCircle, ListChecks, Send, ShieldAlert, Sparkles, Stethoscope, Target, TrendingUp } from 'lucide-react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useMemo } from 'react';

import { useDock } from '@/components/assistant/use-assistant';
import { useUnits } from '@/components/health';
import { toast } from '@/components/toast';
import { Badge, Button, Card, EmptyState, FindingKindBadge, Notice, Overline, PageHeader, SeverityBadge, alertCategory, Summary, LearnMore } from '@/components/ui';
import { TrendChart } from '@/components/viz';
import { VITAL_META, displayUnit } from '@/data/vitals';
import { explainFinding, findingCategory, findProtocol } from '@/engine';
import { ALERT_STATE_COPY, alertForFinding } from '@/features/intelligence/intel';
import { ago, baselineBand, stamp } from '@/features/health/vitals';
import { useNow } from '@/hooks/use-now';
import { evidenceForFinding } from '@/intel/evidence';
import { trendPoints } from '@/lib/series';
import { HAZARD_BY_ID } from '@/research/hazards';
import { resolveRef } from '@/research/sources';
import { useEngine } from '@/store/engine-runner';
import { useHealth } from '@/store/health';

const STEP_ICON = [Gauge, Activity, Target, TrendingUp, HelpCircle, BookOpenText, ListChecks, Stethoscope];

function Step({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  const Icon = STEP_ICON[n - 1] ?? Gauge;
  return (
    <Card className="flex gap-4">
      <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary-soft text-primary" title={`Step ${n}`}><Icon size={18} aria-hidden /></span>
      <div className="min-w-0 flex-1">
        <h2 className="t-headline mb-1.5">{title}</h2>
        <div className="t-callout flex flex-col gap-2 text-ink-2">{children}</div>
      </div>
    </Card>
  );
}

export default function FindingDetail() {
  const { id: raw } = useParams<{ id: string }>();
  const id = decodeURIComponent(raw);
  const now = useNow(60_000);
  const units = useUnits();
  const engine = useEngine();
  const measurements = useHealth((s) => s.measurements);
  const alerts = useHealth((s) => s.alerts);
  const profile = useHealth((s) => s.profile);
  const transition = useHealth((s) => s.transitionAlert);
  const send = useHealth((s) => s.sendCrewMessage);
  const queue = useDock((s) => s.queue);
  const finding = engine.findings.find((f) => f.id === id);
  const alert = alertForFinding(alerts, id);
  const ex = useMemo(() => (finding ? explainFinding(finding, { measurements, baselines: engine.baselines, now, alert }) : null), [finding, measurements, engine.baselines, now, alert]);
  const ev = useMemo(() => (finding ? evidenceForFinding(finding) : null), [finding]);

  if (!finding || !ex || !ev) {
    return (
      <div className="flex flex-col gap-4">
        <Link href="/alerts" className="t-callout flex items-center gap-1 text-ink-2"><ArrowLeft size={16} /> Alerts</Link>
        <Card>
          <EmptyState icon={CheckCheck} title={alert ? 'This condition is no longer detected' : 'Finding not found'} body={alert ? `“${alert.title}” was ${alert.state}. The engine closes alerts automatically when the condition clears.` : 'It may have been resolved by newer data.'} />
          {alert && (
            <ol className="mx-auto flex max-w-lg flex-col gap-1.5 pb-4">
              {alert.history.map((h, i) => (
                <li key={i} className="t-caption text-ink-2">{stamp(h.at)} — {h.state} by {h.by}{h.note ? ` (${h.note})` : ''}</li>
              ))}
            </ol>
          )}
        </Card>
      </div>
    );
  }

  const cat = alertCategory(finding.severity);
  const metric = ex.metric;
  const pts = metric ? trendPoints(measurements, metric, '30d', now, units) : [];
  const protocols = (finding.protocolIds ?? []).map(findProtocol).filter(Boolean);
  const escalate = finding.severity === 'high' || finding.severity === 'critical';

  return (
    <div className="flex flex-col gap-5">
      <Link href="/alerts" className="t-callout flex items-center gap-1 text-ink-2 hover:text-ink"><ArrowLeft size={16} /> Alerts & recommendations</Link>
      <div className="flex flex-wrap gap-1.5">
        <Badge label={cat.label} tone={cat.tone} size="md" />
        <Badge label={findingCategory(finding)} size="md" />
        <FindingKindBadge kind={finding.kind} />
        <SeverityBadge severity={finding.severity} />
        {alert && <Badge label={`Alert ${ALERT_STATE_COPY[alert.state].label.toLowerCase()}`} tone={ALERT_STATE_COPY[alert.state].tone} />}
      </div>
      <PageHeader title={finding.title} subtitle={finding.summary} actions={<Button size="sm" variant="secondary" icon={Sparkles} onClick={() => queue(`Explain why the alert "${finding.title}" was generated`)}>Ask why</Button>} />
      {ex.simulated && <Notice tone="demo" icon={FlaskConical} title="SYNTHETIC — demonstration only">This finding rests only on simulated readings. It is not a real health event and never triggers escalation or notifications.</Notice>}

      <div className="grid gap-4 xl:grid-cols-2">
        <Step n={1} title="Indicator">
          <p className="t-title3 text-ink">{ex.metricLabel}</p>
          {metric && <Summary text={VITAL_META[metric].about} />}
        </Step>
        <Step n={2} title="Recorded measurement">
          {ex.latest ? (
            <>
              <p className="t-title3 text-ink">{ex.latest.text}</p>
              <p>{stamp(ex.latest.takenAt)} ({ago(ex.latest.takenAt, now)}) · {ex.latest.source}{!/simulated/i.test(ex.latest.source) && <> · <span className={ex.latest.status === 'simulated' ? 'text-demo' : ''}>{ex.latest.status.toUpperCase()}</span></>}</p>
            </>
          ) : (
            <p>{finding.contributing.map((c) => `${c.label}: ${c.value}`).join(' · ') || 'Not a single-measurement finding.'}</p>
          )}
        </Step>
        <Step n={3} title="Your established baseline">
          <p>{ex.baseline}</p>
          {!ex.baselineEstablished && <p className="text-warning-ink">Baseline not yet established — the finding relies on mission rules rather than your personal norm.</p>}
        </Step>
        <Step n={4} title="Nature of the deviation">
          <p><span className="font-medium text-ink">What changed: </span>{finding.whatChanged}</p>
          <LearnMore title="Rule & persistence">
            <p><span className="font-medium text-ink">Rule: </span>{finding.why}</p>
            <p><span className="font-medium text-ink">Persistence: </span>{ex.persistence.text}</p>
          </LearnMore>
          {ex.outcome && <p><span className="font-medium text-ink">Since the alert: </span>{ex.outcome.text}</p>}
        </Step>
        <Step n={5} title="Potential contributing factors">
          <Summary text={finding.uncertainty} />
          {ev.hazards.length > 0 && (
            <p>
              Spaceflight context:{' '}
              {ev.hazards.map((h, i) => (
                <span key={h}>{i > 0 && ', '}<Link className="font-medium text-primary hover:underline" href={`/risk/${h}`}>{HAZARD_BY_ID[h].name}</Link></span>
              ))}
              . These are possible contributors, not a diagnosis.
            </p>
          )}
        </Step>
        <Step n={6} title="Supporting scientific evidence">
          {ev.refs.slice(0, 1).map((r) => {
            const x = resolveRef(r);
            if (!x) return null;
            return (
              <p key={r} className="flex items-start gap-2">
                <BookOpenText size={15} className="mt-0.5 shrink-0 text-primary" />
                <span>
                  {x.fact?.text ?? x.source.summary}{' '}
                  <Link href={`/research/${x.source.id}`} className="font-medium text-primary hover:underline">[{x.source.org}: {x.source.title}]</Link>
                </span>
              </p>
            );
          })}
          {ev.refs.length > 1 && (
            <LearnMore title={`${Math.min(3, ev.refs.length - 1)} more sources`}>
              {ev.refs.slice(1, 4).map((r) => {
                const x = resolveRef(r);
                return x ? <p key={r}>• {x.fact?.text ?? x.source.summary} <Link href={`/research/${x.source.id}`} className="font-medium text-primary hover:underline">[{x.source.org}]</Link></p> : null;
              })}
            </LearnMore>
          )}
          {ev.risks.length > 0 && <div className="flex flex-wrap gap-1.5">{ev.risks.map((r) => <span key={r.name} className="t-caption rounded-full bg-sunken px-2.5 py-1">{r.name.replace(/^Risk of /, '')}</span>)}</div>}
        </Step>
        <Step n={7} title="Recommended next steps">
          <ul className="list-disc space-y-1 pl-5">
            {ex.nextSteps.map((s) => <li key={s}>{s}</li>)}
          </ul>
          {protocols.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {protocols.map((p) => <Badge key={p!.id} label={`${p!.id} v${p!.version} · ${p!.title}`} tone="accent" icon={ShieldAlert} />)}
            </div>
          )}
          <p className="t-caption text-ink-3">Protocols come from the demonstration knowledge base (not flight-approved).</p>
        </Step>
        <Step n={8} title="Medical review & escalation">
          <p><span className="font-medium text-ink">{ex.tierLabel}: </span>{ex.tierMeaning}</p>
          <p>{escalate ? 'Medical review is appropriate: share with the crew medical officer and the flight surgeon.' : 'No escalation needed now; keep monitoring and re-check if it persists.'}</p>
          {finding.severity === 'critical' && <Link href="/emergency" className="font-semibold text-critical hover:underline">Open Emergency →</Link>}
        </Step>
      </div>

      {metric && (
        <Card className="flex flex-col gap-2">
          <Overline>{VITAL_META[metric].label} · last 30 days</Overline>
          <TrendChart ariaLabel={`${VITAL_META[metric].label} trend`} points={pts} unit={displayUnit(metric, units)} decimals={metric === 'temperature' ? 1 : 0} band={baselineBand(engine.baselines[metric], metric, units)} height={240} secondLabel={metric === 'blood_pressure' ? 'Diastolic' : undefined} />
        </Card>
      )}

      {alert && (
        <Card className="flex flex-col gap-3">
          <Overline>Alert workflow</Overline>
          <div className="flex flex-wrap gap-2">
            {alert.state === 'active' && <Button size="sm" icon={ClipboardCheck} onClick={() => { transition(alert.id, 'acknowledged', profile.name); toast('Alert acknowledged'); }}>Acknowledge</Button>}
            {alert.state !== 'escalated' && alert.state !== 'resolved' && !alert.simulated && (
              <Button size="sm" variant="outline" icon={Send} onClick={() => { transition(alert.id, 'escalated', profile.name, 'Escalated from CosmicPulse Web'); send(`Alert for review: ${finding.title}. ${finding.whatChanged}`, 'Flight surgeon (demo)'); toast('Escalated — message queued for the flight surgeon'); }}>
                Escalate to flight surgeon
              </Button>
            )}
            {alert.simulated && alert.state !== 'resolved' && <Badge label="Simulated alerts cannot be escalated" tone="demo" />}
          </div>
          <ol className="flex flex-col gap-1">
            {alert.history.map((h, i) => <li key={i} className="t-caption text-ink-2">{stamp(h.at)} — {h.state} · {h.by}{h.note ? ` · ${h.note}` : ''}</li>)}
          </ol>
        </Card>
      )}
      <p className="t-caption text-ink-3">Method: {finding.method}. Informational only — CosmicPulse does not diagnose; decisions belong to authorised medical personnel. <Link className="inline-flex items-center gap-0.5 hover:underline" href="/research">Evidence library <ExternalLink size={11} /></Link></p>
    </div>
  );
}
