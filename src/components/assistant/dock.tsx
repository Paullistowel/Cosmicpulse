'use client';
import { Maximize2, Radar } from 'lucide-react';
import Link from 'next/link';

import { Sheet } from '@/components/sheet';
import { AssistantChat } from './chat';
import { useDock } from './use-assistant';

/** Floating CosmicPulse assistant (mobile AssistantDock) — available on every screen. */
export function AssistantDock() {
  const open = useDock((s) => s.open);
  const setOpen = useDock((s) => s.setOpen);
  return (
    <>
      <button
        onClick={() => setOpen(true)}
        aria-label="Ask Sentinel, the CosmicPulse assistant"
        className="no-print fixed right-4 bottom-24 z-40 flex h-14 w-14 items-center justify-center gap-2 rounded-full bg-pill text-on-pill shadow-float transition-transform hover:scale-[1.03] active:scale-95 sm:right-5 sm:w-auto sm:pr-5 sm:pl-4 lg:bottom-6">
        <Radar size={19} aria-hidden />
        <span className="hidden text-sm font-semibold sm:inline">Ask Sentinel</span>
      </button>
      <Sheet open={open} onOpenChange={setOpen} title="Sentinel AI" description="Grounded in your data, approved protocols and NASA/CSA research.">
        <div className="flex h-[min(70dvh,680px)] flex-col sm:h-[calc(100dvh-140px)]">
          <AssistantChat compact />
          <Link href="/sentinel" onClick={() => setOpen(false)} className="t-caption mt-2 flex items-center gap-1 self-end text-ink-2 hover:text-ink">
            <Maximize2 size={12} /> Open Sentinel
          </Link>
        </div>
      </Sheet>
    </>
  );
}
