'use client';

import { ArrowLeft, BookOpenText, Eye, HeartPulse, Layers3, Rotate3d, Sparkles } from 'lucide-react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { Component, useCallback, useMemo, useState, type ReactNode } from 'react';

import { useDock } from '@/components/assistant/use-assistant';
import { useUnits } from '@/components/health';
import { SectionIntro } from '@/components/story';
import { BodyMap, webglAvailable } from '@/components/twin/body-map';
import { Badge, Button, SeverityBadge, SourceBadge, cn } from '@/components/ui';
import { TrendChart } from '@/components/viz';
import { VITAL_META, displayUnit, formatValue } from '@/data/vitals';
import { ago, baselineBand, baselineDelta } from '@/features/health/vitals';
import { award } from '@/game/progress';
import { useClientValue, useIsDark, usePrefersReducedMotion } from '@/hooks/use-client-value';
import { useNow } from '@/hooks/use-now';
import { trendPoints } from '@/lib/series';
import { HAZARD_BY_ID } from '@/research/hazards';
import { sevenQuestions } from '@/sentinel/sentinel';
import { useEngine } from '@/store/engine-runner';
import { useHealth } from '@/store/health';
import { useSettings } from '@/store/settings';
import { LAYERS, STRUCTURES, SYSTEM_LAYERS, type LayerId, type StructureId } from '@/twin/anatomy';
import { STATUS_COPY, SYSTEMS, SYSTEM_BY_ID, systemStatus, type SystemId, type SystemStatus } from '@/twin/systems';
import { TONE_CLASS } from '@/theme';

const Loading = () => (
  <div className="flex h-full items-center justify-center" role="status">
    <p className="t-telemetry text-ink-3">INITIALISING DIGITAL TWIN…</p>
  </div>
);
const AnatomyScene = dynamic(() => import('@/components/twin/anatomy-scene'), { ssr: false, loading: Loading });
/** Procedural twin from the first release — used if the anatomical model cannot load. */
const ProceduralScene = dynamic(() => import('@/components/twin/twin-scene').catch(() => import('@/components/twin/twin-fallback')), { ssr: false, loading: Loading });

class ModelBoundary extends Component<{ fallback: ReactNode; children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

const STATUS_ICON: Record<SystemStatus, string> = { normal: '✓', attention: '!', high: '!!', unknown: '?' };

export default function TwinPage() {
  const now = useNow(30_000);
  const units = useUnits();
  const engine = useEngine();
  const ms = useHealth((s) => s.measurements);
  const moods = useHealth((s) => s.moods);
  const alerts = useHealth((s) => s.alerts);
  const motionPref = useSettings((s) => s.motion);
  const queue = useDock((s) => s.queue);
  const [selected, setSelected] = useState<SystemId | null>(null);
  const [view, setView] = useState<'anatomy' | 'status'>('anatomy');
  const [mode, setMode] = useState<'3d' | '2d'>('3d');
  const [customLayers, setCustomLayers] = useState<LayerId[] | null>(null);
  const [present, setPresent] = useState<StructureId[] | null>(null);
  const gl = useClientValue(webglAvailable, true);
  const show3d = gl && mode === '3d';
  const dark = useIsDark();
  const reduced = usePrefersReducedMotion(motionPref);

  const moodsRecent = moods.filter((m) => now - new Date(m.at).getTime() < 7 * 86_400_000).length;
  const sys = useMemo(() => Object.fromEntries(SYSTEMS.map((s) => [s.id, systemStatus(s.id, { measurements: ms, findings: engine.findings, moodsRecent, now })])) as Record<SystemId, ReturnType<typeof systemStatus>>, [ms, engine.findings, moodsRecent, now]);
  const status = useMemo(() => Object.fromEntries(SYSTEMS.map((s) => [s.id, sys[s.id].status])) as Record<SystemId, SystemStatus>, [sys]);
  const hr = sys.cardiovascular.latest.heart_rate;
  const rr = sys.respiratory.latest.respiratory_rate;
  const fresh = (iso?: string) => !!iso && now - new Date(iso).getTime() < 24 * 3_600_000;
  const layers = customLayers ?? SYSTEM_LAYERS[selected ?? 'body'];
  const availableLayers = new Set(STRUCTURES.filter((s) => !present || present.includes(s.id)).map((s) => s.layer));

  const select = useCallback((id: SystemId | null) => {
    setSelected(id);
    setCustomLayers(null);
    if (id) award('twin_explored', id);
  }, []);
  const toggleLayer = (l: LayerId) => setCustomLayers((cur) => {
    const base = cur ?? SYSTEM_LAYERS[selected ?? 'body'];
    const next = base.includes(l) ? base.filter((x) => x !== l) : [...base, l];
    return next.length ? next : base;
  });

  const cur = selected ? SYSTEM_BY_ID[selected] : null;
  const info = selected ? sys[selected] : null;
  const topFinding = info?.findings[0];
  const seven = topFinding ? sevenQuestions(topFinding, { measurements: ms, baselines: engine.baselines, now, alert: alerts.find((a) => a.insightId === topFinding.id) }) : null;
  const structuresOf = (id: SystemId) => STRUCTURES.filter((s) => s.system === id && s.id !== 'skin' && (!present || present.includes(s.id)));

  const procedural = <ProceduralScene status={status} selected={selected} onSelect={select} heartRate={fresh(hr?.takenAt) ? hr?.value : undefined} respRate={fresh(rr?.takenAt) ? rr?.value : undefined} reducedMotion={reduced} dark={dark} />;

  return (
    <div className="flex flex-col gap-5">
      <SectionIntro chapter="body" title="Your body lab" say="This is a real human body, lit up by your own data. Tap any part to see how it’s doing!" />

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.35fr)_minmax(340px,1fr)]">
        {/* ---------- Stage ---------- */}
        <section className="twin-stage relative h-[min(78vh,760px)] min-h-[520px] overflow-hidden rounded-[32px]" aria-label="Digital twin view">
          {show3d ? (
            <ModelBoundary fallback={procedural}>
              <AnatomyScene status={status} selected={selected} onSelect={select} layers={layers} view={view} heartRate={fresh(hr?.takenAt) ? hr?.value : undefined} respRate={fresh(rr?.takenAt) ? rr?.value : undefined} reducedMotion={reduced} onStructures={setPresent} />
            </ModelBoundary>
          ) : (
            <div className="h-full p-6"><BodyMap status={status} selected={selected} onSelect={select} /></div>
          )}

