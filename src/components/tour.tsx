'use client';

import { ArrowLeft, ArrowRight, X } from 'lucide-react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { usePathname, useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { create } from 'zustand';

import { Nova, type Pose } from '@/components/companion';
import { award } from '@/game/progress';
import { sfx } from '@/lib/sfx';
import { useSettings } from '@/store/settings';

/**
 * First-run guided tour. Nova walks the explorer through the real app — each stop spotlights
 * a live element (which stays interactive) on its real page. Skip / replay / help; completion
 * is remembered in settings (tourDone).
 */
type Step = { route: string; target?: string; say: string; pose: Pose; title: string };

const STEPS: Step[] = [
  { route: '/', target: '[data-tour="hub-nova"]', title: 'Mission hub', say: 'This is your mission hub. I’ll always show you the next step right here.', pose: 'wave' },
  { route: '/', target: '[data-tour="nav-health"]', title: 'My Health', say: 'My Health holds your body lab, Sentinel and your health story.', pose: 'point' },
  { route: '/twin', target: '.twin-stage', title: 'Human Twin', say: 'Your Human Twin! Drag to spin it and tap the heart — go on, try it!', pose: 'point' },
  { route: '/sentinel', target: '[data-tour="sentinel-hero"]', title: 'Sentinel AI', say: 'Sentinel, our ship’s health AI, briefs you daily and explains every change.', pose: 'think' },
  { route: '/alerts', target: '[data-tour="page-intro"]', title: 'Health alerts', say: 'Alerts show what changed, why it matters and what to do. Colours always come with labels.', pose: 'point' },
  { route: '/simulator', target: '[role="tablist"]', title: 'Hazard expeditions', say: 'Explore the five dangers of space. Tap one to start an expedition!', pose: 'point' },
  { route: '/missions', target: '[data-tour="missions-hero"]', title: 'Missions & rewards', say: 'Complete daily objectives to earn XP, ranks and insignia.', pose: 'celebrate' },
  { route: '/', target: '[data-tour="emergency"]', title: 'Emergency', say: 'Feeling unwell? The red Emergency button is on every screen. Use it first.', pose: 'point' },
  { route: '/', title: 'Ready!', say: 'You’re ready, Explorer! Tap the ? button any time to see this tour again.', pose: 'celebrate' },
];

export const useTour = create<{ active: boolean; step: number; start: () => void; stop: () => void; go: (n: number) => void }>((set) => ({
  active: false,
  step: 0,
  start: () => set({ active: true, step: 0 }),
  stop: () => set({ active: false }),
  go: (n) => set({ step: n }),
}));

function visibleTarget(sel?: string): HTMLElement | null {
  if (!sel) return null;
  for (const el of Array.from(document.querySelectorAll<HTMLElement>(sel))) {
    const r = el.getBoundingClientRect();
    if (r.width > 0 && r.height > 0) return el;
  }
  return null;
}

