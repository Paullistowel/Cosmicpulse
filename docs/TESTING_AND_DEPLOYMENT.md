# Testing & deployment

## Automated

| Suite | Command | Covers |
|---|---|---|
| Typecheck | `npm run typecheck` | Strict TS across web code and the copied mobile core |
| Lint | `npm run lint` | Next core-web-vitals, TypeScript, React Compiler rules |
| Unit | `npm test` (41 tests) | Hazard signals, evidence integrity (5 challenge sources, every reference resolves, 17 HRP risks), evidence search, assistant routing (triage incl. curly apostrophes, dosing refusal never forwarded, research citations, cloud fallback, evidence context), check-in scoring, REAL/DEMO/MIXED, Bluetooth unit conversion, OSDR mapping, Inspiration4 snapshot, gamification rules (daily/per-item caps, ranks, achievements), Sentinel 7Q and briefing, simulator evidence vs hypothetical, twin status |
| Smoke | `CHROME_PATH=… node scripts/smoke.mjs` | Every route, desktop 1440 and phone 390: no console errors, no 5xx, no horizontal overflow, screenshots |
| Mobile drift | `npm run sync:mobile -- --check` | Shared core still identical to the mobile app |

## Verified manually / scripted on 2026-11-14

- **Ground integration** with the real FastAPI server (scratch SQLite DB): status, login (tokens never
  reach JS: `document.cookie` empty), an iPhone-style HealthKit reading pushed via `/sync/push` appears
  in the browser as "Synced · Apple Watch" with MIXED mode, RBAC 403 on another astronaut, allow-list
  404, assistant-not-configured falls back on board.
- **Offline/LOS:** a reading recorded while LOS was simulated queued (1), then synced and appeared in
  ground `/vitals`.
- **Gamification:** first-run redirect to onboarding, +100 XP and "Mission Briefed", mood (+20), twin
  (+10), briefing (+15) = 145 XP after reload (persistence); a second same-day check-in earned nothing.
- **Scenario detection:** Mars transit + persistent multi-signal condition → physiological-strain
  finding (SYNTHETIC), isolation hazard "attention", full eight-point explanation.
- **Offline (production build + service worker):** with the browser set offline, Mission home, Twin, Sentinel, Research, Risk, Simulator, Timeline, Missions and Record all load from cache with local data; the 3D twin falls back to the 2D map if its bundle was never cached.
- **Production build** (`next build`) succeeds (33 routes); smoke test passes on the production server.

## Not verified (no hardware available)

Web Bluetooth with a physical sensor (parsers are unit-tested and shared with mobile) · iPhone HealthKit
end-to-end (emulated by pushing the same payload the phone sends) · Safari/Firefox visual pass.

## Deployment

```bash
npm ci && npm run build && npm start         # Node 20+; PORT defaults to 3100
```

- Set `GROUND_API_URL` (server-side) to the ground server and `COOKIE_SECURE=true` behind HTTPS. Add the
  web origin to nothing — the browser never calls the ground server directly, so no CORS change is needed.
- Any Node host (Vercel, Fly, a container) works: route handlers need a Node runtime for the proxy.
- Web Bluetooth and the service worker require HTTPS (or localhost).
- Bundled data refresh: `npm run data:osdr`, `node scripts/fetch-nasa-images.mjs`, `npm run sync:mobile`.
