'use client';

import { ArrowLeft, ArrowRight, BellRing, CheckCircle2, HelpCircle, Rocket, ShieldCheck, Siren } from 'lucide-react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import dynamic from 'next/dynamic';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { Nova, type Pose } from '@/components/companion';
import { MissionArt } from '@/components/game';
import { SentinelOrb } from '@/components/sentinel';
import { BodyMap, webglAvailable } from '@/components/twin/body-map';
import { Badge, Button, cn } from '@/components/ui';
import { award } from '@/game/progress';
import { useClientValue } from '@/hooks/use-client-value';
import { HAZARD_IMAGE, HAZARD_SHORT_NAME } from '@/lib/hazard-ui';
import type { HazardId } from '@/research/hazards';
import { useSettings } from '@/store/settings';
import { STATUS_COPY, SYSTEMS, type SystemId, type SystemStatus } from '@/twin/systems';

const AnatomyScene = dynamic(() => import('@/components/twin/anatomy-scene'), { ssr: false, loading: () => <div className="flex h-full items-center justify-center"><span className="t-telemetry text-white/50">LOADING ANATOMY…</span></div> });

const STEPS = ['intro', 'journey', 'baseline', 'twin', 'sentinel', 'hazards', 'missions', 'alerts'] as const;
type Step = (typeof STEPS)[number];
const EXAMPLE: Record<SystemId, SystemStatus> = { cardiovascular: 'normal', respiratory: 'normal', neuro: 'attention', musculoskeletal: 'normal', immune: 'unknown', metabolic: 'normal' };
const BG: Record<Step, string> = {
  intro: '/images/nasa/cupola.jpg', journey: '/images/nasa/earth-night.jpg', baseline: '/images/nasa/treadmill.jpg', twin: '/images/nasa/quarters.jpg',
  sentinel: '/images/nasa/aurora.jpg', hazards: '/images/nasa/solar-flare.jpg', missions: '/images/nasa/iss-orbit.jpg', alerts: '/images/nasa/mission-control.jpg',
};
const HAZARDS: HazardId[] = ['gravity', 'radiation', 'isolation', 'environment', 'distance'];

function BaselineDemo() {
  const [hr, setHr] = useState(62);
  const base = { lo: 54, hi: 63 };
  const within = hr >= base.lo && hr <= base.hi;
  const pct = (v: number) => ((v - 40) / 60) * 100;
  return (
    <div className="rounded-[24px] bg-white/[0.07] p-5 backdrop-blur">
      <div className="flex items-baseline justify-between">
        <p className="t-caption text-white/60">Resting heart rate · example</p>
        <Badge label="EXAMPLE" tone="demo" />
      </div>
      <p className="t-metric-lg mt-1">{hr} <span className="t-telemetry text-white/60">bpm</span></p>
      <div className="relative my-5 h-3 rounded-full bg-white/15">
        <span className="absolute inset-y-0 rounded-full bg-[#62D2E6]/45" style={{ left: `${pct(base.lo)}%`, width: `${pct(base.hi) - pct(base.lo)}%` }} />
        <span className="t-telemetry absolute -top-5 text-[#9FE6F2]" style={{ left: `${pct(base.lo)}%` }}>YOUR USUAL RANGE</span>
        <span className="absolute top-1/2 size-5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-[#05080D] transition-[left]" style={{ left: `${pct(hr)}%` }} />
      </div>
      <label htmlFor="demo-hr" className="sr-only">Example heart rate</label>
      <input id="demo-hr" type="range" min={40} max={100} value={hr} onChange={(e) => setHr(Number(e.target.value))} className="w-full accent-[#62D2E6]" />
      <p className={cn('t-headline mt-3 flex items-center gap-2', within ? 'text-[#3FD38E]' : 'text-[#F2B84B]')}>
        {within ? <CheckCircle2 size={18} /> : <BellRing size={18} />}
        {within ? 'Usual for you' : `${hr > base.hi ? 'Above' : 'Below'} your usual — Sentinel watches if it persists`}
      </p>
    </div>
  );
}

