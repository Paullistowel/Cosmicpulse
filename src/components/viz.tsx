'use client';

import { useMemo } from 'react';
import { Bar, BarChart, CartesianGrid, ComposedChart, Legend, Line, LineChart, ReferenceArea, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis, type TooltipContentProps } from 'recharts';

import type { Readiness, RiskAssessment } from '@/engine';
import { RISK_COPY } from '@/features/intelligence/intel';
import { toneVar } from '@/theme';
import { cn } from './ui';

/* Chart rules (dataviz method): one y-axis, 2px lines, recessive grid, hover
 * tooltip on every plot, legend whenever ≥ 2 series, text in ink tokens,
 * status colours only with labels. Colours come from CosmicPulse tokens. */

const AXIS = { stroke: 'var(--chart-grid)', tickLine: false, axisLine: false } as const;

export type TrendPoint = { t: number; v: number; v2?: number; synthetic?: boolean; source?: string; flagged?: boolean };

const fmtTime = (t: number, spanDays: number) => {
  const d = new Date(t);
  if (spanDays <= 1.5) return d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
};

function TrendTooltip({ active, payload, unit, decimals, label2 }: TooltipContentProps<number, string> & { unit: string; decimals: number; label2?: string }) {
  if (!active || !payload?.length) return null;
  const p = payload[0].payload as TrendPoint;
  return (
    <div className="rounded-[14px] bg-surface px-3 py-2 shadow-float">
      <p className="t-telemetry text-ink-3">{new Date(p.t).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</p>
      <p className="t-headline tabular">
        {p.v.toFixed(decimals)}
        {p.v2 !== undefined ? `/${p.v2.toFixed(decimals)}` : ''} <span className="t-caption text-ink-3">{unit}</span>
      </p>
      {label2 && p.v2 !== undefined && <p className="t-caption text-ink-3">systolic / {label2}</p>}
      {p.source && <p className={cn('t-caption', p.synthetic ? 'text-demo' : 'text-ink-2')}>{p.synthetic ? `SYNTHETIC · ${p.source}` : p.source}</p>}
      {p.flagged && <p className="t-caption text-warning-ink">Quality-flagged — excluded from baseline</p>}
    </div>
  );
}

/**
 * Trend with the astronaut's personal baseline band (p10–p90 of the baseline
 * window, sage) and optional mission-rule lines. Synthetic points are drawn
 * hollow in the demo colour and named in the legend.
 */
export function TrendChart({
  points,
  unit,
  decimals = 0,
  band,
  rules = [],
  height = 260,
  secondLabel,
  launchAt,
  ariaLabel,
  projection,
}: {
  points: TrendPoint[];
  unit: string;
  decimals?: number;
  band?: [number, number];
  rules?: { y: number; label: string; tone: 'warning' | 'critical' }[];
  height?: number;
  secondLabel?: string;
  launchAt?: number;
  ariaLabel: string;
  /** Qualified trend projection (dashed), from projectTrend(); omit when no reliable trend. */
  projection?: { t0: number; v0: number; t1: number; v1: number };
}) {
  const span = points.length ? (points[points.length - 1].t - points[0].t) / 86_400_000 : 1;
  const anySynthetic = points.some((p) => p.synthetic);
  const domain = useMemo(() => {
    const vals = points.flatMap((p) => (p.v2 !== undefined ? [p.v, p.v2] : [p.v]));
    if (band) vals.push(...band);
    if (projection) vals.push(projection.v0, projection.v1);
    rules.forEach((r) => vals.push(r.y));
    if (!vals.length) return [0, 1] as [number, number];
    const lo = Math.min(...vals);
    const hi = Math.max(...vals);
    const pad = (hi - lo || Math.abs(hi) * 0.1 || 1) * 0.12;
    return [Math.floor((lo - pad) * 10 ** decimals) / 10 ** decimals, Math.ceil((hi + pad) * 10 ** decimals) / 10 ** decimals] as [number, number];
  }, [points, band, rules, decimals, projection]);

  if (!points.length) return <div className="t-callout flex items-center justify-center rounded-[18px] bg-sunken text-ink-3" style={{ height }}>No readings in this period.</div>;

  return (
    <figure aria-label={ariaLabel} className="w-full overflow-hidden">
      <ResponsiveContainer width="100%" height={height}>
        <ComposedChart data={points} margin={{ top: 8, right: 8, bottom: 0, left: -12 }}>
          <CartesianGrid vertical={false} stroke="var(--chart-grid)" />
          <XAxis dataKey="t" type="number" scale="time" domain={projection ? ['dataMin', projection.t1] : ['dataMin', 'dataMax']} allowDataOverflow tickFormatter={(t) => fmtTime(t, span)} minTickGap={36} {...AXIS} />
          <YAxis domain={domain} width={48} tickFormatter={(v) => Number(v).toFixed(decimals)} {...AXIS} />
          {band && <ReferenceArea y1={band[0]} y2={band[1]} fill="var(--chart-band)" stroke="none" ifOverflow="extendDomain" />}
          {rules.map((r) => (
            <ReferenceLine key={r.label + r.y} y={r.y} stroke={toneVar(r.tone)} strokeDasharray="4 4" strokeWidth={1.5} label={{ value: r.label, position: 'insideTopRight', fill: 'var(--ink-2)', fontSize: 10 }} />
          ))}
          {launchAt && launchAt > points[0].t && <ReferenceLine x={launchAt} stroke="var(--ink-3)" strokeDasharray="2 4" label={{ value: 'Launch', position: 'insideTopLeft', fill: 'var(--ink-3)', fontSize: 10 }} />}
          <Tooltip content={(p) => <TrendTooltip {...(p as TooltipContentProps<number, string>)} unit={unit} decimals={decimals} label2={secondLabel} />} cursor={{ stroke: 'var(--ink-3)', strokeWidth: 1 }} />
          <Line
            dataKey="v"
            name={secondLabel ? 'Systolic' : 'Reading'}
            type="monotone"
            stroke="var(--chart-line)"
            strokeWidth={2}
            isAnimationActive={false}
            dot={points.length <= 60 ? (props) => <PointDot key={`${props.cx}-${props.cy}-${props.index}`} {...(props as DotProps)} /> : false}
            activeDot={{ r: 5, stroke: 'var(--surface)', strokeWidth: 2, fill: 'var(--chart-line)' }}
          />
          {projection && <Line data={[{ t: projection.t0, p: projection.v0 }, { t: projection.t1, p: projection.v1 }]} dataKey="p" name="Projected trend" stroke="var(--violet)" strokeWidth={2} strokeDasharray="6 5" dot={false} isAnimationActive={false} />}
          {secondLabel && <Line dataKey="v2" name={secondLabel} type="monotone" stroke="var(--chart-line-2)" strokeWidth={2} dot={false} isAnimationActive={false} activeDot={{ r: 5, stroke: 'var(--surface)', strokeWidth: 2 }} />}
        </ComposedChart>
      </ResponsiveContainer>
      <figcaption className="t-caption mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-ink-3">
        <span className="flex items-center gap-1.5">
          <span className="h-0.5 w-4 rounded bg-[var(--chart-line)]" /> {secondLabel ? 'Systolic' : 'Reading'}
        </span>
        {secondLabel && (
          <span className="flex items-center gap-1.5">
            <span className="h-0.5 w-4 rounded bg-[var(--chart-line-2)]" /> {secondLabel}
          </span>
        )}
        {band && (
          <span className="flex items-center gap-1.5">
            <span className="h-3 w-4 rounded-sm bg-[var(--chart-band)]" /> Your baseline (p10–p90)
          </span>
        )}
        {rules.length > 0 && (
          <span className="flex items-center gap-1.5">
            <span className="w-4 border-t-2 border-dashed border-warning" /> Mission rule (prototype)
          </span>
        )}
        {projection && (
          <span className="flex items-center gap-1.5">
            <span className="w-4 border-t-2 border-dashed border-violet" /> Projected trend — not a prediction
          </span>
        )}
        {anySynthetic && (
          <span className="flex items-center gap-1.5 text-demo">
            <span className="size-2.5 rounded-full border-2 border-demo" /> Synthetic reading
          </span>
        )}
      </figcaption>
    </figure>
  );
}

type DotProps = { cx?: number; cy?: number; payload?: TrendPoint; index?: number };
function PointDot({ cx, cy, payload }: DotProps) {
  if (cx === undefined || cy === undefined || !payload) return null;
  if (payload.flagged) return <circle cx={cx} cy={cy} r={4} fill="var(--warning)" stroke="var(--surface)" strokeWidth={2} />;
  if (payload.synthetic) return <circle cx={cx} cy={cy} r={3} fill="var(--surface)" stroke="var(--demo)" strokeWidth={1.5} />;
  return <circle cx={cx} cy={cy} r={3} fill="var(--chart-line)" stroke="var(--surface)" strokeWidth={1.5} />;
}

/** Daily bars (sleep hours, steps, exercise minutes) with an optional goal line. */
export function DailyBars({ data, unit, goal, goalLabel, height = 220, decimals = 0, ariaLabel, color = 'var(--chart-line-2)' }: { data: { label: string; v: number; synthetic?: boolean; note?: string }[]; unit: string; goal?: number; goalLabel?: string; height?: number; decimals?: number; ariaLabel: string; color?: string }) {
  if (!data.length) return <div className="t-callout flex items-center justify-center rounded-[18px] bg-sunken text-ink-3" style={{ height }}>No data in this period.</div>;
  return (
    <figure aria-label={ariaLabel} className="overflow-hidden">
      <ResponsiveContainer width="100%" height={height}>
        <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -12 }} barCategoryGap="22%">
          <CartesianGrid vertical={false} stroke="var(--chart-grid)" />
          <XAxis dataKey="label" interval="preserveStartEnd" minTickGap={18} {...AXIS} />
          <YAxis width={48} tickFormatter={(v) => Number(v).toLocaleString('en-US', { maximumFractionDigits: decimals })} {...AXIS} />
          {goal !== undefined && <ReferenceLine y={goal} stroke="var(--ink-3)" strokeDasharray="4 4" label={{ value: goalLabel ?? `Goal ${goal}`, position: 'insideTopRight', fill: 'var(--ink-2)', fontSize: 10 }} />}
          <Tooltip
            cursor={{ fill: 'var(--chart-grid)' }}
            content={({ active, payload }) =>
              active && payload?.length ? (
                <div className="rounded-[14px] bg-surface px-3 py-2 shadow-float">
                  <p className="t-telemetry text-ink-3">{(payload[0].payload as { label: string }).label}</p>
                  <p className="t-headline tabular">
                    {Number(payload[0].value).toLocaleString('en-US', { maximumFractionDigits: decimals })} <span className="t-caption text-ink-3">{unit}</span>
                  </p>
                  {(payload[0].payload as { synthetic?: boolean }).synthetic && <p className="t-caption text-demo">SYNTHETIC</p>}
                  {(payload[0].payload as { note?: string }).note && <p className="t-caption text-ink-2">{(payload[0].payload as { note?: string }).note}</p>}
                </div>
              ) : null
            }
          />
          <Bar dataKey="v" fill={color} radius={[4, 4, 0, 0]} isAnimationActive={false} maxBarSize={28} />
        </BarChart>
      </ResponsiveContainer>
    </figure>
  );
}

