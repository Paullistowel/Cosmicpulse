# CosmicPulse Web — Architecture

```
┌──────────────────────────────── Browser (Next.js 16 client components) ────────────────────────────────┐
│  UI: Command Centre · Digital Twin (R3F) · Sentinel · Analytics · Hazard Explorer · Timeline · Missions  │
│                                                                                                          │
│  Shared mobile core (copied verbatim, src/data · src/engine · src/shared · pure feature helpers)         │
│    baselines · analysis · risk · readiness · autonomy/alert reconciliation · protocols · assistant       │
│  Web intelligence:  intel/ (hazard links, evidence)  sentinel/ (briefing, 7Q, follow-ups)                │
│                     twin/ (body systems)  simulator/ (scenario model)  game/ (XP, objectives, insignia)  │
│  Research layer:    research/ (sources + provenance, hazards, HRP risks/studies, BM25 search, OSDR JSON) │
│                                                                                                          │
│  Stores (zustand):  health · activity · progress · follow-ups  → encrypted IndexedDB vault (AES-GCM)     │
│                     settings · session · link → localStorage (non-sensitive)                              │
│  Services:          sync outbox · connectivity/LOS · device data pull · Web Bluetooth · assistant         │
│  Service worker:    app shell + routes + images + OSDR responses cached (public/sw.js)                    │
└───────────────┬───────────────────────────────────────────────────────┬──────────────────────────────────┘
                │ same-origin                                            │ same-origin
┌───────────────▼─────────────── Next.js route handlers (server) ───────▼──────────────────────────────────┐
│  /api/ground/[...path]  allow-listed proxy → FastAPI ground server; httpOnly session cookies; refresh   │
│  /api/ground/status     ground /health check                                                              │
│  /api/osdr/search|files NASA OSDR proxy (CORS-restricted upstream), 6 h cache, stale fallback            │
└───────────────┬───────────────────────────────────────────────────────┬──────────────────────────────────┘
                │                                                        │
   Existing CosmicPulse ground server (../Aegis/server, FastAPI)    https://osdr.nasa.gov (public API)
   auth+MFA · RBAC/ABAC · sync push/pull · vitals · assistant (HF/Anthropic keys server-side)
                ▲
   CosmicPulse iPhone app (Expo) — HealthKit/Apple Watch, Health Connect, BLE → /sync/push
```

## Decisions

| Decision | Why |
|---|---|
| Separate app in `~/Desktop/cosmicpulse` | The mobile repo (`~/Desktop/Aegis`) is never modified. The web app has its own dependencies and config. |
| **Copy, don't fork, the mobile core** | `scripts/sync-mobile-core.mjs` copies 32 platform-independent files unchanged (with a header). Same `@/…` paths resolve here via `tsconfig` paths; `lucide-react-native` is aliased to `lucide-react`. `--check` detects drift. Business logic stays identical on both platforms. |
| Next.js App Router, client-heavy pages | Health data is local-first and encrypted in the browser, so pages are client components rendered after vault hydration. Route handlers are needed only for the CORS-blocked OSDR API and to keep ground tokens out of JavaScript. |
| Reuse the FastAPI ground server | No duplicate backend: the web app is another client of the existing auth, sync, vitals and assistant endpoints. |
| Real anatomy for the twin | `public/models/anatomy.glb` (1.5 MB, meshopt) is built from BodyParts3D (CC BY-SA 2.1 JP) by `scripts/anatomy/` — see `docs/ANATOMY.md`. Lazy-loaded only on `/twin` and onboarding, decoded offline, cached by the service worker. Falls back to the procedural twin, then the 2D map. The station tour stays procedural. |
| Intro film rendered in real time | Built from local NASA stills (no remote video, no autoplay failures, works offline). Optional `public/media/intro.mp4` is detected server-side and used if present. |
| Five-chapter navigation | Home · Health · Sentinel · Explore · Progress (`src/lib/nav.ts`); sub-pages are chapter tabs, nothing is gated. |
| Deep-space theme default | Mobile dark tokens (navy/near-black, ice cyan) plus a restrained violet for Sentinel. Pearl light theme remains in Settings. |

## Backend integration