export default function Welcome() {
  const router = useRouter();
  const set = useSettings((s) => s.set);
  const callsign = useSettings((s) => s.callsign);
  const reduced = useReducedMotion();
  const gl = useClientValue(webglAvailable, false);
  const [i, setI] = useState(0);
  const [sys, setSys] = useState<SystemId | null>('neuro');
  const step: Step = STEPS[i];
  const finish = () => {
    set('welcomed', true);
    set('introSeen', true);
    award('onboarding');
    router.replace('/');
  };
  const skip = () => {
    set('welcomed', true);
    set('introSeen', true);
    router.replace('/');
  };
  const slide = reduced ? { initial: { opacity: 0 }, animate: { opacity: 1 }, exit: { opacity: 0 } } : { initial: { opacity: 0, y: 24 }, animate: { opacity: 1, y: 0 }, exit: { opacity: 0, y: -16 } };
  const heading = (n: number, kicker: string, title: string, color = '#62D2E6', pose: Pose = 'point') => (
    <div className="flex flex-col gap-3">
      <p className="t-overline" style={{ color }}>Chapter 02 · Welcome aboard · {String(n).padStart(2, '0')} {kicker}</p>
      <div className="flex items-end gap-3">
        <Nova pose={pose} size={78} className="shrink-0" />
        <h2 className="t-display relative mb-4 max-w-2xl rounded-[24px] rounded-bl-[6px] bg-white/[0.08] px-5 py-3 text-balance backdrop-blur sm:text-[40px] sm:leading-[46px]">{title}</h2>
      </div>
    </div>
  );

  return (
    <main id="main" className="relative flex min-h-dvh flex-col bg-[#05080D] text-white" data-theme-lock>
      <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
        <AnimatePresence>
          <motion.div key={BG[step]} className="absolute inset-0" initial={{ opacity: 0 }} animate={{ opacity: step === 'intro' ? 0.65 : 0.3 }} exit={{ opacity: 0 }} transition={{ duration: 1 }}>
            <Image src={BG[step]} alt="" fill priority={step === 'intro'} sizes="100vw" className="object-cover" />
          </motion.div>
        </AnimatePresence>
        <div className="absolute inset-0 bg-gradient-to-b from-[#05080D]/50 via-[#05080D]/70 to-[#05080D]" />
      </div>

      <header className="relative z-10 flex items-center justify-between p-4 sm:p-6">
        <div className="flex gap-1.5" role="progressbar" aria-label="Briefing progress" aria-valuemin={1} aria-valuemax={STEPS.length} aria-valuenow={i + 1}>
          {STEPS.map((s, k) => <span key={s} className={cn('h-1.5 rounded-full transition-all', k === i ? 'w-8 bg-[#62D2E6]' : k < i ? 'w-4 bg-white/60' : 'w-4 bg-white/20')} />)}
        </div>
        <div className="flex items-center gap-1">
          <Link href="/intro?replay=1" className="t-callout hidden rounded-full px-3 py-1.5 text-white/60 hover:bg-white/10 hover:text-white sm:block">Replay intro</Link>
          <button onClick={skip} className="t-callout rounded-full px-3 py-1.5 text-white/75 hover:bg-white/10 hover:text-white">Skip</button>
        </div>
      </header>

      <section className="relative z-10 mx-auto flex w-full max-w-6xl flex-1 items-center px-5 pb-6 sm:px-8">
        <AnimatePresence mode="wait">
          <motion.div key={step} {...slide} transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }} className="w-full">
            {step === 'intro' && (
              <div className="grid items-center gap-8 lg:grid-cols-[auto_1fr]">
                <Nova pose="wave" size={260} className="mx-auto" />
                <div className="flex flex-col gap-6">
                  <p className="t-overline text-[#9FE6F2]">Chapter 02 · Welcome aboard</p>
                  <h1 className="t-display text-balance sm:text-[60px] sm:leading-[1.02]">Welcome aboard, Explorer! I’m Nova.</h1>
                  <p className="t-title3 max-w-xl font-normal text-white/75">I’ll be your guide. Together we’ll keep your body healthy on this mission.</p>
                  <div className="flex max-w-md flex-col gap-2">
                    <label htmlFor="callsign" className="t-callout text-white/70">What should I call you? <span className="text-white/45">(optional)</span></label>
                    <input id="callsign" value={callsign} onChange={(e) => set('callsign', e.target.value.slice(0, 24))} placeholder="Your name or callsign" autoComplete="nickname" className="h-12 rounded-full border border-white/20 bg-white/10 px-5 text-[17px] text-white placeholder:text-white/40 focus:border-[#62D2E6] focus:outline-none" />
                  </div>
                  <Button size="lg" icon={Rocket} onClick={() => setI(1)} className="self-start bg-white text-[#05080D]">{callsign ? `Let’s go, ${callsign}!` : 'Let’s go!'}</Button>
                </div>
              </div>
            )}

            {step === 'journey' && (
              <div className="flex flex-col gap-8">
                {heading(1, 'Your journey', 'Here’s how we’ll protect your body: measure, understand, protect.', '#62D2E6', 'wave')}
                <div className="grid gap-3 sm:grid-cols-3">
                  {[
                    ['/images/nasa/blood-sample.jpg', 'Measure', 'Watch, sensors or quick manual entries.'],
                    ['/images/nasa/cupola.jpg', 'Understand', 'Your body as a living 3D model.'],
                    ['/images/nasa/mission-control.jpg', 'Protect', 'Sentinel spots changes early.'],
                  ].map(([img, t, d], k) => (
                    <motion.div key={t} initial={reduced ? false : { opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.12 * k }} className="group relative h-64 overflow-hidden rounded-[26px] sm:h-80">
                      <Image src={img} alt="" fill sizes="(min-width: 640px) 33vw, 100vw" className="object-cover transition-transform duration-700 group-hover:scale-105" />
                      <div className="absolute inset-0 bg-gradient-to-t from-[#05080D] via-[#05080D]/30 to-transparent" />
                      <div className="absolute inset-x-0 bottom-0 p-5">
                        <p className="t-telemetry text-[#62D2E6]">0{k + 1}</p>
                        <p className="t-title2">{t}</p>
                        <p className="t-callout text-white/70">{d}</p>
                      </div>
                    </motion.div>
                  ))}
                </div>
              </div>
            )}

            {step === 'baseline' && (
              <div className="grid items-center gap-8 lg:grid-cols-2">
                <div className="flex flex-col gap-4">
                  {heading(2, 'Daily health check', 'I compare every reading with your usual — not with everyone else.', '#62D2E6', 'think')}
                  <p className="t-body text-white/70">Drag the reading. One odd value isn’t a diagnosis — patterns over days matter.</p>
                </div>
                <BaselineDemo />
              </div>
            )}

            {step === 'twin' && (
              <div className="grid items-center gap-6 lg:grid-cols-[1fr_1.1fr]">
                <div className="flex flex-col gap-4">
                  {heading(3, 'Your body lab', 'This is your body lab — a real human body lit by your data. Tap a system!')}
                  <div className="flex flex-wrap gap-1.5">
                    {SYSTEMS.map((s) => (
                      <button key={s.id} onClick={() => setSys(s.id)} aria-pressed={sys === s.id} className={cn('t-caption flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1.5 font-medium hover:bg-white/15', sys === s.id && 'ring-2 ring-[#62D2E6]')}>
                        <span className="size-2 rounded-full" style={{ background: STATUS_COPY[EXAMPLE[s.id]].color }} />{s.name}
                      </button>
                    ))}
                  </div>
                  <Badge label="Example statuses — not your data" tone="demo" className="self-start" />
                </div>
                <div className="twin-stage relative h-[420px] overflow-hidden rounded-[28px] sm:h-[520px]">
                  {gl ? (
                    <AnatomyScene status={EXAMPLE} selected={sys} onSelect={setSys} layers={sys ? ['skeleton', 'organs', 'vessels'] : ['skin', 'skeleton', 'organs', 'vessels']} view="status" reducedMotion={!!reduced} heartRate={60} respRate={14} />
                  ) : (
                    <div className="h-full p-6"><BodyMap status={EXAMPLE} selected={sys} onSelect={setSys} /></div>
                  )}
                </div>
              </div>
            )}

            {step === 'sentinel' && (
              <div className="grid items-center gap-10 lg:grid-cols-[auto_1fr]">
                <SentinelOrb size={240} speaking className="mx-auto" />
                <div className="flex flex-col gap-6">
                  {heading(4, 'Sentinel AI', 'Meet Sentinel, our ship’s health AI. It explains every alert in five answers.', '#A99BFF')}
                  <ol className="grid gap-2 sm:grid-cols-2">
                    {['What changed?', 'Why it matters', 'What to do', 'When to re-check', 'When to call medical'].map((q, k) => (
                      <motion.li key={q} initial={reduced ? false : { opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.1 * k }} className="t-headline flex items-center gap-3 rounded-full bg-white/[0.07] py-2 pr-4 pl-2">
                        <span className="t-telemetry flex size-7 items-center justify-center rounded-full bg-[#A99BFF]/25 text-[#CFC6FF]">{k + 1}</span>{q}
                      </motion.li>
                    ))}
                  </ol>
                  <p className="t-caption text-white/55">Works offline. Never diagnoses or changes medication.</p>
                </div>
              </div>
            )}

            {step === 'hazards' && (
              <div className="flex flex-col gap-6">
                {heading(5, 'Dangers of space', 'Five dangers shape the body in space. We’ll explore each one together.')}
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
                  {HAZARDS.map((h, k) => (
                    <motion.div key={h} initial={reduced ? false : { opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.08 * k }} className={cn('relative h-44 overflow-hidden rounded-[22px] sm:h-64', k === 4 && 'col-span-2 sm:col-span-1')}>
                      <Image src={HAZARD_IMAGE[h]} alt="" fill sizes="(min-width: 640px) 20vw, 50vw" className="object-cover" />
                      <div className="absolute inset-0 bg-gradient-to-t from-[#05080D] via-[#05080D]/20 to-transparent" />
                      <p className="t-headline absolute inset-x-0 bottom-0 p-4">{HAZARD_SHORT_NAME[h]}</p>
                    </motion.div>
                  ))}
                </div>
                <p className="t-callout text-white/60">Explore each one with interactive scenes in <b className="text-white">Explore</b>.</p>
              </div>
            )}

            {step === 'missions' && (
              <div className="flex flex-col gap-6">
                {heading(6, 'Missions & rank', 'Complete daily objectives to rise through the ranks and earn insignia!', '#62D2E6', 'celebrate')}
                <div className="grid gap-3 sm:grid-cols-3">
                  {(['pulse', 'bed', 'atom'] as const).map((a, k) => (
                    <div key={a} className="flex items-center gap-4 rounded-[22px] bg-white/[0.07] p-4">
                      <MissionArt art={a} size={60} />
                      <div><p className="t-headline">{['Daily health check', 'Review your sleep', 'Explore a hazard'][k]}</p><p className="t-telemetry text-[#62D2E6]">+{[20, 10, 25][k]} XP</p></div>
                    </div>
                  ))}
                </div>
                <div className="flex items-center gap-3 rounded-[22px] border border-white/15 p-4">
                  <ShieldCheck size={20} className="shrink-0 text-[#3FD38E]" />
                  <p className="t-callout text-white/80">Rewards for taking part — never for “good” numbers or ignoring symptoms.</p>
                </div>
              </div>
            )}

            {step === 'alerts' && (
              <div className="flex flex-col gap-6">
                {heading(7, 'Reading your status', 'Last thing: four colours, always with a label. Ready for launch?')}
                <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                  {([['normal', 'Usual for you', CheckCircle2], ['attention', 'Re-check soon', BellRing], ['high', 'Tell medical', Siren], ['unknown', 'No recent data', HelpCircle]] as const).map(([k, d, Icon]) => (
                    <div key={k} className="flex flex-col gap-3 rounded-[22px] bg-white/[0.07] p-4">
                      <span className="flex size-10 items-center justify-center rounded-full" style={{ background: `${STATUS_COPY[k].color}33`, color: STATUS_COPY[k].color }}><Icon size={20} /></span>
                      <div><p className="t-headline">{STATUS_COPY[k].label}</p><p className="t-callout text-white/65">{d}</p></div>
                    </div>
                  ))}
                </div>
                <div className="flex items-center gap-3 rounded-[22px] bg-[#FF6464]/15 p-4">
                  <Siren size={22} className="shrink-0 text-[#FF8A8A]" />
                  <p className="t-callout">The red <b>Emergency</b> button is on every screen. Use it first.</p>
                </div>
                <Button size="lg" icon={Rocket} onClick={finish} className="self-start bg-white text-[#05080D]">Start my mission · +100 XP</Button>
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </section>

      {step !== 'intro' && (
        <footer className="relative z-10 mx-auto flex w-full max-w-6xl items-center justify-between px-5 pb-8 sm:px-8">
          <Button variant="ghost" icon={ArrowLeft} onClick={() => setI((x) => Math.max(0, x - 1))} className="text-white hover:bg-white/10">Back</Button>
          {step !== 'alerts' && <Button icon={ArrowRight} onClick={() => setI((x) => Math.min(STEPS.length - 1, x + 1))} className="bg-white text-[#05080D]">Next</Button>}
        </footer>
      )}
    </main>
  );
}
