import type { EnvironmentKind, VitalType } from '@/data/types';
import type { EvidenceRef } from './sources';

/**
 * Spaceflight Risk Intelligence — the five NASA HRP hazards.
 *
 * Two kinds of content are kept strictly apart:
 *  - `science` / `risks` / `studies`: what NASA and the CSA say, each with an
 *    evidence reference (see sources.ts).
 *  - `monitoring` / `warningSigns` / `prevention` / `actions` / `escalation`:
 *    CosmicPulse PROTOTYPE monitoring rationale. It is shown with a
 *    "CosmicPulse prototype guidance — not NASA flight-medicine guidance"
 *    label and points to approved protocols (AEG-*, demo/unapproved KB) rather
 *    than inventing procedures.
 */

export type HazardId = 'radiation' | 'isolation' | 'distance' | 'gravity' | 'environment';

export type HrpRisk = {
  id: string;
  /** Exact name from nasa.gov/hrp/risks. */
  name: string;
  group: 'Human Physiology' | 'Behavioral Performance and Human Factors' | 'Space Radiation';
  hazards: HazardId[];
  /** Metrics CosmicPulse can observe that are relevant (not diagnostic) to this risk. */
  metrics: VitalType[];
};

export const HRP_RISKS: HrpRisk[] = [
  { id: 'immune', name: 'Risk of Altered Immune System Responses', group: 'Human Physiology', hazards: ['environment', 'radiation'], metrics: ['temperature', 'heart_rate'] },
  { id: 'sensorimotor', name: 'Risk of Altered Sensorimotor and Vestibular Function', group: 'Human Physiology', hazards: ['gravity'], metrics: [] },
  { id: 'cardiovascular', name: 'Risk of Cardiovascular Adaptations', group: 'Human Physiology', hazards: ['gravity', 'radiation'], metrics: ['heart_rate', 'blood_pressure', 'hrv'] },
  { id: 'dcs', name: 'Risk of Decompression Sickness', group: 'Human Physiology', hazards: ['environment'], metrics: [] },
  { id: 'microbe', name: 'Risk of Host-Microorganism Interactions', group: 'Human Physiology', hazards: ['environment'], metrics: ['temperature'] },
  { id: 'hypoxia', name: 'Risk of Hypoxia', group: 'Human Physiology', hazards: ['environment'], metrics: ['spo2', 'respiratory_rate', 'heart_rate'] },
  { id: 'nutrition', name: 'Risk of Inadequate Food and Nutrition', group: 'Human Physiology', hazards: ['distance'], metrics: ['weight', 'glucose'] },
  { id: 'eva', name: 'Risk of Injury and Compromised Performance from Spacewalks', group: 'Human Physiology', hazards: ['environment', 'gravity'], metrics: ['heart_rate'] },
  { id: 'fitness', name: 'Risk of Reduced Cardiorespiratory and Musculoskeletal Fitness', group: 'Human Physiology', hazards: ['gravity'], metrics: ['heart_rate', 'steps', 'weight'] },
  { id: 'sans', name: 'Risk of Spaceflight Associated Neuro-ocular Syndrome (SANS)', group: 'Human Physiology', hazards: ['gravity'], metrics: [] },
  { id: 'bone', name: 'Risk of Spaceflight-Induced Bone Changes', group: 'Human Physiology', hazards: ['gravity'], metrics: ['steps'] },
  { id: 'behavioral', name: 'Risk of Behavioral Changes and Psychiatric Disorders', group: 'Behavioral Performance and Human Factors', hazards: ['isolation', 'distance'], metrics: ['sleep', 'hrv'] },
  { id: 'teamwork', name: 'Risk of Inadequate Teamwork', group: 'Behavioral Performance and Human Factors', hazards: ['isolation'], metrics: [] },
  { id: 'sleep', name: 'Risk of Inadequate Sleep and Irregular Schedules', group: 'Behavioral Performance and Human Factors', hazards: ['isolation', 'environment'], metrics: ['sleep', 'hrv', 'heart_rate'] },
  { id: 'ops-support', name: 'Risk of Inadequate Systems Operations Support', group: 'Behavioral Performance and Human Factors', hazards: ['distance'], metrics: [] },
  { id: 'dynamic-loads', name: 'Risk of Injury from Dynamic Loads', group: 'Behavioral Performance and Human Factors', hazards: ['gravity'], metrics: [] },
  { id: 'cancer', name: 'Risk of Radiation-Induced Cancers', group: 'Space Radiation', hazards: ['radiation'], metrics: [] },
];

