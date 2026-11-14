'use client';

import { useState } from 'react';
import { ArrowDownRight, ArrowRight, ArrowUpRight, CheckCircle2, ChevronRight, FlaskConical, Sparkles } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';

import type { CrewRole, HealthAlert, Insight, Measurement, Mission, VitalType } from '@/data/types';
import { VITAL_META, classify } from '@/data/vitals';
import { MISSION_TYPE_LABEL, findingCategory, type Baseline } from '@/engine';
import { VITAL_ICON } from '@/features/health/meta';
import { PHASE_LABEL, ago, baselineDelta, formatDelay, formatMet, latestOf, seriesOf } from '@/features/health/vitals';
import { useNow } from '@/hooks/use-now';
import { STATE_COPY, metricList, useDataSource } from '@/services/data-source';
import { useSettings } from '@/store/settings';
import { TONE_TEXT } from '@/theme';
import { useLinkSummary } from './shell/app-shell';
import { useDock } from './assistant/use-assistant';
import { Badge, Button, Card, FindingKindBadge, Glass, LivePulse, Overline, SeverityBadge, SourceBadge, cn, severityTone } from './ui';
import { Sparkline } from './viz';

export const ROLE_LABEL: Record<CrewRole, string> = {
  commander: 'Commander',
  pilot: 'Pilot',
  flight_engineer: 'Flight engineer',
  mission_specialist: 'Mission specialist',
  crew_medical_officer: 'Crew medical officer',
  payload_specialist: 'Payload specialist',
};

export function useUnits() {
  const system = useSettings((s) => s.units);
  const glucose = useSettings((s) => s.glucoseUnit);
  return { system, glucose };
}

export function MetClock({ launchedAt }: { launchedAt: string }) {
  const now = useNow(1000);
  return (
    <p className="font-mono text-[26px] leading-8 font-medium tracking-tight tabular" aria-label="Mission elapsed time">
      {formatMet(launchedAt, now)}
    </p>
  );
}

/** Cinematic mission hero (mobile MissionHero): EVA photograph + liquid-glass telemetry panel. */
export function MissionHero({ mission, now }: { mission: Mission; now: number }) {
  const link = useLinkSummary();
  const online = link.state === 'online';
  const color = link.failed ? 'var(--critical)' : online ? 'var(--success)' : link.state === 'not_configured' ? 'var(--ink-3)' : 'var(--warning)';
  const day = Math.max(0, Math.floor((now - new Date(mission.launchedAt).getTime()) / 86_400_000));
  return (
    <section aria-label={`Mission ${mission.designator}, ${MISSION_TYPE_LABEL[mission.type]}, day ${day} of ${mission.plannedDays}`} className="relative flex h-[380px] flex-col justify-between overflow-hidden rounded-[30px] bg-[#D9E2EA] p-2.5 shadow-card">
      <Image src="/images/eva-hero.jpg" alt="" fill priority sizes="(min-width: 1024px) 50vw, 100vw" className="object-cover object-[50%_35%]" />
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-white/5 to-[rgba(20,24,28,0.35)]" />
      <div className="relative flex items-center justify-between p-1.5">
        <Glass className="flex h-[30px] items-center rounded-full px-3">
          <span className="t-telemetry font-semibold">{mission.designator}</span>
        </Glass>
        <Badge label={PHASE_LABEL[mission.phase]} tone="primary" size="md" />
      </div>
      <Glass className="relative flex flex-col gap-2.5 rounded-[24px] p-4">
        <div>
          <p className="t-title3 truncate">{MISSION_TYPE_LABEL[mission.type]}</p>
          <p className="t-caption truncate text-ink-2">
            {mission.habitat} · Day {day} of {mission.plannedDays}
          </p>
        </div>
        <div>
          <Overline>Mission elapsed time</Overline>
          <MetClock launchedAt={mission.launchedAt} />
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="flex items-center gap-1.5">
            <LivePulse live={online} color={color} size={7} />
            <span className="t-telemetry">{link.copy.label.toUpperCase()}</span>
          </span>
          <span className="t-telemetry text-ink-2">
            DELAY {formatDelay(mission.commDelaySec).toUpperCase()} · {link.lastSyncAt ? `SYNC ${ago(link.lastSyncAt, now).toUpperCase()}` : `${link.queued} QUEUED`}
          </span>
        </div>
      </Glass>
    </section>
  );
}

