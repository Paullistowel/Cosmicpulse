'use client';

import { SectionIntro } from '@/components/story';
import { BookOpenText, Info } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';

import { HazardScene } from '@/components/simulator/scenes';
import { Badge, ButtonLink, Card, Overline, ProgressBar, Segmented, cn, LearnMore } from '@/components/ui';
import { award } from '@/game/progress';
import { HAZARD_CAPTION, HAZARD_ICON, HAZARD_IMAGE, HAZARD_SHORT_NAME, HAZARD_SYSTEMS } from '@/lib/hazard-ui';
import { HAZARDS, HAZARD_BY_ID, riskById, type HazardId } from '@/research/hazards';
import { resolveRef } from '@/research/sources';
import { DEFAULT_SCENARIO, DESTINATIONS, TAG_COPY, simulate, type Destination, type ScenarioInput, type Tag } from '@/simulator/model';
import { useHazards } from '@/store/engine-runner';
import { SYSTEM_BY_ID, SYSTEMS } from '@/twin/systems';
import { HAZARD_STATUS_COPY } from '@/intel/hazard-profile';

const ORDER: HazardId[] = ['gravity', 'radiation', 'isolation', 'environment', 'distance'];

function Range({ label, value, min, max, step, unit, onChange, hint }: { label: string; value: number; min: number; max: number; step: number; unit: string; onChange: (v: number) => void; hint?: string }) {
  const id = `r-${label.replace(/\W+/g, '-')}`;
  return (
    <label htmlFor={id} className="flex flex-col gap-1">
      <span className="t-caption flex justify-between text-ink-2"><span>{label}</span><span className="font-semibold text-ink tabular">{value} {unit}</span></span>
      <input id={id} type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} className="accent-[var(--accent)]" />
      {hint && <span className="t-caption text-ink-3">{hint}</span>}
    </label>
  );
}