export type HrpStudy = {
  id: string;
  name: string;
  aim: string;
  setting: 'Artemis II' | 'Low Earth orbit' | 'Completed';
  url: string;
  hazards: HazardId[];
};

/** From nasa.gov/hrp/ongoing-hrp-research (retrieved 2026-11-14). */
export const HRP_STUDIES: HrpStudy[] = [
  { id: 'archer', name: 'ARCHeR', aim: 'Crew well-being, activity and sleep patterns in deep space.', setting: 'Artemis II', url: 'https://www.nasa.gov/reference/archer/', hazards: ['isolation', 'distance'] },
  { id: 'immune-biomarkers', name: 'Immune Biomarkers', aim: 'Blood and saliva samples to see how deep space changes the immune system.', setting: 'Artemis II', url: 'https://www.nasa.gov/reference/immune-biomarkers/', hazards: ['environment', 'radiation'] },
  { id: 'a2-standard-measures', name: 'Artemis II Standard Measures', aim: 'Consistent health information added to a data bank for future research.', setting: 'Artemis II', url: 'https://www.nasa.gov/reference/artemis-ii-standard-measures/', hazards: ['distance', 'isolation', 'gravity'] },
  { id: 'b-complex', name: 'B-Complex', aim: 'Whether a daily B-vitamin supplement prevents or lessens brain and eye changes.', setting: 'Low Earth orbit', url: 'https://www.nasa.gov/reference/b-complex/', hazards: ['gravity'] },
  { id: 'brain-fluid', name: 'Brain Fluid Pressure', aim: 'Skull fluid pressure and changes to astronauts’ eyes and brains.', setting: 'Low Earth orbit', url: 'https://www.nasa.gov/reference/brain-fluid-pressure/', hazards: ['gravity'] },
  { id: 'cipher', name: 'CIPHER', aim: 'How multiple body systems change during orbital flight.', setting: 'Low Earth orbit', url: 'https://www.nasa.gov/reference/cipher/', hazards: ['gravity', 'radiation', 'environment', 'isolation'] },
  { id: 'piloting', name: 'Simulating Manual Piloting for Moon Landings', aim: 'How gravity transitions may affect piloting for future Moon landings.', setting: 'Low Earth orbit', url: 'https://www.nasa.gov/reference/simulating-manual-piloting-for-moon-landings/', hazards: ['gravity'] },
  { id: 'occupant', name: 'Spacecraft Occupant Protection', aim: 'Crew discomfort during re-entry, combined with spacecraft sensor data.', setting: 'Low Earth orbit', url: 'https://www.nasa.gov/reference/spacecraft-occupant-protection/', hazards: ['gravity'] },
  { id: 'spinal-fluid', name: 'Spinal Fluid Biomarkers', aim: 'Spinal-fluid substances linked to space-related brain and eye changes.', setting: 'Low Earth orbit', url: 'https://www.nasa.gov/reference/spinal-fluid-biomarkers/', hazards: ['gravity'] },
  { id: 'standard-measures', name: 'Standard Measures', aim: 'Consistent physiological and psychological measurements of crew members.', setting: 'Low Earth orbit', url: 'https://www.nasa.gov/reference/standard-measures/', hazards: ['isolation', 'gravity', 'environment'] },
  { id: 'thigh-cuff', name: 'Thigh Cuff', aim: 'Whether tight thigh cuffs keep fluid in the legs to help prevent eye disorders.', setting: 'Low Earth orbit', url: 'https://www.nasa.gov/reference/thigh-cuff/', hazards: ['gravity'] },
  { id: 'venous', name: 'Venous Haemostasis', aim: 'Physical differences that may affect blood flow and clotting in space.', setting: 'Low Earth orbit', url: 'https://www.nasa.gov/reference/venous-haemostasis/', hazards: ['gravity'] },
  { id: 'zero-t2', name: 'Zero T2', aim: 'Exercise in space without a treadmill and its effect on health and performance.', setting: 'Low Earth orbit', url: 'https://www.nasa.gov/reference/zero-t2/', hazards: ['gravity'] },
  { id: 'altered-immunity', name: 'Altered Immunity', aim: 'Blood, saliva and urine samples to study how spaceflight alters immunity.', setting: 'Completed', url: 'https://www.nasa.gov/missions/station/scientists-probe-how-long-term-spaceflight-alters-immunity/', hazards: ['environment'] },
  { id: 'food-acceptability', name: 'Food Acceptability', aim: 'How long-term spaceflight affects food appeal.', setting: 'Completed', url: 'https://www.nasa.gov/humans-in-space/how-does-spaceflight-change-food-appeal/', hazards: ['distance', 'isolation'] },
  { id: 'food-physiology', name: 'Food Physiology', aim: 'Whether an enhanced spaceflight diet helps astronauts adapt.', setting: 'Completed', url: 'https://www.nasa.gov/missions/station/enhanced-diet-may-help-astronauts-adapt-to-spaceflight/', hazards: ['distance'] },
  { id: 'omics-archive', name: 'Omics Archive', aim: 'Biological samples documenting molecular changes from long-duration spaceflight.', setting: 'Completed', url: 'https://www.nasa.gov/reference/omics-archive/', hazards: ['radiation', 'environment'] },
  { id: 'space-gardening', name: 'Space Gardening', aim: 'Whether growing vegetables in space eases isolation and confinement.', setting: 'Completed', url: 'https://www.nasa.gov/humans-in-space/can-space-gardening-help-astronauts-cope-with-isolation/', hazards: ['isolation'] },
  { id: 'spinal-health', name: 'Spinal Health', aim: 'Spine scans to inform strategies against bone and muscle loss.', setting: 'Completed', url: 'https://www.nasa.gov/missions/station/astronauts-spines-under-scrutiny/', hazards: ['gravity'] },
  { id: 'tempus-pro', name: 'Tempus Pro', aim: 'Testing a commercial telemedicine device for remote health diagnoses.', setting: 'Completed', url: 'https://www.nasa.gov/reference/tempus-pro/', hazards: ['distance'] },
  { id: 'veggie-monitoring', name: 'Veggie Monitoring', aim: 'Microbial growth on crop storage hardware, for plant production and crew safety.', setting: 'Completed', url: 'https://www.nasa.gov/missions/station/researchers-put-space-garden-microbes-under-the-microscope/', hazards: ['environment'] },
];

