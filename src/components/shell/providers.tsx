'use client';

import { useEffect, useState, type ReactNode } from 'react';

import { CosmicMark } from '@/components/brand/mark';
import { Celebrations } from '@/components/game';
import { Toaster } from '@/components/toast';
import { useProgress } from '@/game/progress';
import { GameWatcher } from '@/game/watcher';
import { useFollowUps } from '@/sentinel/sentinel';
import { useActivity } from '@/store/activity';
import { startEngineRunner } from '@/store/engine-runner';
import { useHealth } from '@/store/health';
import { useSettings } from '@/store/settings';

/** Applies theme + motion preferences to <html> (deep-space dark is the default; Pearl light is available). */
function useThemeAttr() {
  const theme = useSettings((s) => s.theme);
  const motion = useSettings((s) => s.motion);
  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const apply = () => {
      const scheme = theme === 'system' ? (mq.matches ? 'dark' : 'light') : theme;
      document.documentElement.dataset.theme = scheme;
      document.querySelector('meta[name="theme-color"]')?.setAttribute('content', scheme === 'dark' ? '#05080D' : '#EFEEEA');
    };
    apply();
    mq.addEventListener('change', apply);
    return () => mq.removeEventListener('change', apply);
  }, [theme]);
  useEffect(() => {
    document.documentElement.dataset.motion = motion === 'reduced' ? 'reduced' : motion === 'full' ? 'full' : '';
  }, [motion]);
}

/**
 * Hydrates the encrypted stores, re-applies the demo merge, starts the
 * autonomous engine loop and registers the offline service worker. Content
 * renders only after local data is loaded, so no screen ever flashes the
 * wrong dataset.
 */
export function Providers({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  useThemeAttr();

  useEffect(() => {
    let stop: (() => void) | undefined;
    let cancelled = false;
    (async () => {
      await Promise.all([useHealth.persist.rehydrate(), useActivity.persist.rehydrate(), useProgress.persist.rehydrate(), useFollowUps.persist.rehydrate()]);
      if (cancelled) return;
      const st = useSettings.getState();
      const h = useHealth.getState();
      if (h.scenario !== st.scenario) h.loadScenario(st.scenario);
      useHealth.getState().reconcileDemo();
      stop = startEngineRunner();
      setReady(true);
      // Warm the lazily-loaded 3D bundles when idle so the service worker caches them for offline use.
      const warm = () => {
        void import('@/components/twin/anatomy-scene').catch(() => {});
        void import('@/components/twin/twin-scene').catch(() => {});
        void import('@/components/station/station-scene').catch(() => {});
      };
      if ('requestIdleCallback' in window) window.requestIdleCallback(warm, { timeout: 8000 });
      else setTimeout(warm, 4000);
    })();
    if ('serviceWorker' in navigator && process.env.NODE_ENV === 'production') {
      navigator.serviceWorker.register('/sw.js').catch(() => {});
    } else if ('serviceWorker' in navigator) {
      // Development: a worker left over from a production run on this origin serves stale
      // /_next/static chunks cache-first ("module factory is not available"). Remove it and its caches.
      void navigator.serviceWorker.getRegistrations().then(async (regs) => {
        if (!regs.length) return;
        await Promise.all(regs.map((r) => r.unregister()));
        if ('caches' in window) await Promise.all((await caches.keys()).filter((k) => k.startsWith('cp-')).map((k) => caches.delete(k)));
        location.reload();
      });
    }
    return () => {
      cancelled = true;
      stop?.();
    };
  }, []);

  if (!ready) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-4" role="status" aria-live="polite">
        <CosmicMark size={72} animated />
        <p className="t-telemetry text-ink-3">DECRYPTING LOCAL HEALTH VAULT…</p>
      </div>
    );
  }
  return (
    <>
      {children}
      <Toaster />
      <Celebrations />
      <GameWatcher />
    </>
  );
}
