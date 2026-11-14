# Mobile → web feature migration checklist

Source: CosmicPulse mobile app (`~/Desktop/Aegis`, Expo SDK 57, Expo Router, FastAPI ground server,
Supabase-ready Postgres schema). ✅ migrated · 🔁 adapted for the web · ⛔ not possible in a browser (with fallback)

| Mobile capability (file) | Web equivalent | Status |
|---|---|---|
| Design tokens, type scale, glass, ink pills (`theme/tokens.ts`, `ui/glass.tsx`) | `globals.css` tokens 1:1, `glass`/`card` utilities, Urbanist/Inter/JetBrains Mono | ✅ |
| Brand mark, space backdrop, editorial NASA imagery | `brand/mark.tsx`, `brand/backdrop.tsx`, `public/images` | ✅ |
| Home dashboard: greeting, mission hero, MET, health dial, key vitals, insight, alerts, emergency, devices & sync | Command Centre (`/`) — expanded | ✅ 🔁 |
| Health tab, vital detail (trend, baseline band, rules, history) | `/vitals`, `/vitals/[type]`, `/analytics` | ✅ |
| Measurement entry with validation and unit conversion | `/record` (vitals, sleep, activity, mood, symptoms) | ✅ |
| Sleep, physical/activity (periods, goal, distance provenance), environment | `/sleep`, `/activity`; environment via hazards and findings | ✅ |
| Behavioural check-ins, journal | `/wellness` (+ confinement check-in) | ✅ 🔁 |
| Intelligence Engine: baselines, analysis, risk, readiness, autonomy, alert reconciliation | Shared code, copied verbatim (`src/engine`) | ✅ |
| Explainable finding detail and alert workflow (acknowledge/escalate) | `/alerts/[id]` 8-point detail, `/sentinel` seven questions | ✅ 🔁 |
| Risk assessment, baselines, autonomy levels | `/assessments` | ✅ |
| Protocol knowledge base and BM25 retrieval | Shared; shown on findings, hazards, emergency, incidents | ✅ |
| Grounded on-board assistant, safety triage, cloud assistant via ground | `services/assistant.ts` + Sentinel + evidence library | ✅ (+ smart-quote triage fix) |
| Voice input / read-aloud (expo-speech) | Web Speech API (where supported) | 🔁 |
| Medical: incidents (timeline, protocol checklist), inventory and administrations (authorisedBy), medications and doses, comms with delay, records | `/medical` | ✅ |
| Emergency flow (category, severity, vitals snapshot, CMO ack, priority message) | `/emergency` | ✅ |
| Reports: emergency summary, health report (HTML/PDF) | `/reports` (+ flight-surgeon brief), print-to-PDF | ✅ |
| Demo scenarios (7) and simulated conditions (7), per-metric REAL/DEMO/MIXED fallback | Shared generator + Settings → Simulation | ✅ |
| Encrypted vault (XChaCha20 + Keychain) | AES-GCM-256 + non-extractable WebCrypto key in IndexedDB | 🔁 |
| Sync outbox, connectivity, LOS simulation | Ported (`services/sync.ts`, `connectivity.ts`) | ✅ |
| Auth (FastAPI JWT + MFA) | `/api/ground` proxy with httpOnly cookies, TOTP prompt | 🔁 |
| Apple HealthKit / Apple Watch (`health-platform/healthkit.ts`) | ⛔ in browsers → readings pulled from ground after the phone syncs | ⛔ → 🔁 |
| Health Connect (Android) | Same as above | ⛔ → 🔁 |
| BLE GATT sensors (`ble/gatt.ts`) | Web Bluetooth with the same parsers | 🔁 |
| Fitbit cloud integration (server) | Reaches the web through ground `/astronauts/{id}/vitals` | ✅ |
| GPS outdoor sessions (expo-location) | Not migrated: phone-centric. Activity accepts manual distance | ⛔ (manual fallback) |
| Lab/medicine OCR, imaging (demo) | Not migrated: placeholders on mobile with no real model | ⛔ (documented) |
| Biometric lock (Face ID) | Not available on the web; vault key is device-bound instead | ⛔ |
| Local notifications | Browser notifications for real high-severity alerts (opt-in) | 🔁 |
| Medical Command Centre (web, flight-surgeon roles) | Not in scope (astronaut app); still served by the mobile project's web build | — |

## New in the web edition

NASA/CSA evidence library with provenance · Inspiration4 OSDR explorer · live OSDR search ·
Spaceflight Risk Intelligence · Hazard Explorer and scenario simulator · 3D Digital Twin · Sentinel
(briefing, seven questions, relationship diagrams, follow-ups) · Predictive timeline · Gamification
(XP, ranks, objectives, insignia, onboarding) · Station tour · offline service worker.
