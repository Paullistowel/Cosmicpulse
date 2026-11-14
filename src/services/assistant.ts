import { z } from 'zod';

import { uid } from '@/data/demo/random';
import type { ChatMessage, Reference } from '@/data/types';
import { ASSISTANT_ENGINE, answer, findProtocol, type AssistantData, type GroundedAnswer } from '@/engine';
import { HAZARDS } from '@/research/hazards';
import { searchEvidence } from '@/research/search';
import { canReachGround } from './connectivity';
import { ground } from './ground';
import { isAstronautSession } from './session';

/**
 * CosmicPulse Web assistant — same routing as the mobile app
 * (src/services/assistant.ts), plus the NASA/CSA evidence library:
 *
 *  1. Safety triage on device (regex, no model) — emergencies and crises get
 *     fixed escalation copy immediately, even with no link.
 *  2. On-board grounded answer (`answer()` from the shared engine): refuses
 *     dosing, explains alerts, summarises metrics vs baseline, cites protocols.
 *     Research questions are answered from the evidence library with citations.
 *  3. If signed in to the ground server, the link is up and AI consent is on,
 *     the question goes to the existing ground endpoint `POST /assistant`
 *     (provider keys live only on the ground server). Any failure falls back
 *     to the on-board answer from step 2.
 *
 * The AI never invents readings: every number comes from the deterministic
 * engine context. It never diagnoses or prescribes.
 */

