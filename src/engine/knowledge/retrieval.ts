/* Copied verbatim from the CosmicPulse mobile app (src/engine/knowledge/retrieval.ts) by scripts/sync-mobile-core.mjs.
 * Edit the mobile original and re-run `npm run sync:mobile`; do not edit this copy. */
import type { Protocol } from '@/data/types';
import { PROTOCOLS } from './protocols';

/**
 * Offline BM25 retrieval over the approved knowledge base. Runs entirely on
 * device, so protocol lookup works during loss of signal.
 */

const STOP = new Set(['the', 'a', 'an', 'and', 'or', 'of', 'to', 'in', 'is', 'it', 'my', 'i', 'for', 'what', 'how', 'do', 'should', 'with', 'on', 'me', 'have', 'has', 'about', 'be', 'are', 'this', 'that', 'when', 'can', 'there']);

const SYNONYMS: Record<string, string[]> = {
  breathless: ['breathing', 'hypoxia', 'oxygen'],
  breath: ['breathing', 'hypoxia'],
  o2: ['oxygen'],
  spo2: ['oxygen', 'saturation'],
  temp: ['temperature', 'fever'],
  hot: ['fever'],
  puke: ['vomiting', 'nausea'],
  sick: ['illness', 'nausea'],
  cut: ['laceration', 'bleeding'],
  radiation: ['spe', 'dose'],
  flare: ['solar', 'radiation'],
  tired: ['fatigue', 'sleep'],
  heart: ['cardiac', 'chest'],
  faint: ['collapse', 'unresponsive'],
  passed: ['unresponsive', 'collapse'],
};

export function tokenize(text: string): string[] {
  const base = text
    .toLowerCase()
    .replace(/₂/g, '2')
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length > 1 && !STOP.has(t));
  return base.flatMap((t) => [t, ...(SYNONYMS[t] ?? [])]);
}

function docText(p: Protocol): string {
  // Title and keywords are weighted by repetition.
  return [p.title, p.title, p.keywords.join(' '), p.keywords.join(' '), p.summary, p.indications.join(' '), p.category].join(' ');
}

type Index = { docs: { p: Protocol; tf: Map<string, number>; len: number }[]; df: Map<string, number>; avgLen: number };

function buildIndex(protocols: Protocol[]): Index {
  const df = new Map<string, number>();
  const docs = protocols.map((p) => {
    const toks = tokenize(docText(p));
    const tf = new Map<string, number>();
    toks.forEach((t) => tf.set(t, (tf.get(t) ?? 0) + 1));
    new Set(toks).forEach((t) => df.set(t, (df.get(t) ?? 0) + 1));
    return { p, tf, len: toks.length };
  });
  const avgLen = docs.reduce((a, d) => a + d.len, 0) / Math.max(1, docs.length);
  return { docs, df, avgLen };
}

let INDEX: Index | null = null;

export type Hit = { protocol: Protocol; score: number; matched: string[] };

export function searchProtocols(query: string, limit = 3, protocols: Protocol[] = PROTOCOLS): Hit[] {
  const idx = protocols === PROTOCOLS ? (INDEX ??= buildIndex(PROTOCOLS)) : buildIndex(protocols);
  const q = Array.from(new Set(tokenize(query)));
  const N = idx.docs.length;
  const k1 = 1.4;
  const b = 0.75;
  return idx.docs
    .map((d) => {
      let score = 0;
      const matched: string[] = [];
      for (const term of q) {
        const f = d.tf.get(term);
        if (!f) continue;
        matched.push(term);
        const n = idx.df.get(term) ?? 0;
        const idf = Math.log(1 + (N - n + 0.5) / (n + 0.5));
        score += idf * ((f * (k1 + 1)) / (f + k1 * (1 - b + (b * d.len) / idx.avgLen)));
      }
      return { protocol: d.p, score, matched };
    })
    .filter((h) => h.score > 0.8)
    .sort((a, b2) => b2.score - a.score)
    .slice(0, limit);
}

export const citation = (p: Protocol) => `${p.id} v${p.version}`;
