'use client';

import { LearnMore } from '@/components/ui';
import { useEffect, useState } from 'react';

import type { HazardId } from '@/research/hazards';

/**
 * Interactive scientific explainers, one per hazard. All motion is CSS (cheap,
 * static under reduced motion) and every animated idea is also stated in text.
 * Numbers shown are either physics (light time) or clearly illustrative.
 */
const CSS = `
@keyframes sc-up { from { transform: translateY(0); opacity: 0 } 15% { opacity: 1 } to { transform: translateY(-120px); opacity: 0 } }
@keyframes sc-fly { from { transform: translateX(0) } to { transform: translateX(var(--d, 300px)) } }
@keyframes sc-sig { from { offset-distance: 0% } to { offset-distance: 100% } }
@keyframes sc-blink { 0%,100% { opacity: .25 } 50% { opacity: 1 } }
.sc-up { animation: sc-up 3.2s ease-in infinite; } .sc-fly { animation: sc-fly 1.6s linear infinite; } .sc-blink { animation: sc-blink 2s ease-in-out infinite; }
@media (prefers-reduced-motion: reduce) { .sc-up,.sc-fly,.sc-blink,.sc-sig { animation: none !important; } }
:root[data-motion='reduced'] .sc-up, :root[data-motion='reduced'] .sc-fly, :root[data-motion='reduced'] .sc-blink, :root[data-motion='reduced'] .sc-sig { animation: none !important; }
`;

function Slider({ label, value, min, max, step, onChange, format }: { label: string; value: number; min: number; max: number; step: number; onChange: (v: number) => void; format: (v: number) => string }) {
  const id = `sl-${label.replace(/\W+/g, '-')}`;
  return (
    <label htmlFor={id} className="flex flex-col gap-1">
      <span className="t-caption flex justify-between text-ink-2"><span>{label}</span><span className="font-semibold text-ink tabular">{format(value)}</span></span>
      <input id={id} type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} className="w-full accent-[var(--accent)]" />
    </label>
  );
}

function Figure({ x, fluidTop, color = 'var(--ink-2)' }: { x: number; fluidTop: number; color?: string }) {
  // fluidTop: 0 (feet-heavy, Earth) … 1 (head-heavy, weightless)
  const gid = `fl${x}`;
  return (
    <g transform={`translate(${x} 0)`}>
      <defs>
        <linearGradient id={gid} x1="0" y1="1" x2="0" y2="0">
          <stop offset="0" stopColor="#62D2E6" stopOpacity={0.75 - fluidTop * 0.5} />
          <stop offset="1" stopColor="#62D2E6" stopOpacity={0.15 + fluidTop * 0.6} />
        </linearGradient>
      </defs>
      <circle cx="0" cy="30" r="14" fill={`url(#${gid})`} stroke={color} />
      <rect x="-16" y="46" width="32" height="56" rx="12" fill={`url(#${gid})`} stroke={color} />
      <rect x="-14" y="102" width="11" height="52" rx="5" fill={`url(#${gid})`} stroke={color} />
      <rect x="3" y="102" width="11" height="52" rx="5" fill={`url(#${gid})`} stroke={color} />
    </g>
  );
}

function Microgravity() {
  const [g, setG] = useState(0);
  const load = Math.round(g * 100);
  const shift = 1 - Math.min(1, g);
  return (
    <div className="flex flex-col gap-3">
      <svg viewBox="0 0 360 170" className="w-full" role="img" aria-label={`At ${g} g, skeletal loading is ${load}% of Earth and body fluids shift towards the head.`}>
        <Figure x={90} fluidTop={0} />
        <text x="90" y="166" textAnchor="middle" fontSize="11" fill="var(--ink-3)">Earth · 1 g</text>
        <path d="M90 2v10m-4-4 4 4 4-4" stroke="var(--ink-3)" fill="none" />
        <Figure x={250} fluidTop={shift} color="var(--accent)" />
        <text x="250" y="166" textAnchor="middle" fontSize="11" fill="var(--ink-3)">Selected · {g} g</text>
        {shift > 0.2 && [0, 1, 2].map((i) => <circle key={i} className="sc-up" style={{ animationDelay: `${i * 1}s` }} cx={244 + i * 6} cy="150" r="2.5" fill="#62D2E6" />)}
        <rect x="300" y="40" width="14" height="110" rx="7" fill="var(--sunken)" />
        <rect x="300" y={150 - 110 * Math.min(1, g)} width="14" height={110 * Math.min(1, g)} rx="7" fill="var(--accent)" />
        <text x="307" y="34" textAnchor="middle" fontSize="9" fill="var(--ink-3)">load</text>
      </svg>
      <Slider label="Gravity level" value={g} min={0} max={1} step={0.005} onChange={setG} format={(v) => (v === 0 ? '0 g (orbit)' : Math.abs(v - 0.165) < 0.01 ? '0.17 g (Moon)' : Math.abs(v - 0.375) < 0.01 ? '0.38 g (Mars)' : v === 1 ? '1 g (Earth)' : `${v.toFixed(2)} g`)} />
      <div className="flex flex-wrap gap-1.5">{[['Orbit', 0], ['Moon', 0.165], ['Mars', 0.375], ['Earth', 1]].map(([l, v]) => <button key={l as string} onClick={() => setG(v as number)} className="t-caption rounded-full border border-line-strong px-2.5 py-1 hover:bg-sunken">{l}</button>)}</div>
      <LearnMore title="What’s happening?">With less gravity, bones and muscles carry less weight ({load}% of Earth loading here), so they lose strength unless countermeasure exercise replaces that load. Body fluids that gravity normally pulls to the legs shift towards the head — linked to puffy faces, changes in heart and blood-pressure regulation, and research into eye changes (SANS). <span className="text-ink-3">Diagram is illustrative.</span></LearnMore>
    </div>
  );
}

