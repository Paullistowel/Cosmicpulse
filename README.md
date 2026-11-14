# CosmicPulse Web

**Astronaut health intelligence for long-duration missions** — the web edition of the CosmicPulse
mobile app (NASA Space Apps Challenge 2026, *Health Monitoring Software*).

An astronaut can collect and review personal health indicators, see how they compare with their **own
baseline**, understand changes through **Sentinel AI**, explore them on a **3D digital twin**, connect
them to NASA's **five hazards of human spaceflight**, follow the story on a **predictive timeline**, and
stay engaged through fair, participation-based **missions and achievements** — fully offline if needed.

> ⚠️ **Not a medical device.** CosmicPulse highlights patterns against personal baselines and prototype
> rules. It does not diagnose, prescribe or replace a flight surgeon. Demo mode shows **SYNTHETIC**
> data from fictional crews, always labelled.

## Quick start

```bash
npm install
npm run dev            # http://localhost:3100  (PORT=xxxx to change)
```

No configuration is needed: the app runs standalone with simulated telemetry, manual entry, Web
Bluetooth and the full research library. A first visit plays the cinematic introduction (`/intro`,
skippable), then the mission briefing (`/welcome`). Both can be replayed from **Settings → About**.

Optional — connect the existing ground server (auth, phone sync, cloud AI):

```bash
cd ../Aegis/server && .venv/bin/uvicorn aegis_server.main:app --port 8000   # see that repo's README
cd ../../cosmicpulse && GROUND_API_URL=http://localhost:8000 npm run dev
```

Development ground servers seed fictional crew logins (e.g. `kestrel@crew.aegis.demo`, password from
`server/aegis_server/seed.py`). Sign in under **Settings & data → Live device data**.

| Command | Purpose |
|---|---|
| `npm run dev` / `build` / `start` | Next.js dev server, production build, production server |
| `npm run typecheck` | `tsc --noEmit` (strict) |
| `npm run lint` | ESLint (Next core-web-vitals + TypeScript) |
| `npm test` | Vitest unit tests (engine integration, evidence, assistant routing, gamification, simulator, twin) |
| `node scripts/smoke.mjs` | Headless-Chromium route check (console errors, 5xx, horizontal overflow, screenshots) — needs `CHROME_PATH` |
| `npm run sync:mobile` | Re-copy the shared TypeScript core from the mobile app (`--check` reports drift) |
| `node scripts/anatomy/fetch.mjs` + `build.mjs` | Rebuild the 3D anatomy model from BodyParts3D (see docs/ANATOMY.md) |
| `npm run data:osdr` | Rebuild the bundled NASA OSDR Inspiration4 snapshot |
| `node scripts/fetch-nasa-images.mjs` | Re-download NASA imagery + credits |

## Environment variables (server-side only)

| Variable | Default | Purpose |
|---|---|---|
| `GROUND_API_URL` | — | Base URL of the CosmicPulse FastAPI ground server. Unset = standalone. |
| `COOKIE_SECURE` | `false` | `true` behind HTTPS (session cookies become `Secure`). |
| `OSDR_API_BASE` | `https://osdr.nasa.gov` | NASA OSDR API base (testing only). |
| `PORT` | `3100` | Dev/start port. |

No AI keys live here: the cloud assistant runs on the ground server (`HF_TOKEN` / `ANTHROPIC_API_KEY`
in `server/.env`). The browser never sees the ground URL or session tokens.

## What's inside — one story, four sections

**Story:** *"Humanity is exploring beyond Earth. Your mission is to protect the human body on that
journey."* Seven chapters frame every screen (`src/lib/nav.ts`, `src/components/story.tsx`) — a
map, never a gate: health data, alerts and Emergency are always reachable. **Nova**, an original
animated astronaut (`src/components/companion.tsx`), guides the explorer through onboarding, the
hub, every section intro and milestone celebrations.

