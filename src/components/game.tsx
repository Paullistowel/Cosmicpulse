'use client';

import { Nova } from '@/components/companion';
import { Award, Lock, Rocket, Sparkles, X } from 'lucide-react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import Link from 'next/link';
import { useEffect } from 'react';

import type { Achievement, ArtKey } from '@/game/objectives';
import { RANKS, rankFor, totalXp, useProgress } from '@/game/progress';
import { cn } from './ui';

/** Mission illustrations: small, distinct SVG scenes (decorative; meaning is always also in text). */
export function MissionArt({ art, size = 64, className }: { art: ArtKey; size?: number; className?: string }) {
  const s = { width: size, height: size, viewBox: '0 0 64 64', 'aria-hidden': true, className } as const;
  const bg = <circle cx="32" cy="32" r="30" fill="url(#ga)" />;
  const defs = (
    <defs>
      <radialGradient id="ga" cx="35%" cy="30%" r="75%">
        <stop offset="0" stopColor="var(--primary)" stopOpacity="0.35" />
        <stop offset="1" stopColor="var(--primary)" stopOpacity="0.06" />
      </radialGradient>
    </defs>
  );
  const ink = 'var(--ink)';
  const acc = 'var(--accent)';
  switch (art) {
    case 'pulse':
      return <svg {...s}>{defs}{bg}<path d="M10 34h10l4-10 6 20 5-16 3 6h16" stroke={acc} strokeWidth="3" fill="none" strokeLinecap="round" strokeLinejoin="round" /></svg>;
    case 'moon':
      return <svg {...s}>{defs}{bg}<path d="M38 16a16 16 0 1 0 10 28 13 13 0 0 1-10-28z" fill={ink} opacity=".85" /><circle cx="46" cy="18" r="1.6" fill={acc} /><circle cx="52" cy="28" r="1" fill={acc} /></svg>;
    case 'bed':
      return <svg {...s}>{defs}{bg}<rect x="14" y="30" width="36" height="10" rx="3" fill={ink} opacity=".8" /><rect x="16" y="24" width="10" height="7" rx="3" fill={acc} /><path d="M14 40v6M50 40v6" stroke={ink} strokeWidth="3" strokeLinecap="round" /><text x="40" y="22" fontSize="9" fill={acc} fontFamily="monospace">z z</text></svg>;
    case 'orbit':
      return <svg {...s}>{defs}{bg}<circle cx="32" cy="32" r="8" fill={ink} opacity=".85" /><ellipse cx="32" cy="32" rx="22" ry="8" stroke={acc} strokeWidth="2.5" fill="none" transform="rotate(-20 32 32)" /><circle cx="51" cy="25" r="3" fill={acc} /></svg>;
    case 'radar':
      return <svg {...s}>{defs}{bg}<circle cx="32" cy="32" r="18" stroke={acc} strokeWidth="2" fill="none" opacity=".6" /><circle cx="32" cy="32" r="10" stroke={acc} strokeWidth="2" fill="none" /><path d="M32 32 L46 20" stroke={ink} strokeWidth="3" strokeLinecap="round" /><circle cx="40" cy="38" r="2.5" fill="var(--warning)" /></svg>;
    case 'atom':
      return <svg {...s}>{defs}{bg}<circle cx="32" cy="32" r="4" fill={ink} />{[0, 60, 120].map((r) => <ellipse key={r} cx="32" cy="32" rx="20" ry="7" stroke={acc} strokeWidth="2" fill="none" transform={`rotate(${r} 32 32)`} />)}</svg>;
    case 'book':
      return <svg {...s}>{defs}{bg}<path d="M14 20c6-2 12-2 18 2 6-4 12-4 18-2v24c-6-2-12-2-18 2-6-4-12-4-18-2z" fill="none" stroke={ink} strokeWidth="2.5" strokeLinejoin="round" /><path d="M32 22v24" stroke={acc} strokeWidth="2.5" /></svg>;
    case 'shield':
      return <svg {...s}>{defs}{bg}<path d="M32 12l16 6v12c0 11-7 18-16 22-9-4-16-11-16-22V18z" fill={ink} opacity=".85" /><path d="M24 32l6 6 10-12" stroke={acc} strokeWidth="3" fill="none" strokeLinecap="round" strokeLinejoin="round" /></svg>;
    case 'steps':
      return <svg {...s}>{defs}{bg}<ellipse cx="24" cy="38" rx="5" ry="8" fill={ink} opacity=".85" /><ellipse cx="40" cy="26" rx="5" ry="8" fill={acc} /></svg>;
    case 'brain':
      return <svg {...s}>{defs}{bg}<path d="M24 20c-6 0-9 5-8 10-3 2-3 8 1 10 0 5 5 8 10 6 2 3 8 3 10 0 5 2 10-1 10-6 4-2 4-8 1-10 1-5-2-10-8-10-2-4-14-4-16 0z" fill="none" stroke={ink} strokeWidth="2.5" /><circle cx="27" cy="31" r="2" fill={acc} /><circle cx="37" cy="35" r="2" fill={acc} /><path d="M27 31l10 4" stroke={acc} strokeWidth="1.5" /></svg>;
    case 'station':
      return <svg {...s}>{defs}{bg}<rect x="27" y="18" width="10" height="28" rx="3" fill={ink} opacity=".85" /><rect x="10" y="26" width="15" height="12" fill={acc} opacity=".8" /><rect x="39" y="26" width="15" height="12" fill={acc} opacity=".8" /></svg>;
    case 'star':
    default:
      return <svg {...s}>{defs}{bg}<path d="M32 14l5 11 12 1-9 8 3 12-11-6-11 6 3-12-9-8 12-1z" fill={acc} /></svg>;
  }
}