          {/* top controls */}
          <div className="absolute inset-x-3 top-3 flex flex-wrap items-start justify-between gap-2">
            <div className="glass flex rounded-full p-1" role="group" aria-label="View">
              {(['anatomy', 'status'] as const).map((v) => (
                <button key={v} onClick={() => setView(v)} aria-pressed={view === v} className={cn('t-caption flex items-center gap-1.5 rounded-full px-3 py-1.5 font-medium', view === v ? 'bg-pill text-on-pill' : 'text-ink-2 hover:text-ink')}>
                  {v === 'anatomy' ? <Eye size={14} aria-hidden /> : <HeartPulse size={14} aria-hidden />}
                  {v === 'anatomy' ? 'Anatomy' : 'Health status'}
                </button>
              ))}
            </div>
            <div className="flex gap-1.5">
              <button onClick={() => setMode(mode === '3d' ? '2d' : '3d')} disabled={!gl} className="glass t-caption flex items-center gap-1.5 rounded-full px-3 py-1.5 font-medium text-ink-2 hover:text-ink disabled:opacity-50">
                {mode === '3d' ? <Layers3 size={14} aria-hidden /> : <Rotate3d size={14} aria-hidden />}
                {mode === '3d' ? '2D map' : '3D'}
              </button>
            </div>
          </div>

          {/* layer toggles */}
          {show3d && (
            <div className="absolute inset-x-3 top-14 flex gap-1.5 overflow-x-auto pb-1 sm:inset-x-auto sm:top-16 sm:left-3 sm:flex-col sm:overflow-visible" role="group" aria-label="Anatomical layers">
              {LAYERS.filter((l) => availableLayers.has(l.id)).map((l) => {
                const on = layers.includes(l.id);
                return (
                  <button key={l.id} onClick={() => toggleLayer(l.id)} aria-pressed={on} className={cn('glass t-caption flex shrink-0 items-center gap-2 rounded-full py-1.5 pr-3 pl-2 text-left font-medium transition-opacity', !on && 'opacity-55')}>
                    <span className={cn('flex size-4 items-center justify-center rounded-full border text-[9px]', on ? 'border-transparent bg-[var(--primary)] text-[var(--bg)]' : 'border-line-strong')}>{on ? '✓' : ''}</span>
                    {l.label}
                  </button>
                );
              })}
            </div>
          )}

