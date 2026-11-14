/**
 * CosmicPulse research & evidence layer — source registry.
 *
 * Every scientific statement CosmicPulse shows (hazard explanations, finding
 * evidence, assistant citations) resolves to a fact in this file, and every
 * fact resolves to a source with full provenance.
 *
 * Rules
 * - Facts are close paraphrases of the source page as retrieved on
 *   `retrievedAt`. `quote: true` marks verbatim text.
 * - Nothing here is a live physiological feed. `nature` says exactly what each
 *   source is (research summary, catalogue, article, dataset, API).
 * - CosmicPulse's own monitoring rationale lives in `hazards.ts` and is
 *   labelled there as prototype interpretation, never as agency guidance.
 */

export type SourceOrg = 'NASA' | 'NASA HRP' | 'NASA OSDR' | 'CSA' | 'Literature';

export type SourceNature =
  | 'research_summary' // narrative page summarising research
  | 'risk_catalogue' // structured list of risks
  | 'research_catalogue' // list of investigations
  | 'news_article'
  | 'educational'
  | 'standard'
  | 'dataset' // downloadable, machine-readable data
  | 'api' // documented, working HTTP API
  | 'publication'
  | 'portal';

export const NATURE_LABEL: Record<SourceNature, string> = {
  research_summary: 'Research summary (web page)',
  risk_catalogue: 'Risk catalogue (web page)',
  research_catalogue: 'Research catalogue (web page)',
  news_article: 'News article',
  educational: 'Educational page',
  standard: 'Technical standard',
  dataset: 'Downloadable dataset',
  api: 'Public API',
  publication: 'Peer-reviewed publication',
  portal: 'Data portal',
};

export type Fact = {
  id: string;
  text: string;
  /** Verbatim from the source. */
  quote?: boolean;
  /** Units / definitions where the fact contains a measurement. */
  units?: string;
};

export type Source = {
  id: string;
  org: SourceOrg;
  title: string;
  url: string;
  nature: SourceNature;
  /** One of the five official Space Apps 2026 challenge resources. */
  challengeResource?: boolean;
  /** Publication date stated on the page (ISO date), if any. */
  published?: string;
  /** "Page last updated" / "Date modified" stated on the page. */
  updated?: string;
  /** When CosmicPulse retrieved and extracted it. */
  retrievedAt: string;
  /** Dataset / study identifiers (OSD accession, DOI …). */
  identifiers?: string[];
  /** When the underlying data was collected (datasets). */
  collected?: string;
  machineReadable: boolean;
  /** Historical / experimental / continuously updated. */
  currency: 'static' | 'historical' | 'experimental' | 'periodically updated' | 'continuously updated';
  usage: string;
  attribution: string;
  summary: string;
  facts: Fact[];
  /** How CosmicPulse uses it. */
  usedFor: string[];
  limitations?: string;
};

const RETRIEVED = '2026-11-14';

const NASA_USAGE =
  'NASA content is generally not subject to U.S. copyright; follow NASA media usage guidelines. NASA does not endorse CosmicPulse.';
const CSA_USAGE =
  'Government of Canada (Canadian Space Agency) content — reuse is governed by the CSA terms and conditions. CosmicPulse paraphrases and quotes short excerpts with attribution.';

