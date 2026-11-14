'use client';

import { ArrowLeft, BookOpenText, Plus, ShieldAlert, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { notFound, useParams } from 'next/navigation';
import { useMemo, useState } from 'react';

import { ProvenanceLine, useUnits } from '@/components/health';
import { toast } from '@/components/toast';
import { Badge, ButtonLink, Card, FindingKindBadge, IconButton, LearnMore, Notice, Overline, PageHeader, Section, Segmented, SeverityBadge, SourceBadge, Stat } from '@/components/ui';
import { TrendChart } from '@/components/viz';
import type { VitalType } from '@/data/types';
import { CONTEXT_LABEL, VITAL_META, VITAL_ORDER, classify, displayUnit, formatValue, toDisplay } from '@/data/vitals';
import { BASELINE_SOURCE_COPY } from '@/engine';
import { QUALITY_COPY } from '@/features/intelligence/intel';
import { PHASE_LABEL, ago, baselineBand, baselineDelta, findingsFor, latestOf, ruleLevel, stamp } from '@/features/health/vitals';
import { useNow } from '@/hooks/use-now';
import { RANGE_OPTIONS, trendPoints, type RangeKey } from '@/lib/series';
import { HAZARD_BY_ID, hazardsForMetric, risksForMetric } from '@/research/hazards';
import { useEngine } from '@/store/engine-runner';
import { useHealth } from '@/store/health';
import { useSettings } from '@/store/settings';

export default function VitalDetail() {
  const { type: raw } = useParams<{ type: string }>();
  const type = raw as VitalType;
  if (!VITAL_ORDER.includes(type) || type === 'ecg' || type === 'steps') notFound();
  const now = useNow(60_000);
  const units = useUnits();
  const thresholds = useSettings((s) => s.thresholds);
  const measurements = useHealth((s) => s.measurements);
  const mission = useHealth((s) => s.mission);
  const del = useHealth((s) => s.deleteMeasurement);
  const engine = useEngine();
  const [range, setRange] = useState<RangeKey>('30d');
  const [allRows, setAllRows] = useState(false);
  const meta = VITAL_META[type];
  const unit = displayUnit(type, units);
  const latest = latestOf(measurements, type, now);
  const b = engine.baselines[type];
  const pts = trendPoints(measurements, type, range, now, units);
  const delta = baselineDelta(latest, b, units);
  const band = latest ? classify(latest, thresholds) : null;
  const rule = latest ? ruleLevel(type, latest.value, engine.rules) : null;
  const findings = findingsFor(engine.findings, type);
  const rr = engine.rules.vitals[type];
  const rules = [
    rr?.cautionHigh !== undefined && { y: toDisplay(type, rr.cautionHigh, units), label: 'Caution', tone: 'warning' as const },
    rr?.actionHigh !== undefined && { y: toDisplay(type, rr.actionHigh, units), label: 'Action', tone: 'critical' as const },
    rr?.cautionLow !== undefined && { y: toDisplay(type, rr.cautionLow, units), label: 'Caution', tone: 'warning' as const },
    rr?.actionLow !== undefined && { y: toDisplay(type, rr.actionLow, units), label: 'Action', tone: 'critical' as const },
  ].filter(Boolean) as { y: number; label: string; tone: 'warning' | 'critical' }[];
  const history = useMemo(() => measurements.filter((m) => m.type === type).sort((a, b2) => b2.takenAt.localeCompare(a.takenAt)), [measurements, type]);
  const stats = useMemo(() => {
    const vs = pts.filter((p) => !p.flagged).map((p) => p.v);
    if (!vs.length) return null;
    return { min: Math.min(...vs), max: Math.max(...vs), mean: vs.reduce((a, x) => a + x, 0) / vs.length };
  }, [pts]);
  const dec = type === 'temperature' || type === 'weight' ? 1 : 0;
  const hazards = hazardsForMetric(type);
  const risks = risksForMetric(type);

  return (
    <div className="flex flex-col gap-6">
      <Link href="/vitals" className="t-callout flex items-center gap-1 text-ink-2 hover:text-ink">
        <ArrowLeft size={16} /> Vital signs
      </Link>
      <PageHeader
        title={meta.label}
        subtitle={meta.about}
        actions={
          <ButtonLink href={`/record?type=${type}`} icon={Plus} size="sm">
            Record {meta.shortLabel}
          </ButtonLink>
        }
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="flex flex-col gap-2">
          <Overline>Latest reading</Overline>
          {latest ? (
            <>
              <p className="flex items-baseline gap-2">
                <span className="t-metric-lg">{formatValue(latest, units)}</span>
                <span className="t-telemetry text-ink-3">{unit}</span>
              </p>
              <ProvenanceLine m={latest} now={now} />
              {latest.context && <p className="t-caption text-ink-3">Context: {CONTEXT_LABEL[latest.context]}</p>}
              <div className="flex flex-wrap gap-1.5">
                {band && <Badge label={band.label} tone={band.tone === 'critical' ? 'critical' : band.tone === 'warning' ? 'warning' : band.tone === 'success' ? 'success' : 'info'} />}
                {rule && <Badge label={`Mission rule: ${rule.level} (${rule.dir})`} tone={rule.level === 'action' ? 'critical' : 'warning'} icon={ShieldAlert} />}
              </div>
              {latest.note && <p className="t-caption text-ink-2">{latest.note}</p>}
            </>
          ) : (
            <p className="t-callout text-ink-3">No readings yet.</p>
          )}
        </Card>
        <Card className="flex flex-col gap-2">
          <Overline>Your baseline</Overline>
          {b && b.quality !== 'insufficient' ? (
            <>
              <p className="flex items-baseline gap-2">
                <span className="t-metric-lg">{toDisplay(type, b.median, units).toFixed(dec)}</span>
                <span className="t-telemetry text-ink-3">{type === 'blood_pressure' && b.median2 ? `/${Math.round(b.median2)} ` : ''}{unit} median</span>
              </p>
              <p className="t-headline">Usual {toDisplay(type, b.p10, units).toFixed(dec)}–{toDisplay(type, b.p90, units).toFixed(dec)} {unit}</p>
              <div className="flex flex-wrap gap-1.5">
                <Badge label={QUALITY_COPY[b.quality].label} tone={QUALITY_COPY[b.quality].tone} />
                <Badge label={PHASE_LABEL[b.phase]} />
              </div>
              <LearnMore title="How your baseline works">p10–p90 of {b.n} readings over {b.coverageDays} days. {BASELINE_SOURCE_COPY[b.source]}. The latest 3 days are excluded so a developing change is compared with what came before.</LearnMore>
            </>
          ) : (
            <p className="t-callout text-ink-2">{type === 'glucose' ? 'Glucose is compared with guideline ranges by context rather than a personal baseline.' : `Not enough readings yet to establish a personal baseline (${b?.n ?? 0} usable; needs ≥10 over ≥5 days).`}</p>
          )}
        </Card>
        <Card className="flex flex-col gap-2">
          <Overline>Compared with baseline</Overline>
          {delta ? (
            <>
              <p className="t-title2">{delta.text}</p>
              <LearnMore title="The maths">Robust z-score {delta.z.toFixed(1)} (median absolute deviation scaled to SD). Findings require |z| ≥ 2.5 and a meaningful shift, sustained over days.</LearnMore>
            </>
          ) : (
            <p className="t-callout text-ink-2">Baseline still building — no comparison yet.</p>
          )}
          {stats && (
            <div className="mt-auto grid grid-cols-3 gap-2 pt-2">
              <Stat label="Min" value={stats.min.toFixed(dec)} />
              <Stat label="Mean" value={stats.mean.toFixed(dec)} />
              <Stat label="Max" value={stats.max.toFixed(dec)} />
            </div>
          )}
        </Card>
      </div>

      <Card className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="t-title3">Trend</h2>
          <Segmented label="Time range" value={range} onChange={setRange} options={RANGE_OPTIONS} />
        </div>
        <TrendChart ariaLabel={`${meta.label} trend, ${range}`} points={pts} unit={unit} decimals={dec} band={baselineBand(b, type, units)} rules={rules} height={300} secondLabel={type === 'blood_pressure' ? 'Diastolic' : undefined} launchAt={new Date(mission.launchedAt).getTime()} />
        <LearnMore title="Reference ranges">{meta.reference} Mission-rule lines are prototype demo values, not NASA flight-medicine limits.</LearnMore>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Section title="Findings for this vital">
          <Card className="flex flex-col gap-2">
            {findings.length ? (
              findings.map((f) => (
                <Link key={f.id} href={`/alerts/${encodeURIComponent(f.id)}`} className="flex flex-col gap-1.5 rounded-[16px] p-2 hover:bg-sunken">
                  <span className="flex flex-wrap gap-1.5">
                    <FindingKindBadge kind={f.kind} />
                    <SeverityBadge severity={f.severity} />
                    {f.simulated && <Badge label="SYNTHETIC" tone="demo" />}
                  </span>
                  <span className="t-headline">{f.title}</span>
                  <span className="t-callout text-ink-2">{f.summary}</span>
                </Link>
              ))
            ) : (
              <p className="t-callout text-ink-2">No current findings for {meta.label.toLowerCase()}.</p>
            )}
          </Card>
        </Section>
        <Section title="Why this matters in spaceflight" action={{ label: 'Evidence', href: '/research' }}>
          <Card className="flex flex-col gap-3">
            {hazards.length ? (
              <div className="flex flex-wrap gap-1.5">
                {hazards.map((h) => (
                  <Link key={h} href={`/risk/${h}`}>
                    <Badge label={HAZARD_BY_ID[h].name} tone="primary" icon={ShieldAlert} />
                  </Link>
                ))}
              </div>
            ) : (
              <p className="t-callout text-ink-2">Not directly linked to a NASA hazard indicator.</p>
            )}
            {risks.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {risks.map((r) => (
                  <span key={r.id} title={`NASA HRP ${r.group.toLowerCase()} risk — context, not evidence it has occurred.`} className="t-caption inline-flex items-center gap-1.5 rounded-full bg-sunken px-2.5 py-1"><BookOpenText size={13} className="text-primary" />{r.name.replace(/^Risk of /, '')}</span>
                ))}
              </div>
            )}
            {risks.length > 0 && <p className="t-caption text-ink-3">Context — never a diagnosis.</p>}
          </Card>
        </Section>
      </div>

      <Section title="Readings" description={`${history.length} stored · newest first`}>
        <Card className="overflow-x-auto p-0 sm:p-0">
          <table className="w-full min-w-[640px] text-left">
            <thead>
              <tr className="t-overline border-b border-line text-ink-3">
                <th className="px-4 py-3 font-medium">Measured</th>
                <th className="px-4 py-3 font-medium">Value</th>
                <th className="px-4 py-3 font-medium">Source</th>
                <th className="px-4 py-3 font-medium">Context</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {history.slice(0, allRows ? 60 : 12).map((m) => (
                <tr key={m.id} className="t-callout border-b border-line last:border-0">
                  <td className="px-4 py-2.5 whitespace-nowrap">
                    {stamp(m.takenAt)}
                    <span className="t-telemetry block text-ink-3">{ago(m.takenAt, now)}</span>
                  </td>
                  <td className="px-4 py-2.5 font-medium tabular">
                    {formatValue(m, units)} {unit}
                    {m.qualityFlag && <span className="t-caption block text-warning-ink">{m.qualityFlag}</span>}
                  </td>
                  <td className="px-4 py-2.5">
                    <SourceBadge source={m.source} />
                  </td>
                  <td className="px-4 py-2.5 text-ink-2">{m.context ? CONTEXT_LABEL[m.context] : '—'}</td>
                  <td className="px-2 py-2.5 text-right">
                    {(m.source.kind === 'manual' || m.source.kind === 'live') && (
                      <IconButton
                        icon={Trash2}
                        label="Delete reading"
                        onClick={() => {
                          if (confirm('Delete this reading? This cannot be undone.')) {
                            del(m.id);
                            toast('Reading deleted');
                          }
                        }}
                      />
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {history.length > 60 && <p className="t-caption px-4 py-3 text-ink-3">Showing 60 of {history.length}. See Health history for all records.</p>}
          {!history.length && <Notice className="m-4">No readings stored for this vital.</Notice>}
        {!allRows && history.length > 12 && <div className="p-3 text-center"><button onClick={() => setAllRows(true)} className="t-callout rounded-full bg-sunken px-4 py-2 font-medium hover:text-ink">Show all readings</button></div>}
        </Card>
      </Section>
    </div>
  );
}
