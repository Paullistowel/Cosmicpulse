'use client';
import { BodyMap } from './body-map';
import type { TwinProps } from './twin-scene';

/** Used when the 3D bundle cannot load (e.g. offline before it was cached). */
export default function TwinFallback({ status, selected, onSelect }: TwinProps) {
  return (
    <div className="flex h-full flex-col p-6">
      <p className="t-caption text-ink-3">3D view unavailable offline — showing the 2D body map.</p>
      <div className="min-h-0 flex-1"><BodyMap status={status} selected={selected} onSelect={(id) => onSelect(id)} /></div>
    </div>
  );
}