export function TourOverlay() {
  const { active, step, stop, go, start } = useTour();
  const router = useRouter();
  const pathname = usePathname();
  const reduced = useReducedMotion();
  const welcomed = useSettings((s) => s.welcomed);
  const tourDone = useSettings((s) => s.tourDone);
  const sound = useSettings((s) => s.sfx);
  const set = useSettings((s) => s.set);
  const s = STEPS[step];
  const key = `${step}:${pathname}`;
  const [spot, setSpot] = useState<{ k: string; r: DOMRect | null } | null>(null);
  const rect = spot && spot.k === key ? spot.r : null;

  // First visit after onboarding: start automatically (never on Emergency).
  useEffect(() => {
    if (welcomed && !tourDone && !active && !pathname.startsWith('/emergency')) {
      const t = setTimeout(start, 1200);
      return () => clearTimeout(t);
    }
  }, [welcomed, tourDone, active, pathname, start]);

  // Go to the step's page, then find and track its target.
  useEffect(() => {
    if (!active) return;
    if (pathname !== s.route) {
      router.push(s.route);
      return;
    }
    let tries = 0;
    let raf = 0;
    let el: HTMLElement | null = null;
    const find = () => {
      el = visibleTarget(s.target);
      if (el) {
        el.scrollIntoView({ block: 'center', behavior: reduced ? 'auto' : 'smooth' });
        track();
      } else if (s.target && tries++ < 60) raf = window.setTimeout(find, 100) as unknown as number;
      else setSpot({ k: key, r: null });
    };
    const track = () => {
      if (el) setSpot({ k: key, r: el.getBoundingClientRect() });
      raf = requestAnimationFrame(track);
    };
    raf = window.setTimeout(find, 0) as unknown as number;
    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(raf);
    };
  }, [active, step, pathname, s, router, reduced, key]);

  const finish = useCallback(() => {
    set('tourDone', true);
    stop();
  }, [set, stop]);
  const next = useCallback(() => {
    if (sound) sfx.tick();
    if (step >= STEPS.length - 1) {
      award('onboarding');
      if (sound) sfx.sparkle();
      finish();
    } else go(step + 1);
  }, [step, go, finish, sound]);
  const back = useCallback(() => step > 0 && go(step - 1), [step, go]);

  useEffect(() => {
    if (!active) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') finish();
      if (e.key === 'ArrowRight') next();
      if (e.key === 'ArrowLeft') back();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [active, finish, next, back]);

  if (!active) return null;
  const pad = 10;
  const hole = rect ? { x: rect.left - pad, y: rect.top - pad, w: rect.width + pad * 2, h: rect.height + pad * 2 } : null;
  // Place Nova's card below the target if there's room, else above; centre when no target.
  const vw = typeof window !== 'undefined' ? window.innerWidth : 1200;
  const vh = typeof window !== 'undefined' ? window.innerHeight : 800;
  const cardW = Math.min(420, vw - 24);
  const CARD_H = 250;
  let top = vh / 2 - 120;
  let left = vw / 2 - cardW / 2;
  if (hole) {
    const centred = Math.min(vw - cardW - 12, Math.max(12, hole.x + hole.w / 2 - cardW / 2));
    if (hole.y + hole.h + CARD_H < vh) [top, left] = [hole.y + hole.h + 14, centred];
    else if (hole.y - CARD_H > 12) [top, left] = [hole.y - CARD_H, centred];
    else if (hole.x + hole.w + cardW + 24 < vw) [top, left] = [Math.max(12, vh / 2 - CARD_H / 2), hole.x + hole.w + 16];
    else [top, left] = [vh - CARD_H - 12, centred];
  }

  return (
    <div className="fixed inset-0 z-[90]" role="dialog" aria-modal="true" aria-label={`Guided tour: ${s.title}`}>
      {/* Dim everything except the spotlight (the spotlit element stays clickable). */}
      {hole ? (
        <>
          <div className="absolute inset-x-0 top-0 bg-black/65" style={{ height: Math.max(0, hole.y) }} onClick={next} />
          <div className="absolute inset-x-0 bottom-0 bg-black/65" style={{ top: hole.y + hole.h }} onClick={next} />
          <div className="absolute left-0 bg-black/65" style={{ top: hole.y, height: hole.h, width: Math.max(0, hole.x) }} onClick={next} />
          <div className="absolute right-0 bg-black/65" style={{ top: hole.y, height: hole.h, left: hole.x + hole.w }} onClick={next} />
          <motion.div className="pointer-events-none absolute rounded-[24px] ring-2 ring-[#62D2E6]" style={{ left: hole.x, top: hole.y, width: hole.w, height: hole.h, boxShadow: '0 0 0 4px rgba(98,210,230,0.25), 0 0 40px rgba(98,210,230,0.5)' }} animate={reduced ? undefined : { opacity: [0.6, 1, 0.6] }} transition={{ duration: 1.6, repeat: Infinity }} />
        </>
      ) : (
        <div className="absolute inset-0 bg-black/65" />
      )}

      <AnimatePresence mode="wait">
        <motion.div
          key={step}
          initial={reduced ? false : { opacity: 0, y: 12, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
          className="absolute flex items-end gap-2"
          style={{ top, left, width: cardW }}>
          <Nova pose={s.pose} size={86} className="shrink-0" />
          <div className="mb-2 flex-1 rounded-[22px] rounded-bl-[6px] bg-[#0E1A33] p-4 text-white shadow-2xl ring-1 ring-white/10">
            <div className="flex items-center justify-between gap-2">
              <p className="t-overline text-[#62D2E6]">{s.title} · {step + 1}/{STEPS.length}</p>
              <button onClick={finish} aria-label="Skip tour" className="rounded-full p-1 text-white/50 hover:text-white"><X size={15} /></button>
            </div>
            <p className="t-body mt-1 font-medium">{s.say}</p>
            <div className="mt-3 flex items-center justify-between gap-2">
              <button onClick={finish} className="t-caption text-white/55 hover:text-white">Skip tour</button>
              <div className="flex gap-2">
                {step > 0 && <button onClick={back} aria-label="Back" className="flex size-10 items-center justify-center rounded-full bg-white/10 hover:bg-white/20"><ArrowLeft size={16} /></button>}
                <button onClick={next} className="t-callout flex h-10 items-center gap-1.5 rounded-full bg-white px-4 font-semibold text-[#05080D]">
                  {step === STEPS.length - 1 ? 'Start exploring' : 'Next'} <ArrowRight size={15} />
                </button>
              </div>
            </div>
            <div className="mt-3 flex gap-1" aria-hidden>
              {STEPS.map((_, i) => <span key={i} className={i === step ? 'h-1 w-5 rounded-full bg-[#62D2E6]' : i < step ? 'h-1 w-2 rounded-full bg-white/60' : 'h-1 w-2 rounded-full bg-white/20'} />)}
            </div>
          </div>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
