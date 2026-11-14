/**
 * Confinement wellbeing check-in.
 *
 * PROTOTYPE self-report items written for CosmicPulse — NOT a validated
 * clinical or psychological instrument, and never used to screen for or
 * diagnose a disorder. It gives the astronaut a structured way to notice
 * changes relevant to the isolation & confinement hazard over time.
 */
export type ConfinementItem = { id: string; label: string; low: string; high: string; reverse?: boolean };

export const CONFINEMENT_ITEMS: ConfinementItem[] = [
  { id: 'connection', label: 'Connection with family and friends on Earth', low: 'Very disconnected', high: 'Well connected' },
  { id: 'crew', label: 'Getting along with the crew', low: 'Strained', high: 'Very good' },
  { id: 'monotony', label: 'Sense of monotony or boredom', low: 'None', high: 'Overwhelming', reverse: true },
  { id: 'privacy', label: 'Enough private time and space', low: 'Not at all', high: 'Plenty' },
  { id: 'workload', label: 'Workload feels manageable', low: 'Unmanageable', high: 'Very manageable' },
  { id: 'rest', label: 'Feeling rested after sleep', low: 'Exhausted', high: 'Fully rested' },
];

export type ConfinementCheckin = {
  id: string;
  at: string;
  /** item id → 1..5 as answered. */
  answers: Record<string, number>;
  /** 0–100, higher = better wellbeing (reverse items inverted). */
  score: number;
  lowest?: string;
  note?: string;
};

export function scoreCheckin(answers: Record<string, number>): { score: number; lowest?: string } {
  const vals = CONFINEMENT_ITEMS.map((i) => {
    const raw = answers[i.id];
    if (!raw) return null;
    return { label: i.label, v: i.reverse ? 6 - raw : raw };
  }).filter(Boolean) as { label: string; v: number }[];
  if (!vals.length) return { score: 0 };
  const score = Math.round(((vals.reduce((a, x) => a + x.v, 0) / vals.length - 1) / 4) * 100);
  const min = vals.reduce((a, b) => (b.v < a.v ? b : a));
  return { score, lowest: min.v <= 2 ? min.label : undefined };
}