export default function SimulatorPage() {
  const [hz, setHz] = useState<HazardId>('gravity');
  const profiles = useHazards();
  const [sc, setSc] = useState<ScenarioInput>(DEFAULT_SCENARIO);
  const [filter, setFilter] = useState<Tag | 'all'>('all');
  const touched = useRef(false);
  const result = useMemo(() => simulate(sc), [sc]);
  const h = HAZARD_BY_ID[hz];
  const p = profiles.find((x) => x.hazard === hz)!;

  useEffect(() => {
    award('hazard_explored', hz);
  }, [hz]);
  const update = (patch: Partial<ScenarioInput>) => {
    setSc((s) => ({ ...s, ...patch }));
    if (!touched.current) {
      touched.current = true;
      award('simulator_run');
    }
  };

  return (
    <div className="flex flex-col gap-8">
      <SectionIntro chapter="dangers" title="Hazard expeditions" say="Five dangers shape the human body in space. Pick one and let’s explore it together!" />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5" role="tablist" aria-label="Hazards">
        {ORDER.map((id) => {
          const Icon = HAZARD_ICON[id];
          return (
            <button key={id} role="tab" aria-selected={hz === id} onClick={() => setHz(id)} className={cn('group relative h-32 overflow-hidden rounded-[22px] text-left text-white shadow-card transition-transform hover:-translate-y-0.5', hz === id && 'ring-2 ring-[var(--accent)] ring-offset-2 ring-offset-[var(--bg)]')}>
              <Image src={HAZARD_IMAGE[id]} alt="" fill sizes="(min-width: 1024px) 20vw, 50vw" className="object-cover transition-transform duration-700 group-hover:scale-105" />
              <span className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
              <span className="absolute top-3 left-3 flex size-8 items-center justify-center rounded-full bg-white/20 backdrop-blur"><Icon size={16} /></span>
              <span className="absolute inset-x-3 bottom-3"><span className="t-headline block">{HAZARD_SHORT_NAME[id]}</span><span className="t-caption block text-white/80">{HAZARD_STATUS_COPY[profiles.find((x) => x.hazard === id)!.status].label}</span></span>
            </button>
          );
        })}
      </div>

      <section className="grid gap-6 xl:grid-cols-5" aria-label={`${h.name} explainer`}>
        <div className="flex flex-col gap-4 xl:col-span-3">
          <figure className="relative h-56 overflow-hidden rounded-[26px] shadow-card">
            <Image src={HAZARD_IMAGE[hz]} alt={HAZARD_CAPTION[hz]} fill sizes="(min-width: 1280px) 60vw, 100vw" className="object-cover" />
            <div className="absolute inset-0 bg-gradient-to-r from-black/70 to-transparent" />
            <div className="absolute inset-y-0 left-0 flex max-w-md flex-col justify-end gap-1 p-5 text-white">
              <h2 className="t-title1">{h.name}</h2>
              <p className="t-callout text-white/85">{h.short}</p>
            </div>
            <figcaption className="t-caption absolute right-3 bottom-2 text-white/70">{HAZARD_CAPTION[hz]}</figcaption>
          </figure>
          <Card><HazardScene id={hz} /></Card>
        </div>
        <div className="flex flex-col gap-4 xl:col-span-2">
          <Card className="flex flex-col gap-3">
            <Overline>Body systems it may affect</Overline>
            <div className="flex flex-wrap gap-2">
              {HAZARD_SYSTEMS[hz].map((s) => <Link key={s} href="/twin" className="t-callout rounded-full bg-sunken px-3 py-1.5 font-medium hover:bg-line-strong/40">{SYSTEM_BY_ID[s].name}</Link>)}
            </div>
            <Overline className="mt-1">Health indicators CosmicPulse watches</Overline>
            <ul className="flex flex-col gap-1.5">{h.indicators.map((i) => <li key={i.label} className="t-callout"><span className="font-medium">{i.label}</span> <span className="text-ink-2">— {i.why}</span></li>)}</ul>
          </Card>
          <Card className="flex flex-col gap-2">
            <Overline>Possible health risks (NASA HRP)</Overline>
            {h.riskIds.slice(0, 5).map((id) => <p key={id} className="t-callout">{riskById(id)!.name}</p>)}
            <Overline className="mt-2">The research</Overline>
            {h.science.slice(0, 3).map((s) => { const r = resolveRef(s.ref); return <Link key={s.ref + s.text} href={r ? `/research/${r.source.id}` : '/research'} className="t-callout flex items-start gap-2 text-ink-2 line-clamp-2 hover:text-ink"><BookOpenText size={15} className="mt-0.5 shrink-0 text-primary" /><span>{s.text} <span className="text-primary">[{r?.source.org}]</span></span></Link>; })}
          </Card>
          <Card className="flex flex-col gap-2">
            <Overline>Monitoring & prevention</Overline>
            <ul className="t-callout space-y-1.5 text-ink-2">{[...h.prevention, ...h.actions.slice(0, 1)].slice(0, 3).map((x) => <li key={x} className="flex items-start gap-2"><span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-success-soft text-[11px] text-success">✓</span><span className="line-clamp-2">{x}</span></li>)}</ul>
            <p className="t-caption text-ink-3">Prototype guidance.</p>
            <div className="flex flex-wrap gap-2 pt-1">
              <ButtonLink size="sm" href={`/risk/${hz}`}>Your data & this hazard</ButtonLink>
              <Badge label={HAZARD_STATUS_COPY[p.status].label} tone={HAZARD_STATUS_COPY[p.status].tone} size="md" />
            </div>
          </Card>
        </div>
      </section>

      <section className="flex flex-col gap-4" aria-labelledby="scn-h">
        <div>
          <h2 id="scn-h" className="t-title2">Mission scenario simulator</h2>
          <LearnMore title="How the simulator works" className="mt-2 max-w-3xl">Design a mission and see how stressors combine. Radiation dose uses published dose rates; the stress indices are simple illustrative formulas to build intuition — they are not predictions about any person.</LearnMore>
        </div>
        <div className="grid gap-6 xl:grid-cols-[380px_1fr]">
          <Card className="flex flex-col gap-4">
            <Overline>Your scenario assumptions</Overline>
            <Segmented size="sm" label="Destination" value={sc.destination} onChange={(v: Destination) => update({ destination: v })} options={(Object.keys(DESTINATIONS) as Destination[]).map((d) => ({ value: d, label: DESTINATIONS[d].label.split(' / ')[0] }))} />
            <Range label="Mission duration" value={sc.durationDays} min={3} max={1000} step={1} unit="days" onChange={(v) => update({ durationDays: v })} hint="ISS increments ~180 d; a Mars round trip ~3 years." />
            <Range label="Prior career dose" value={sc.priorDoseMsv} min={0} max={400} step={5} unit="mSv" onChange={(v) => update({ priorDoseMsv: v })} />
            <Range label="Shelter use during radiation events" value={sc.shieldingPct} min={0} max={100} step={5} unit="%" onChange={(v) => update({ shieldingPct: v })} hint="Assumption: full shelter use avoids up to 30% of daily dose (illustrative)." />
            <Range label="Countermeasure exercise" value={sc.exerciseMin} min={0} max={180} step={5} unit="min/day" onChange={(v) => update({ exerciseMin: v })} hint="ISS crews typically schedule about 2 h/day." />
            <Range label="Planned sleep" value={sc.sleepH} min={4} max={9} step={0.5} unit="h/night" onChange={(v) => update({ sleepH: v })} />
            <Range label="Crew size" value={sc.crewSize} min={2} max={8} step={1} unit="crew" onChange={(v) => update({ crewSize: v })} />
          </Card>
          <div className="flex flex-col gap-4">
            <div className="flex flex-wrap items-center gap-2">
              <Segmented size="sm" label="Filter outputs" value={filter} onChange={setFilter} options={[{ value: 'all', label: 'All' }, { value: 'evidence', label: 'Evidence' }, { value: 'assumption', label: 'Assumptions' }, { value: 'hypothetical', label: 'Hypothetical' }]} />
              {(Object.keys(TAG_COPY) as Tag[]).map((t) => <Badge key={t} label={TAG_COPY[t].label} tone={TAG_COPY[t].tone} title={TAG_COPY[t].detail} />)}
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              {result.outputs.filter((o) => filter === 'all' || o.tag === filter).map((o) => (
                <Card key={o.id} className="flex flex-col gap-2 p-4" title={o.detail}>
                  <div className="flex items-start justify-between gap-2"><span className="t-callout font-medium">{o.label}</span><Badge label={TAG_COPY[o.tag].label} tone={TAG_COPY[o.tag].tone} /></div>
                  <p className="t-metric">{o.value}</p>
                  {o.level !== undefined && <ProgressBar value={o.level} max={100} tone={o.level >= 75 ? 'critical' : o.level >= 50 ? 'warning' : 'accent'} label={o.label} />}
                                    <Link href={`/risk/${o.hazard}`} className="t-caption text-primary hover:underline">{HAZARD_BY_ID[o.hazard].name} →</Link>
                </Card>
              ))}
            </div>
            <Card className="flex flex-col gap-2">
              <div className="flex items-center gap-2"><Overline>Body systems under this scenario</Overline><Badge label="Hypothetical" tone="demo" /></div>
              {SYSTEMS.map((s) => { const v = result.systems[s.id] ?? 0; return (
                <div key={s.id} className="grid grid-cols-[150px_1fr_40px] items-center gap-3">
                  <span className="t-caption text-ink-2">{s.name}</span>
                  <ProgressBar value={v} max={100} tone={v >= 75 ? 'critical' : v >= 50 ? 'warning' : 'accent'} label={`${s.name} scenario stress`} />
                  <span className="t-caption text-right tabular">{v}</span>
                </div>
              ); })}
              <p className="t-caption flex items-start gap-1 text-ink-3"><Info size={12} className="mt-0.5 shrink-0" />Illustration only — not a prediction.</p>
            </Card>
          </div>
        </div>
      </section>
      <p className="t-caption text-ink-3">Hazard data: {HAZARDS.length} NASA HRP hazards · imagery courtesy NASA (public domain; no endorsement implied).</p>
    </div>
  );
}
