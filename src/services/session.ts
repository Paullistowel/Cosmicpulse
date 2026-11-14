import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import type { AuthUser } from '@/shared/contract';
import { ground, GroundError } from './ground';

/**
 * Ground-server session. Tokens live in httpOnly cookies (set by
 * /api/ground/auth/login); this store only keeps the non-secret user profile
 * so the UI can show who is signed in while offline.
 *
 * Without a session CosmicPulse runs in standalone/demo mode: everything is
 * computed on board and nothing is sent anywhere.
 */
type SessionState = {
  user?: AuthUser;
  signedInAt?: string;
  deviceId: string;
  lastError?: string;
  signIn: (email: string, password: string, totp?: string) => Promise<{ ok: true } | { ok: false; mfa?: boolean; error: string }>;
  signOut: () => Promise<void>;
  refreshMe: () => Promise<void>;
};

const newDeviceId = () => (typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `web-${Date.now()}-${Math.random().toString(16).slice(2)}`);

export const useSession = create<SessionState>()(
  persist(
    (set, get) => ({
      deviceId: newDeviceId(),
      signIn: async (email, password, totp) => {
        try {
          const r = await ground<{ status: 'ok'; user: AuthUser } | { status: 'mfa_required' }>('/auth/login', {
            method: 'POST',
            body: JSON.stringify({ email, password, totp: totp || undefined, deviceId: get().deviceId, deviceName: `CosmicPulse Web · ${navigator.userAgent.includes('Mac') ? 'Mac' : 'Browser'}` }),
          });
          if (r.status === 'mfa_required') return { ok: false, mfa: true, error: 'Enter the 6-digit code from your authenticator app.' };
          set({ user: r.user, signedInAt: new Date().toISOString(), lastError: undefined });
          return { ok: true };
        } catch (e) {
          const msg = e instanceof GroundError ? (e.status === 401 ? 'Email or password is incorrect.' : e.message) : 'Sign-in failed.';
          set({ lastError: msg });
          return { ok: false, error: msg };
        }
      },
      signOut: async () => {
        await ground('/auth/logout', { method: 'POST' }).catch(() => {});
        set({ user: undefined, signedInAt: undefined });
      },
      refreshMe: async () => {
        if (!get().user) return;
        try {
          const user = await ground<AuthUser>('/auth/me');
          set({ user });
        } catch (e) {
          if (e instanceof GroundError && e.code === 'auth') set({ user: undefined, lastError: 'Session expired — sign in again.' });
        }
      },
    }),
    { name: 'cosmicpulse.session.v1', storage: createJSONStorage(() => localStorage), partialize: (s) => ({ user: s.user, signedInAt: s.signedInAt, deviceId: s.deviceId }) as SessionState },
  ),
);

export const isAstronautSession = () => useSession.getState().user?.role === 'astronaut' && !!useSession.getState().user?.astronautId;