The browser calls `/api/ground/*`. The route handler forwards only allow-listed paths:
`auth/(login|logout|me|refresh)`, `sync/(push|pull)`, `assistant(/status)`,
`astronauts/{id}/(vitals|records|environment|administrations)`, `readings`, `missions`.

- **Login:** tokens from `POST /auth/login` are stripped from the response and stored as httpOnly,
  SameSite=Strict cookies scoped to `/api/ground`. A 401 triggers one `POST /auth/refresh` rotation.
- **Sync:** the mobile outbox is ported unchanged in behaviour: UUID idempotency keys, coalescing,
  exponential backoff (2 s → 5 min), dead-letter after 8 attempts, server-authoritative conflicts and
  cursor pull. Manual readings, alerts, incidents, messages and administrations queue and push.
- **Phone data:** `GET /astronauts/{id}/vitals?from=…` every minute when online and signed in. Readings
  keep their original `source` (e.g. `Synced · Apple Watch`), `provider` (`healthkit`), `takenAt` and
  `syncedAt`. Server RBAC prevents reading another astronaut's data (verified: 403).
- **Cloud assistant:** `POST /assistant` with a minimal, question-specific context built by the shared
  `features/assistant/context.ts`, plus NASA/CSA evidence excerpts. Without a server, session, link or
  consent, the on-board assistant answers.

## External APIs and limitations

| API | Status | Limitation / fallback |
|---|---|---|
| NASA OSDR Search + Data File | Verified working | Not CORS-enabled, so it is proxied. Historical data only. Offline: bundled Inspiration4 snapshot plus cached searches. |
| NASA Image Library | Used at build time | Images stored locally. |
| Ground server | Verified end-to-end | Optional. Standalone mode otherwise. |
| Web Bluetooth | Chromium only, HTTPS/localhost | Safari and Firefox are unsupported (UI says so). Apple Watch is not exposed. |
| Web Speech (dictation, read-aloud) | Browser-dependent | Buttons only appear when supported. |
| Apple HealthKit | **Not accessible from browsers** | Via the iPhone app and ground sync only. |
| NASA Life Sciences Portal | No public API found | Not integrated. |

## Offline-first

- Engine, findings, alerts, Sentinel briefing and seven questions, hazard links, twin statuses, timeline,
  missions, protocols, evidence library and Inspiration4 data all run in the browser.
- Writes queue in the encrypted outbox. "Simulate loss of signal" (Settings) blocks every network call
  from the tab (ground, assistant, OSDR) to demonstrate this. Verified: a reading recorded during LOS
  queued, then reached the ground server after the link returned.
- The production service worker precaches all routes and images and caches visited pages and OSDR
  responses.

## Security & privacy

- Encrypted vault: AES-GCM-256 with a **non-extractable** WebCrypto key stored in IndexedDB. Tampered
  ciphertext is refused. Writes flush within 50 ms and again when the tab is hidden.
- No secrets in the client bundle. Ground URL and tokens are server-side only. Security headers are set
  (nosniff, frame-deny, referrer, permissions-policy).
- Mood, journal and confinement check-ins are never synced or sent to the cloud assistant.
- Simulated alerts never trigger browser notifications or escalation.

## Source layout

| Path | Contents |
|---|---|
| `src/app/(app)/*` | All app routes (shell, providers) |
| `src/app/(immersive)/intro`, `welcome` | Cinematic introduction and onboarding (no chrome) |
| `src/app/api/*` | Ground proxy and OSDR proxy |
| `src/components/` | UI kit, viz, shell, twin, station, simulator scenes, sentinel, game, research, assistant |
| `src/data`, `src/engine`, `src/shared`, `src/features`, `src/lib/{format,analysis,interactions}.ts`, `src/services/health-integrations/ble/gatt.ts` | **Copied from mobile** (do not edit) |
| `src/intel`, `src/sentinel`, `src/twin`, `src/simulator`, `src/game`, `src/research` | Web intelligence and research layer |
| `src/store`, `src/services` | State, vault, sync, connectivity, device data, Bluetooth, assistant |
| `scripts/` | Mobile sync, OSDR snapshot, NASA images, smoke test, `anatomy/` model pipeline |
