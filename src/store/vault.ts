import { createStore, del, get, set } from 'idb-keyval';
import type { StateStorage } from 'zustand/middleware';

/**
 * Encrypted local vault (web counterpart of the mobile app's
 * XChaCha20-Poly1305 + Keychain vault).
 *
 * - Health state is stored in IndexedDB, encrypted with AES-GCM-256.
 * - The key is a NON-EXTRACTABLE WebCrypto key generated in this browser and
 *   stored as a CryptoKey object in IndexedDB: page scripts can use it but can
 *   never read its bytes, and the ciphertext is useless on another device.
 * - Writes are coalesced briefly (50 ms) so a burst of store updates costs one
 *   encryption, and flushed as soon as the tab is hidden, so a save followed
 *   by an immediate reload or tab close is not lost.
 * - If WebCrypto/IndexedDB is unavailable (very old browser, some private
 *   modes) the app still works in memory and says so in Settings.
 */

const db = typeof indexedDB !== 'undefined' ? createStore('cosmicpulse-vault', 'kv') : undefined;
const KEY_ID = 'vault-key-v1';
let keyPromise: Promise<CryptoKey> | null = null;

export const vaultStatus = { available: !!db && typeof crypto !== 'undefined' && !!crypto.subtle, lastError: '' as string };

async function vaultKey(): Promise<CryptoKey> {
  if (!db) throw new Error('IndexedDB unavailable');
  keyPromise ??= (async () => {
    const existing = await get<CryptoKey>(KEY_ID, db);
    if (existing) return existing;
    const k = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
    await set(KEY_ID, k, db);
    return k;
  })();
  return keyPromise;
}

async function encrypt(plain: string): Promise<{ iv: Uint8Array; data: ArrayBuffer }> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const data = await crypto.subtle.encrypt({ name: 'AES-GCM', iv: iv as BufferSource }, await vaultKey(), new TextEncoder().encode(plain));
  return { iv, data };
}

async function decrypt(rec: { iv: Uint8Array; data: ArrayBuffer }): Promise<string> {
  const out = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: rec.iv as BufferSource }, await vaultKey(), rec.data);
  return new TextDecoder().decode(out);
}

const pending = new Map<string, string>();
let timer: ReturnType<typeof setTimeout> | null = null;

async function flush() {
  timer = null;
  const batch = [...pending.entries()];
  pending.clear();
  for (const [name, value] of batch) {
    try {
      await set(name, await encrypt(value), db);
    } catch (e) {
      vaultStatus.lastError = (e as Error).message;
    }
  }
}

if (typeof window !== 'undefined') {
  const now = () => {
    if (!pending.size) return;
    if (timer) clearTimeout(timer);
    void flush();
  };
  window.addEventListener('pagehide', now);
  document.addEventListener('visibilitychange', () => document.visibilityState === 'hidden' && now());
}

export const vaultStorage: StateStorage = {
  async getItem(name) {
    if (!vaultStatus.available) return null;
    try {
      const rec = await get<{ iv: Uint8Array; data: ArrayBuffer } | string>(name, db);
      if (rec == null) return null;
      // Tampered or foreign ciphertext fails authentication and is refused.
      return typeof rec === 'string' ? rec : await decrypt(rec);
    } catch (e) {
      vaultStatus.lastError = `Stored data could not be decrypted (${(e as Error).message}); starting fresh.`;
      return null;
    }
  },
  async setItem(name, value) {
    if (!vaultStatus.available) return;
    pending.set(name, value);
    timer ??= setTimeout(flush, 50);
  },
  async removeItem(name) {
    pending.delete(name);
    if (db) await del(name, db);
  },
};

/** Removes every encrypted record and the key (Settings → Erase local data). */
export async function eraseVault() {
  pending.clear();
  if (!db) return;
  const { clear } = await import('idb-keyval');
  await clear(db);
  keyPromise = null;
}
