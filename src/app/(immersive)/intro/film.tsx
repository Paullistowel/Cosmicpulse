'use client';

import { Captions, CaptionsOff, Pause, Play, SkipForward } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useEffect, useRef, useState } from 'react';

import { cn } from '@/lib/cn';

/**
 * Landing film — the first thing you see when CosmicPulse opens. 23 s cut from public-domain
 * NASA footage (public/media/intro.mp4, see public/media/CREDITS.md). When the footage reaches
 * Earth's night limb it hands over to the interactive launch universe (onDone).
 */
const CAPTIONS: { from: number; to: number; text: string }[] = [
  { from: 0.4, to: 4.3, text: 'Humanity is exploring beyond Earth.' },
  { from: 4.5, to: 6.6, text: 'Farther than ever before.' },
  { from: 6.8, to: 10.6, text: 'Living and working in space.' },
  { from: 10.8, to: 14.8, text: 'Far from home, the human body needs protecting.' },
  { from: 15.0, to: 16.8, text: 'That’s your mission.' },
];
/** The cut reaches the dark night-limb plate here — hand over to the 3D universe. */
export const HANDOFF_AT = 17.2;

export function LandingFilm({ onDone }: { onDone: () => void }) {
  const ref = useRef<HTMLVideoElement>(null);
  const [t, setT] = useState(0);
  const [playing, setPlaying] = useState(true);
  const [blocked, setBlocked] = useState(false);
  const [cc, setCc] = useState(true);
  const done = useRef(false);

  const finish = () => {
    if (done.current) return;
    done.current = true;
    onDone();
  };

  // Follow the video clock; hand over at the night-limb plate.
  useEffect(() => {
    let raf = 0;
    const tick = () => {
      const v = ref.current;
      if (v) {
        setT(v.currentTime);
        if (v.currentTime >= HANDOFF_AT || v.ended) finish();
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const v = ref.current;
    if (!v) return;
    if (playing) {
      v.play().then(() => setBlocked(false)).catch(() => {
        // Autoplay refused (e.g. low-power mode): one big play button over the poster.
        setBlocked(true);
        setPlaying(false);
      });
    } else v.pause();
  }, [playing]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') finish();
      if (e.key === ' ' || e.key === 'k') {
        e.preventDefault();
        setPlaying((p) => !p);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const caption = CAPTIONS.find((c) => t >= c.from && t < c.to);

  return (
    <div className="absolute inset-0 z-30 bg-black" role="region" aria-label="CosmicPulse landing film">
      <video
        ref={ref}
        className="absolute inset-0 h-full w-full object-cover"
        poster="/media/intro-poster.jpg"
        muted
        playsInline
        autoPlay
        preload="auto"
        aria-label="Footage: Earth from orbit, the Orion spacecraft’s view of Earth, the International Space Station, and astronauts living aboard it (NASA)">
        {/* Only a failure of the (single) source means no video — go straight to the launch pad. */}
        <source src="/media/intro.mp4" type="video/mp4" onError={finish} />
        <track kind="captions" src="/media/intro.vtt" srcLang="en" label="English" />
      </video>

      {/* film grade + letterbox */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(120%_90%_at_50%_45%,transparent_45%,rgba(0,0,0,0.75))]" aria-hidden />
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-black/40 via-transparent to-black/70" aria-hidden />
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[6vh] bg-black" aria-hidden />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-[6vh] bg-black" aria-hidden />

      {/* captions */}
      <div className="pointer-events-none absolute inset-x-0 bottom-[calc(6vh+4.5rem)] flex justify-center px-6" aria-live="polite">
        <AnimatePresence mode="wait">
          {caption && (
            <motion.p
              key={caption.text}
              initial={{ opacity: 0, y: 10, filter: 'blur(6px)' }}
              animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
              className={cn('max-w-3xl text-center font-[family-name:var(--font-urbanist)] text-[26px] leading-tight font-semibold tracking-tight text-balance sm:text-[44px]', !cc && 'sr-only')}
              style={{ textShadow: '0 2px 30px rgba(0,0,0,0.8)' }}>
              {caption.text}
            </motion.p>
          )}
        </AnimatePresence>
      </div>

      {blocked && !playing && (
        <button onClick={() => setPlaying(true)} className="absolute inset-0 flex items-center justify-center" aria-label="Play the CosmicPulse film">
          <span className="flex size-24 items-center justify-center rounded-full bg-white/15 backdrop-blur-md transition-transform hover:scale-105"><Play size={40} className="ml-1" /></span>
        </button>
      )}

      {/* chrome */}
      <div className="absolute inset-x-0 top-[6vh] flex items-center justify-between gap-2 px-4 pt-3 sm:px-8">
        <span className="t-telemetry text-white/50">CHAPTER 01 · THE CALL TO EXPLORE</span>
        <button onClick={finish} className="t-callout flex items-center gap-1.5 rounded-full bg-white/10 px-4 py-2 font-medium text-white backdrop-blur hover:bg-white/20">
          Skip <SkipForward size={15} aria-hidden />
        </button>
      </div>
      <div className="absolute inset-x-0 bottom-[6vh] flex items-center gap-3 px-4 pb-3 sm:px-8">
        <button onClick={() => setPlaying((p) => !p)} aria-label={playing ? 'Pause' : 'Play'} className="flex size-9 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20">
          {playing ? <Pause size={16} /> : <Play size={16} />}
        </button>
        <div className="relative h-1 flex-1 overflow-hidden rounded-full bg-white/15" role="progressbar" aria-label="Film progress" aria-valuemin={0} aria-valuemax={Math.round(HANDOFF_AT)} aria-valuenow={Math.round(t)}>
          <div className="absolute inset-y-0 left-0 bg-gradient-to-r from-[#62D2E6] to-[#A99BFF]" style={{ width: `${Math.min(100, (t / HANDOFF_AT) * 100)}%` }} />
        </div>
        <button onClick={() => setCc((c) => !c)} aria-pressed={cc} aria-label={cc ? 'Hide captions' : 'Show captions'} className="flex size-9 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20">
          {cc ? <Captions size={16} /> : <CaptionsOff size={16} />}
        </button>
      </div>
    </div>
  );
}