/** Tiny inline trend for tiles (value is always also shown as text). */
export function Sparkline({ values, width = 96, height = 30, color = 'var(--chart-line)' }: { values: number[]; width?: number; height?: number; color?: string }) {
  if (values.length < 2) return <svg width={width} height={height} aria-hidden />;
  const lo = Math.min(...values);
  const hi = Math.max(...values);
  const pts = values.map((v, i) => `${(i / (values.length - 1)) * (width - 4) + 2},${height - 3 - ((v - lo) / (hi - lo || 1)) * (height - 6)}`);
  const last = pts[pts.length - 1].split(',');
  return (
    <svg width={width} height={height} aria-hidden className="overflow-visible">
      <polyline points={pts.join(' ')} fill="none" stroke={color} strokeWidth={1.75} strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={last[0]} cy={last[1]} r={2.75} fill={color} />
    </svg>
  );
}

const ARC_COLORS = ['#5F8466', '#7FA285', '#A3BFA6', '#C6D7C6', '#DCE6DB'];

/**
 * Overall health dial (mobile HealthDial): concentric half-arcs, one per
 * readiness component (points / max), readiness index in the centre, risk
 * level above. Every arc is real engine output.
 */
export function HealthDial({ risk, readiness, size = 320 }: { risk: RiskAssessment; readiness: Readiness; size?: number }) {
  const stroke = 13;
  const gap = 7;
  const width = size;
  const height = width / 2 + stroke;
  const cx = width / 2;
  const cy = width / 2 + stroke / 2;
  const r0 = width / 2 - stroke / 2;
  const comps = readiness.components.slice(0, 4);
  const r = RISK_COPY[risk.level];
  return (
    <div className="flex flex-col items-center">
      <div className="relative" style={{ width, height }}>
        <svg width={width} height={height} role="img" aria-label={`Readiness ${readiness.score ?? 'not available'}. ${comps.map((c) => `${c.label} ${c.points} of ${c.max}`).join('; ')}.`}>
          {comps.map((c, i) => {
            const rad = r0 - i * (stroke + gap);
            if (rad < stroke) return null;
            const len = Math.PI * rad;
            const f = Math.max(0, Math.min(1, c.max ? c.points / c.max : 0));
            const d = `M ${cx - rad} ${cy} A ${rad} ${rad} 0 0 1 ${cx + rad} ${cy}`;
            const th = Math.PI - f * Math.PI;
            return (
              <g key={c.label}>
                <path d={d} stroke="var(--chart-grid)" strokeWidth={stroke} strokeLinecap="round" fill="none" />
                {f > 0 && <path d={d} stroke={ARC_COLORS[i]} strokeWidth={stroke} strokeLinecap="round" fill="none" strokeDasharray={`${len} ${len}`} strokeDashoffset={len * (1 - f)} className="draw" style={{ ['--len' as string]: len, transition: 'stroke-dashoffset 1s var(--ease-out)' }} />}
                {f > 0.02 && i === 0 && <circle cx={cx + rad * Math.cos(th)} cy={cy - rad * Math.sin(th)} r={4.5} fill="var(--pill)" stroke="#fff" strokeWidth={2} />}
              </g>
            );
          })}
        </svg>
        <div className="pointer-events-none absolute inset-x-0 bottom-0 text-center">
          <span className="font-display text-[58px] leading-[60px] tracking-[-2.5px] tabular">{readiness.score ?? '—'}</span>
        </div>
      </div>
      <p className="t-telemetry mt-1 text-ink-3">{readiness.score !== null ? `READINESS INDEX · ${readiness.label.toUpperCase()}` : 'READINESS · BUILDING BASELINE'}</p>
      <ul className="mt-3 grid w-full grid-cols-2 gap-x-4 gap-y-1.5">
        {comps.map((c, i) => (
          <li key={c.label} className="t-caption flex items-center gap-1.5 text-ink-2">
            <span className="size-2 shrink-0 rounded-full" style={{ background: ARC_COLORS[i] }} />
            <span className="truncate">{c.label}</span>
            <span className="ml-auto font-semibold text-ink tabular">
              {c.points}/{c.max}
            </span>
          </li>
        ))}
      </ul>
      <span className="sr-only">Overall health {r.label}</span>
    </div>
  );
}

