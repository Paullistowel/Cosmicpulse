# NASA & CSA data sources used by CosmicPulse Web

Retrieved and verified **2026-11-14**. Machine-readable provenance for every source lives in
[`src/research/sources.ts`](src/research/sources.ts) (organisation, title, URL, identifiers, dates,
units, retrieval date, usage and attribution) and is shown in the app under **Research library → source**.

## How to read this document

CosmicPulse handles four kinds of information and never mixes them up. Each one is labelled in the UI:

| Class | What it is | UI label |
|---|---|---|
| **NASA/CSA research & data** | Agency research pages and published datasets (historical/experimental) | "REAL NASA OSDR DATA", source badges, `[NASA HRP]` / `[CSA]` citations |
| **Recorded measurements** | Manual entries, Web Bluetooth sensors, readings synced from the CosmicPulse iPhone app | "Entered manually", "Live · device", "Synced · device" |
| **Simulated telemetry** | Fictional demo-mission data for demonstrations | "SYNTHETIC / DEMO DATA" |
| **AI-generated explanations** | Sentinel/assistant text grounded in the above | Engine name shown under every answer; cites sources |

None of the sources below is a live physiological monitoring feed. No astronaut telemetry is obtained from NASA.

---

## The five official challenge resources (research documentation — no API)

| # | Source | Type | What was extracted | How CosmicPulse uses it |
|---|---|---|---|---|
| 1 | **NASA HRP — 5 Hazards of Human Spaceflight**<br>https://www.nasa.gov/hrp/hazards/ (updated 2026-06-12) | Research summary (web page) | The five hazards (radiation, isolation & confinement, distance from Earth, gravity fields, hostile/closed environments); Mars ≈140 million miles and ~3-year mission; Mars gravity 3/8 g; closed-habitat controls (temperature, pressure, lighting, noise, microbes, immune responses); analogs/labs/ISS as test beds | Structure of Risk Intelligence and the Hazard Explorer; hazard explanations beside findings; Sentinel and assistant citations |
| 2 | **NASA HRP — Risks of Human Spaceflight**<br>https://www.nasa.gov/hrp/risks/ (updated 2026-07-21) | Risk catalogue | All 17 named risks in three groups (11 physiology, 5 behavioural/human factors, 1 radiation); effects vary by destination; research aims at understanding, prevention, mitigation | `HRP_RISKS` catalogue: each risk is linked to hazards and to the metrics CosmicPulse can observe; shown as "related HRP risk" on findings (relevance, never a diagnosis) |
| 3 | **NASA HRP — Ongoing HRP Research in Space**<br>https://www.nasa.gov/hrp/ongoing-hrp-research/ (updated 2026-08-18) | Research catalogue | 21 investigations: Artemis II (ARCHeR, Immune Biomarkers, Standard Measures), LEO (B-Complex, Brain Fluid Pressure, CIPHER, Thigh Cuff, Zero T2, …), completed (Altered Immunity, Space Gardening, Tempus Pro, …) with links | "NASA research supporting this" cards on each hazard; evidence search; presented as *what NASA is studying*, not as results |
| 4 | **CSA — Monitoring radiation for astronaut health**<br>https://www.asc-csa.gc.ca/eng/news/articles/2026/2026-02-26-monitoring-radiation-astronaut-health.asp (2026-02-26) | News article | $5.5 M contract to Bubble Technology Industries for CANS (compact autonomous neutron spectrometer); neutrons ≈30% of ISS radiation and especially harmful; heritage MOSFET, EVARM, Radi-N/N2; continuous autonomous monitoring; Earth applications | Radiation hazard page and scene; rationale for continuous on-board monitoring; radiation-finding evidence |
| 5 | **CSA — Why do we conduct science experiments in space?**<br>https://www.asc-csa.gc.ca/eng/iss/science/why-do-we-conduct-science-experiments-in-space.asp (modified 2025-10-28) | Educational page | Goal: identify, characterise and mitigate effects on astronauts; deep-space missions mean more weightlessness, more radiation, longer isolation, longer communication delays, less reliance on Earth; parallels with ageing and sedentary lifestyles; ~200 experiments on the ISS at any time | Distance and gravity hazards; offline-first rationale; activity and cardiovascular evidence |

**Licensing / attribution.** NASA content is generally not subject to U.S. copyright (NASA media
guidelines apply; NASA does not endorse CosmicPulse). CSA pages are Government of Canada content under
the CSA terms and conditions; CosmicPulse paraphrases and quotes only short excerpts, with attribution.

---

## NASA Open Science Data Repository (OSDR) — API + datasets

