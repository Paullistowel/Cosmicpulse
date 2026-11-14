'use client';
import { useId } from 'react';

/**
 * CosmicPulse brand mark (same geometry as the mobile AegisMark): a graphite
 * planet held by a sage orbit, with a clinical pulse running through it.
 * `animated` draws the pulse once (CSS, honours reduced motion).
 */
export const PLANET_PATH = 'M32 10 A22 22 0 1 1 31.99 10 Z';
export const PULSE_PATH = 'M8 34 L20 34 L25 25 L31 44 L36 20 L41 34 L56 34';

export function CosmicMark({ size = 40, animated = false, className }: { size?: number; animated?: boolean; className?: string }) {
  // Unique gradient ids: a duplicate id inside a hidden subtree would blank every other mark.
  const id = useId().replace(/:/g, '');
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" role="img" aria-label="CosmicPulse logo" className={className}>
      <defs>
        <linearGradient id={`p${id}`} x1="0.2" y1="0" x2="0.8" y2="1">
          <stop offset="0" stopColor="#4A5250" />
          <stop offset="1" stopColor="#1C1F21" />
        </linearGradient>
        <linearGradient id={`o${id}`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#A9C3AC" />
          <stop offset="1" stopColor="#6F9A76" />
        </linearGradient>
      </defs>
      <path d={PLANET_PATH} fill={`url(#p${id})`} />
      <path d="M3 40 C 10 54, 54 54, 61 40 C 64 33, 58 26, 52 24" stroke={`url(#o${id})`} strokeWidth={3} strokeLinecap="round" fill="none" />
      <path
        d={PULSE_PATH}
        stroke="#FFFFFF"
        strokeWidth={3.4}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
        className={animated ? 'draw' : undefined}
        style={animated ? ({ strokeDasharray: 100, ['--len' as string]: 100 } as React.CSSProperties) : undefined}
      />
    </svg>
  );
}

export function Wordmark({ size = 22, className }: { size?: number; className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2.5 ${className ?? ''}`}>
      <CosmicMark size={size * 1.4} />
      <span className="font-display tracking-tight text-ink" style={{ fontSize: size, lineHeight: 1.1, fontWeight: 600 }}>
        Cosmic<span style={{ fontWeight: 400 }}>Pulse</span>
      </span>
    </span>
  );
}
