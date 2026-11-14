'use client';

import { Film, Rocket, Star, Volume2, VolumeX } from 'lucide-react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import dynamic from 'next/dynamic';
import Image from 'next/image';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';

import { Guide, type Pose } from '@/components/companion';
import { webglAvailable } from '@/components/twin/body-map';
import type { Pick } from '@/components/universe/launch-scene';
import { useClientValue } from '@/hooks/use-client-value';
import { cn } from '@/lib/cn';
import { sfx } from '@/lib/sfx';
import { useSettings } from '@/store/settings';

import { LandingFilm } from './film';

const LaunchScene = dynamic(() => import('@/components/universe/launch-scene'), { ssr: false });

/**
 * Chapter 1 — The call to explore. An interactive launch pad: explore a living 3D universe,
 * discover Earth, the station and the Moon with Nova, then ENTER COSMICPULSE for a warp-speed
 * launch. The NASA landing film (public/media/intro.mp4) plays first and hands over to it.
 */
const DISCOVERIES: Record<Pick, { say: string; pose: Pose }> = {
  earth: { say: 'That’s home! Gravity keeps our bones, muscles and heart strong here.', pose: 'point' },
  station: { say: 'The International Space Station — crews live up there for months!', pose: 'wave' },
  moon: { say: 'The Moon — the next stop for astronauts on Artemis missions.', pose: 'celebrate' },
};

