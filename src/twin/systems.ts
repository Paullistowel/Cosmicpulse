import type { Insight, Measurement, VitalType } from '@/data/types';
import { classify, DEFAULT_THRESHOLDS } from '@/data/vitals';
import { metricOf } from '@/engine/explain';
import type { HazardId } from '@/research/hazards';

/**
 * Astronaut Digital Twin — body-system model.
 *
 * Each system maps to the measurements CosmicPulse actually has, the engine
 * findings about them and the NASA hazards that affect them. Status is
 * derived only from real engine output and data availability:
 *   normal    — data present, no findings
 *   attention — informational/moderate finding or a guideline band warning
 *   high      — a finding recommending medical review or urgent attention
 *   unknown   — no readings for this system in the last 7 days
 */
export type SystemId = 'cardiovascular' | 'respiratory' | 'neuro' | 'musculoskeletal' | 'immune' | 'metabolic';
export type SystemStatus = 'normal' | 'attention' | 'high' | 'unknown';

export type BodySystem = {
  id: SystemId;
  name: string;
  plain: string;
  metrics: VitalType[];
  behavioural?: boolean;
  hazards: HazardId[];
  /** Plain-language "what spaceflight does" (with evidence in the hazard pages). */
  spaceflight: string;
  /** What the twin animates and why. */
  animation: string;
};

export const SYSTEMS: BodySystem[] = [
  { id: 'cardiovascular', name: 'Heart & circulation', plain: 'How your heart pumps blood around your body.', metrics: ['heart_rate', 'blood_pressure', 'hrv'], hazards: ['gravity', 'radiation'], spaceflight: 'Without gravity, body fluids shift towards the head and the heart works differently; NASA studies these “cardiovascular adaptations”.', animation: 'Beats at your latest recorded heart rate.' },
  { id: 'respiratory', name: 'Lungs & oxygen', plain: 'How you breathe and how much oxygen reaches your blood.', metrics: ['spo2', 'respiratory_rate'], hazards: ['environment'], spaceflight: 'In a sealed spacecraft, cabin CO₂ and oxygen levels directly affect breathing; low oxygen (hypoxia) is a NASA-listed risk.', animation: 'Breathes at your latest recorded respiratory rate.' },
  { id: 'neuro', name: 'Brain, sleep & mood', plain: 'Sleep, stress and how you feel.', metrics: ['sleep', 'hrv'], behavioural: true, hazards: ['isolation', 'distance'], spaceflight: 'Isolation, confinement and irregular schedules affect sleep and mood; NASA studies behavioural health and sleep on Artemis II.', animation: 'Highlights when selected (not a measurement).' },
  { id: 'musculoskeletal', name: 'Muscles & bones', plain: 'Strength, movement and bone loading.', metrics: ['steps', 'weight'], hazards: ['gravity'], spaceflight: 'With no weight to carry, muscles and bones lose loading; daily countermeasure exercise protects them.', animation: 'Highlights when selected (not a measurement).' },
  { id: 'immune', name: 'Temperature & immunity', plain: 'Body temperature and your defence against infection.', metrics: ['temperature'], hazards: ['environment', 'radiation'], spaceflight: 'Spaceflight can alter immune responses, and microbes behave differently in closed habitats; NASA tracks immune biomarkers.', animation: 'Glows with temperature status (no motion).' },
  { id: 'metabolic', name: 'Energy & metabolism', plain: 'Blood sugar, body mass and energy balance.', metrics: ['glucose', 'weight'], hazards: ['distance'], spaceflight: 'Far from Earth, food supply and appetite matter; NASA studies food acceptability and spaceflight nutrition.', animation: 'Static (no live metabolic measurement).' },
];

export const SYSTEM_BY_ID = Object.fromEntries(SYSTEMS.map((s) => [s.id, s])) as Record<SystemId, BodySystem>;

export const STATUS_COPY: Record<SystemStatus, { label: string; tone: 'success' | 'warning' | 'critical' | 'neutral'; color: string }> = {
  normal: { label: 'Normal', tone: 'success', color: '#3FD38E' },
  attention: { label: 'Attention required', tone: 'warning', color: '#F2B84B' },
  high: { label: 'High priority', tone: 'critical', color: '#FF6464' },
  unknown: { label: 'Unknown / no data', tone: 'neutral', color: '#66768C' },
};

const DAY = 86_400_000;

export function findingsForSystem(id: SystemId, findings: Insight[]): Insight[] {
  const sys = SYSTEM_BY_ID[id];
  return findings.filter((f) => {
    if (f.module === 'data_quality') return false;
    if (f.id === 'pattern:physiological-strain') return id === 'cardiovascular' || id === 'respiratory' || id === 'immune';
    if (f.id === 'recovery:sleep-debt') return id === 'neuro';
    if (f.id.startsWith('env:radiation') || f.id === 'env:career-dose') return id === 'immune';
    if (f.id === 'env:cabin_co2' || f.id === 'env:cabin_o2' || f.id === 'env:cabin_pressure') return id === 'respiratory';
    if (f.id.startsWith('env:')) return false;
    const m = metricOf(f);
    return !!m && sys.metrics.includes(m);
  });
}

export function systemStatus(id: SystemId, input: { measurements: Measurement[]; findings: Insight[]; moodsRecent?: number; now: number }): { status: SystemStatus; findings: Insight[]; latest: Partial<Record<VitalType, Measurement>> } {
  const sys = SYSTEM_BY_ID[id];
  const latest: Partial<Record<VitalType, Measurement>> = {};
  for (const m of input.measurements) {
    if (!sys.metrics.includes(m.type) || m.qualityFlag) continue;
    const t = new Date(m.takenAt).getTime();
    if (t > input.now + 60_000) continue;
    if (!latest[m.type] || latest[m.type]!.takenAt < m.takenAt) latest[m.type] = m;
  }
  const fresh = Object.values(latest).some((m) => input.now - new Date(m!.takenAt).getTime() < 7 * DAY) || (sys.behavioural && (input.moodsRecent ?? 0) > 0);
  const f = findingsForSystem(id, input.findings);
  if (f.some((x) => x.severity === 'high' || x.severity === 'critical')) return { status: 'high', findings: f, latest };
  if (!fresh) return { status: 'unknown', findings: f, latest };
  const banded = Object.values(latest).some((m) => {
    const b = classify(m!, DEFAULT_THRESHOLDS);
    return b && (b.tone === 'warning' || b.tone === 'critical');
  });
  if (f.length || banded) return { status: 'attention', findings: f, latest };
  return { status: 'normal', findings: f, latest };
}
