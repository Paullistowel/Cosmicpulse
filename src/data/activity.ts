/* Copied verbatim from the CosmicPulse mobile app (src/data/activity.ts) by scripts/sync-mobile-core.mjs.
 * Edit the mobile original and re-run `npm run sync:mobile`; do not edit this copy. */
import type { ISODate } from './types';

/**
 * Activity data model. One `ActivityDay` per local calendar date per source.
 * Platform sources (HealthKit / Health Connect) are already de-duplicated
 * across devices by the platform's own statistics query, so a day is never
 * summed across sources — the engine picks one source per day by priority.
 */

/** Where an activity record came from. `demo` is synthetic and always labelled. */
export type ActivitySource = 'healthkit' | 'health_connect' | 'fitbit' | 'garmin' | 'gps' | 'demo';

export type ActivityDay = {
  /** Local calendar date, YYYY-MM-DD. */
  date: string;
  source: ActivitySource;
  steps?: number;
  /** Device-recorded walking + running distance, metres. Never an estimate. */
  distanceM?: number;
  /** Cycling distance, metres (kept separate from walking/running). */
  cyclingM?: number;
  activeKcal?: number;
  exerciseMin?: number;
  /** Contributing source names reported by the platform (e.g. "Apple Watch", "iPhone"). */
  origins: string[];
  syncedAt: ISODate;
};

export type Workout = {
  /** Platform record id (HealthKit UUID / Health Connect metadata id) — used for de-duplication. */
  id: string;
  source: ActivitySource;
  activity: string;
  start: ISODate;
  end: ISODate;
  durationMin: number;
  distanceM?: number;
  kcal?: number;
  origin: string;
};

export type GpsPoint = { lat: number; lon: number; at: number; accuracy?: number };

export type GpsSession = {
  id: string;
  start: ISODate;
  end: ISODate;
  distanceM: number;
  durationS: number;
  steps?: number;
  /** Simplified route for display (kept small). */
  route: { lat: number; lon: number }[];
};

export type ActivityPrefs = {
  stepGoal: number;
  /** Stride length in metres, used only for clearly labelled estimates. */
  strideM?: number;
  strideSource?: 'user' | 'height' | 'default';
};

export type DistanceKind = 'measured' | 'gps' | 'estimated' | 'none';
