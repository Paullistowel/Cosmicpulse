'use client';

import { STATUS_COPY, SYSTEMS, type SystemId, type SystemStatus } from '@/twin/systems';

/**
 * 2D body map — fallback when WebGL is unavailable, and an accessible,
 * keyboard-operable alternative to the 3D twin.
 */
const SPOTS: Record<SystemId, { x: number; y: number; r: number }> = {
  neuro: { x: 100, y: 36, r: 20 },
  respiratory: { x: 100, y: 104, r: 26 },
  cardiovascular: { x: 110, y: 112, r: 12 },
  metabolic: { x: 96, y: 148, r: 16 },
  immune: { x: 72, y: 92, r: 9 },
  musculoskeletal: { x: 82, y: 250, r: 14 },
};

export function BodyMap({ status, selected, onSelect }: { status: Record<SystemId, SystemStatus>; selected: SystemId | null; onSelect: (id: SystemId) => void }) {
  return (
    <svg viewBox="0 0 200 340" className="mx-auto h-full max-h-[520px] w-auto" role="group" aria-label="Body systems map">
      <path d="M100 8a26 28 0 1 1-.1 0zM86 64h28l40 12 10 80-14 2-8-62-6 70 4 120h-20l-8-110h-4l-8 110H80l4-120-6-70-8 62-14-2 10-80z" fill="var(--primary-soft)" stroke="var(--primary)" strokeOpacity=".4" />
      {SYSTEMS.map((s) => {
        const p = SPOTS[s.id];
        const c = STATUS_COPY[status[s.id]].color;
        return (
          <g key={s.id} role="button" tabIndex={0} aria-pressed={selected === s.id} aria-label={`${s.name}: ${STATUS_COPY[status[s.id]].label}`} onClick={() => onSelect(s.id)} onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && onSelect(s.id)} className="cursor-pointer focus:outline-none">
            <circle cx={p.x} cy={p.y} r={p.r + 6} fill={c} opacity={selected === s.id ? 0.35 : 0.12} />
            <circle cx={p.x} cy={p.y} r={p.r} fill={c} opacity=".85" stroke={selected === s.id ? 'var(--ink)' : 'none'} strokeWidth="2" />
          </g>
        );
      })}
    </svg>
  );
}

export function webglAvailable(): boolean {
  try {
    const c = document.createElement('canvas');
    return !!(window.WebGL2RenderingContext ? c.getContext('webgl2') : null) || !!c.getContext('webgl');
  } catch {
    return false;
  }
}