          {/* status legend (status view) */}
          {view === 'status' && (
            <div className="pointer-events-none absolute top-16 right-3 flex flex-col items-end gap-1">
              {(Object.keys(STATUS_COPY) as SystemStatus[]).map((k) => (
                <span key={k} className="glass t-caption flex items-center gap-1.5 rounded-full px-2.5 py-1"><span className="size-2 rounded-full" style={{ background: STATUS_COPY[k].color }} />{STATUS_COPY[k].label}</span>
              ))}
            </div>
          )}

          {hr && fresh(hr.takenAt) && !reduced && show3d && (
            <p className="t-telemetry glass absolute right-3 bottom-[4.5rem] flex items-center gap-1.5 rounded-full px-2.5 py-1">
              <HeartPulse size={12} className="text-critical" aria-hidden /> {Math.round(hr.value)} BPM · {hr.source.kind === 'simulated' || hr.source.kind === 'demo' ? 'SYNTHETIC' : 'RECORDED'}
            </p>
          )}

          {/* system chips */}
          <div className="absolute inset-x-3 bottom-3 flex gap-1.5 overflow-x-auto pb-1">
            <button onClick={() => select(null)} aria-pressed={!selected} className={cn('glass t-caption shrink-0 rounded-full px-3 py-2 font-medium', !selected && 'ring-2 ring-[var(--primary)]')}>Full body</button>
            {SYSTEMS.map((s) => (
              <button key={s.id} onClick={() => select(s.id)} aria-pressed={selected === s.id} aria-label={`${s.name}: ${STATUS_COPY[status[s.id]].label}`} className={cn('glass t-caption flex shrink-0 items-center gap-1.5 rounded-full px-3 py-2 font-medium', selected === s.id && 'ring-2 ring-[var(--primary)]')}>
                <span className="flex size-4 items-center justify-center rounded-full text-[9px] font-bold text-[#05080D]" style={{ background: STATUS_COPY[status[s.id]].color }} aria-hidden>{STATUS_ICON[status[s.id]]}</span>
                {s.name}
              </button>
            ))}
          </div>
        </section>

