'use client';
import * as Dialog from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import type { ReactNode } from 'react';

import { cn } from './ui';

/** Glass sheet: right-side drawer on desktop, bottom sheet on mobile. */
export function Sheet({ open, onOpenChange, title, description, children, side = 'right', wide }: { open: boolean; onOpenChange: (v: boolean) => void; title: string; description?: string; children: ReactNode; side?: 'right' | 'center'; wide?: boolean }) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[60] bg-[var(--overlay)] backdrop-blur-[2px] data-[state=open]:animate-in" />
        <Dialog.Content
          className={cn(
            'fixed z-[61] flex flex-col overflow-hidden bg-surface shadow-float focus:outline-none',
            side === 'right'
              ? cn('inset-x-0 bottom-0 max-h-[92dvh] rounded-t-[30px] sm:inset-y-3 sm:right-3 sm:left-auto sm:max-h-none sm:rounded-[30px]', wide ? 'sm:w-[640px]' : 'sm:w-[460px]')
              : cn('inset-x-3 bottom-3 max-h-[90dvh] rounded-[30px] sm:top-1/2 sm:bottom-auto sm:left-1/2 sm:-translate-x-1/2 sm:-translate-y-1/2', wide ? 'sm:w-[680px]' : 'sm:w-[520px]'),
          )}>
          <div className="flex items-start justify-between gap-3 border-b border-line px-5 pt-5 pb-4">
            <div>
              <Dialog.Title className="t-title3">{title}</Dialog.Title>
              {description ? <Dialog.Description className="t-callout mt-0.5 text-ink-2">{description}</Dialog.Description> : <Dialog.Description className="sr-only">{title}</Dialog.Description>}
            </div>
            <Dialog.Close aria-label="Close" className="rounded-full p-2 text-ink-2 hover:bg-sunken hover:text-ink">
              <X size={18} />
            </Dialog.Close>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">{children}</div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