export const SOURCES: Source[] = [
  /* ------------------------------ Challenge resource 1 ------------------------------ */
  {
    id: 'nasa-hrp-hazards',
    org: 'NASA HRP',
    title: '5 Hazards of Human Spaceflight',
    url: 'https://www.nasa.gov/hrp/hazards/',
    nature: 'research_summary',
    challengeResource: true,
    updated: '2026-06-12',
    retrievedAt: RETRIEVED,
    machineReadable: false,
    currency: 'periodically updated',
    usage: NASA_USAGE,
    attribution: 'NASA Human Research Program, “5 Hazards of Human Spaceflight”.',
    summary:
      'NASA’s Human Research Program groups the dangers of spaceflight into five hazards — space radiation, isolation and confinement, distance from Earth, gravity fields, and hostile/closed environments — studied with ground analogs, laboratories and the ISS.',
    facts: [
      { id: 'radiation', text: 'Space radiation is invisible and is “considered one of the most hazardous aspects of spaceflight.”', quote: false },
      { id: 'isolation', text: 'Small groups isolated far from Earth for long periods show behavioural responses; crews “must be carefully chosen, trained, and supported” to work as a team for months or years.' },
      { id: 'distance', text: 'The farther crews travel, the harder it is to get instructions, supplies and medical care from Earth; “planning and self-sufficiency will be key to successful deep space missions.”' },
      { id: 'distance-numbers', text: 'Mars is on average about 140 million miles from Earth; a Mars mission would last roughly three years, versus a three-day trip to the Moon.', units: 'miles; years/days' },
      { id: 'gravity', text: 'Crews must adapt to different gravity levels — spacecraft, the Moon, Mars and Earth on return — and the body’s muscles, bones, inner ear and organs must adjust to each.' },
      { id: 'gravity-mars', text: 'Mars gravity is three-eighths of Earth’s, and crews could live there for up to two years.' },
      { id: 'closed', text: 'A spacecraft is both home and machine; its internal ecosystem must be controlled for temperature, pressure, lighting and noise, while microbial communities and crew immune responses are monitored.' },
      { id: 'testbeds', text: 'The hazards are studied using ground-based analogs, laboratories and the International Space Station as test beds.' },
    ],
    usedFor: ['Structure of the Spaceflight Risk Intelligence module (one page per hazard)', 'Hazard explanations shown beside findings', 'Assistant citations'],
    limitations: 'Narrative summary; it does not give clinical thresholds or quantitative risk estimates, so CosmicPulse never derives alert limits from it.',
  },
  /* ------------------------------ Challenge resource 2 ------------------------------ */
  {
    id: 'nasa-hrp-risks',
    org: 'NASA HRP',
    title: 'Risks of Human Spaceflight',
    url: 'https://www.nasa.gov/hrp/risks/',
    nature: 'risk_catalogue',
    challengeResource: true,
    updated: '2026-07-21',
    retrievedAt: RETRIEVED,
    machineReadable: false,
    currency: 'periodically updated',
    usage: NASA_USAGE,
    attribution: 'NASA Human Research Program, “Risks of Human Spaceflight”.',
    summary:
      'Seventeen human-system risks that NASA HRP studies, grouped as human physiology (11), behavioural performance and human factors (5) and space radiation (1). Effects vary by destination (low Earth orbit, Moon, Mars).',
    facts: [
      { id: 'grouping', text: 'Risks are grouped as: Human Physiology (11), Behavioral Performance and Human Factors (5), Space Radiation (1).' },
      { id: 'destination', text: 'The effects of these risks vary depending on whether crews travel to low Earth orbit, the Moon or Mars.' },
      { id: 'approach', text: 'HRP “seeks to understand specific risks associated with the hazards of human spaceflight”; research aims at prevention, mitigation and treatment, and for some risks (e.g. behavioural, sleep) first at better understanding and quantifying the risk.' },
    ],
    usedFor: ['Risk catalogue linking each hazard to named HRP risks', 'Labels on findings (“related HRP risk”)'],
    limitations: 'Lists risk names and short descriptions; no per-person probabilities. CosmicPulse never states that an astronaut “has” one of these risks.',
  },
  /* ------------------------------ Challenge resource 3 ------------------------------ */
  {
    id: 'nasa-hrp-research',
    org: 'NASA HRP',
    title: 'Ongoing HRP Research in Space',
    url: 'https://www.nasa.gov/hrp/ongoing-hrp-research/',
    nature: 'research_catalogue',
    challengeResource: true,
    updated: '2026-08-18',
    retrievedAt: RETRIEVED,
    machineReadable: false,
    currency: 'periodically updated',
    usage: NASA_USAGE,
    attribution: 'NASA Human Research Program, “Ongoing HRP Research in Space”.',
    summary:
      'Human investigations on Artemis II (ARCHeR, Immune Biomarkers, Standard Measures), in low Earth orbit (e.g. CIPHER, Thigh Cuff, Zero T2, Brain Fluid Pressure) and completed studies (e.g. Altered Immunity, Space Gardening, Tempus Pro).',
    facts: [
      { id: 'artemis', text: 'Artemis II human investigations: ARCHeR (crew well-being, activity and sleep in deep space), Immune Biomarkers (blood and saliva) and Artemis II Standard Measures (consistent health data for a research data bank).' },
      { id: 'leo', text: 'Low-Earth-orbit investigations include B-Complex, Brain Fluid Pressure, CIPHER, Simulating Manual Piloting for Moon Landings, Spacecraft Occupant Protection, Spinal Fluid Biomarkers, Standard Measures, Thigh Cuff, Venous Haemostasis and Zero T2.' },
      { id: 'past', text: 'Past investigations include Altered Immunity, Food Acceptability, Food Physiology, Omics Archive, Space Gardening, Spinal Health, Tempus Pro and Veggie Monitoring.' },
    ],
    usedFor: ['Study cards linked from each hazard', '“Why CosmicPulse watches this” evidence on findings'],
    limitations: 'Describes study aims, not results; CosmicPulse presents them as “what NASA is studying”, never as findings.',
  },
  /* ------------------------------ Challenge resource 4 ------------------------------ */
  {
    id: 'csa-radiation-monitoring',
    org: 'CSA',
    title: 'Monitoring radiation for astronaut health',
    url: 'https://www.asc-csa.gc.ca/eng/news/articles/2026/2026-02-26-monitoring-radiation-astronaut-health.asp',
    nature: 'news_article',
    challengeResource: true,
    published: '2026-02-26',
    updated: '2026-02-26',
    retrievedAt: RETRIEVED,
    machineReadable: false,
    currency: 'static',
    usage: CSA_USAGE,
    attribution: 'Canadian Space Agency, “Monitoring radiation for astronaut health” (2026-02-26).',
    summary:
      'The CSA awarded Bubble Technology Industries $5.5 million to continue developing CANS, a compact autonomous neutron spectrometer. Neutrons contribute about 30% of total radiation on the ISS and can cause serious biological damage.',
    facts: [
      { id: 'challenge', text: 'Radiation is one of the key challenges faced by astronauts living and working beyond the protective shield of Earth’s atmosphere.' },
      { id: 'cans', text: 'The CSA awarded a $5.5 million contract to Bubble Technology Industries for continued development of the Canadian Active Neutron Spectrometer (CANS), a compact and autonomous instrument that measures neutron radiation exposure in space.', units: 'CAD' },
      { id: 'neutron-share', text: 'Neutron radiation contributes about 30% of total radiation on the ISS and is especially harmful because it can cause serious biological damage and requires specialised protective measures.', units: '% of total ISS radiation' },
      { id: 'heritage', text: 'Canada’s ISS radiation-detection experiments include MOSFET, EVARM, Radi-N and Radi-N2; bubble detectors were a predecessor to CANS.' },
      { id: 'continuous', text: 'CANS improves on earlier methods by working continuously and autonomously; its data could help develop better measures to reduce risks to astronauts’ health.' },
      { id: 'earth', text: 'Potential Earth applications include cancer therapy, radiation protection for aircrews, nuclear threat detection and public safety.' },
    ],
    usedFor: ['Radiation hazard page', 'Rationale for continuous, autonomous on-board monitoring', 'Environment → radiation evidence'],
    limitations: 'Describes an instrument under development; it provides no dose data. CosmicPulse’s radiation readings are simulated unless a real dosimeter feed is connected.',
  },
  /* ------------------------------ Challenge resource 5 ------------------------------ */
  {
    id: 'csa-why-science',
    org: 'CSA',
    title: 'Why do we conduct science experiments in space?',
    url: 'https://www.asc-csa.gc.ca/eng/iss/science/why-do-we-conduct-science-experiments-in-space.asp',
    nature: 'educational',
    challengeResource: true,
    updated: '2025-10-28',
    retrievedAt: RETRIEVED,
    machineReadable: false,
    currency: 'periodically updated',
    usage: CSA_USAGE,
    attribution: 'Canadian Space Agency, “Why do we conduct science experiments in space?”.',
    summary:
      'ISS science helps identify, characterise and mitigate the effects of spaceflight on astronauts. Moon and Mars missions mean more weightlessness, more radiation, longer isolation, longer communication delays and less reliance on Earth.',
    facts: [
      { id: 'goal', text: 'Research aims to better understand the risks of human spaceflight and help find countermeasures and treatments — to identify, characterise and mitigate the effects on astronauts’ health.' },
      { id: 'deep-space-risks', text: 'Missions to the Moon and Mars mean longer trips and more risks: more time in weightlessness, more exposure to radiation, longer isolation far from home, increased communication delays with Earth, and less ability to rely on Earth for food, materials and emergency medical assistance.' },
      { id: 'aging', text: 'Effects observed in astronauts resemble accelerated ageing and the health problems of a sedentary lifestyle; six months in space gives data that would take years to gather on Earth.' },
      { id: 'systems', text: 'Canadian scientists use space to study bones, heart, blood vessels and the brain, with findings relevant to balance problems, osteoporosis, cardiovascular disorders and type 2 diabetes.' },
      { id: 'count', text: 'On average about 200 international experiments are on board the ISS at any given time.' },
    ],
    usedFor: ['Distance-from-Earth and gravity hazard pages', 'Offline-first and self-sufficiency rationale', 'Evidence for monitoring activity and cardiovascular trends'],
  },
  /* --------------------------------- Data repositories --------------------------------- */
  {
    id: 'osdr-api',
    org: 'NASA OSDR',
    title: 'NASA Open Science Data Repository — public Search and Data File APIs',
    url: 'https://osdr.nasa.gov/bio/repo',
    nature: 'api',
    retrievedAt: RETRIEVED,
    machineReadable: true,
    currency: 'continuously updated',
    usage: 'Open access; most data need no authentication. Astronaut sequence data are controlled access. Acknowledge: “Data are courtesy of the NASA Open Science Data Repository.”',
    attribution: 'NASA Open Science Data Repository (OSDR).',
    summary:
      'Documented REST endpoints used by CosmicPulse (server-side proxy): Search API `GET https://osdr.nasa.gov/osdr/data/search?term=…&type=cgene&from=&size=` and Data File API `GET https://osdr.nasa.gov/osdr/data/osd/files/{OSD number}`. Both verified live on 2026-11-14.',
    facts: [
      { id: 'scope', text: 'OSDR (GeneLab + Ames Life Sciences Data Archive) provides space-biology data on how terrestrial life responds biologically and physiologically to spaceflight.' },
      { id: 'access', text: 'Most OSDR data are accessible without authentication; for astronaut-derived studies processed data are public but sequence data are controlled access.' },
      { id: 'cors', text: 'The API does not allow cross-origin browser requests (Access-Control-Allow-Origin: osdr.nasa.gov), so CosmicPulse queries it through its own server route and caches results for offline use.' },
    ],
    usedFor: ['Live dataset search in Research & Evidence', 'Building the bundled Inspiration4 snapshot (scripts/fetch-osdr.mjs)'],
    limitations: 'Historical/experimental study data — not a physiological monitoring feed. No astronaut telemetry is available from OSDR.',
  },
  {
    id: 'osdr-faq',
    org: 'NASA',
    title: 'OSDR Frequently Asked Questions',
    url: 'https://science.nasa.gov/reference/osdr-faq/',
    nature: 'educational',
    updated: '2025-09-23',
    retrievedAt: RETRIEVED,
    machineReadable: false,
    currency: 'periodically updated',
    usage: NASA_USAGE,
    attribution: 'NASA Science, “OSDR Frequently Asked Questions”.',
    summary: 'Explains OSDR (GeneLab + ALSDA), open vs controlled access, how to cite datasets and OSDR, and the public API / AWS S3 bucket.',
    facts: [
      { id: 'cite', text: 'Preferred citation for OSDR: Gebre SG et al. (2024) “NASA Open Science Data Repository: Open Science for Life in Space”, Nucleic Acids Research 53(D1):D1697–D1710, doi:10.1093/nar/gkae1116.' },
      { id: 'ack', text: 'Suggested acknowledgement: “Data are courtesy of the NASA Open Science Data Repository.”', quote: true },
    ],
    usedFor: ['Attribution text for every OSDR-derived view'],
  },
  {
    id: 'osd-575',
    org: 'NASA OSDR',
    title: 'SpaceX Inspiration4 Blood Serum Metabolic Panel and Immune/Cardiac Cytokine Arrays (OSD-575)',
    url: 'https://osdr.nasa.gov/bio/repo/data/studies/OSD-575',
    nature: 'dataset',
    published: '2024-05-14',
    retrievedAt: RETRIEVED,
    identifiers: ['OSD-575', 'LSDS-8', 'doi:10.1038/s41467-024-48806-z', 'doi:10.1038/s41586-024-07639-y'],
    collected: 'Pre-flight L-92, L-44, L-3 and post-flight R+1, R+45, R+82 (R+194 in some files) around the 16–18 Sept 2021 mission',
    machineReadable: true,
    currency: 'historical',
    usage: 'Open-access processed data. Acknowledge NASA OSDR and cite the study publications.',
    attribution: 'Data are courtesy of the NASA Open Science Data Repository (OSD-575).',
    summary:
      'Comprehensive metabolic panel (Quest Diagnostics) and cytokine panels from serum of the four Inspiration4 crew (3-day LEO mission, Sept 2021), de-identified as C001–C004.',
    facts: [
      { id: 'design', text: 'Inspiration4 was a 3-day mission with four private astronauts to low Earth orbit in September 2021; serum was collected pre-flight (L-92, L-44, L-3) and post-flight (R+1, R+45, R+82).' },
      { id: 'units', text: 'CMP analytes in this snapshot: glucose, calcium, creatinine, BUN (mg/dL); sodium, potassium (mmol/L); albumin, total protein (g/dL); alkaline phosphatase (U/L), each with the laboratory reference range.', units: 'mg/dL, mmol/L, g/dL, U/L' },
    ],
    usedFor: ['Inspiration4 dataset explorer (real NASA data, bundled offline)', 'Example of individual baselines: each crew member’s pre-flight values vs return'],
    limitations: 'Four civilians on a 3-day flight — not representative of long-duration crews. Shown as research context only; never compared with the user’s readings as if it were a norm.',
  },
  {
    id: 'osd-569',
    org: 'NASA OSDR',
    title: 'Whole Blood Measurements from the SpaceX Inspiration4 Mission (OSD-569)',
    url: 'https://osdr.nasa.gov/bio/repo/data/studies/OSD-569',
    nature: 'dataset',
    published: '2024-05-14',
    retrievedAt: RETRIEVED,
    identifiers: ['OSD-569', 'LSDS-7'],
    collected: 'Same pre-/post-flight time points as OSD-575',
    machineReadable: true,
    currency: 'historical',
    usage: 'Open-access processed data (sequence data in this study are controlled access and not used). Acknowledge NASA OSDR.',
    attribution: 'Data are courtesy of the NASA Open Science Data Repository (OSD-569).',
    summary: 'Complete blood count and omics from whole blood of the Inspiration4 crew; CosmicPulse uses only the processed CBC table.',
    facts: [{ id: 'cbc', text: 'CBC analytes in this snapshot: white blood cells and platelets (10³/µL), absolute lymphocytes and neutrophils (cells/µL), haematocrit (%), with reference ranges.', units: '10³/µL, cells/µL, %' }],
    usedFor: ['Inspiration4 dataset explorer (immune-related cell counts — closed-environment hazard context)'],
    limitations: 'As OSD-575.',
  },
  {
    id: 'osd-174',
    org: 'NASA OSDR',
    title: 'Effects of a Closed Space Environment on Gene Expression in Hair Follicles of Astronauts in the International Space Station (OSD-174)',
    url: 'https://osdr.nasa.gov/bio/repo/data/studies/OSD-174',
    nature: 'dataset',
    retrievedAt: RETRIEVED,
    identifiers: ['OSD-174'],
    machineReadable: true,
    currency: 'historical',
    usage: 'Open-access processed data; acknowledge NASA OSDR.',
    attribution: 'Data are courtesy of the NASA Open Science Data Repository (OSD-174).',
    summary: 'Gene-expression study of astronaut hair follicles aboard the ISS, framed around the closed space environment. Found via the OSDR Search API.',
    facts: [{ id: 'title', text: 'OSDR lists OSD-174 as a spaceflight study of the effects of a closed space environment on hair-follicle gene expression in ISS astronauts (Homo sapiens).' }],
    usedFor: ['Hostile/closed environment hazard — example of molecular-level human data in OSDR'],
    limitations: 'Omics data; not interpretable as a health indicator in CosmicPulse.',
  },
  {
    id: 'osd-53',
    org: 'NASA OSDR',
    title: 'Spaceflight Modulates Gene Expression in Astronauts (OSD-53)',
    url: 'https://osdr.nasa.gov/bio/repo/data/studies/OSD-53',
    nature: 'dataset',
    retrievedAt: RETRIEVED,
    identifiers: ['OSD-53'],
    collected: 'Whole blood 10 days before shuttle launch (L-10) and hours after return (R+0)',
    machineReadable: true,
    currency: 'historical',
    usage: 'Open-access processed data; acknowledge NASA OSDR.',
    attribution: 'Data are courtesy of the NASA Open Science Data Repository (OSD-53).',
    summary: 'Whole-blood transcription profiling of NASA shuttle astronauts before launch and after landing.',
    facts: [{ id: 'protocol', text: 'Consenting astronauts from several shuttle missions provided whole blood 10 days before launch (L-10) and several hours after return (R+0) for transcription profiling.' }],
    usedFor: ['Gravity / immune context — example of pre-flight vs post-flight comparisons (the same idea as a personal baseline)'],
  },
  {
    id: 'nlsp',
    org: 'NASA',
    title: 'NASA Life Sciences Portal (NLSP)',
    url: 'https://nlsp.nasa.gov/',
    nature: 'portal',
    retrievedAt: RETRIEVED,
    machineReadable: false,
    currency: 'periodically updated',
    usage: 'Interactive portal; human-subject data requests are handled through the portal’s own processes.',
    attribution: 'NASA Life Sciences Portal.',
    summary: 'NASA life-sciences portal. On 2026-11-14 the home page returned only its title to non-browser clients (content is rendered client-side); no documented public API was found.',
    facts: [],
    usedFor: ['Listed as a reference; not integrated (no verified machine interface)'],
    limitations: 'Not integrated: no verified API or downloadable files, so CosmicPulse does not claim any data from it.',
  },
  /* ------------------------------ Standards & literature used by the engine ------------------------------ */
  {
    id: 'nasa-std-3001',
    org: 'NASA',
    title: 'NASA-STD-3001 Volume 1: Crew Health (Rev. B)',
    url: 'https://www.nasa.gov/reference/nasa-std-3001/',
    nature: 'standard',
    retrievedAt: 'Cited by the CosmicPulse mobile engine (src/engine/mission-rules.ts)',
    machineReadable: false,
    currency: 'periodically updated',
    usage: NASA_USAGE,
    attribution: 'NASA-STD-3001 Vol. 1 Rev. B.',
    summary: 'NASA’s crew health standard. CosmicPulse uses only its career effective-dose limit (600 mSv) as a reference line on the radiation chart.',
    facts: [{ id: 'career', text: 'Career effective radiation dose limit of 600 mSv.', units: 'mSv (effective dose)' }],
    usedFor: ['Cumulative-dose reference line and career-dose finding'],
    limitations: 'All other CosmicPulse thresholds are prototype demo values, not NASA flight-medicine limits.',
  },
  {
    id: 'lit-dose-rates',
    org: 'Literature',
    title: 'Measured mission dose rates (MSL RAD cruise & surface; Chang’e-4 LND)',
    url: 'https://doi.org/10.1126/science.1235989',
    nature: 'publication',
    retrievedAt: 'Cited by the CosmicPulse mobile engine (src/engine/mission-rules.ts)',
    identifiers: ['Zeitlin et al., Science 2013', 'Hassler et al., Science 2014', 'Zhang et al., Science Advances 2020'],
    machineReadable: false,
    currency: 'historical',
    usage: 'Cite the publications.',
    attribution: 'Zeitlin et al. 2013; Hassler et al. 2014; Zhang et al. 2020.',
    summary: 'Approximate daily effective dose rates used to recognise radiation events: ISS/LEO ≈0.5, lunar surface ≈1.4, Mars transit ≈1.8, Mars surface ≈0.64 mSv/day.',
    facts: [{ id: 'rates', text: 'Typical daily dose rates: ISS/LEO ~0.3–0.8 mSv/day; lunar surface ~1.4 mSv/day; Mars transit ~1.8 mSv/day; Mars surface ~0.64 mSv/day.', units: 'mSv/day' }],
    usedFor: ['Expected dose rate per mission type; radiation event rule (≥ 3× expected rate)'],
  },
];

export const SOURCE_BY_ID = new Map(SOURCES.map((s) => [s.id, s]));

export function source(id: string): Source {
  const s = SOURCE_BY_ID.get(id);
  if (!s) throw new Error(`Unknown evidence source: ${id}`);
  return s;
}

/** Reference to one fact: "sourceId#factId" or just "sourceId". */
export type EvidenceRef = string;

export function resolveRef(ref: EvidenceRef): { source: Source; fact?: Fact } | undefined {
  const [sid, fid] = ref.split('#');
  const s = SOURCE_BY_ID.get(sid);
  if (!s) return undefined;
  return { source: s, fact: fid ? s.facts.find((f) => f.id === fid) : undefined };
}

export const CHALLENGE_SOURCES = SOURCES.filter((s) => s.challengeResource);
