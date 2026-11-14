import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import type { SyncEntity, SyncEvent } from '@/data/types';
import type { PullChange, PullResponse, PushEvent, PushRequest, PushResponse } from '@/shared/contract';
import { vaultStorage } from '@/store/vault';
import { canReachGround } from './connectivity';
import { ground } from './ground';
import { isAstronautSession } from './session';

/**
 * Ported from the CosmicPulse mobile app (src/services/sync.ts). Web changes:
 * transport goes through /api/ground (cookie session), UUIDs from WebCrypto,
 * and syncing only runs for a signed-in astronaut session.
 *
 * CosmicPulse deferred synchronisation.
 *
 * Outbox pattern: every local change that ground must know about is written to
 * an encrypted, persistent queue in the same tick as the change itself, so it
 * survives restarts and loss of signal.
 *
 * - Idempotency: each event has a UUID; the server records seen ids and
 *   answers repeats with `duplicate`, so retries can never double-apply.
 * - Coalescing: an event that has never been attempted is replaced by a newer
 *   change to the same entity rather than queued twice.
 * - Retry: exponential backoff with jitter (2 s → 5 min); after MAX_ATTEMPTS a
 *   rejected event moves to `failed` for the user to retry or discard.
 * - Conflicts: entities carry a server revision; if the server copy moved on
 *   (e.g. a flight surgeon changed an alert), the server returns `conflict`
 *   with its copy, which is applied locally and logged.
 * - Pull: server-side changes since the last cursor are applied through the
 *   registered inbound handler.
 */

const MAX_BATCH = 100;
const MAX_ATTEMPTS = 8;

export type Conflict = { at: string; entity: SyncEntity; entityId: string; resolution: 'server_applied' };

export type SyncTransport = {
  push(req: PushRequest): Promise<PushResponse>;
  pull(cursor: string | undefined, astronautId: string): Promise<PullResponse>;
};

type SyncState = {
  queue: SyncEvent[];
  failed: SyncEvent[];
  revisions: Record<string, number>;
  cursor?: string;
  status: 'idle' | 'syncing' | 'waiting' | 'error';
  lastSyncAt?: string;
  lastAttemptAt?: string;
  lastError?: string;
  conflicts: Conflict[];
  stats: { pushed: number; duplicates: number; pulled: number };
};

const initial: SyncState = { queue: [], failed: [], revisions: {}, status: 'idle', conflicts: [], stats: { pushed: 0, duplicates: 0, pulled: 0 } };

export const useSync = create<SyncState>()(
  persist(() => initial, {
    name: 'cosmicpulse.sync.v1',
    storage: createJSONStorage(() => vaultStorage),
    version: 1,
    partialize: (s) => ({ ...s, status: s.status === 'syncing' ? 'idle' : s.status }),
  }),
);