| Item | Detail |
|---|---|
| **Search API** | `GET https://osdr.nasa.gov/osdr/data/search?term=<text>&type=cgene&from=<n>&size=<n>` — verified live. Returns Elasticsearch-style JSON (`hits.total`, `hits.hits[]._source` with `Accession`, `Study Title`, `Study Description`, `organism`, `Mission`, `Study Public Release Date` …). |
| **Data File API** | `GET https://osdr.nasa.gov/osdr/data/osd/files/<OSD number>` — verified live. Returns `studies.{OSD-n}.study_files[]` with `file_name`, `category`, `file_size`, `restricted`, `remote_url` (prefix with `https://osdr.nasa.gov`). |
| **Documentation** | OSDR FAQ (https://science.nasa.gov/reference/osdr-faq/) points to the "OSDR Public API" reference page. That page returned 404 to automated clients on 2026-11-14; parameters were confirmed from its search-indexed copy **and by live calls**. |
| **Access** | Open, no key. Astronaut sequence data are *controlled access* (not used). |
| **CORS** | `Access-Control-Allow-Origin: osdr.nasa.gov`, so browsers cannot call it directly. CosmicPulse proxies through `/api/osdr/search` and `/api/osdr/files` (server-side, 6 h cache, stale fallback); the browser caches the last 12 searches for offline use. |
| **Attribution** | "Data are courtesy of the NASA Open Science Data Repository." Cite OSDR: Gebre SG et al. (2024) *Nucleic Acids Research* 53(D1):D1697–D1710, doi:10.1093/nar/gkae1116. |
| **Currency** | Continuously updated repository of historical/experimental studies. |

### Datasets integrated into the app (bundled offline)

`scripts/fetch-osdr.mjs` downloads the processed files below through the Data File API and writes
[`src/research/data/inspiration4.json`](src/research/data/inspiration4.json) (values copied as published; only reshaped).

| Dataset | File | Analytes used (units) | Collected |
|---|---|---|---|
| **OSD-575** — SpaceX Inspiration4 Blood Serum Metabolic Panel and Immune/Cardiac Cytokine Arrays (released 2024-05-14) | `LSDS-8_Comprehensive_Metabolic_Panel_CMP_TRANSFORMED.csv` | Glucose, calcium, creatinine, BUN (mg/dL); sodium, potassium (mmol/L); albumin, total protein (g/dL); alkaline phosphatase (U/L) + lab reference ranges | L-92, L-44, L-3, R+1, R+45, R+82, R+194 around the 16–18 Sep 2021 mission |
| **OSD-569** — Whole Blood Measurements from the SpaceX Inspiration4 Mission (released 2024-05-14) | `LSDS-7_Complete_Blood_Count_CBC_TRANSFORMED.csv` | WBC, platelets (10³/µL); absolute lymphocytes, neutrophils (cells/µL); haematocrit (%) | Same time points |

Crew are de-identified by OSDR as C001–C004. Related publications (from OSDR metadata): *Collection of
Biospecimens from the Inspiration4 Mission Establishes the Standards for the Space Omics and Medical
Atlas (SOMA)*, Nature Communications 2024, doi:10.1038/s41467-024-48806-z; *The Space Omics and Medical
Atlas (SOMA) and international astronaut biobank*, Nature 2024, doi:10.1038/s41586-024-07639-y.

**Contribution:** the Inspiration4 explorer (Research library) shows real astronaut clinical chemistry
across a spaceflight and compares each crew member with their *own* pre-flight mean — the same principle
as CosmicPulse personal baselines. **Limitation:** four private astronauts on a 3-day flight; never used
as a norm for the user's readings.

Also referenced (found via the Search API, metadata only): **OSD-174** (closed space environment, hair
follicle gene expression, ISS astronauts) and **OSD-53** (whole-blood gene expression in shuttle
astronauts, L-10 vs R+0).

---

## NASA Image and Video Library — imagery

API: `https://images-api.nasa.gov` (`/search`, `/asset/{nasa_id}`), public, no key.
`scripts/fetch-nasa-images.mjs` downloads the images to `public/images/nasa/` and writes
`credits.json` (title, NASA ID, centre, date, source page). IDs used: iss018e030101, iss054e022260,
iss058e005282, GSFC_20171208_Archive_e001210, jsc2006e38928, iss058e003901, PIA19679, iss071e414653,
iss070e062746, s88e5157 (plus the mobile app's editorial images in `public/images/CREDITS.md`).
Imagery is stored locally, so it cannot break after deployment.

---

## Other resources

| Resource | Status in CosmicPulse |
|---|---|
| NASA Human Research Program (https://www.nasa.gov/hrp/) | Parent of resources 1–3. |
| NASA Life Sciences Portal (https://nlsp.nasa.gov/) | **Not integrated.** The page renders client-side (only its title is served to non-browser clients) and no documented public API or downloadable files were found. Listed as a reference only. |
| NASA-STD-3001 Vol. 1 Rev. B | Only the 600 mSv career effective-dose limit is used (reference line and career-dose finding), as already cited by the mobile engine. |
| Dose-rate literature (Zeitlin 2013; Hassler 2014; Zhang 2020) | Typical mission dose rates (≈0.5 LEO, 1.4 lunar surface, 1.8 Mars transit, 0.64 Mars surface mSv/day), used for radiation-event detection and the scenario simulator. |

## What CosmicPulse does **not** claim

- It does not use any NASA "live health API" — none exists in these resources.
- It never derives clinical thresholds from narrative pages. All alert thresholds are **prototype demo
  values**, labelled as such, not NASA flight-medicine limits.
- Linking a finding to a NASA risk means *relevance*, never that the risk has occurred.
