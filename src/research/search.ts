import { tokenize } from '@/engine/knowledge/retrieval';
import { HAZARDS, HRP_RISKS, HRP_STUDIES } from './hazards';
import { SOURCES, type EvidenceRef } from './sources';

/**
 * Offline BM25 retrieval over the evidence library (source facts, hazard
 * science lines, HRP risks and studies). Used by the on-board assistant and
 * to attach evidence to cloud-assistant context. No network, deterministic.
 */
export type EvidenceDoc = { ref: EvidenceRef; kind: 'fact' | 'risk' | 'study'; title: string; text: string; sourceTitle: string; org: string; url: string };

const EXTRA: Record<string, string[]> = {
  radiation: ['dose', 'dosimeter', 'neutron', 'msv', 'solar', 'cancer', 'cans'],
  isolation: ['confinement', 'behavioral', 'behavioural', 'mood', 'stress', 'psychological', 'lonely', 'team', 'teamwork'],
  gravity: ['microgravity', 'weightlessness', 'bone', 'muscle', 'vestibular', 'cardiovascular', 'exercise'],
  distance: ['earth', 'delay', 'communication', 'mars', 'resupply', 'telemedicine', 'self', 'sufficiency'],
  environment: ['closed', 'hostile', 'co2', 'carbon', 'immune', 'microbe', 'microbial', 'oxygen', 'hypoxia'],
  sleep: ['fatigue', 'tired', 'insomnia', 'schedule'],
};

function expand(tokens: string[]) {
  return tokens.flatMap((t) => [t, ...(EXTRA[t] ?? [])]);
}

let DOCS: EvidenceDoc[] | null = null;
function docs(): EvidenceDoc[] {
  if (DOCS) return DOCS;
  const out: EvidenceDoc[] = [];
  for (const s of SOURCES) for (const f of s.facts) out.push({ ref: `${s.id}#${f.id}`, kind: 'fact', title: s.title, text: f.text, sourceTitle: s.title, org: s.org, url: s.url });
  const risksSrc = SOURCES.find((s) => s.id === 'nasa-hrp-risks')!;
  for (const r of HRP_RISKS) out.push({ ref: `nasa-hrp-risks#grouping`, kind: 'risk', title: r.name, text: `${r.name} — NASA HRP ${r.group} risk; hazards: ${r.hazards.map((h) => HAZARDS.find((x) => x.id === h)!.name).join(', ')}.`, sourceTitle: risksSrc.title, org: 'NASA HRP', url: risksSrc.url });
  for (const st of HRP_STUDIES) out.push({ ref: `nasa-hrp-research#${st.setting === 'Artemis II' ? 'artemis' : st.setting === 'Low Earth orbit' ? 'leo' : 'past'}`, kind: 'study', title: st.name, text: `${st.name} (${st.setting}): ${st.aim}`, sourceTitle: 'Ongoing HRP Research in Space', org: 'NASA HRP', url: st.url });
  DOCS = out;
  return out;
}

type Index = { tf: Map<string, number>[]; len: number[]; df: Map<string, number>; avg: number };
let INDEX: Index | null = null;
function index(): Index {
  if (INDEX) return INDEX;
  const df = new Map<string, number>();
  const tf: Map<string, number>[] = [];
  const len: number[] = [];
  for (const d of docs()) {
    const toks = expand(tokenize(`${d.title} ${d.text}`));
    const m = new Map<string, number>();
    toks.forEach((t) => m.set(t, (m.get(t) ?? 0) + 1));
    new Set(toks).forEach((t) => df.set(t, (df.get(t) ?? 0) + 1));
    tf.push(m);
    len.push(toks.length);
  }
  INDEX = { tf, len, df, avg: len.reduce((a, b) => a + b, 0) / Math.max(1, len.length) };
  return INDEX;
}

export function searchEvidence(query: string, limit = 4): (EvidenceDoc & { score: number })[] {
  const q = [...new Set(tokenize(query))];
  if (!q.length) return [];
  const { tf, len, df, avg } = index();
  const N = tf.length;
  const k1 = 1.2;
  const b = 0.75;
  return docs()
    .map((d, i) => {
      let score = 0;
      for (const t of q) {
        const f = tf[i].get(t);
        if (!f) continue;
        const idf = Math.log(1 + (N - (df.get(t) ?? 0) + 0.5) / ((df.get(t) ?? 0) + 0.5));
        score += idf * ((f * (k1 + 1)) / (f + k1 * (1 - b + (b * len[i]) / avg)));
      }
      return { ...d, score };
    })
    .filter((d) => d.score > 1.5)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}