const key = (entity: SyncEntity, entityId: string) => `${entity}:${entityId}`;
/** RFC 4122 v4 UUID from the platform CSPRNG. */
export function newEventId(): string {
  const b = crypto.getRandomValues(new Uint8Array(16));
  b[6] = (b[6] & 0x0f) | 0x40;
  b[8] = (b[8] & 0x3f) | 0x80;
  const h = Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

/** Queue a change for ground. Call in the same action that changes local state. */
export function enqueue(entity: SyncEntity, op: 'upsert' | 'delete', entityId: string, payload: unknown, now = new Date()) {
  useSync.setState((s) => {
    const i = s.queue.findIndex((e) => e.entity === entity && e.entityId === entityId && e.attempts === 0 && e.op === op);
    const createdAt = now.toISOString();
    if (i >= 0) {
      const queue = [...s.queue];
      queue[i] = { ...queue[i], payload, createdAt };
      return { queue };
    }
    return { queue: [...s.queue, { id: newEventId(), entity, op, entityId, payload, createdAt, attempts: 0 }] };
  });
  scheduleFlush();
}

export function backoffMs(attempts: number, rand = Math.random()) {
  return Math.min(300_000, 2000 * 2 ** Math.max(0, attempts - 1)) * (0.8 + rand * 0.4);
}

/* ------------------------------- Inbound ------------------------------- */

type InboundHandler = (change: PullChange) => void;
let inbound: InboundHandler = () => {};
type AckHandler = (entity: SyncEntity, entityId: string) => void;
let ack: AckHandler = () => {};
/** Called when ground has durably accepted an entity (e.g. mark a message "sent"). */
export const registerAckHandler = (fn: AckHandler) => {
  ack = fn;
};
/** The mission store registers how to apply server changes locally. */
export const registerInboundHandler = (fn: InboundHandler) => {
  inbound = fn;
};

/* ------------------------------- Transport ------------------------------- */

export const httpTransport: SyncTransport = {
  push: (req) => ground<PushResponse>('/sync/push', { method: 'POST', body: JSON.stringify(req), timeoutMs: 30_000 }),
  pull: (cursor, astronautId) => ground<PullResponse>(`/sync/pull?astronautId=${encodeURIComponent(astronautId)}${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ''}`),
};

let transport: SyncTransport = httpTransport;
let identity = { deviceId: 'unregistered', astronautId: 'unknown' };
export const configureSync = (opts: { transport?: SyncTransport; deviceId?: string; astronautId?: string }) => {
  if (opts.transport) transport = opts.transport;
  identity = { deviceId: opts.deviceId ?? identity.deviceId, astronautId: opts.astronautId ?? identity.astronautId };
};

/* -------------------------------- Flush -------------------------------- */

let running: Promise<void> | null = null;
let flushTimer: ReturnType<typeof setTimeout> | null = null;

function scheduleFlush(ms = 1500) {
  if (flushTimer) return;
  flushTimer = setTimeout(() => {
    flushTimer = null;
    syncNow().catch(() => {});
  }, ms);
}

/** Push due events, then pull server changes. Safe to call concurrently. */
export function syncNow(opts: { force?: boolean; now?: () => number; isOnline?: () => boolean } = {}): Promise<void> {
  running ??= run(opts).finally(() => {
    running = null;
  });
  return running;
}

async function run({ force, now = Date.now, isOnline = () => canReachGround() && isAstronautSession() }: { force?: boolean; now?: () => number; isOnline?: () => boolean }) {
  if (!isOnline()) {
    useSync.setState({ status: 'waiting' });
    return;
  }
  useSync.setState({ status: 'syncing', lastAttemptAt: new Date(now()).toISOString() });
  try {
    // Push in batches until nothing is due.
    for (;;) {
      const s = useSync.getState();
      const due = s.queue.filter((e) => force || !e.nextAttemptAt || new Date(e.nextAttemptAt).getTime() <= now()).slice(0, MAX_BATCH);
      if (!due.length) break;
      const events: PushEvent[] = due.map((e) => ({
        id: e.id,
        entity: e.entity,
        op: e.op,
        entityId: e.entityId,
        baseRevision: s.revisions[key(e.entity, e.entityId)] ?? 0,
        payload: e.payload,
        createdAt: e.createdAt,
      }));
      let res: PushResponse;
      try {
        res = await transport.push({ deviceId: identity.deviceId, astronautId: identity.astronautId, events });
      } catch (err) {
        // Transport failure: back off every attempted event and stop.
        markAttempt(due.map((e) => e.id), (err as Error).message, now());
        throw err;
      }
      applyPushResults(res, now());
      if (force) break;
    }
    // Pull until drained.
    for (let page = 0; page < 20; page++) {
      const r = await transport.pull(useSync.getState().cursor, identity.astronautId);
      for (const c of r.changes) {
        inbound(c);
        useSync.setState((s) => ({ revisions: { ...s.revisions, [key(c.entity, c.entityId)]: c.revision } }));
      }
      useSync.setState((s) => ({ cursor: r.cursor, stats: { ...s.stats, pulled: s.stats.pulled + r.changes.length } }));
      if (!r.hasMore) break;
    }
    useSync.setState({ status: 'idle', lastSyncAt: new Date(now()).toISOString(), lastError: undefined });
  } catch (err) {
    useSync.setState({ status: 'error', lastError: (err as Error).message });
  }
}

function markAttempt(ids: string[], error: string, now: number) {
  useSync.setState((s) => {
    const failed = [...s.failed];
    const queue = s.queue.flatMap((e) => {
      if (!ids.includes(e.id)) return [e];
      const attempts = e.attempts + 1;
      const next = { ...e, attempts, lastError: error, nextAttemptAt: new Date(now + backoffMs(attempts)).toISOString() };
      if (attempts >= MAX_ATTEMPTS) {
        failed.push(next);
        return [];
      }
      return [next];
    });
    return { queue, failed };
  });
}

function applyPushResults(res: PushResponse, now: number) {
  const done = new Set<string>();
  const acked = new Map(useSync.getState().queue.map((e) => [e.id, e]));
  const rejected: { id: string; error: string }[] = [];
  useSync.setState((s) => {
    const revisions = { ...s.revisions };
    const conflicts = [...s.conflicts];
    const stats = { ...s.stats };
    for (const r of res.results) {
      const ev = s.queue.find((e) => e.id === r.id);
      if (!ev) continue;
      if (r.status === 'accepted' || r.status === 'duplicate') {
        done.add(r.id);
        revisions[key(ev.entity, ev.entityId)] = r.revision;
        if (r.status === 'duplicate') stats.duplicates += 1;
        else stats.pushed += 1;
      } else if (r.status === 'conflict') {
        done.add(r.id);
        revisions[key(ev.entity, ev.entityId)] = r.revision;
        inbound({ entity: ev.entity, entityId: ev.entityId, revision: r.revision, op: 'upsert', payload: r.server, at: new Date(now).toISOString() });
        conflicts.unshift({ at: new Date(now).toISOString(), entity: ev.entity, entityId: ev.entityId, resolution: 'server_applied' });
      } else {
        rejected.push({ id: r.id, error: r.error });
      }
    }
    return { queue: s.queue.filter((e) => !done.has(e.id)), revisions, conflicts: conflicts.slice(0, 50), stats };
  });
  for (const r of rejected) markAttempt([r.id], r.error, now);
  for (const r of res.results) {
    if (r.status !== 'accepted' && r.status !== 'duplicate') continue;
    const ev = acked.get(r.id);
    if (ev) ack(ev.entity, ev.entityId);
  }
}

/** Move failed events back into the queue for another attempt. */
export function retryFailed() {
  useSync.setState((s) => ({ queue: [...s.queue, ...s.failed.map((e) => ({ ...e, attempts: 0, nextAttemptAt: undefined }))], failed: [] }));
  scheduleFlush(0);
}

export function discardFailed(id: string) {
  useSync.setState((s) => ({ failed: s.failed.filter((e) => e.id !== id) }));
}

export function resetSync() {
  useSync.setState(initial);
}