export type Hazard = {
  id: HazardId;
  name: string;
  short: string;
  /** Agency science, each line with an evidence reference. */
  science: { text: string; ref: EvidenceRef }[];
  /** Physiological / behavioural risks (named HRP risks). */
  riskIds: string[];
  studyIds: string[];
  datasetIds: string[];
  /** Health indicators CosmicPulse watches for this hazard. */
  indicators: { metric?: VitalType; env?: EnvironmentKind; behavioural?: 'mood' | 'stress' | 'energy' | 'confinement' | 'exercise' | 'comms'; label: string; why: string }[];
  /* ------------- CosmicPulse prototype guidance (labelled in UI) ------------- */
  warningSigns: string[];
  prevention: string[];
  actions: string[];
  escalation: string[];
  protocolIds: string[];
};

export const HAZARDS: Hazard[] = [
  {
    id: 'radiation',
    name: 'Space radiation',
    short: 'Invisible exposure beyond Earth’s protective atmosphere and magnetic field.',
    science: [
      { text: 'Radiation is invisible and considered one of the most hazardous aspects of spaceflight.', ref: 'nasa-hrp-hazards#radiation' },
      { text: 'NASA HRP lists the Risk of Radiation-Induced Cancers as the space-radiation risk it studies.', ref: 'nasa-hrp-risks#grouping' },
      { text: 'Neutron radiation is about 30% of total radiation on the ISS and is especially harmful because it can cause serious biological damage.', ref: 'csa-radiation-monitoring#neutron-share' },
      { text: 'The CSA is developing CANS, a compact neutron spectrometer that works continuously and autonomously, to better understand exposure and reduce risks.', ref: 'csa-radiation-monitoring#continuous' },
      { text: 'Typical daily dose rates range from ~0.5 mSv/day in LEO to ~1.8 mSv/day in deep-space transit.', ref: 'lit-dose-rates#rates' },
      { text: 'NASA-STD-3001 sets a career effective-dose limit of 600 mSv.', ref: 'nasa-std-3001#career' },
    ],
    riskIds: ['cancer', 'cardiovascular', 'immune'],
    studyIds: ['omics-archive', 'immune-biomarkers', 'cipher'],
    datasetIds: ['osd-575'],
    indicators: [
      { env: 'radiation_dose_rate', label: 'Dose rate (mSv/day)', why: 'A sudden rise above the mission’s expected rate signals a radiation event (e.g. solar particle event).' },
      { env: 'radiation_cumulative', label: 'Cumulative dose (mSv)', why: 'Tracked against the 600 mSv career limit.' },
      { metric: 'temperature', label: 'Body temperature', why: 'Context during and after an exposure event; no single vital is a radiation biomarker.' },
      { behavioural: 'energy', label: 'Fatigue / energy check-ins', why: 'Self-reported symptoms are recorded alongside any exposure event for medical review.' },
    ],
    warningSigns: [
      'Dose rate ≥ 3× the expected mission rate (CosmicPulse event rule).',
      'Cumulative dose approaching the career limit.',
      'Nausea, vomiting, unusual fatigue or skin changes after a recorded radiation event.',
    ],
    prevention: ['Keep personal dosimetry worn and synchronised.', 'Know the shelter location and procedure before EVA or a forecast solar event.'],
    actions: ['On a radiation-event alert, follow AEG-EN-002 (radiation shelter) and record symptoms.', 'Log any symptoms in a check-in so the exposure timeline is complete.'],
    escalation: ['Any symptoms after a radiation event → crew medical officer now; flight surgeon at next link.', 'Event-level dose rate → follow the shelter protocol; ground notified automatically at autonomy level 4.'],
    protocolIds: ['AEG-EN-002'],
  },
  {
    id: 'isolation',
    name: 'Isolation & confinement',
    short: 'Small crews, long durations, confined habitats.',
    science: [
      { text: 'Small groups isolated far from Earth for long periods show behavioural responses; crews must be carefully chosen, trained and supported.', ref: 'nasa-hrp-hazards#isolation' },
      { text: 'Related HRP risks include Behavioral Changes and Psychiatric Disorders, Inadequate Teamwork, and Inadequate Sleep and Irregular Schedules.', ref: 'nasa-hrp-risks#grouping' },
      { text: 'For behavioural and sleep risks, HRP research first works to better understand and quantify the risk.', ref: 'nasa-hrp-risks#approach' },
      { text: 'ARCHeR on Artemis II studies crew well-being, activity and sleep patterns in deep space.', ref: 'nasa-hrp-research#artemis' },
      { text: 'Moon and Mars missions bring longer periods of isolation far from home.', ref: 'csa-why-science#deep-space-risks' },
    ],
    riskIds: ['behavioral', 'teamwork', 'sleep'],
    studyIds: ['archer', 'space-gardening', 'standard-measures', 'food-acceptability'],
    datasetIds: [],
    indicators: [
      { metric: 'sleep', label: 'Sleep duration & quality', why: 'Short or disrupted sleep is both a risk in itself and an early behavioural signal.' },
      { behavioural: 'mood', label: 'Mood check-ins', why: 'A sustained decline relative to your own history is more informative than any single day.' },
      { behavioural: 'stress', label: 'Stress check-ins', why: 'Sustained high stress alongside poor sleep is a pattern worth discussing early.' },
      { behavioural: 'confinement', label: 'Confinement wellbeing check-in', why: 'Self-reported connection, monotony and team climate.' },
      { metric: 'hrv', label: 'Heart-rate variability', why: 'HRV below your baseline often accompanies stress and poor recovery (non-specific).' },
      { behavioural: 'exercise', label: 'Exercise minutes', why: 'Declining activity can accompany low mood and also removes a protective routine.' },
    ],
    warningSigns: ['Several nights of short sleep (< 6 h) or rising disruptions.', 'Mood trending down and stress trending up over a week.', 'Reduced exercise or social participation compared with your usual pattern.'],
    prevention: ['Protect the sleep period and keep a regular schedule where operations allow.', 'Keep exercise and private family/psychological conferences on the timeline.', 'Use regular check-ins so changes are visible early.'],
    actions: ['Review AEG-BH-001 (sleep disruption and fatigue).', 'Request a private conference with the flight psychologist via Medical › Comms.', 'Talk with the crew medical officer if the pattern persists beyond a few days.'],
    escalation: ['Thoughts of self-harm or feeling unsafe → Emergency and crew medical officer immediately.', 'Persistent sleep loss, low mood or high stress over a week → crew medical officer and flight psychologist.'],
    protocolIds: ['AEG-BH-001'],
  },
  {
    id: 'distance',
    name: 'Distance from Earth',
    short: 'Communication delay, limited resupply and medical evacuation.',
    science: [
      { text: 'The farther crews travel, the harder it is to get instructions, supplies and medical care from Earth; planning and self-sufficiency are key.', ref: 'nasa-hrp-hazards#distance' },
      { text: 'Mars is on average ~140 million miles away; a Mars mission would last about three years.', ref: 'nasa-hrp-hazards#distance-numbers' },
      { text: 'Deep-space missions mean increased communication delays and less ability to rely on Earth for food, materials and emergency medical assistance.', ref: 'csa-why-science#deep-space-risks' },
      { text: 'Tempus Pro tested a commercial telemedicine device for remote health diagnoses.', ref: 'nasa-hrp-research#past' },
    ],
    riskIds: ['ops-support', 'nutrition', 'behavioral'],
    studyIds: ['tempus-pro', 'food-physiology', 'food-acceptability', 'archer'],
    datasetIds: [],
    indicators: [
      { behavioural: 'comms', label: 'Ground link & delay', why: 'Determines whether ground can respond in time; CosmicPulse keeps working offline.' },
      { metric: 'weight', label: 'Body mass', why: 'A sustained loss can indicate inadequate intake on long missions.' },
      { metric: 'glucose', label: 'Blood glucose (if measured)', why: 'Context for nutrition and energy balance.' },
    ],
    warningSigns: ['Loss of signal during a developing finding.', 'Steady weight loss over weeks.', 'Medical kit items low or expired.'],
    prevention: ['Keep the on-board engine, protocols and evidence library cached for offline use.', 'Check inventory and expiry regularly.', 'Record readings so on-board assessments have a baseline.'],
    actions: ['When the link is down, rely on on-board findings and approved protocols; messages queue automatically.', 'Prepare a medical summary in advance of the next communication window.'],
    escalation: ['Urgent findings never wait for the link: follow the linked protocol and alert the crew medical officer.'],
    protocolIds: ['AEG-EM-001'],
  },
  {
    id: 'gravity',
    name: 'Gravity fields',
    short: 'Weightlessness, partial gravity and re-adaptation to Earth.',
    science: [
      { text: 'Crews adapt to different gravity levels — spacecraft, Moon, Mars and Earth — and muscles, bones, inner ear and organs must adjust each time.', ref: 'nasa-hrp-hazards#gravity' },
      { text: 'Mars gravity is three-eighths of Earth’s; crews could live there for up to two years.', ref: 'nasa-hrp-hazards#gravity-mars' },
      { text: 'Related HRP risks include Cardiovascular Adaptations, Reduced Cardiorespiratory and Musculoskeletal Fitness, Spaceflight-Induced Bone Changes, SANS and Altered Sensorimotor and Vestibular Function.', ref: 'nasa-hrp-risks#grouping' },
      { text: 'Effects in astronauts resemble accelerated ageing and a sedentary lifestyle; Canadian research studies bones, heart, blood vessels and the brain.', ref: 'csa-why-science#aging' },
      { text: 'Current LEO studies include Zero T2 (exercise without a treadmill), Thigh Cuff (fluid shift and eye disorders) and Brain Fluid Pressure.', ref: 'nasa-hrp-research#leo' },
    ],
    riskIds: ['cardiovascular', 'fitness', 'bone', 'sans', 'sensorimotor', 'dynamic-loads'],
    studyIds: ['zero-t2', 'thigh-cuff', 'brain-fluid', 'b-complex', 'venous', 'spinal-health', 'piloting', 'occupant'],
    datasetIds: ['osd-53', 'osd-575'],
    indicators: [
      { metric: 'heart_rate', label: 'Resting heart rate', why: 'Cardiovascular adaptation and deconditioning can shift resting HR from your baseline.' },
      { metric: 'blood_pressure', label: 'Blood pressure', why: 'Fluid shifts change blood pressure regulation, especially around gravity transitions.' },
      { behavioural: 'exercise', label: 'Exercise minutes', why: 'Countermeasure exercise protects muscle, bone and cardiorespiratory fitness.' },
      { metric: 'steps', label: 'Activity', why: 'On surface missions, activity volume reflects loading of bones and muscles.' },
      { metric: 'weight', label: 'Body mass', why: 'Loss of lean mass shows up as weight change over weeks.' },
    ],
    warningSigns: ['Exercise minutes below plan for several days.', 'Resting heart rate drifting above baseline.', 'New vision changes or persistent headache.', 'Light-headedness on standing after landing or gravity transition.'],
    prevention: ['Complete the prescribed countermeasure exercise.', 'Report vision changes promptly (neuro-ocular monitoring).'],
    actions: ['Review AEG-MD-005 for vision change or persistent headache.', 'Review AEG-MD-001 for space motion sickness after a gravity transition.'],
    escalation: ['Vision change or persistent headache → crew medical officer and flight surgeon.', 'Fainting → Emergency.'],
    protocolIds: ['AEG-MD-005', 'AEG-MD-001'],
  },
  {
    id: 'environment',
    name: 'Hostile & closed environments',
    short: 'The spacecraft is both home and life-support machine.',
    science: [
      { text: 'The spacecraft ecosystem must be controlled for temperature, pressure, lighting and noise, while microbial communities and immune responses are monitored.', ref: 'nasa-hrp-hazards#closed' },
      { text: 'Related HRP risks include Altered Immune System Responses, Host-Microorganism Interactions, Hypoxia and Decompression Sickness.', ref: 'nasa-hrp-risks#grouping' },
      { text: 'Immune Biomarkers (Artemis II) and Altered Immunity study how spaceflight changes the immune system.', ref: 'nasa-hrp-research#artemis' },
      { text: 'OSDR holds molecular data from astronauts in the closed ISS environment (OSD-174) and Inspiration4 crew blood panels (OSD-575, OSD-569).', ref: 'osd-174#title' },
    ],
    riskIds: ['immune', 'microbe', 'hypoxia', 'dcs', 'eva', 'sleep'],
    studyIds: ['immune-biomarkers', 'altered-immunity', 'veggie-monitoring', 'omics-archive', 'cipher'],
    datasetIds: ['osd-174', 'osd-569', 'osd-575'],
    indicators: [
      { env: 'cabin_co2', label: 'Cabin CO₂', why: 'Elevated CO₂ is associated with headache and reduced performance.' },
      { env: 'cabin_o2', label: 'Cabin O₂', why: 'Low partial pressure of oxygen is a hypoxia hazard.' },
      { metric: 'spo2', label: 'Blood oxygen (SpO₂)', why: 'The personal signal of hypoxia; confirmed low values are urgent.' },
      { metric: 'respiratory_rate', label: 'Respiratory rate', why: 'Rises with hypoxia, CO₂ and illness.' },
      { metric: 'temperature', label: 'Body temperature', why: 'Fever can indicate infection in a closed habitat.' },
      { env: 'noise', label: 'Noise', why: 'Chronic noise affects sleep and hearing.' },
    ],
    warningSigns: ['SpO₂ below 94% (caution) or 90% (action) — demo rule values.', 'Cabin CO₂ above the caution level with headache.', 'Temperature ≥ 37.8 °C with rising heart and breathing rate.'],
    prevention: ['Keep environmental sensors calibrated and visible.', 'Hand hygiene and food-safety practices.', 'Hearing protection in high-noise modules.'],
    actions: ['Low SpO₂ → AEG-EM-002; elevated CO₂ symptoms → AEG-EN-001; fever → AEG-MD-002.'],
    escalation: ['Confirmed SpO₂ < 90% → Emergency and flight surgeon on the priority channel.', 'Fever with breathing difficulty → crew medical officer now.'],
    protocolIds: ['AEG-EM-002', 'AEG-EN-001', 'AEG-MD-002'],
  },
];

export const HAZARD_BY_ID = Object.fromEntries(HAZARDS.map((h) => [h.id, h])) as Record<HazardId, Hazard>;
export const riskById = (id: string) => HRP_RISKS.find((r) => r.id === id);
export const studyById = (id: string) => HRP_STUDIES.find((s) => s.id === id);

/** Hazards relevant to a metric (through the HRP risks it informs + indicators). */
export function hazardsForMetric(metric: VitalType): HazardId[] {
  const set = new Set<HazardId>();
  for (const h of HAZARDS) if (h.indicators.some((i) => i.metric === metric)) set.add(h.id);
  return [...set];
}

export function risksForMetric(metric: VitalType): HrpRisk[] {
  return HRP_RISKS.filter((r) => r.metrics.includes(metric));
}

export const PROTOTYPE_GUIDANCE_LABEL = 'CosmicPulse prototype guidance — not NASA flight-medicine guidance. Protocol IDs refer to the demo (unapproved) knowledge base.';
