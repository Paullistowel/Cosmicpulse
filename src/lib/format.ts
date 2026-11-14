/* Copied verbatim from the CosmicPulse mobile app (src/lib/format.ts) by scripts/sync-mobile-core.mjs.
 * Edit the mobile original and re-run `npm run sync:mobile`; do not edit this copy. */
import type { DataSource } from '@/data/types';

const DAY = 86_400_000;

export function relativeTime(iso: string, now = Date.now()): string {
  const diff = now - new Date(iso).getTime();
  const future = diff < 0;
  const abs = Math.abs(diff);
  const min = Math.round(abs / 60000);
  if (min < 1) return 'just now';
  if (min < 60) return future ? `in ${min} min` : `${min} min ago`;
  const h = Math.round(min / 60);
  if (h < 24) return future ? `in ${h} h` : `${h} h ago`;
  const d = Math.round(abs / DAY);
  if (d === 1) return future ? 'tomorrow' : 'yesterday';
  if (d < 14) return future ? `in ${d} days` : `${d} days ago`;
  return shortDate(iso);
}

export function shortDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export function longDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' });
}

export function dateTime(iso: string): string {
  return new Date(iso).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

export function time(iso: string): string {
  return new Date(iso).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
}

export function fullDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

export function greeting(d = new Date()): string {
  const h = d.getHours();
  if (h < 12) return 'Good morning';
  if (h < 18) return 'Good afternoon';
  return 'Good evening';
}

export function sourceLabel(s: DataSource): string {
  switch (s.kind) {
    case 'live':
      return `Live · ${s.deviceName}`;
    case 'synced':
      return `Synced · ${s.deviceName}`;
    case 'manual':
      return 'Entered manually';
    case 'demo':
      return 'Demo data';
    case 'simulated':
      return `Simulated · ${s.deviceName}`;
    case 'clinician':
      return `Clinician · ${s.name}`;
    case 'import':
      return 'Imported document';
  }
}

export function ageFrom(dob?: string): number | undefined {
  if (!dob) return undefined;
  const d = new Date(dob);
  const now = new Date();
  let age = now.getFullYear() - d.getFullYear();
  if (now.getMonth() < d.getMonth() || (now.getMonth() === d.getMonth() && now.getDate() < d.getDate())) age--;
  return age;
}

export function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join('');
}