/** Key-vital tile (mobile VitalGlance): latest value, baseline delta arrow, sparkline, provenance. */
export function VitalTile({ type, measurements, baseline, now }: { type: VitalType; measurements: Measurement[]; baseline?: Baseline; now: number }) {
  const units = useUnits();
  const thresholds = useSettings((s) => s.thresholds);
  const latest = latestOf(measurements, type, now);
  const series = seriesOf(measurements, type, now).slice(-24);
  const meta = VITAL_META[type];
  const Icon = VITAL_ICON[type];
  const delta = baselineDelta(latest, baseline, units);
  const band = latest ? classify(latest, thresholds) : null;
  const synthetic = latest && (latest.source.kind === 'simulated' || latest.source.kind === 'demo');
  return (
    <Link href={`/vitals/${type}`} className="card group flex min-w-0 flex-col gap-2 p-4 transition-transform duration-200 hover:-translate-y-0.5 hover:shadow-float" aria-label={`${meta.label}: ${latest ? '' : 'no data'}`}>
      <div className="flex items-center justify-between gap-2">
        <span className="flex min-w-0 items-center gap-2">
          <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-sunken text-ink-2">
            <Icon size={16} aria-hidden />
          </span>
          <span className="t-callout truncate font-medium">{meta.shortLabel}</span>
        </span>
        {synthetic && <FlaskConical size={14} className="shrink-0 text-demo" aria-label="Synthetic reading" />}
      </div>
      {latest ? (
        <>
          <p className="flex items-baseline gap-1.5">
            <span className="t-metric">{type === 'blood_pressure' ? `${Math.round(latest.value)}/${Math.round(latest.value2 ?? 0)}` : (type === 'temperature' && units.system === 'us' ? (latest.value * 9) / 5 + 32 : latest.value).toFixed(type === 'temperature' ? 1 : 0)}</span>
            <span className="t-telemetry text-ink-3">{type === 'temperature' ? (units.system === 'us' ? '°F' : '°C') : meta.unit}</span>
          </p>
          <div className="flex items-end justify-between gap-2">
            <div className="min-w-0">
              {delta ? (
                <p className={cn('t-caption flex items-center gap-0.5', TONE_TEXT[delta.tone])}>
                  {delta.within ? <ArrowRight size={13} /> : delta.shift > 0 ? <ArrowUpRight size={13} /> : <ArrowDownRight size={13} />}
                  {delta.text}
                </p>
              ) : (
                <p className="t-caption text-ink-3">Baseline building</p>
              )}
              <p className="t-telemetry mt-0.5 truncate text-ink-3">{ago(latest.takenAt, now)}</p>
            </div>
            <Sparkline values={series.map((m) => m.value)} width={72} height={26} />
          </div>
          {band && band.tone !== 'success' && <Badge className="self-start" label={band.label} tone={band.tone === 'critical' ? 'critical' : band.tone === 'warning' ? 'warning' : 'info'} />}
        </>
      ) : (
        <p className="t-callout text-ink-3">No readings yet</p>
      )}
    </Link>
  );
}

export function AlertRow({ alert, now }: { alert: HealthAlert; now: number }) {
  return (
    <Link href={`/alerts/${encodeURIComponent(alert.insightId)}`} className="flex items-center gap-3 rounded-[16px] px-2 py-3 hover:bg-sunken">
      <span className={cn('size-2.5 shrink-0 rounded-full', alert.severity === 'critical' ? 'bg-critical' : alert.severity === 'high' || alert.severity === 'moderate' ? 'bg-warning' : 'bg-info')} aria-hidden />
      <div className="min-w-0 flex-1">
        <p className="t-callout truncate font-medium">{alert.title}</p>
        <p className="t-caption text-ink-3">
          {alert.state} · {ago(alert.createdAt, now)}
          {alert.simulated ? ' · SYNTHETIC' : ''}
        </p>
      </div>
      <SeverityBadge severity={alert.severity} />
      <ChevronRight size={16} className="shrink-0 text-ink-3" />
    </Link>
  );
}

export function AllClear({ detail }: { detail: string }) {
  return (
    <div className="flex items-center gap-3 px-1 py-2">
      <span className="flex size-9 items-center justify-center rounded-full bg-success-soft text-success">
        <CheckCircle2 size={18} />
      </span>
      <div>
        <p className="t-headline">All clear</p>
        <p className="t-callout text-ink-2">{detail}</p>
      </div>
    </div>
  );
}