const SHAPES: Record<Achievement['shape'], string> = {
  hex: 'M50 4 92 28v44L50 96 8 72V28z',
  circle: 'M50 4a46 46 0 1 1 0 92a46 46 0 1 1 0-92z',
  shield: 'M50 4 90 18v30c0 26-17 40-40 48C27 88 10 74 10 48V18z',
  star: 'M50 4l12 28 30 2-23 20 8 30-27-16-27 16 8-30L8 34l30-2z',
  diamond: 'M50 4 94 50 50 96 6 50z',
  ring: 'M50 4a46 46 0 1 1 0 92a46 46 0 1 1 0-92zM50 20a30 30 0 1 0 0 60a30 30 0 1 0 0-60z',
};

/** Achievement badge — each has its own shape, colour and emblem; locked badges are greyed. */
export function BadgeArt({ a, unlocked, size = 96 }: { a: Achievement; unlocked: boolean; size?: number }) {
  const id = `b-${a.id}`;
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" role="img" aria-label={`${a.title} badge${unlocked ? '' : ' (locked)'}`}>
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor={unlocked ? a.hue : '#8C908B'} stopOpacity={unlocked ? 1 : 0.45} />
          <stop offset="1" stopColor={unlocked ? '#16243A' : '#5D625F'} stopOpacity={unlocked ? 1 : 0.45} />
        </linearGradient>
      </defs>
      <path d={SHAPES[a.shape]} fill={`url(#${id})`} fillRule="evenodd" stroke={unlocked ? a.hue : 'var(--border-strong)'} strokeWidth="2" />
      <g transform="translate(18 18) scale(1)" opacity={unlocked ? 1 : 0.35}>
        <MissionArt art={a.art} size={64} />
      </g>
    </svg>
  );
}

export function RankMeter({ compact }: { compact?: boolean }) {
  const events = useProgress((s) => s.events);
  const xp = totalXp(events);
  const r = rankFor(xp);
  return (
    <Link href="/missions" className={cn('flex items-center gap-3', compact ? '' : 'card p-4')} aria-label={`Rank ${r.rank.name}, ${xp} XP`}>
      <span className="relative flex size-11 shrink-0 items-center justify-center">
        <svg viewBox="0 0 44 44" className="absolute inset-0" aria-hidden>
          <circle cx="22" cy="22" r="19" stroke="var(--chart-grid)" strokeWidth="4" fill="none" />
          <circle cx="22" cy="22" r="19" stroke="var(--accent)" strokeWidth="4" fill="none" strokeLinecap="round" strokeDasharray={`${2 * Math.PI * 19}`} strokeDashoffset={`${2 * Math.PI * 19 * (1 - r.progress)}`} transform="rotate(-90 22 22)" style={{ transition: 'stroke-dashoffset 0.8s var(--ease-out)' }} />
        </svg>
        <Rocket size={17} className="text-ink" />
      </span>
      <span className="min-w-0">
        <span className="t-overline block text-ink-3">Rank {r.index + 1}/{RANKS.length}</span>
        <span className="t-headline block truncate">{r.rank.name}</span>
        <span className="t-caption block text-ink-3">{xp.toLocaleString('en-US')} XP{r.next ? ` · ${r.next.xp - xp} to ${r.next.name}` : ' · top rank'}</span>
      </span>
    </Link>
  );
}

/** Milestone celebrations (XP, rank, achievement). Respects reduced motion; auto-dismisses. */
export function Celebrations() {
  const list = useProgress((s) => s.celebrations);
  const dismiss = useProgress((s) => s.dismiss);
  const reduced = useReducedMotion();
  useEffect(() => {
    if (!list.length) return;
    const t = setTimeout(() => dismiss(list[0].id), list[0].kind === 'xp' ? 2600 : 5200);
    return () => clearTimeout(t);
  }, [list, dismiss]);
  return (
    <div aria-live="polite" className="pointer-events-none fixed top-20 right-4 z-[75] flex w-[min(360px,calc(100vw-32px))] flex-col gap-2">
      <AnimatePresence>
        {list.map((c) => (
          <motion.div
            key={c.id}
            initial={reduced ? { opacity: 0 } : { opacity: 0, x: 40, scale: 0.95 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: reduced ? 0 : 30 }}
            transition={{ type: 'spring', damping: 22, stiffness: 260 }}
            className={cn('glass pointer-events-auto flex items-center gap-3 rounded-[20px] p-3', c.kind !== 'xp' && 'ring-1 ring-[var(--accent)]')}>
            {c.kind === 'xp' ? (
              <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary-soft text-primary"><Sparkles size={18} /></span>
            ) : (
              // Milestones are celebrated by Nova, the mission guide.
              <span className="relative -my-2 shrink-0" aria-hidden>
                <Nova pose="celebrate" size={58} />
                <span className={cn('absolute -right-1 bottom-1 flex size-6 items-center justify-center rounded-full', c.kind === 'achievement' ? 'bg-warning-soft text-warning-ink' : 'bg-accent-soft text-accent')}>{c.kind === 'achievement' ? <Award size={13} /> : <Rocket size={13} />}</span>
              </span>
            )}
            <span className="min-w-0 flex-1">
              <span className="t-headline block">{c.title}</span>
              <span className="t-caption block text-ink-2">{c.detail}</span>
            </span>
            <button aria-label="Dismiss" onClick={() => dismiss(c.id)} className="rounded-full p-1 text-ink-3 hover:text-ink">
              <X size={14} />
            </button>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}

export function LockedNote({ text }: { text: string }) {
  return (
    <span className="t-caption inline-flex items-center gap-1 text-ink-3">
      <Lock size={12} /> {text}
    </span>
  );
}
