'use client';

import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { useId, type ReactNode } from 'react';

import { cn } from '@/lib/cn';

/**
 * Nova — the CosmicPulse astronaut companion. One consistent character across the story:
 * welcomes the explorer, introduces features, points at discoveries and celebrates milestones.
 * Original vector character (no third-party art). Motion respects reduced-motion settings.
 */
export type Pose = 'float' | 'wave' | 'point' | 'think' | 'celebrate';

const ARM_L: Record<Pose, number[]> = { float: [8, 14, 8], wave: [10, 10, 10], point: [10, 10, 10], think: [-118, -122, -118], celebrate: [150, 162, 150] };
const ARM_R: Record<Pose, number[]> = { float: [-8, -14, -8], wave: [-140, -165, -120, -165, -140], point: [-82, -86, -82], think: [-12, -16, -12], celebrate: [-150, -162, -150] };

export function Nova({ pose = 'float', size = 160, className, title = 'Nova, your astronaut guide' }: { pose?: Pose; size?: number; className?: string; title?: string }) {
  const reduced = useReducedMotion();
  const id = useId().replace(/:/g, '');
  const loop = (values: number[], duration: number) => (reduced ? { rotate: values[0] } : { rotate: values, transition: { duration, repeat: Infinity, ease: 'easeInOut' as const } });
  return (
    <motion.svg
      viewBox="0 0 200 220"
      width={size}
      height={size * 1.1}
      className={cn('overflow-visible', className)}
      role="img"
      aria-label={title}
      animate={reduced ? undefined : pose === 'celebrate' ? { y: [0, -14, 0], rotate: [0, -4, 4, 0] } : { y: [0, -7, 0], rotate: [-2, 2, -2] }}
      transition={{ duration: pose === 'celebrate' ? 1.1 : 4.5, repeat: Infinity, ease: 'easeInOut' }}>
      <defs>
        <linearGradient id={`suit-${id}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#FFFFFF" />
          <stop offset="0.55" stopColor="#E3EAF3" />
          <stop offset="1" stopColor="#B4C2D4" />
        </linearGradient>
        <linearGradient id={`visor-${id}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#1B2A6B" />
          <stop offset="0.5" stopColor="#3B2E8F" />
          <stop offset="1" stopColor="#0B1435" />
        </linearGradient>
        <radialGradient id={`glow-${id}`} cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor="#62D2E6" stopOpacity="0.55" />
          <stop offset="1" stopColor="#62D2E6" stopOpacity="0" />
        </radialGradient>
        <linearGradient id={`pack-${id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#C9D3E0" />
          <stop offset="1" stopColor="#8E9CB2" />
        </linearGradient>
      </defs>

      {/* soft halo */}
      <ellipse cx="100" cy="112" rx="92" ry="96" fill={`url(#glow-${id})`} />

      {/* backpack */}
      <rect x="52" y="78" width="96" height="88" rx="26" fill={`url(#pack-${id})`} />

      {/* left arm (viewer's left) */}
      <motion.g style={{ transformOrigin: '62px 112px' }} animate={loop(ARM_L[pose], 3)}>
        <rect x="34" y="104" width="30" height="58" rx="15" fill={`url(#suit-${id})`} />
        <circle cx="49" cy="164" r="13" fill="#F2F5F9" stroke="#AEBBCD" strokeWidth="2" />
      </motion.g>

      {/* legs */}
      <motion.g animate={reduced ? undefined : { rotate: [-3, 3, -3] }} transition={{ duration: 4.5, repeat: Infinity, ease: 'easeInOut' }} style={{ transformOrigin: '100px 170px' }}>
        <rect x="70" y="160" width="26" height="46" rx="13" fill={`url(#suit-${id})`} />
        <rect x="104" y="160" width="26" height="46" rx="13" fill={`url(#suit-${id})`} />
        <rect x="66" y="196" width="34" height="18" rx="9" fill="#8E9CB2" />
        <rect x="100" y="196" width="34" height="18" rx="9" fill="#8E9CB2" />
      </motion.g>

      {/* torso */}
      <rect x="60" y="96" width="80" height="76" rx="30" fill={`url(#suit-${id})`} />
      {/* chest panel with CosmicPulse heartbeat light */}
      <rect x="80" y="118" width="40" height="26" rx="8" fill="#0E1A33" />
      <motion.path d="M84 131 h8 l3 -6 l5 12 l4 -9 l3 3 h9" fill="none" stroke="#62D2E6" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" animate={reduced ? undefined : { opacity: [0.5, 1, 0.5] }} transition={{ duration: 1, repeat: Infinity }} />
      <circle cx="88" cy="153" r="3.5" fill="#FF6464" />
      <circle cx="100" cy="153" r="3.5" fill="#F2B84B" />
      <circle cx="112" cy="153" r="3.5" fill="#3FD38E" />

      {/* right arm (viewer's right) */}
      <motion.g style={{ transformOrigin: '138px 112px' }} animate={loop(ARM_R[pose], pose === 'wave' ? 1.4 : 3)}>
        <rect x="136" y="104" width="30" height="58" rx="15" fill={`url(#suit-${id})`} />
        <circle cx="151" cy="164" r="13" fill="#F2F5F9" stroke="#AEBBCD" strokeWidth="2" />
      </motion.g>

      {/* helmet */}
      <circle cx="100" cy="62" r="46" fill={`url(#suit-${id})`} />
      <circle cx="100" cy="62" r="46" fill="none" stroke="#AEBBCD" strokeWidth="2" />
      <rect x="62" y="40" width="76" height="50" rx="25" fill={`url(#visor-${id})`} />
      {/* visor reflections */}
      <path d="M72 52 q10 -12 28 -10" stroke="#9FE6F2" strokeWidth="4" strokeLinecap="round" fill="none" opacity="0.8" />
      <circle cx="122" cy="74" r="4" fill="#A99BFF" opacity="0.8" />
      {/* friendly eyes behind the visor */}
      <motion.g animate={reduced ? undefined : { scaleY: [1, 1, 0.1, 1, 1] }} transition={{ duration: 4, repeat: Infinity, times: [0, 0.9, 0.93, 0.96, 1] }} style={{ transformOrigin: '100px 66px' }}>
        <ellipse cx="88" cy="66" rx="5" ry="6.5" fill="#CFEFFF" />
        <ellipse cx="112" cy="66" rx="5" ry="6.5" fill="#CFEFFF" />
      </motion.g>
      <path d={pose === 'think' ? 'M92 80 h16' : 'M90 78 q10 8 20 0'} stroke="#CFEFFF" strokeWidth="3" strokeLinecap="round" fill="none" />
      {/* antenna light */}
      <line x1="134" y1="26" x2="142" y2="12" stroke="#AEBBCD" strokeWidth="3" strokeLinecap="round" />
      <motion.circle cx="143" cy="10" r="5" fill="#62D2E6" animate={reduced ? undefined : { opacity: [0.4, 1, 0.4] }} transition={{ duration: 1.6, repeat: Infinity }} />

      {pose === 'celebrate' && !reduced && (
        <g>
          {[[30, 40, '#F2B84B'], [170, 34, '#62D2E6'], [20, 120, '#A99BFF'], [182, 110, '#3FD38E'], [100, 4, '#FF8A8A']].map(([x, y, c], i) => (
            <motion.path key={i} d={`M${x} ${y} l3 7 l7 3 l-7 3 l-3 7 l-3 -7 l-7 -3 l7 -3z`} fill={c as string} animate={{ scale: [0.4, 1.2, 0.4], opacity: [0, 1, 0] }} transition={{ duration: 1.2, repeat: Infinity, delay: i * 0.18 }} style={{ transformOrigin: `${x}px ${(y as number) + 7}px` }} />
          ))}
        </g>
      )}
    </motion.svg>
  );
}

/** Nova + speech bubble. `children` are optional actions under the line. */
export function Guide({ say, pose = 'float', size = 120, className, children, tone = 'dark', align = 'left' }: { say: ReactNode; pose?: Pose; size?: number; className?: string; children?: ReactNode; tone?: 'dark' | 'auto'; align?: 'left' | 'right' }) {
  const reduced = useReducedMotion();
  return (
    <div className={cn('flex items-end gap-3', align === 'right' && 'flex-row-reverse', className)}>
      <Nova pose={pose} size={size} className="shrink-0" />
      <AnimatePresence mode="wait">
        <motion.div
          key={typeof say === 'string' ? say : undefined}
          initial={reduced ? false : { opacity: 0, y: 8, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
          className={cn(
            'relative mb-6 max-w-md rounded-[22px] px-4 py-3',
            align === 'left' ? 'rounded-bl-[6px]' : 'rounded-br-[6px]',
            tone === 'dark' ? 'bg-white/[0.1] text-white backdrop-blur-md' : 'bg-[color-mix(in_srgb,var(--ink)_7%,var(--surface))] text-ink',
          )}>
          <p className="t-overline mb-0.5 text-[#62D2E6]">Nova</p>
          <div className="t-body font-medium">{say}</div>
          {children && <div className="mt-2.5 flex flex-wrap gap-2">{children}</div>}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