function Radiation() {
  const [shield, setShield] = useState(30);
  const pass = Math.round(10 * (1 - shield / 140));
  return (
    <div className="flex flex-col gap-3">
      <svg viewBox="0 0 360 170" className="w-full overflow-hidden" role="img" aria-label={`Illustration: with ${shield}% shielding, ${pass} of 10 particles reach the body.`}>
        <rect x={190} y={20} width={8 + shield * 0.25} height={130} rx="3" fill="var(--ink-3)" opacity={0.25 + shield / 200} />
        <Figure x={290} fluidTop={0.3} />
        {Array.from({ length: 10 }, (_, i) => (
          <circle key={i} className="sc-fly" cx="10" cy={28 + i * 12} r="3" fill={i < pass ? '#FF8A65' : '#F2B84B'} style={{ ['--d' as string]: i < pass ? '270px' : '178px', animationDelay: `${(i * 0.17) % 1.6}s` } as React.CSSProperties} />
        ))}
        <text x="194" y="164" textAnchor="middle" fontSize="10" fill="var(--ink-3)">shielding</text>
      </svg>
      <Slider label="Shielding (illustrative)" value={shield} min={0} max={100} step={5} onChange={setShield} format={(v) => `${v}%`} />
      <LearnMore title="What’s happening?">Space radiation — galactic cosmic rays and solar particles — passes into spacecraft and the body; neutrons make up about 30% of the radiation dose on the ISS (CSA). Shielding and shelters reduce some exposure but cannot stop it all, so CosmicPulse tracks dose rate and cumulative dose against the 600 mSv career limit. <span className="text-ink-3">Particle counts are illustrative.</span></LearnMore>
    </div>
  );
}

function Distance() {
  const [au, setAu] = useState(1.5);
  const sec = au * 499;
  const label = sec < 60 ? `${sec.toFixed(1)} s` : `${(sec / 60).toFixed(1)} min`;
  return (
    <div className="flex flex-col gap-3">
      <svg viewBox="0 0 360 120" className="w-full" role="img" aria-label={`At ${au} AU, a radio signal takes ${label} each way.`}>
        <circle cx="30" cy="60" r="16" fill="#3A8DDE" /><text x="30" y="96" textAnchor="middle" fontSize="10" fill="var(--ink-3)">Earth</text>
        <circle cx="330" cy="60" r="10" fill="#D86F34" /><text x="330" y="96" textAnchor="middle" fontSize="10" fill="var(--ink-3)">Crew</text>
        <line x1="48" y1="60" x2="318" y2="60" stroke="var(--line-strong, var(--ink-3))" strokeDasharray="3 6" opacity=".5" />
        <circle r="4" fill="#62D2E6" className="sc-sig" style={{ offsetPath: "path('M48 60 L318 60')", animation: `sc-sig ${Math.max(0.6, Math.min(6, sec / 60))}s linear infinite` } as React.CSSProperties} />
        <text x="180" y="40" textAnchor="middle" fontSize="13" fill="var(--ink)" fontWeight="600">{label} one way · {sec * 2 < 120 ? `${(sec * 2).toFixed(0)} s` : `${((sec * 2) / 60).toFixed(0)} min`} round trip</text>
      </svg>
      <Slider label="Distance from Earth" value={au} min={0.0026} max={2.6} step={0.0001} onChange={setAu} format={(v) => (v < 0.01 ? `${Math.round(v * 149.6e6).toLocaleString()} km (Moon)` : `${v.toFixed(2)} AU`)} />
      <div className="flex flex-wrap gap-1.5">{[['Moon', 0.00257], ['Mars closest', 0.38], ['Mars average', 1.52], ['Mars farthest', 2.5]].map(([l, v]) => <button key={l as string} onClick={() => setAu(v as number)} className="t-caption rounded-full border border-line-strong px-2.5 py-1 hover:bg-sunken">{l}</button>)}</div>
      <LearnMore title="What’s happening?">Radio signals travel at light speed — 499 seconds per astronomical unit. On a Mars mission ground teams cannot answer in real time, so NASA stresses planning and self-sufficiency. That’s why CosmicPulse runs its assessments, alerts and evidence library entirely on board. <span className="text-ink-3">Light time is physics; distances are examples.</span></LearnMore>
    </div>
  );
}

