/* Copied verbatim from the CosmicPulse mobile app (src/lib/interactions.ts) by scripts/sync-mobile-core.mjs.
 * Edit the mobile original and re-run `npm run sync:mobile`; do not edit this copy. */
import { DRUGS, INTERACTIONS, findDrug } from '@/data/demo/drugs';
import type { DrugInteraction, InteractionSeverity } from '@/data/types';

export type DuplicateIngredient = { ingredient: string; drugIds: string[] };
export type AllergyAlert = { allergy: string; drugId: string; reason: string };

export type InteractionReport = {
  interactions: DrugInteraction[];
  duplicates: DuplicateIngredient[];
  allergyAlerts: AllergyAlert[];
  /** Drug ids not present in the knowledge base — cannot be checked. */
  unknown: string[];
  checkedAt: string;
};

const ORDER: Record<InteractionSeverity, number> = { contraindicated: 0, major: 1, moderate: 2, minor: 3 };

/** Crude allergy cross-check by drug class keyword. Demo only. */
const ALLERGY_CLASS: Record<string, string[]> = {
  penicillin: ['penicillin', 'amoxicillin'],
  nsaid: ['ibuprofen', 'aspirin', 'naproxen'],
  aspirin: ['aspirin', 'acetylsalicylic acid'],
  macrolide: ['clarithromycin', 'azithromycin', 'erythromycin'],
};

export function checkInteractions(drugIds: string[], allergies: string[] = []): InteractionReport {
  const ids = Array.from(new Set(drugIds));
  const known = ids.filter((id) => findDrug(id));
  const unknown = ids.filter((id) => !findDrug(id));

  const interactions = INTERACTIONS.filter((i) => known.includes(i.drugs[0]) && known.includes(i.drugs[1])).sort(
    (a, b) => ORDER[a.severity] - ORDER[b.severity],
  );

  const ingredientMap = new Map<string, string[]>();
  for (const id of known) {
    for (const ing of findDrug(id)!.ingredients) {
      ingredientMap.set(ing, [...(ingredientMap.get(ing) ?? []), id]);
    }
  }
  const duplicates = [...ingredientMap.entries()].filter(([, v]) => v.length > 1).map(([ingredient, drugIds]) => ({ ingredient, drugIds }));

  const allergyAlerts: AllergyAlert[] = [];
  for (const a of allergies) {
    const key = a.toLowerCase();
    for (const id of known) {
      const d = findDrug(id)!;
      const hit =
        d.ingredients.some((i) => key.includes(i) || i.includes(key)) ||
        Object.entries(ALLERGY_CLASS).some(([cls, members]) => key.includes(cls) && d.ingredients.some((i) => members.includes(i)));
      if (hit) allergyAlerts.push({ allergy: a, drugId: id, reason: `${d.generic} may contain or be related to “${a}”.` });
    }
  }

  return { interactions, duplicates, allergyAlerts, unknown, checkedAt: new Date().toISOString() };
}

export const SEVERITY_COPY: Record<InteractionSeverity, { label: string; tone: 'critical' | 'warning' | 'info' }> = {
  contraindicated: { label: 'Do not combine', tone: 'critical' },
  major: { label: 'Major', tone: 'critical' },
  moderate: { label: 'Moderate', tone: 'warning' },
  minor: { label: 'Minor', tone: 'info' },
};

export const KNOWLEDGE_BASE_SIZE = DRUGS.length;
