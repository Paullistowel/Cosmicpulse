import type { Insight, VitalType } from '@/data/types';
import { metricOf } from '@/engine/explain';
import { HAZARD_BY_ID, HRP_RISKS, hazardsForMetric, type HazardId, type HrpRisk } from '@/research/hazards';
import type { EvidenceRef } from '@/research/sources';

/**
 * Evidence for a finding: which hazards and named HRP risks it relates to and
 * which source facts explain why CosmicPulse watches it. Relevance only —
 * a linked risk is context, never a statement that the risk has materialised.
 */
export type FindingEvidence = { hazards: HazardId[]; risks: HrpRisk[]; refs: EvidenceRef[] };

export function evidenceForFinding(f: Insight): FindingEvidence {
  const metric = metricOf(f);
  let hazards: HazardId[] = [];
  if (f.id.startsWith('env:radiation') || f.id === 'env:career-dose') hazards = ['radiation'];
  else if (f.id.startsWith('env:')) hazards = ['environment'];
  else if (f.id === 'recovery:sleep-debt') hazards = ['isolation'];
  else if (f.id === 'pattern:physiological-strain') hazards = ['environment', 'isolation'];
  else if (metric) hazards = hazardsForMetric(metric);
  const risks = metric ? HRP_RISKS.filter((r) => r.metrics.includes(metric as VitalType) && r.hazards.some((h) => hazards.includes(h))) : HRP_RISKS.filter((r) => r.hazards.some((h) => hazards.includes(h))).slice(0, 3);
  const refs = [...new Set(hazards.flatMap((h) => HAZARD_BY_ID[h].science.slice(0, 2).map((s) => s.ref)))];
  if (f.id === 'env:career-dose') refs.unshift('nasa-std-3001#career');
  if (f.id === 'env:radiation-event') refs.unshift('lit-dose-rates#rates', 'csa-radiation-monitoring#neutron-share');
  return { hazards, risks, refs: [...new Set(refs)] };
}