const SERIES = ['var(--series-1)', 'var(--series-2)', 'var(--series-3)', 'var(--series-4)'];

/** Inspiration4 crew analyte over the mission timeline (4 series → legend + reference range). */
export function CrewChart({ rows, crew, unit, refLow, refHigh, height = 280, ariaLabel }: { rows: Record<string, number | string>[]; crew: string[]; unit: string; refLow?: number; refHigh?: number; height?: number; ariaLabel: string }) {
  return (
    <figure aria-label={ariaLabel} className="overflow-hidden">
      <ResponsiveContainer width="100%" height={height}>
        <LineChart data={rows} margin={{ top: 8, right: 12, bottom: 0, left: -8 }}>
          <CartesianGrid vertical={false} stroke="var(--chart-grid)" />
          <XAxis dataKey="day" {...AXIS} />
          <YAxis width={52} domain={['auto', 'auto']} {...AXIS} />
          {refLow !== undefined && refHigh !== undefined && <ReferenceArea y1={refLow} y2={refHigh} fill="var(--chart-band)" stroke="none" ifOverflow="extendDomain" />}
          <ReferenceLine x="R+1" stroke="var(--ink-3)" strokeDasharray="2 4" label={{ value: 'Return', position: 'insideTopLeft', fill: 'var(--ink-3)', fontSize: 10 }} />
          <Tooltip
            cursor={{ stroke: 'var(--ink-3)' }}
            content={({ active, payload, label }) =>
              active && payload?.length ? (
                <div className="rounded-[14px] bg-surface px-3 py-2 shadow-float">
                  <p className="t-telemetry text-ink-3">{String(label)}</p>
                  {payload.map((p) => (
                    <p key={String(p.dataKey)} className="t-caption flex items-center gap-2 text-ink">
                      <span className="size-2 rounded-full" style={{ background: p.color }} />
                      {String(p.dataKey)} <span className="ml-auto pl-3 font-semibold tabular">{p.value as number}</span> <span className="text-ink-3">{unit}</span>
                    </p>
                  ))}
                </div>
              ) : null
            }
          />
          <Legend iconType="plainline" wrapperStyle={{ fontSize: 12, color: 'var(--ink-2)' }} />
          {crew.map((c, i) => (
            <Line key={c} dataKey={c} stroke={SERIES[i % 4]} strokeWidth={2} dot={{ r: 3.5, strokeWidth: 0, fill: SERIES[i % 4] }} activeDot={{ r: 5, stroke: 'var(--surface)', strokeWidth: 2 }} connectNulls isAnimationActive={false} />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </figure>
  );
}