export function LaunchExperience() {
  const router = useRouter();
  const replay = useSearchParams().get('replay') === '1';
  const set = useSettings((s) => s.set);
  const welcomed = useSettings((s) => s.welcomed);
  const sound = useSettings((s) => s.sfx);
  const reduced = !!useReducedMotion();
  const gl = useClientValue(webglAvailable, true);
  const [found, setFound] = useState<Pick[]>([]);
  const [last, setLast] = useState<Pick | null>(null);
  const [launching, setLaunching] = useState(false);
  // The landing film plays first; at the night-limb plate it hands over to this launch pad.
  const [phase, setPhase] = useState<'film' | 'launch'>('film');
  const [filmKey, setFilmKey] = useState(0);

  const pick = (p: Pick) => {
    setLast(p);
    if (!found.includes(p)) {
      setFound((f) => [...f, p]);
      if (sound) (found.length === 2 ? sfx.sparkle : sfx.chime)();
    } else if (sound) sfx.tick();
  };

  const enter = () => {
    if (launching) return;
    set('introSeen', true);
    const dest = replay ? '/settings#about' : welcomed ? '/' : '/welcome';
    if (reduced) return router.replace(dest);
    setLaunching(true);
    if (sound) sfx.launch();
    setTimeout(() => router.replace(dest), 1900);
  };

  // Seen this session → the app opens straight in until the next visit.
  useEffect(() => {
    try {
      sessionStorage.setItem('cp.landed', '1');
    } catch {}
  }, []);

  const say = last ? DISCOVERIES[last].say : 'Hi, Explorer! I’m Nova. Tap Earth, the space station or the Moon.';
  const pose: Pose = found.length === 3 ? 'celebrate' : last ? DISCOVERIES[last].pose : 'wave';

  return (
    <main id="main" className="fixed inset-0 overflow-hidden bg-[#020409] text-white" data-theme-lock aria-label="CosmicPulse launch">
      {/* Universe */}
      {gl ? (
        <div className="absolute inset-0">
          <LaunchScene onPick={pick} launching={launching} reducedMotion={reduced} paused={phase === 'film'} />
        </div>
      ) : (
        <Image src="/images/nasa/earth-night.jpg" alt="" fill priority sizes="100vw" className="object-cover opacity-70" />
      )}
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-[#020409]/85 via-[#020409]/25 to-transparent" />

      {/* Top bar */}
      <div className="absolute inset-x-0 top-0 flex items-center justify-between gap-2 p-4 sm:p-6">
        <span className="t-telemetry text-white/55">CHAPTER 01 · THE CALL TO EXPLORE</span>
        <div className="flex items-center gap-2">
          <button onClick={() => { setFilmKey((k) => k + 1); setPhase('film'); if (sound) sfx.tick(); }} className="t-callout flex items-center gap-2 rounded-full bg-white/10 px-4 py-2 font-medium backdrop-blur hover:bg-white/20">
            <Film size={16} aria-hidden /> <span className="hidden sm:inline">Watch the film again</span><span className="sm:hidden">Film</span>
          </button>
          <button onClick={() => set('sfx', !sound)} aria-pressed={sound} aria-label={sound ? 'Mute sound effects' : 'Turn on sound effects'} className="flex size-10 items-center justify-center rounded-full bg-white/10 backdrop-blur hover:bg-white/20">
            {sound ? <Volume2 size={17} /> : <VolumeX size={17} />}
          </button>
        </div>
      </div>

      {/* Brand + launch */}
      <motion.div className="pointer-events-none absolute top-[16%] left-0 flex max-w-xl flex-col gap-5 px-6 sm:left-[5%] sm:px-0 [&>*]:pointer-events-auto" initial={reduced ? false : { opacity: 0, x: -20 }} animate={{ opacity: launching || phase === 'film' ? 0 : 1, x: phase === 'film' ? -20 : 0 }} transition={{ duration: launching ? 0.5 : 1, ease: [0.16, 1, 0.3, 1] }}>
        <Image src="/brand/cosmicpulse-logo.png" alt="CosmicPulse" width={560} height={104} priority className="h-auto w-[min(520px,82vw)] drop-shadow-[0_0_40px_rgba(169,155,255,0.45)]" />
        <p className="t-overline tracking-[0.35em] text-[#BFEFFA]">PROTECTING HUMAN HEALTH BEYOND EARTH</p>
        <button
          onClick={enter}
          onMouseEnter={() => sound && sfx.tick()}
          className="group relative mt-3 flex items-center gap-3 self-start overflow-hidden rounded-full bg-white py-4 pr-8 pl-6 text-[18px] font-bold tracking-[0.14em] text-[#05080D] shadow-[0_0_60px_rgba(124,200,242,0.5)] transition-transform hover:scale-[1.04] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white">
          <Rocket size={22} className="relative z-10 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" aria-hidden />
          <span className="relative z-10">{replay ? 'BACK TO SETTINGS' : 'ENTER COSMICPULSE'}</span>
          {!reduced && <span className="absolute inset-y-0 -left-1/2 w-1/3 skew-x-[-20deg] bg-gradient-to-r from-transparent via-[#9FE6F2]/70 to-transparent [animation:intro-sheen_2.4s_ease-in-out_infinite]" aria-hidden />}
        </button>
        {/* discovery counter (mini-game) */}
        <div className="flex items-center gap-2" aria-label={`Discovered ${found.length} of 3`}>
          {(['earth', 'station', 'moon'] as Pick[]).map((p) => (
            <motion.span key={p} animate={found.includes(p) && !reduced ? { scale: [1, 1.4, 1] } : undefined} className={cn('flex size-8 items-center justify-center rounded-full', found.includes(p) ? 'bg-[#F2B84B] text-[#05080D]' : 'bg-white/10 text-white/40')}>
              <Star size={15} fill={found.includes(p) ? 'currentColor' : 'none'} />
            </motion.span>
          ))}
          <span className="t-caption text-white/60">{found.length === 3 ? 'All discovered! ✨' : 'Find all 3'}</span>
        </div>
      </motion.div>

      {/* Nova */}
      <motion.div className="pointer-events-none absolute bottom-4 left-2 max-w-[min(560px,96vw)] sm:bottom-8 sm:left-[4%]" animate={{ opacity: launching || phase === 'film' ? 0 : 1, y: launching || phase === 'film' ? 30 : 0 }} transition={{ delay: phase === 'launch' && !launching ? 0.9 : 0 }}>
        <Guide say={say} pose={pose} size={120} />
      </motion.div>

      {/* Launch flash */}
      <AnimatePresence>
        {launching && <motion.div className="pointer-events-none absolute inset-0 bg-white" initial={{ opacity: 0 }} animate={{ opacity: [0, 0, 0.9] }} transition={{ duration: 1.9, times: [0, 0.75, 1] }} />}
      </AnimatePresence>

      {/* Landing film — first thing you see; fades into the universe at the hand-off. */}
      <AnimatePresence>
        {phase === 'film' && (
          <motion.div key={filmKey} className="absolute inset-0 z-30" initial={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: reduced ? 0.2 : 1.4, ease: 'easeInOut' }}>
            <LandingFilm onDone={() => setPhase('launch')} />
          </motion.div>
        )}
      </AnimatePresence>
    </main>
  );
}