        {/* ---------- Panel ---------- */}
        <section aria-live="polite" className="flex flex-col gap-4">
          {!cur || !info ? (
            <>
              <div className="flex flex-col gap-1">
                <p className="t-overline text-ink-3">Body systems</p>
                <p className="t-callout text-ink-2">Tap the body or a system.</p>
              </div>
              <ul className="flex flex-col">
                {SYSTEMS.map((s) => (
                  <li key={s.id}>
                    <button onClick={() => select(s.id)} className="group flex w-full items-center gap-4 border-b border-line py-3.5 text-left">
                      <span className="flex size-9 shrink-0 items-center justify-center rounded-full text-[12px] font-bold text-[#05080D]" style={{ background: STATUS_COPY[status[s.id]].color }} aria-hidden>{STATUS_ICON[status[s.id]]}</span>
                      <span className="min-w-0 flex-1">
                        <span className="t-headline block group-hover:text-primary">{s.name}</span>
                        <span className="t-caption block text-ink-3">{structuresOf(s.id).map((x) => x.label).join(' · ') || s.plain}</span>
                      </span>
                      <span className="t-caption shrink-0 text-ink-2">{STATUS_COPY[status[s.id]].label}</span>
                    </button>
                  </li>
                ))}
              </ul>
              <p className="t-caption text-ink-3">Colour = your data · Grey = no data · Never a diagnosis.</p>
            </>
          ) : (
            <>
              <button onClick={() => select(null)} className="t-callout flex items-center gap-1 self-start text-ink-2 hover:text-ink"><ArrowLeft size={15} /> Full body</button>
              <div className="flex flex-col gap-2">
                <div className="flex flex-wrap items-center gap-3">
                  <h2 className="t-title1">{cur.name}</h2>
                  <Badge label={STATUS_COPY[info.status].label} tone={STATUS_COPY[info.status].tone} size="md" />
                </div>
                <p className="t-callout text-ink-2">{cur.plain}</p>
                <div className="flex flex-wrap gap-1.5">
                  {structuresOf(cur.id).map((s) => <span key={s.id} className="t-caption flex items-center gap-1.5 rounded-full bg-sunken px-2.5 py-1"><span className="size-2 rounded-full" style={{ background: s.color }} />{s.label}</span>)}
                </div>
              </div>

              {/* measurements */}
              <div className="grid grid-cols-2 gap-2">
                {cur.metrics.map((m) => {
                  const latest = info.latest[m];
                  const d = baselineDelta(latest, engine.baselines[m], units);
                  return (
                    <Link key={m} href={m === 'steps' ? '/activity' : `/vitals/${m}`} className="flex flex-col gap-1 rounded-[20px] bg-sunken p-3.5 hover:bg-[color-mix(in_srgb,var(--primary)_10%,var(--sunken))]">
                      <span className="t-caption text-ink-3">{VITAL_META[m].label}</span>
                      <span className="t-title2 tabular">{latest ? formatValue(latest, units) : '—'} <span className="t-caption text-ink-3">{latest ? displayUnit(m, units) : ''}</span></span>
                      <span className={cn('t-caption', d ? TONE_CLASS[d.tone].split(' ')[0] : 'text-ink-3')}>{d ? d.text : latest ? 'Baseline building' : 'No data'}</span>
                      {latest && <span className="flex flex-wrap items-center gap-1.5"><span className="t-telemetry text-ink-3">{ago(latest.takenAt, now)}</span><SourceBadge source={latest.source} /></span>}
                    </Link>
                  );
                })}
                {cur.behavioural && (
                  <Link href="/wellness" className="flex flex-col gap-1 rounded-[20px] bg-sunken p-3.5">
                    <span className="t-caption text-ink-3">Mood check-ins</span>
                    <span className="t-title2 tabular">{moodsRecent}</span>
                    <span className="t-caption text-ink-3">last 7 days</span>
                  </Link>
                )}
              </div>

              {cur.metrics[0] !== 'steps' && (
                <TrendChart ariaLabel={`${VITAL_META[cur.metrics[0]].label} trend, 30 days`} points={trendPoints(ms, cur.metrics[0], '30d', now, units)} unit={displayUnit(cur.metrics[0], units)} decimals={cur.metrics[0] === 'temperature' ? 1 : 0} band={baselineBand(engine.baselines[cur.metrics[0]], cur.metrics[0], units)} height={170} secondLabel={cur.metrics[0] === 'blood_pressure' ? 'Diastolic' : undefined} />
              )}

              {/* Sentinel */}
              <div className="flex flex-col gap-2 rounded-[22px] border border-[color-mix(in_srgb,var(--violet,#A99BFF)_35%,transparent)] p-4">
                <div className="flex items-center justify-between gap-2">
                  <p className="t-overline text-[var(--violet,#A99BFF)]">Sentinel</p>
                  <Button size="sm" variant="ghost" icon={Sparkles} onClick={() => queue(`Explain my ${cur.name.toLowerCase()} status`)}>Ask</Button>
                </div>
                {topFinding && seven ? (
                  <>
                    <div className="flex flex-wrap items-center gap-1.5"><SeverityBadge severity={topFinding.severity} />{topFinding.simulated && <Badge label="SYNTHETIC" tone="demo" />}</div>
                    <p className="t-headline">{topFinding.title}</p>
                    {seven.answers.filter((a) => ['What changed?', 'What should I do?', 'When should I reassess?'].includes(a.q)).map((a) => (
                      <p key={a.q} className="t-callout"><span className="font-semibold">{a.q} </span><span className="text-ink-2">{a.a}</span></p>
                    ))}
                    <Link href={`/sentinel?finding=${encodeURIComponent(topFinding.id)}`} className="t-callout font-medium text-primary hover:underline">Full explanation →</Link>
                  </>
                ) : (
                  <p className="t-callout text-ink-2">{info.status === 'unknown' ? 'Not enough recent data. Record a reading to bring this system online.' : 'Nothing unusual against your baseline.'}</p>
                )}
              </div>

              {/* space science */}
              <div className="flex flex-col gap-2">
                <p className="t-overline text-ink-3">In space</p>
                <p className="t-callout text-ink-2">{cur.spaceflight}</p>
                {cur.hazards.map((h) => (
                  <Link key={h} href={`/risk/${h}`} className="t-callout flex items-center gap-2 font-medium hover:text-primary"><BookOpenText size={15} className="shrink-0 text-primary" />{HAZARD_BY_ID[h].name}</Link>
                ))}
              </div>
            </>
          )}
        </section>
      </div>
      <p className="t-caption text-ink-3">3D anatomy: BodyParts3D © 2008 DBCLS, CC BY-SA 2.1 JP (reduced for the web). <Link href="/settings#about" className="underline">Credits</Link></p>
    </div>
  );
}