const EMERGENCY = [
  /chest (pain|tightness|pressure)/i,
  /can'?t breathe|cannot breathe|struggling to breathe|short(ness)? of breath/i,
  /face (droop|drooping)|slurred speech|arm weakness|sudden (numbness|weakness|confusion)|worst headache/i,
  /unconscious|passed out|not breathing|seizure/i,
  /severe (bleeding|allergic)|throat (closing|swelling)|anaphyla/i,
  /overdos/i,
];
const CRISIS = [/suicid/i, /kill (myself|me)/i, /end (my|it all)|end my life/i, /self[- ]?harm|hurt myself|cutting myself/i, /don'?t want to (live|be alive)|better off dead/i];

export type Triage = 'emergency' | 'crisis' | null;
export function triage(raw: string): Triage {
  // Normalise typographic apostrophes (iOS/macOS smart punctuation types "can’t").
  const text = raw.replace(/[\u2018\u2019\u02BC]/g, "'");
  if (CRISIS.some((r) => r.test(text))) return 'crisis';
  if (EMERGENCY.some((r) => r.test(text))) return 'emergency';
  return null;
}

export const EMERGENCY_REPLY =
  'This could be a medical emergency. Start AEG-EM-001 (Medical emergency — first response) now and open Emergency. Alert the crew medical officer and the crew, and contact the flight surgeon on the priority medical channel. If the link is down, continue care — the incident report queues for ground. I can’t assess an emergency in chat.';
export const CRISIS_REPLY =
  'Thank you for saying this — you don’t have to handle it alone. Please contact the crew medical officer now, and request a private conference with the flight psychologist via Medical → Comms. If anyone is in immediate danger, use Emergency. I’m an on-board assistant and can’t provide crisis care, but your crew and ground team can.';

export const DISCLAIMER =
  'Explains your data with cited sources. Never diagnoses, never replaces the flight surgeon, never changes medication.';

export const PROMPTS = [
  'Analyse my current health status',
  'Explain my latest health alert',
  'Summarise my sleep and recovery',
  'How could isolation affect my sleep and mood?',
  'What does NASA say about space radiation?',
  'Prepare a medical summary for the flight surgeon',
];

export type AnswerKind = GroundedAnswer['kind'] | 'escalation' | 'ground' | 'research';
export type AssistantMessage = ChatMessage & { answerKind?: AnswerKind };
export type AssistantRoute = 'triage' | 'onboard' | 'ground';
export type AssistantResult = { message: AssistantMessage; route: AssistantRoute; groundError?: string };

export type CloudState = 'available' | 'no_session' | 'offline' | 'no_consent';
export const CLOUD_COPY: Record<CloudState, string> = {
  available: 'Cloud AI via ground server',
  no_session: 'On-board assistant (sign in to the ground server for cloud AI)',
  offline: 'On-board assistant (no ground link)',
  no_consent: 'On-board assistant (cloud AI consent off)',
};

export function cloudState(consent: boolean): CloudState {
  if (!isAstronautSession()) return 'no_session';
  if (!canReachGround()) return 'offline';
  if (!consent) return 'no_consent';
  return 'available';
}

const GroundReply = z.object({
  text: z.string().min(1),
  model: z.string().optional(),
  provider: z.string().optional(),
  protocolRefs: z.array(z.object({ id: z.string(), version: z.string(), title: z.string().nullish() })).optional(),
  dataUsed: z.array(z.string()).optional(),
});

const RESEARCH_Q = /\bnasa\b|\bcsa\b|research|stud(y|ies)|evidence|hazard|radiation|isolation|confine|microgravity|gravity|distance from earth|closed environment|osdr|inspiration4|hrp\b|why (do|does) (you|cosmicpulse) (monitor|watch|track)|risk of /i;

/** Evidence-library answer: short synthesis of the top facts with citations. */
export function researchAnswer(question: string): { text: string; citations: Reference[] } | null {
  const hits = searchEvidence(question, 4);
  if (!hits.length) return null;
  const hazard = HAZARDS.find((h) => new RegExp(h.name.split(' ')[0], 'i').test(question) || question.toLowerCase().includes(h.id));
  const lines = hits.slice(0, 3).map((h) => `• ${h.text} [${h.org}: ${h.sourceTitle}]`);
  const intro = hazard ? `Here is what the NASA/CSA sources in the CosmicPulse evidence library say about ${hazard.name.toLowerCase()}:` : 'From the CosmicPulse evidence library (NASA / CSA sources):';
  const outro = hazard ? ` See Risk Intelligence › ${hazard.name} for how this connects to your own data. This is research context, not a statement about your health.` : ' This is research context, not a statement about your health.';
  const seen = new Set<string>();
  const citations = hits.filter((h) => (seen.has(h.url) ? false : (seen.add(h.url), true))).map((h) => ({ title: h.kind === 'study' ? `${h.title} — ${h.sourceTitle}` : h.sourceTitle, publisher: h.org, url: h.url }));
  return { text: `${intro}\n${lines.join('\n')}\n${outro}`, citations };
}

function escalation(kind: 'emergency' | 'crisis', at: string): AssistantMessage {
  const p = findProtocol('AEG-EM-001');
  return {
    id: uid('msg'),
    role: 'assistant',
    text: kind === 'emergency' ? EMERGENCY_REPLY : CRISIS_REPLY,
    at,
    escalation: kind,
    engine: 'cosmicpulse-safety-triage (on device)',
    protocolRefs: kind === 'emergency' && p ? [{ id: p.id, version: p.version, title: p.title }] : undefined,
    answerKind: 'escalation',
  };
}

export function onboardReply(q: string, data: AssistantData, at: string): AssistantMessage {
  const a = answer(q, data);
  const research = RESEARCH_Q.test(q) || a.kind === 'unsupported' ? researchAnswer(q) : null;
  if (research && (a.kind === 'unsupported' || a.kind === 'help' || RESEARCH_Q.test(q))) {
    const combine = a.kind !== 'unsupported' && a.kind !== 'help' && a.kind !== 'refusal';
    return {
      id: uid('msg'),
      role: 'assistant',
      text: combine ? `${a.text}\n\n${research.text}` : research.text,
      at,
      engine: `${ASSISTANT_ENGINE} + evidence library`,
      citations: research.citations,
      protocolRefs: a.protocols.map((p) => ({ id: p.id, version: p.version, title: p.title })),
      dataUsed: combine ? a.dataUsed : [],
      answerKind: 'research',
    };
  }
  return {
    id: uid('msg'),
    role: 'assistant',
    text: a.text,
    at,
    engine: ASSISTANT_ENGINE,
    protocolRefs: a.protocols.map((p) => ({ id: p.id, version: p.version, title: p.title })),
    dataUsed: a.dataUsed,
    answerKind: a.kind,
  };
}

export type AskOptions = {
  consent: boolean;
  screen?: string;
  history?: { role: 'user' | 'assistant'; text: string }[];
  /** Per-question context built by features/assistant/context.ts (shared with mobile). */
  context?: Record<string, unknown>;
  /** Injected for tests. */
  post?: (body: unknown) => Promise<unknown>;
  cloud?: boolean;
};

export async function ask(question: string, data: AssistantData, opts: AskOptions): Promise<AssistantResult> {
  const q = question.trim();
  const at = new Date().toISOString();
  const flag = triage(q);
  if (flag) return { message: escalation(flag, at), route: 'triage' };
  const onboard = onboardReply(q, data, at);
  // Dosing refusals never leave the device.
  if (onboard.answerKind === 'refusal') return { message: onboard, route: 'onboard' };
  const useCloud = opts.cloud ?? cloudState(opts.consent) === 'available';
  if (!useCloud) return { message: onboard, route: 'onboard' };
  try {
    const evidence = searchEvidence(q, 4).map((e) => ({ ref: e.ref, source: `${e.org}: ${e.sourceTitle}`, url: e.url, text: e.text }));
    const body = {
      question: q,
      screen: opts.screen,
      history: (opts.history ?? []).slice(-8).map((h) => ({ role: h.role, text: h.text.slice(0, 3000) })),
      context: { ...(opts.context ?? {}), ...(evidence.length ? { evidence, evidenceNote: 'NASA/CSA research excerpts from the CosmicPulse evidence library. Cite as [source] when used; they describe research, not this astronaut.' } : {}) },
    };
    const raw = await (opts.post ?? ((b) => ground<unknown>('/assistant', { method: 'POST', body: JSON.stringify(b), timeoutMs: 45_000 })))(body);
    const r = GroundReply.parse(raw);
    const citedEvidence = evidence.filter((e) => r.text.includes(e.source.split(': ')[1] ?? '###'));
    return {
      route: 'ground',
      message: {
        id: uid('msg'),
        role: 'assistant',
        text: r.text,
        at: new Date().toISOString(),
        engine: r.model ? `${r.model} (cloud, via ground server)` : 'Cloud model (via ground server)',
        // Only protocols that exist in the on-board KB are shown as citations.
        protocolRefs: (r.protocolRefs ?? []).map((p) => findProtocol(p.id)).filter((p): p is NonNullable<typeof p> => !!p).map((p) => ({ id: p.id, version: p.version, title: p.title })),
        citations: citedEvidence.map((e) => ({ title: e.source.split(': ')[1], publisher: e.source.split(': ')[0], url: e.url })),
        dataUsed: r.dataUsed ?? [],
        answerKind: 'ground',
      },
    };
  } catch (e) {
    return { message: onboard, route: 'onboard', groundError: e instanceof Error ? e.message : 'Cloud model unavailable' };
  }
}
