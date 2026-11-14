'use client';
import { CheckCircle2, Info, TriangleAlert, X } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { create } from 'zustand';

type Toast = { id: number; tone: 'success' | 'info' | 'warning'; text: string };
const useToasts = create<{ list: Toast[] }>(() => ({ list: [] }));
let n = 0;

export function toast(text: string, tone: Toast['tone'] = 'success') {
  const id = ++n;
  useToasts.setState((s) => ({ list: [...s.list.slice(-2), { id, tone, text }] }));
  setTimeout(() => useToasts.setState((s) => ({ list: s.list.filter((t) => t.id !== id) })), 4200);
}

export function Toaster() {
  const list = useToasts((s) => s.list);
  return (
    <div aria-live="polite" className="pointer-events-none fixed inset-x-0 bottom-24 z-[70] flex flex-col items-center gap-2 px-4 lg:bottom-6">
      <AnimatePresence>
        {list.map((t) => {
          const Icon = t.tone === 'success' ? CheckCircle2 : t.tone === 'warning' ? TriangleAlert : Info;
          return (
            <motion.div
              key={t.id}
              initial={{ opacity: 0, y: 16, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 8 }}
              transition={{ type: 'spring', damping: 22, stiffness: 300 }}
              className="glass pointer-events-auto flex max-w-md items-center gap-3 rounded-full py-2.5 pr-2 pl-4">
              <Icon size={17} className={t.tone === 'success' ? 'text-success' : t.tone === 'warning' ? 'text-warning-ink' : 'text-info'} aria-hidden />
              <span className="t-callout">{t.text}</span>
              <button aria-label="Dismiss" onClick={() => useToasts.setState((s) => ({ list: s.list.filter((x) => x.id !== t.id) }))} className="rounded-full p-1.5 text-ink-3 hover:text-ink">
                <X size={14} />
              </button>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
