import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import type { HealthAlert, Insight, Measurement, Mission, MoodEntry, SleepRecord, VitalType } from '@/data/types';
import { VITAL_META } from '@/data/vitals';
import { explainFinding, TIER_OF, type Tier } from '@/engine/explain';
import type { Baseline, Readiness, RiskAssessment } from '@/engine';
import { evidenceForFinding } from '@/intel/evidence';
import type { HazardProfile } from '@/intel/hazard-profile';
import { HAZARD_BY_ID } from '@/research/hazards';
import { resolveRef } from '@/research/sources';
import { vaultStorage } from '@/store/vault';

/**
 * CosmicPulse Sentinel AI — the deterministic intelligence layer.
 *
 * Everything here is computed from engine output and the evidence library,
 * so it works offline and never invents data. The conversational part (cloud
 * model via the ground server, or the on-board assistant) only phrases and
 * answers questions; the briefing and the seven-question explanation are
 * rule-based and reproducible.
 */
export const SENTINEL_VERSION = 'sentinel 1.0.0 (rule-based on cosmicpulse-engine)';

/* ------------------------------ Seven questions ------------------------------ */

export const REASSESS: Record<Tier, { hours: number; text: string }> = {
  urgent: { hours: 1, text: 'Re-check within the hour while following the linked protocol.' },
  medical_review: { hours: 12, text: 'Re-measure within 12 hours and before the next communication pass.' },
  attention: { hours: 24, text: 'Re-measure within 24 hours under the same conditions.' },
  informational: { hours: 72, text: 'Keep normal monitoring; look again in about 3 days.' },
};

const CONTACT: Record<Tier, string> = {
  urgent: 'Now. Use Emergency, alert the crew medical officer and contact the flight surgeon on the priority channel.',
  medical_review: 'Share with the crew medical officer today and the flight surgeon at the next communication opportunity.',
  attention: 'Contact the crew medical officer if it persists at the reassessment, worsens, or you develop symptoms.',
  informational: 'No contact needed unless it persists for several days or you feel unwell.',
};

export type SevenAnswers = { q: string; a: string; refs?: { text: string; source: string; href: string }[] }[];

export function sevenQuestions(f: Insight, ctx: { measurements: Measurement[]; baselines: Partial<Record<VitalType, Baseline>>; now: number; alert?: HealthAlert }): { tier: Tier; answers: SevenAnswers; reassessHours: number } {
  const ex = explainFinding(f, ctx);
  const ev = evidenceForFinding(f);
  const tier = TIER_OF[f.severity];
  const refs = ev.refs.slice(0, 2).map((r) => resolveRef(r)).filter(Boolean).map((r) => ({ text: r!.fact?.text ?? r!.source.summary, source: `${r!.source.org}: ${r!.source.title}`, href: `/research/${r!.source.id}` }));
  const hazards = ev.hazards.map((h) => HAZARD_BY_ID[h].name.toLowerCase());
  return {
    tier,
    reassessHours: REASSESS[tier].hours,
    answers: [
      { q: 'What changed?', a: `${f.whatChanged} ${ex.persistence.text}` },
      { q: 'Which measurements contributed?', a: f.contributing.length ? f.contributing.map((c) => `${c.label} (${c.value})`).join(', ') + '.' : ex.latest ? `${ex.metricLabel}: ${ex.latest.text}, ${ex.latest.source}.` : ex.metricLabel },
      { q: 'Why is this important?', a: `${ex.tierMeaning}${hazards.length ? ` In spaceflight this matters because NASA links it to ${hazards.join(' and ')}.` : ''}`, refs },
      { q: 'What could be contributing?', a: `${f.uncertainty} Compared with your own baseline: ${ex.baseline}` },
      { q: 'What should I do?', a: ex.nextSteps.join(' ') },
      { q: 'When should I reassess?', a: REASSESS[tier].text },
      { q: 'When should medical personnel be contacted?', a: CONTACT[tier] },
    ],
  };
}

/* ------------------------------ Signal relations ------------------------------ */

export type RelationGraph = { nodes: { id: string; label: string; z?: number; kind: 'metric' | 'behaviour' | 'finding' }[]; links: { from: string; to: string; label: string }[] };

/** How co-occurring changes relate (for the diagram) — drawn only from real signals. */
export function relationGraph(f: Insight, sleep: SleepRecord[], now: number): RelationGraph {
  const nodes: RelationGraph['nodes'] = [{ id: 'f', label: f.title, kind: 'finding' }];
  const links: RelationGraph['links'] = [];
  for (const c of f.contributing) {
    const id = c.measurementType ?? c.label;
    const z = /z = (-?[\d.]+)/.exec(c.value)?.[1];
    nodes.push({ id, label: c.measurementType ? VITAL_META[c.measurementType].shortLabel : c.label, z: z ? Number(z) : undefined, kind: 'metric' });
    links.push({ from: id, to: 'f', label: c.value });
  }
  const recent = sleep.filter((r) => now - new Date(r.night).getTime() < 5 * 86_400_000);
  const avg = recent.length ? recent.reduce((a, r) => a + r.hours, 0) / recent.length : NaN;
  if (Number.isFinite(avg) && avg < 6.5 && f.module !== 'recovery') {
    nodes.push({ id: 'sleep-short', label: `Sleep ${avg.toFixed(1)} h avg`, kind: 'behaviour' });
    links.push({ from: 'sleep-short', to: 'f', label: 'short sleep can raise resting HR and lower HRV' });
  }
  return { nodes, links };
}