| Chapter | Where | Highlights |
|---|---|---|
| 01 The call to explore | `/intro` | **Landing page — opens every visit** (each new browser session; skippable; Emergency never blocked). The 23 s NASA film plays full-screen with captions, then at Earth’s night limb fades into the interactive 3D launch pad: tap Earth / station / Moon with Nova (3 stars), synthesised sound effects, **ENTER COSMICPULSE** warp-speed launch. *Watch the film again* replays it. |
| 02 Welcome aboard | `/welcome` | Nova welcomes you, asks what to call you, and introduces each feature in one-idea screens; the twin step uses the real 3D anatomy |
| 03 Discover your body | **My Health → Body lab** `/twin` | Realistic layered BodyParts3D anatomy, Anatomy / Health-status views, per-system measurement, baseline, trend, Sentinel |
| 04 Your daily mission | **Home** `/`, Sentinel `/sentinel` | Live 3D universe hero (toon planet, clouds, atmosphere, Moon, orbiting station), Nova's one contextual next step, readiness, body-today hotspots, vitals, objectives |
| 05 Dangers of space | **Explore** `/simulator`, `/risk`, `/research`, `/station` | Hazard expeditions with interactive scenes, scenario simulator, personal risk, evidence library |
| 06 Your health story | **My Health** `/timeline`, `/analytics`, `/vitals`, `/sleep`, `/activity`, `/wellness`, `/assessments`, `/alerts` | Interactive charts and qualified projections |
| 07 Complete the mission | **My Rewards** `/missions`, `/achievements` | XP, ranks, objectives, insignia — participation-only, celebrated by Nova |

Records (`/record`, `/medical`, `/reports`) and Settings sit under **More**.

**Guided tour** (`src/components/tour.tsx`): after onboarding, Nova spotlights the real hub, Human Twin, Sentinel, alerts, hazards, rewards and Emergency (live and interactive). Skip, replay (the **?** button or Settings → About); completion is remembered. **Living backdrop:** interactive parallax starfield, shooting stars and nebula behind every screen. **Text-minimal:** page explanations sit behind *What's this?* / *Learn more*; safety notices stay visible.

## Data sources (three, clearly separated)

1. **Live device data** — Apple Watch → iPhone Health → CosmicPulse iPhone app (HealthKit, native) →
   ground server (`/sync/push`) → this web app (`/astronauts/{id}/vitals`). The browser never touches
   HealthKit. Also **Web Bluetooth** (Chrome/Edge) for standard GATT heart-rate, BP, SpO₂, temperature and
   weight sensors.
2. **Manual input** — validated forms (plausible ranges, unit conversion, timestamps).
3. **Simulation** — seven fictional mission scenarios × seven simulated conditions, labelled SYNTHETIC.
   Real readings always win per metric.

## Documentation

- [NASA_DATA_SOURCES.md](NASA_DATA_SOURCES.md) — every NASA/CSA source, what was extracted, API vs dataset vs documentation
- [public/media/CREDITS.md](public/media/CREDITS.md) — intro film shot list and NASA sources
- [docs/ANATOMY.md](docs/ANATOMY.md) — 3D anatomy source, build pipeline, structure → system mapping, limitations
- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) — architecture, backend integration, APIs & limitations, offline, security
- [docs/HEALTH_ANALYSIS.md](docs/HEALTH_ANALYSIS.md) — analysis methodology, Sentinel, simulation, scenario simulator formulas, gamification safety rules
- [docs/FEATURE_MIGRATION.md](docs/FEATURE_MIGRATION.md) — mobile → web feature checklist
- [docs/TESTING_AND_DEPLOYMENT.md](docs/TESTING_AND_DEPLOYMENT.md) — test suites, what was verified, deployment

## Credits

3D anatomy: BodyParts3D, © 2008 DBCLS, CC BY-SA 2.1 JP (derived model under the same licence — see
`public/models/CREDITS.md`). Fonts: Urbanist, Inter, JetBrains Mono (SIL OFL). Imagery: NASA (public domain; no endorsement implied)
— see `public/images/CREDITS.md` and `public/images/nasa/credits.json`. Heart illustration (mobile):
Patrick J. Lynch, CC BY 2.5. Research: NASA HRP, CSA, NASA OSDR. Logo: CosmicPulse.
# Cosmicpulse
