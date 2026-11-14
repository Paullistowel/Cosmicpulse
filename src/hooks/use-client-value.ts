import { useSyncExternalStore } from 'react';

const noop = () => () => {};

/**
 * Reads a browser-only value (WebGL support, media queries, permissions)
 * without setState-in-effect. `server` is used during SSR and hydration.
 */
export function useClientValue<T>(read: () => T, server: T, subscribe: (cb: () => void) => () => void = noop): T {
  return useSyncExternalStore(subscribe, read, () => server);
}

export const subscribeMedia = (query: string) => (cb: () => void) => {
  const mq = window.matchMedia(query);
  mq.addEventListener('change', cb);
  return () => mq.removeEventListener('change', cb);
};

export function usePrefersReducedMotion(pref: 'system' | 'reduced' | 'full'): boolean {
  const os = useClientValue(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches, false, subscribeMedia('(prefers-reduced-motion: reduce)'));
  return pref === 'reduced' ? true : pref === 'full' ? false : os;
}

const themeSub = (cb: () => void) => {
  const o = new MutationObserver(cb);
  o.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
  return () => o.disconnect();
};
export const useIsDark = () => useClientValue(() => document.documentElement.dataset.theme === 'dark', true, themeSub);
