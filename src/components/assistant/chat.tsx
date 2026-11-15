'use client';
import { ArrowUp, BookOpenText, Cloud, Cpu, FileText, Mic, ShieldAlert, Siren } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';

import { Badge, cn, Summary } from '@/components/ui';
import type { ChatMessage } from '@/data/types';
import { CLOUD_COPY, DISCLAIMER, PROMPTS, cloudState, type AssistantMessage } from '@/services/assistant';
import { useConnectivity } from '@/services/connectivity';
import { useSession } from '@/services/session';
import { useSettings } from '@/store/settings';
import { useAssistantChat, useDock } from './use-assistant';

type SpeechRec = { lang: string; interimResults: boolean; onresult: (e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void; onend: () => void; onerror: () => void; start: () => void; stop: () => void };

function useVoice(onText: (t: string) => void) {
  const [listening, setListening] = useState(false);
  const ref = useRef<SpeechRec | null>(null);
  const Ctor = typeof window !== 'undefined' ? ((window as unknown as { SpeechRecognition?: new () => SpeechRec; webkitSpeechRecognition?: new () => SpeechRec }).SpeechRecognition ?? (window as unknown as { webkitSpeechRecognition?: new () => SpeechRec }).webkitSpeechRecognition) : undefined;
  const toggle = () => {
    if (!Ctor) return;
    if (listening) return ref.current?.stop();
    const r = new Ctor();
    r.lang = 'en-US';
    r.interimResults = false;
    r.onresult = (e) => onText(e.results[0][0].transcript);
    r.onend = () => setListening(false);
    r.onerror = () => setListening(false);
    ref.current = r;
    setListening(true);
    r.start();
  };
  return { supported: !!Ctor, listening, toggle };
}

function Message({ m }: { m: AssistantMessage | ChatMessage }) {
  const a = m as AssistantMessage;
  if (m.role === 'user')
    return (
      <div className="flex justify-end">
        <p className="t-callout max-w-[85%] rounded-[20px] rounded-br-md bg-pill px-4 py-2.5 text-on-pill">{m.text}</p>
      </div>
    );
  const escalated = !!m.escalation;
  return (
    <div className={cn('flex max-w-[94%] flex-col gap-2 rounded-[20px] rounded-bl-md px-4 py-3', escalated ? 'bg-critical-soft' : 'bg-sunken')}>
      {escalated && (
        <Link href="/emergency" className="t-headline flex items-center gap-2 text-critical">
          <Siren size={16} /> Open Emergency
        </Link>
      )}
      {/* Long replies open as a one-line summary; emergency/escalation replies always show in full. */}
      {escalated ? <p className="t-callout whitespace-pre-line">{m.text}</p> : <Summary text={m.text} min={260} className="t-callout whitespace-pre-line" />}
      {!!m.protocolRefs?.length && (
        <div className="flex flex-wrap gap-1.5">
          {m.protocolRefs.map((p) => (
            <Badge key={p.id} label={`${p.id} v${p.version} · ${p.title}`} tone="accent" icon={ShieldAlert} title="Protocol from the on-board knowledge base (demo, unapproved)" />
          ))}
        </div>
      )}
      {!!m.citations?.length && (
        <div className="flex flex-col gap-1">
          <p className="t-overline text-ink-3">Sources</p>
          {m.citations.map((c, i) => (
            <a key={i} href={c.url} target="_blank" rel="noreferrer" className="t-caption flex items-start gap-1.5 text-primary hover:underline">
              <BookOpenText size={13} className="mt-0.5 shrink-0" />
              <span>
                {c.publisher}: {c.title}
              </span>
            </a>
          ))}
        </div>
      )}
      {!!m.dataUsed?.length && <p className="t-caption text-ink-3">Data used: {m.dataUsed.join(' · ')}</p>}
      {m.engine && (
        <p className="t-telemetry flex items-center gap-1 text-ink-3">
          {a.answerKind === 'ground' ? <Cloud size={12} /> : <Cpu size={12} />} {m.engine}
        </p>
      )}
    </div>
  );
}

export function AssistantChat({ compact }: { compact?: boolean }) {
  const { conv, send, busy, lastRoute, newChat } = useAssistantChat();
  const [text, setText] = useState('');
  const consent = useSettings((s) => s.aiCloudConsent);
  useConnectivity((s) => s.ground);
  useSession((s) => s.user);
  const cs = cloudState(consent);
  const end = useRef<HTMLDivElement>(null);
  const box = useRef<HTMLDivElement>(null);
  const pending = useDock((s) => s.pending);
  const voice = useVoice((t) => setText(t));

  // Scroll only the message list — never the page (the chat is embedded in pages).
  useEffect(() => {
    const el = box.current;
    if (el && (conv?.messages.length || busy)) el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
  }, [conv?.messages.length, busy]);

  useEffect(() => {
    if (pending) {
      useDock.setState({ pending: undefined });
      void send(pending);
    }
  }, [pending, send]);

  const submit = () => {
    const q = text;
    setText('');
    void send(q);
  };

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex flex-wrap items-center justify-between gap-2 pb-3">
        <Badge label={CLOUD_COPY[cs]} tone={cs === 'available' ? 'primary' : 'neutral'} icon={cs === 'available' ? Cloud : Cpu} size="md" />
        {conv && (
          <button onClick={newChat} className="t-caption text-ink-2 hover:text-ink">
            New conversation
          </button>
        )}
      </div>
      <div ref={box} className="min-h-0 flex-1 space-y-3 overflow-y-auto pr-1" aria-live="polite">
        {!conv?.messages.length && (
          <div className="flex flex-col gap-3 py-2">
            <p className="t-callout text-ink-2">{DISCLAIMER}</p>
            <div className={cn('grid gap-2', compact ? 'grid-cols-1' : 'sm:grid-cols-2')}>
              {PROMPTS.map((p) => (
                <button key={p} onClick={() => void send(p)} className="t-callout rounded-[16px] border border-line-strong px-3.5 py-2.5 text-left hover:bg-sunken">
                  {p}
                </button>
              ))}
            </div>
          </div>
        )}
        {conv?.messages.map((m) => <Message key={m.id} m={m} />)}
        {busy && (
          <div className="flex items-center gap-2 px-1 text-ink-3" role="status">
            <span className="size-2 animate-bounce rounded-full bg-ink-3 [animation-delay:-0.2s]" />
            <span className="size-2 animate-bounce rounded-full bg-ink-3" />
            <span className="size-2 animate-bounce rounded-full bg-ink-3 [animation-delay:0.2s]" />
            <span className="t-caption">Analysing on board…</span>
          </div>
        )}
        {lastRoute?.groundError && !busy && <p className="t-caption text-warning-ink">Cloud AI unavailable ({lastRoute.groundError}) — answered by the on-board assistant.</p>}
        <div ref={end} />
      </div>
      <form
        className="mt-3 flex items-end gap-2 rounded-[22px] border border-line-strong bg-raised p-1.5"
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}>
        <label htmlFor="ask" className="sr-only">
          Ask CosmicPulse
        </label>
        <textarea
          id="ask"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              submit();
            }
          }}
          rows={1}
          maxLength={2000}
          placeholder="Ask about your health, alerts or NASA research…"
          className="t-callout max-h-32 min-h-10 flex-1 resize-none bg-transparent px-3 py-2.5 focus:outline-none"
        />
        {voice.supported && (
          <button type="button" onClick={voice.toggle} aria-pressed={voice.listening} aria-label={voice.listening ? 'Stop dictation' : 'Dictate question'} className={cn('flex size-10 items-center justify-center rounded-full', voice.listening ? 'bg-critical text-white' : 'text-ink-2 hover:bg-sunken')}>
            <Mic size={17} />
          </button>
        )}
        <button type="submit" disabled={!text.trim() || busy} aria-label="Send" className="flex size-10 items-center justify-center rounded-full bg-pill text-on-pill disabled:opacity-35">
          <ArrowUp size={18} />
        </button>
      </form>
      <p className="t-caption mt-2 flex items-center gap-1 text-ink-3">
        <FileText size={12} /> Informational only — not a diagnosis. Urgent symptoms: use Emergency.
      </p>
    </div>
  );
}
