# Health analysis methodology

Everything below is deterministic, explainable and runs offline. **None of it is clinically validated.**
Thresholds are prototype demo values, not NASA flight-medicine limits.

## 1. Personal baselines (shared mobile engine, `src/engine/baseline.ts`)

- Per metric: median and scaled MAD (robust spread), plus p10–p90 "usual range".
- The window is chosen by mission phase: the current phase once it is ≥ 14 days old, else pre-flight,
  else a rolling 30 days. The most recent 3 days are excluded, so a developing change is compared with
  what came before it. Quality-flagged readings are ignored.
- Quality: insufficient (< 10 readings or < 5 days), provisional (< 20 or < 10 days), established.
  Without an established baseline the UI says so and never substitutes a population range.

## 2. Findings (`src/engine/analysis.ts`)

| Rule | Logic |
|---|---|
| Baseline anomaly | Robust z ≥ 2.5 over the last 3 days plus a minimum meaningful shift, direction-aware; severity rises with persistence |
| Mission rule | Caution / action limits (e.g. SpO₂ 94 / 90 %); critical only when confirmed by a second reading |
| Physiological strain | ≥ 2 of HR↑, HRV↓, temperature↑, RR↑ at ≥ 1.5 robust SD; ≥ 3 for ≥ 3 days → medical review |
| Sleep debt, data quality, environment, radiation event (≥ 3× expected dose rate), career dose vs 600 mSv | See source |

Findings carry kind (statistical pattern / screening indicator / …), severity, what changed, the rule,
uncertainty, next step, protocol IDs and a `simulated` flag. Alerts are reconciled idempotently by
fingerprint.

**Web alert categories.** The four engine tiers map to the requested three: *Normal* (informational),
*Warning* (attention or medical review recommended), *Critical* (urgent). Body systems additionally show
*Unknown* when there are no readings in 7 days.

**Eight-point abnormality detail** (`/alerts/[id]`): indicator, recorded measurement with provenance,
baseline, nature of deviation (change, rule, persistence, outcome), contributing factors and hazards,
scientific evidence (resolved source facts), next steps and protocols, escalation.

## 3. Spaceflight hazard links (`src/intel/hazard-profile.ts`)

Signals per hazard, each with the data used and the evidence references:

| Signal | Rule (prototype) |
|---|---|
| Reduced sleep | Last 5 nights mean < 6.5 h, or ≥ 0.75 h below the previous 14 nights; *attention* if < 6 h or ≥ 1.5 h drop |
| Lower mood / higher stress | 7-day mean vs previous 3 weeks: change ≥ 0.7, or mood ≤ 2.2 / stress ≥ 4 |
| Less exercise | 7-day min/day < 70 % of the previous 2 weeks |
| Vital vs baseline | |z| ≥ 1.5 over 3 days (attention ≥ 2.5) |
| Radiation | Dose rate ≥ 1.5× (watch) / ≥ 3× (attention) expected; cumulative ≥ 50 % / 80 % of 600 mSv |
| Environment | Cabin CO₂ ≥ caution/action |
| Distance | Loss of a configured ground link; delay ≥ 60 s; body mass below baseline |
| Confinement check-in | Score ≤ 45 (≤ 30 attention) within 10 days |

Narratives explain relevance and state explicitly that no condition is implied.

## 4. Sentinel AI (`src/sentinel/sentinel.ts`)

- **Daily briefing:** a synthetic-data notice, the top three findings, last sleep, hazards needing
  attention, data quality, due follow-ups, or "no new findings".
- **Seven questions:** built from `explainFinding()` plus evidence. Reassessment windows by tier: urgent
  1 h, medical review 12 h, attention 24 h, informational 72 h. Contact guidance by tier.
- **Relationship diagram:** only contributing signals from the finding, plus short sleep (< 6.5 h,
  5-night mean) when present.
- **Conversation:** safety triage (with smart-quote normalisation), then the on-board engine and the
  evidence library, then the cloud model via the ground server; any failure falls back on board.

## 5. Predictive timeline (`projectTrend`, shared mobile helper)

Ordinary least squares over the last 14 days, extrapolated 7 days. A projection is shown **only if**
|t| ≥ 3, R² ≥ 0.3 and the projected change exceeds the baseline spread. It is drawn dashed and labelled
"not a prediction", with a plain-language caveat.

## 6. Digital twin status (`src/twin/systems.ts`)

| Status | Condition |
|---|---|
| High priority | Any related finding of severity high or critical |
| Unknown | No readings for the system in 7 days (behavioural system: no mood check-ins either) |
| Attention required | Any related finding, or a guideline band warning on the latest reading |
| Normal | Otherwise |

Heartbeat uses the latest heart rate (≤ 24 h old); breathing uses the latest respiratory rate. Without a
reading, or under reduced motion, nothing moves.

## 7. Simulation architecture

- Seven fictional scenarios (`src/data/demo/scenarios.ts`, seeded RNG) produce a **demo pool**, merged
  per metric only where no real reading exists (`mergeDemo`). The pool regenerates daily or when the
  scenario or condition changes.
- Seven simulated conditions (`conditions.ts`) reshape recent synthetic readings; **the engine is not
  told** and must detect them itself.
- Every synthetic record has `source.kind` simulated or demo. Banners, badges, chart markers, findings,
  alerts and reports all say SYNTHETIC.

## 8. Mission scenario simulator (`src/simulator/model.ts`)

| Output | Tag | Formula |
|---|---|---|
| Mission dose | evidence | days × published dose rate × (1 − 0.30 × shelter %) *(the 30 % is an assumption)* |
| Career dose | evidence | prior dose + mission dose, vs 600 mSv |
| Delay | evidence | typical light time per destination |
| Unloading index | hypothetical | (1 − g/0.375 × 0.5) × min(days, 900)/900 × 100 × (1 − min(exercise, 150)/300) |
| Isolation index | hypothetical | min(days,1000)/1000 × 60 + (6 − crew) × 5 + max(0, 7 − sleep) × 8 + delay × 0.8 |
| Self-sufficiency index | hypothetical | delay × 3 + min(days,1000)/1000 × 30 |
| Closed-habitat index | hypothetical | 20 + min(days,1000)/1000 × 30 + max(0, 7 − sleep) × 6 |

All indices are clamped to 0–100. They illustrate direction (for example, that more exercise means less
unloading) and are never predictions.

## 9. Gamification safety rules (`src/game/`)

- XP comes only from participation: recording, checking in, reviewing, learning, following up.
- No reward is ever tied to reading values, "good" health, exercise volume or dismissing alerts.
- Daily activities count once per day, learning items once per item, onboarding once. Weekly missions
  give a one-time bonus per week.
- Ranks: Cadet 0 · Junior Explorer 150 · Mission Specialist 400 · Space Health Specialist 800 ·
  Senior Astronaut 1400 · Mission Commander 2200 XP.
- Progress persists in the encrypted vault. Twelve achievements are evaluated from events only.
