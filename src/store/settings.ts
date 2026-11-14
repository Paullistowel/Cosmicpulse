import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import type { DemoConditionId } from '@/data/demo/conditions';
import type { ScenarioId } from '@/data/demo/scenarios';
import { DEFAULT_THRESHOLDS, type GlucoseUnit, type Thresholds, type UnitSystem } from '@/data/vitals';

export type ThemePref = 'system' | 'light' | 'dark';
export type MotionPref = 'system' | 'reduced' | 'full';

/**
 * Web preferences (non-sensitive, so plain localStorage). Health data lives in
 * the encrypted vault (`store/health.ts`).
 */
type SettingsState = {
  theme: ThemePref;
  motion: MotionPref;
  units: UnitSystem;
  glucoseUnit: GlucoseUnit;
  thresholds: Thresholds;
  thresholdsSetBy?: string;
  scenario: ScenarioId;
  /** SIMULATION data source: synthetic telemetry fills metrics that have no real readings. */
  demoFallback: boolean;
  demoCondition: DemoConditionId;
  /** Consent to send summarised context to the cloud assistant (ground server). */
  aiCloudConsent: boolean;
  welcomed: boolean;
  /** The cinematic introduction has been watched or skipped (replay from Settings). */
  introSeen: boolean;
  /** Ambient sound for the introduction (off by default). */
  introSound: boolean;
  /** What Nova calls the explorer (optional, set in onboarding). */
  callsign: string;
  /** Interface sound effects (synthesised; muted with one tap). */
  sfx: boolean;
  /** The first-run guided tour has been completed or skipped. */
  tourDone: boolean;
  sidebarCollapsed: boolean;
  set: <K extends keyof Omit<SettingsState, 'set' | 'reset'>>(key: K, value: SettingsState[K]) => void;
  reset: () => void;
};

const defaults = () => ({
  theme: 'dark' as ThemePref,
  motion: 'system' as MotionPref,
  units: 'metric' as UnitSystem,
  glucoseUnit: 'mg/dL' as GlucoseUnit,
  thresholds: DEFAULT_THRESHOLDS,
  thresholdsSetBy: undefined as string | undefined,
  scenario: 'iss_nominal' as ScenarioId,
  demoFallback: true,
  demoCondition: 'none' as DemoConditionId,
  aiCloudConsent: true,
  welcomed: false,
  introSeen: false,
  introSound: false,
  callsign: '',
  sfx: true,
  tourDone: false,
  sidebarCollapsed: false,
});

export const useSettings = create<SettingsState>()(
  persist(
    (set) => ({
      ...defaults(),
      set: (key, value) => set({ [key]: value } as Partial<SettingsState>),
      reset: () => set(defaults()),
    }),
    {
      name: 'cosmicpulse.settings.v1',
      storage: createJSONStorage(() => localStorage),
      version: 2,
      // v2: immersive deep-space theme becomes the default (Pearl remains available).
      migrate: (p, v) => ({ ...(p as object), ...(v < 2 ? { theme: 'dark' } : {}) }) as SettingsState,
    },
  ),
);
