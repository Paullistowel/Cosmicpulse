/* Copied verbatim from the CosmicPulse mobile app (src/data/demo/random.ts) by scripts/sync-mobile-core.mjs.
 * Edit the mobile original and re-run `npm run sync:mobile`; do not edit this copy. */
/** Deterministic PRNG (mulberry32) so demo datasets are reproducible. */
export function createRng(seed: number) {
  let a = seed >>> 0;
  const next = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return {
    next,
    range: (min: number, max: number) => min + next() * (max - min),
    int: (min: number, max: number) => Math.floor(min + next() * (max - min + 1)),
    /** Approximately normal via Box–Muller. */
    normal: (mean: number, sd: number) => {
      const u = Math.max(next(), 1e-9);
      const v = next();
      return mean + sd * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
    },
    pick: <T,>(arr: readonly T[]): T => arr[Math.floor(next() * arr.length)],
    chance: (p: number) => next() < p,
  };
}

export type Rng = ReturnType<typeof createRng>;

let counter = 0;
export function uid(prefix = 'id'): string {
  counter += 1;
  return `${prefix}_${Date.now().toString(36)}_${counter.toString(36)}_${Math.floor(Math.random() * 1e6).toString(36)}`;
}

export const DAY = 24 * 60 * 60 * 1000;

export function daysAgo(n: number, hour = 8, minute = 0, now = new Date()): string {
  const d = new Date(now.getTime() - n * DAY);
  d.setHours(hour, minute, 0, 0);
  return d.toISOString();
}

export function daysAhead(n: number, hour = 9, minute = 0, now = new Date()): string {
  return daysAgo(-n, hour, minute, now);
}