function Isolation() {
  const [crew, setCrew] = useState(4);
  const [link, setLink] = useState(true);
  useEffect(() => {}, []);
  return (
    <div className="flex flex-col gap-3">
      <svg viewBox="0 0 360 140" className="w-full" role="img" aria-label={`A crew of ${crew} in a confined habitat; ground link ${link ? 'available' : 'unavailable'}.`}>
        <rect x="70" y="30" width="220" height="80" rx="40" fill="var(--sunken)" stroke="var(--ink-3)" strokeOpacity=".4" />
        {Array.from({ length: crew }, (_, i) => <circle key={i} cx={100 + (i * 160) / Math.max(1, crew - 1 || 1)} cy={70 + (i % 2 ? 10 : -8)} r="9" fill="var(--violet)" opacity=".85" />)}
        <circle cx="330" cy="30" r="10" fill="#3A8DDE" />
        <path d="M290 50 L322 36" stroke={link ? '#62D2E6' : 'var(--critical)'} strokeWidth="2" strokeDasharray="3 4" className={link ? 'sc-blink' : ''} />
        {!link && <text x="306" y="62" fontSize="10" fill="var(--critical)">no link</text>}
      </svg>
      <Slider label="Crew size" value={crew} min={2} max={6} step={1} onChange={setCrew} format={(v) => `${v} people`} />
      <button onClick={() => setLink((v) => !v)} className="t-caption self-start rounded-full border border-line-strong px-3 py-1.5 hover:bg-sunken">{link ? 'Simulate loss of contact' : 'Restore contact'}</button>
      <LearnMore title="What’s happening?">Small crews living in confined spaces for months show behavioural responses; NASA lists behavioural changes, teamwork and inadequate sleep as related risks and selects, trains and supports crews to cope. CosmicPulse watches sleep, mood, stress and a confinement check-in so changes are noticed early — without labelling anyone. <span className="text-ink-3">Scene is illustrative.</span></LearnMore>
    </div>
  );
}

function Environment() {
  const [scrub, setScrub] = useState(90);
  const co2 = 1 + (100 - scrub) * 0.06;
  const level = co2 >= 4 ? 'action' : co2 >= 3 ? 'caution' : 'nominal';
  return (
    <div className="flex flex-col gap-3">
      <svg viewBox="0 0 360 120" className="w-full" role="img" aria-label={`Illustrative cabin CO2 ${co2.toFixed(1)} mmHg, ${level}.`}>
        <rect x="20" y="50" width="320" height="18" rx="9" fill="var(--sunken)" />
        <rect x="20" y="50" width={Math.min(320, (co2 / 7) * 320)} height="18" rx="9" fill={level === 'action' ? 'var(--critical)' : level === 'caution' ? 'var(--warning)' : 'var(--success)'} />
        {[3, 4].map((t) => <g key={t}><line x1={20 + (t / 7) * 320} x2={20 + (t / 7) * 320} y1="40" y2="78" stroke="var(--ink-3)" strokeDasharray="2 3" /><text x={20 + (t / 7) * 320} y="92" textAnchor="middle" fontSize="10" fill="var(--ink-3)">{t === 3 ? 'caution' : 'action'}</text></g>)}
        <text x="20" y="32" fontSize="13" fill="var(--ink)" fontWeight="600">Cabin CO₂ ≈ {co2.toFixed(1)} mmHg ({level})</text>
      </svg>
      <Slider label="CO₂ scrubber performance (illustrative)" value={scrub} min={0} max={100} step={5} onChange={setScrub} format={(v) => `${v}%`} />
      <LearnMore title="What’s happening?">A spacecraft is both home and life-support machine. If CO₂ removal falls behind, cabin CO₂ rises — associated with headaches and reduced performance — and low oxygen is a hypoxia risk. NASA also monitors microbes and immune responses in the closed habitat. CosmicPulse links cabin sensors to your SpO₂, breathing rate and temperature. <span className="text-ink-3">Caution/action lines are CosmicPulse demo values.</span></LearnMore>
    </div>
  );
}

export function HazardScene({ id }: { id: HazardId }) {
  return (
    <div>
      <style>{CSS}</style>
      {id === 'gravity' && <Microgravity />}
      {id === 'radiation' && <Radiation />}
      {id === 'distance' && <Distance />}
      {id === 'isolation' && <Isolation />}
      {id === 'environment' && <Environment />}
    </div>
  );
}
