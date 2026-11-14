'use client';

import { BookOpenText, Cpu, MessageSquare, ShieldCheck, Trash2 } from 'lucide-react';

import { AssistantChat } from '@/components/assistant/chat';
import { useAssistantChat } from '@/components/assistant/use-assistant';
import { Card, IconButton, Overline, PageHeader, Toggle, cn, LearnMore } from '@/components/ui';
import { ASSISTANT_ENGINE } from '@/engine';
import { useHealth } from '@/store/health';
import { useSettings } from '@/store/settings';

export default function AssistantPage() {
  const { conversations, activeId, setActiveId, newChat } = useAssistantChat();
  const del = useHealth((s) => s.deleteConversation);
  const consent = useSettings((s) => s.aiCloudConsent);
  const set = useSettings((s) => s.set);
  return (
    <div className="flex flex-col gap-6">
      <PageHeader overline="Intelligence" title="AI health assistant" subtitle="Explains your indicators, summarises your status, explains alerts and answers questions about NASA research — grounded in your data and cited sources." />
      <div className="grid gap-6 xl:grid-cols-[1fr_340px]">
        <Card className="flex h-[calc(100dvh-260px)] min-h-[520px] flex-col">
          <AssistantChat />
        </Card>
        <div className="flex flex-col gap-4">
          <Card className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <Overline>Conversations</Overline>
              <button onClick={newChat} className="t-caption text-primary">New</button>
            </div>
            {conversations.length === 0 && <p className="t-callout text-ink-3">No saved conversations.</p>}
            {conversations.slice(0, 12).map((c) => (
              <div key={c.id} className={cn('group flex items-center gap-2 rounded-[14px] px-2 py-1.5', c.id === activeId ? 'bg-sunken' : 'hover:bg-sunken')}>
                <MessageSquare size={14} className="shrink-0 text-ink-3" />
                <button onClick={() => setActiveId(c.id)} className="t-callout min-w-0 flex-1 truncate text-left">{c.title}</button>
                <IconButton icon={Trash2} label="Delete conversation" className="size-8 opacity-60 group-hover:opacity-100" onClick={() => { del(c.id); if (c.id === activeId) newChat(); }} />
              </div>
            ))}
            <p className="t-caption text-ink-3">Stored encrypted on this device only.</p>
          </Card>
          <Card className="flex flex-col gap-3">
            <Overline>How answers are produced</Overline>
            <p className="t-callout flex gap-2 text-ink-2"><ShieldCheck size={16} className="mt-0.5 shrink-0 text-success" /> Safety triage runs first, on this device. Urgent symptoms always route to Emergency.</p>
            <p className="t-callout flex gap-2 text-ink-2"><Cpu size={16} className="mt-0.5 shrink-0 text-primary" /> On-board engine ({ASSISTANT_ENGINE}) answers offline with your baselines, findings and protocols.</p>
            <p className="t-callout flex gap-2 text-ink-2"><BookOpenText size={16} className="mt-0.5 shrink-0 text-primary" /> Research answers cite the NASA/CSA evidence library.</p>
            <LearnMore title="On board vs cloud">When signed in to the ground server, the existing cloud model can phrase answers; API keys stay on the ground server and any failure falls back on board.</LearnMore>
            <Toggle id="ai-consent" checked={consent} onChange={(v) => set('aiCloudConsent', v)} label="Allow cloud AI" description="Sends a minimal, question-specific summary (not raw history or journal notes) to the ground assistant." />
          </Card>
        </div>
      </div>
    </div>
  );
}