/** Always-visible provenance strip when any data on screen is synthetic: one bold line, details on tap. */
export function DataSourceBanner({ compact }: { compact?: boolean }) {
  const ds = useDataSource();
  const [open, setOpen] = useState(false);
  if (ds.state === 'real') return null;
  const c = STATE_COPY[ds.state];
  const demoish = ds.state !== 'empty';
  const title = ds.state === 'demo' ? 'SYNTHETIC DEMO DATA — not real measurements' : ds.state === 'mixed' ? 'Some metrics are SYNTHETIC' : c.label;
  void compact;
  return (
    <div role="status" className={cn('flex flex-col gap-1 rounded-[20px] px-4 py-2.5', demoish ? 'bg-demo-soft' : 'bg-sunken')}>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <span className={cn('flex size-7 shrink-0 items-center justify-center rounded-full', demoish ? 'bg-demo/20 text-demo' : 'bg-line-strong text-ink-2')}><FlaskConical size={15} aria-hidden /></span>
        <span className={cn('t-headline flex-1', demoish ? 'text-demo' : 'text-ink')}>{title}</span>
        <button onClick={() => setOpen((o) => !o)} aria-expanded={open} className="t-caption rounded-full px-2.5 py-1 font-semibold text-ink-2 hover:text-ink">{open ? 'Less' : 'Why?'}</button>
        <Link href="/settings#sources" className={cn('t-caption rounded-full px-3 py-1 font-semibold', demoish ? 'bg-demo/15 text-demo' : 'bg-line-strong text-ink')}>Manage</Link>
      </div>
      {open && (
        <p className="t-callout pl-10 text-ink-2">
          {ds.state === 'mixed' ? (
            <>
              Real: {metricList(ds.real) || 'none'}. Synthetic: {metricList(ds.simulated)}
              {ds.activity === 'simulated' ? ', activity' : ''}. {ds.reason ? `Shown because ${ds.reason}.` : ''}
            </>
          ) : ds.state === 'demo' ? (
            <>Simulated telemetry from the selected mission scenario{ds.reason ? `, shown because ${ds.reason}` : ''}. Record a reading or connect a device and real data takes priority automatically.</>
          ) : (
            c.detail
          )}
        </p>
      )}
    </div>
  );
}

/** Latest AI insight (mobile InsightCard). */
export function InsightCard({ finding, autonomy, hasData }: { finding?: Insight; autonomy: number; hasData: boolean }) {
  const queue = useDock((s) => s.queue);
  return (
    <section className="relative flex flex-col gap-2.5 overflow-hidden rounded-[30px] p-5 shadow-card" style={{ background: 'linear-gradient(135deg, var(--ai-a), var(--ai-b) 55%, var(--ai-c))' }} aria-label="Latest insight">
      <div className="flex items-center justify-between gap-2">
        <span className="flex items-center gap-2">
          <span className="flex size-7 items-center justify-center rounded-full bg-pill text-on-pill">
            <Sparkles size={14} />
          </span>
          <Overline className="text-primary">CosmicPulse intelligence</Overline>
        </span>
        <span className="t-telemetry text-ink-3">ON-BOARD</span>
      </div>
      {finding ? (
        <>
          <div className="flex flex-wrap gap-1.5">
            <Badge label={findingCategory(finding)} />
            <FindingKindBadge kind={finding.kind} />
            <SeverityBadge severity={finding.severity} />
            {finding.simulated && <Badge label="SYNTHETIC" tone="demo" icon={FlaskConical} />}
          </div>
          <p className="t-title3">{finding.title}</p>
          <p className="t-callout line-clamp-3 text-ink-2">{finding.summary}</p>
        </>
      ) : (
        <p className="t-callout text-ink-2">
          {autonomy < 2 ? 'Interpretation is off at autonomy level 1 — data is collected and displayed only.' : hasData ? 'No findings. Your recent readings sit within your personal baselines and mission rules.' : 'Nothing to analyse yet. Findings appear once readings are recorded or synced.'}
        </p>
      )}
      <div className="mt-1 flex flex-wrap gap-2">
        <Button size="sm" icon={Sparkles} onClick={() => queue('Analyse my current health status')}>
          Explore analysis
        </Button>
        {finding && (
          <Link href={`/alerts/${encodeURIComponent(finding.id)}`} className="inline-flex h-9 items-center rounded-full px-3.5 text-[13px] font-medium text-ink-2 hover:bg-sunken hover:text-ink">
            View finding
          </Link>
        )}
      </div>
      <p className="t-caption text-ink-3">Rule-based analysis of your own data. Informational only — not a diagnosis.</p>
    </section>
  );
}

export function ProvenanceLine({ m, now }: { m: Measurement; now: number }) {
  return (
    <span className="flex flex-wrap items-center gap-1.5">
      <SourceBadge source={m.source} />
      <span className="t-telemetry text-ink-3">measured {ago(m.takenAt, now)}</span>
      {m.syncedAt && m.syncedAt !== m.takenAt && <span className="t-telemetry text-ink-3">· synced {ago(m.syncedAt, now)}</span>}
    </span>
  );
}

export { Card, severityTone };