/* ---------------------------------- Briefing ---------------------------------- */

export type BriefingItem = { tone: 'success' | 'info' | 'warning' | 'critical' | 'demo'; title: string; detail: string; href?: string };
export type Briefing = { headline: string; status: string; items: BriefingItem[]; generatedAt: string; synthetic: boolean };

export function buildBriefing(i: { name: string; mission: Mission; risk: RiskAssessment; readiness: Readiness; findings: Insight[]; hazards: HazardProfile[]; sleep: SleepRecord[]; moods: MoodEntry[]; synthetic: boolean; dueFollowUps: number; now: number }): Briefing {
  const items: BriefingItem[] = [];
  const day = Math.max(0, Math.floor((i.now - new Date(i.mission.launchedAt).getTime()) / 86_400_000));
  if (i.synthetic) items.push({ tone: 'demo', title: 'Demonstration data', detail: 'Today’s briefing includes SYNTHETIC readings from the selected mission scenario.' });
  const top = i.findings.filter((f) => f.module !== 'data_quality').slice(0, 3);
  for (const f of top) items.push({ tone: f.severity === 'critical' ? 'critical' : f.severity === 'high' || f.severity === 'moderate' ? 'warning' : 'info', title: f.title, detail: f.summary, href: `/sentinel?finding=${encodeURIComponent(f.id)}` });
  const last = [...i.sleep].sort((a, b) => b.night.localeCompare(a.night))[0];
  if (last) items.push({ tone: last.hours < 6 ? 'warning' : 'success', title: `Last sleep ${last.hours.toFixed(1)} h`, detail: last.hours < 6 ? 'Below 6 hours — protect tonight’s sleep period if operations allow.' : 'Within your usual pattern.', href: '/sleep' });
  const hz = i.hazards.filter((h) => h.status === 'attention');
  if (hz.length) items.push({ tone: 'warning', title: `Hazard watch: ${hz.map((h) => HAZARD_BY_ID[h.hazard].name).join(', ')}`, detail: hz[0].narrative.split('. ')[0] + '.', href: `/risk/${hz[0].hazard}` });
  const quality = i.findings.filter((f) => f.module === 'data_quality');
  if (quality.length) items.push({ tone: 'info', title: 'Data quality', detail: `${quality.length} sensor or data issue${quality.length > 1 ? 's' : ''} — some conclusions are less certain.`, href: '/alerts' });
  if (i.dueFollowUps) items.push({ tone: 'info', title: `${i.dueFollowUps} follow-up${i.dueFollowUps > 1 ? 's' : ''} due`, detail: 'Re-measure to see whether earlier changes have settled.', href: '/sentinel#followups' });
  if (!top.length) items.push({ tone: 'success', title: 'No new findings', detail: 'Your readings sit within your personal baselines and mission rules.' });
  const level = i.risk.level;
  const status = level === 'nominal' ? 'All systems nominal' : level === 'monitor' ? 'Monitoring a minor change' : level === 'elevated' ? 'Attention recommended' : level === 'high' ? 'Medical review recommended' : 'Urgent attention';
  return {
    headline: `Mission day ${day} briefing for ${i.name.split(' ')[0]}`,
    status: `${status}${i.readiness.score !== null ? ` · readiness ${i.readiness.score}/100` : ''}`,
    items,
    generatedAt: new Date(i.now).toISOString(),
    synthetic: i.synthetic,
  };
}

/* --------------------------------- Follow-ups --------------------------------- */

export type FollowUp = { id: string; findingId: string; title: string; metric?: VitalType; createdAt: string; dueAt: string; status: 'open' | 'done'; outcome?: string };

type FState = { list: FollowUp[]; reviewed: Record<string, string>; track: (f: Insight, hours: number) => FollowUp; complete: (id: string, outcome: string) => void; markReviewed: (findingId: string) => void; remove: (id: string) => void };

export const useFollowUps = create<FState>()(
  persist(
    (set, get) => ({
      list: [],
      reviewed: {},
      track: (f, hours) => {
        const existing = get().list.find((x) => x.findingId === f.id && x.status === 'open');
        if (existing) return existing;
        const now = Date.now();
        const m = /^(?:anomaly|rule):([a-z_0-9]+)/.exec(f.id)?.[1] as VitalType | undefined;
        const fu: FollowUp = { id: `fu-${now}`, findingId: f.id, title: f.title, metric: m, createdAt: new Date(now).toISOString(), dueAt: new Date(now + hours * 3_600_000).toISOString(), status: 'open' };
        set((s) => ({ list: [fu, ...s.list] }));
        return fu;
      },
      complete: (id, outcome) => set((s) => ({ list: s.list.map((x) => (x.id === id ? { ...x, status: 'done', outcome } : x)) })),
      markReviewed: (findingId) => set((s) => ({ reviewed: { ...s.reviewed, [findingId]: new Date().toISOString() } })),
      remove: (id) => set((s) => ({ list: s.list.filter((x) => x.id !== id) })),
    }),
    { name: 'cosmicpulse.followups.v1', storage: createJSONStorage(() => vaultStorage), skipHydration: true, version: 1 },
  ),
);
