/* Copied verbatim from the CosmicPulse mobile app (src/engine/knowledge/protocols.ts) by scripts/sync-mobile-core.mjs.
 * Edit the mobile original and re-run `npm run sync:mobile`; do not edit this copy. */
import type { Protocol, Reference } from '@/data/types';

/**
 * CosmicPulse MEDICAL KNOWLEDGE BASE — DEMO CONTENT.
 *
 * These protocols are illustrative placeholders written to exercise the
 * retrieval, citation and versioning pipeline. They are deliberately limited
 * to general, conservative first-response steps and escalation. They are NOT
 * flight-approved and must be replaced by protocols authored and signed off
 * by the mission's flight surgeons before any operational use.
 *
 * The assistant may only quote steps from this knowledge base and must always
 * cite `id` + `version`. It never adds dosing or interventions of its own.
 */

export const KB_VERSION = '0.1.0-demo';
const AUTHORED = '2026-11-01T00:00:00.000Z';
const demoApproval = { status: 'demo_unapproved' as const, at: AUTHORED };

const NASA_STD_3001_V1: Reference = {
  title: 'NASA-STD-3001 Volume 1: Crew Health',
  publisher: 'NASA',
  url: 'https://www.nasa.gov/ochmo/standards/',
};
const NASA_STD_3001_V2: Reference = {
  title: 'NASA-STD-3001 Volume 2: Human Factors, Habitability & Environmental Health',
  publisher: 'NASA',
  url: 'https://www.nasa.gov/ochmo/standards/',
};
const HRP: Reference = {
  title: 'Human Research Program — Human System Risks',
  publisher: 'NASA',
  url: 'https://www.nasa.gov/hrp/',
};
const FIRST_AID: Reference = {
  title: 'First Aid/CPR/AED Participant’s Manual',
  publisher: 'American Red Cross',
  url: 'https://www.redcross.org/take-a-class/first-aid',
};

export const PROTOCOLS: Protocol[] = [
  {
    id: 'AEG-EM-001',
    title: 'Medical emergency — first response',
    version: KB_VERSION,
    category: 'emergency',
    keywords: ['emergency', 'unresponsive', 'collapse', 'unconscious', 'primary survey', 'triage', 'drabc', 'cpr'],
    summary: 'Initial assessment of an ill or injured crewmember and immediate escalation to the crew medical officer and flight surgeon.',
    indications: ['A crewmember is unresponsive, collapses, or appears seriously unwell'],
    steps: [
      { text: 'Make the area safe: check cabin atmosphere alarms and remove hazards before approaching.', caution: 'Do not become a second casualty.' },
      { text: 'Check responsiveness and call for help — alert the crew medical officer and all crew.' },
      { text: 'Restrain the patient and yourself (foot loops or restraint system) so you can work hands-free.' },
      { text: 'Check airway and breathing for no more than 10 seconds.' },
      { text: 'If not breathing normally, begin CPR using the vehicle’s microgravity CPR procedure and retrieve the AED.' },
      { text: 'If breathing, record a full set of vitals and keep them updated every 5 minutes.' },
      { text: 'Open an incident in CosmicPulse so vitals and actions are time-stamped automatically.' },
    ],
    escalation: 'Notify the flight surgeon immediately via the priority medical channel. If in loss of signal, continue care and queue the incident report for transmission.',
    equipment: ['AED', 'Restraint system', 'Medical kit'],
    approval: demoApproval,
    references: [FIRST_AID, NASA_STD_3001_V1],
  },
  {
    id: 'AEG-EM-002',
    title: 'Low oxygen saturation / suspected hypoxia',
    version: KB_VERSION,
    category: 'emergency',
    keywords: ['hypoxia', 'spo2', 'oxygen', 'saturation', 'desaturation', 'short of breath', 'breathless', 'cyanosis'],
    summary: 'Verification and response when SpO₂ is low or a crewmember has symptoms of hypoxia.',
    indications: ['SpO₂ below the mission action level', 'Breathlessness, confusion, headache or bluish lips'],
    steps: [
      { text: 'Re-check the reading with a second sensor or site — motion and cold fingers cause false lows.' },
      { text: 'Check cabin oxygen partial pressure and atmosphere alarms for a vehicle-wide cause.', caution: 'If more than one crewmember is affected, treat it as an atmosphere emergency.' },
      { text: 'Follow the vehicle procedure for supplemental oxygen.' },
      { text: 'Record SpO₂, heart rate and respiratory rate every 5 minutes.' },
    ],
    escalation: 'Notify the crew medical officer now and the flight surgeon as soon as communication allows.',
    equipment: ['Pulse oximeter', 'Supplemental oxygen'],
    approval: demoApproval,
    references: [NASA_STD_3001_V2],
  },
  {
    id: 'AEG-EM-003',
    title: 'Chest pain',
    version: KB_VERSION,
    category: 'emergency',
    keywords: ['chest pain', 'chest pressure', 'cardiac', 'heart', 'palpitations', 'angina'],
    summary: 'Initial actions for chest pain or pressure.',
    indications: ['Chest pain, pressure or tightness, with or without breathlessness or sweating'],
    steps: [
      { text: 'Stop activity; have the crewmember rest restrained in a comfortable position.' },
      { text: 'Record a full set of vitals and, if available, a 12-lead or single-lead ECG.' },
      { text: 'Locate the AED and keep it at hand.' },
      { text: 'Open an incident so the ECG and vitals are attached automatically.' },
    ],
    escalation: 'Contact the flight surgeon immediately. Any medication must be directed by the flight surgeon.',
    equipment: ['ECG', 'AED', 'Medical kit'],
    approval: demoApproval,
    references: [FIRST_AID, NASA_STD_3001_V1],
  },
  {
    id: 'AEG-EN-001',
    title: 'Elevated cabin CO₂ symptoms',
    version: KB_VERSION,
    category: 'environmental',
    keywords: ['co2', 'carbon dioxide', 'headache', 'stuffy', 'ventilation', 'lethargy'],
    summary: 'Correlate headache or lethargy with cabin CO₂ readings and local ventilation.',
    indications: ['Headache, lethargy or poor concentration', 'Cabin CO₂ above the mission caution level'],
    steps: [
      { text: 'Check current and 1-hour average CO₂ for the module the crewmember is in.' },
      { text: 'Check that local ventilation fans are running and the sleep station is not enclosed without airflow.' },
      { text: 'Move to a well-ventilated module and reassess symptoms after 30 minutes.' },
      { text: 'Log symptoms against the CO₂ timeline in CosmicPulse.' },
    ],
    escalation: 'Report persistent symptoms to the crew medical officer and environmental control team.',
    equipment: ['CO₂ monitor'],
    approval: demoApproval,
    references: [NASA_STD_3001_V2],
  },
  {
    id: 'AEG-EN-002',
    title: 'Solar particle event — radiation shelter',
    version: KB_VERSION,
    category: 'environmental',
    keywords: ['radiation', 'solar particle event', 'spe', 'storm', 'shelter', 'dose', 'dosimeter'],
    summary: 'Crew response to a forecast or detected solar particle event.',
    indications: ['Space-weather alert from ground', 'Dose rate rises sharply above the mission baseline'],
    steps: [
      { text: 'Move to the designated radiation shelter location for this vehicle.' },
      { text: 'Wear personal dosimeters and confirm they are logging.' },
      { text: 'Postpone EVA and non-essential activities in less-shielded areas.' },
      { text: 'Remain sheltered until the all-clear from ground or until dose rate returns to baseline per mission rules.' },
    ],
    escalation: 'Coordinate with ground space-weather and radiation specialists; record cumulative dose afterwards.',
    equipment: ['Personal dosimeter', 'Area radiation monitor'],
    approval: demoApproval,
    references: [NASA_STD_3001_V1, HRP],
  },
  {
    id: 'AEG-MD-001',
    title: 'Space motion sickness',
    version: KB_VERSION,
    category: 'medical',
    keywords: ['nausea', 'vomiting', 'motion sickness', 'space adaptation', 'dizzy'],
    summary: 'Supportive measures for space adaptation symptoms in the first days of flight.',
    indications: ['Nausea, vomiting, malaise or headache during early flight'],
    steps: [
      { text: 'Limit head movements and keep a consistent visual orientation.' },
      { text: 'Keep emesis bags within reach and maintain fluid intake in small amounts.' },
      { text: 'Track symptoms and fluid intake in CosmicPulse.' },
    ],
    escalation: 'Any anti-nausea medication must be used only as directed by the flight surgeon or the crew’s pre-approved medical plan.',
    equipment: ['Emesis bags'],
    approval: demoApproval,
    references: [HRP],
  },
  {
    id: 'AEG-MD-002',
    title: 'Fever / suspected infection',
    version: KB_VERSION,
    category: 'medical',
    keywords: ['fever', 'temperature', 'infection', 'illness', 'chills', 'sick', 'flu'],
    summary: 'Monitoring and crew protection when a crewmember has a fever.',
    indications: ['Temperature at or above the mission fever threshold', 'Chills, malaise, sore throat or cough'],
    steps: [
      { text: 'Re-measure temperature with the same method in 30 minutes.' },
      { text: 'Record temperature, heart rate and respiratory rate every 4 hours.' },
      { text: 'Encourage fluids and rest; reduce workload.' },
      { text: 'Limit close contact and shared food; clean shared surfaces.' },
    ],
    escalation: 'Inform the crew medical officer; send the trend to the flight surgeon at the next communication window.',
    equipment: ['Thermometer'],
    approval: demoApproval,
    references: [NASA_STD_3001_V1],
  },
  {
    id: 'AEG-MD-003',
    title: 'Bleeding and laceration',
    version: KB_VERSION,
    category: 'medical',
    keywords: ['bleeding', 'cut', 'laceration', 'wound', 'injury', 'blood'],
    summary: 'Control of bleeding and containment of blood in microgravity.',
    indications: ['A cut or wound that is bleeding'],
    steps: [
      { text: 'Put on gloves and eye protection.' },
      { text: 'Apply firm direct pressure with gauze; do not lift to check for at least 10 minutes.' },
      { text: 'Contain floating blood droplets with absorbent material.' },
      { text: 'Photograph the wound for the flight surgeon once bleeding is controlled.' },
    ],
    escalation: 'Report to the crew medical officer. Contact the flight surgeon if bleeding does not stop or the wound is deep or gaping.',
    equipment: ['Gloves', 'Gauze', 'Eye protection'],
    approval: demoApproval,
    references: [FIRST_AID],
  },
  {
    id: 'AEG-MD-004',
    title: 'Foreign body in the eye',
    version: KB_VERSION,
    category: 'medical',
    keywords: ['eye', 'foreign body', 'debris', 'particle', 'irritation', 'gritty'],
    summary: 'Initial care for floating debris in the eye — a common in-flight complaint.',
    indications: ['Eye irritation, watering or a gritty feeling'],
    steps: [
      { text: 'Do not rub the eye.' },
      { text: 'Irrigate using the eyewash in the medical kit following its instructions.' },
      { text: 'Check vision in each eye and note any change.' },
    ],
    escalation: 'Contact the flight surgeon if pain, redness or vision change persists after irrigation.',
    equipment: ['Eyewash kit'],
    approval: demoApproval,
    references: [FIRST_AID, NASA_STD_3001_V1],
  },
  {
    id: 'AEG-MD-005',
    title: 'Vision change or persistent headache',
    version: KB_VERSION,
    category: 'medical',
    keywords: ['vision', 'blurred', 'eyesight', 'headache', 'sans', 'neuro-ocular', 'pressure'],
    summary: 'Reporting pathway for vision changes, which may relate to spaceflight-associated neuro-ocular syndrome.',
    indications: ['New blurred near or distance vision', 'Headache that persists or recurs'],
    steps: [
      { text: 'Record when the change started and which eye is affected.' },
      { text: 'Complete the scheduled vision self-test if one is available on board.' },
      { text: 'Check cabin CO₂ in case headache is environmental.' },
    ],
    escalation: 'Report to the flight surgeon; sudden loss of vision is an emergency — use AEG-EM-001.',
    equipment: ['Vision test chart'],
    approval: demoApproval,
    references: [HRP],
  },
  {
    id: 'AEG-BH-001',
    title: 'Sleep disruption and fatigue',
    version: KB_VERSION,
    category: 'behavioral',
    keywords: ['sleep', 'insomnia', 'fatigue', 'tired', 'exhausted', 'circadian', 'rest'],
    summary: 'Measures for poor sleep and fatigue during missions.',
    indications: ['Sleep below the crew sleep target for several nights', 'Reported fatigue affecting work'],
    steps: [
      { text: 'Keep a consistent sleep window and use the lighting schedule for the sleep period.' },
      { text: 'Check sleep-station noise, temperature and CO₂.' },
      { text: 'Avoid caffeine in the hours before the sleep period.' },
      { text: 'Log sleep and fatigue each morning so trends are visible to the flight surgeon.' },
    ],
    escalation: 'Discuss persistent fatigue or any sleep medication with the flight surgeon at the next private medical conference.',
    equipment: [],
    approval: demoApproval,
    references: [HRP],
  },
  {
    id: 'AEG-EQ-001',
    title: 'Biomonitor sensor troubleshooting',
    version: KB_VERSION,
    category: 'equipment',
    keywords: ['sensor', 'device', 'not syncing', 'stale', 'battery', 'bluetooth', 'biomonitor', 'dropout'],
    summary: 'Restore data flow when a wearable or biomonitor stops reporting.',
    indications: ['A sensor’s last reading is older than its expected interval', 'Implausible readings from one device'],
    steps: [
      { text: 'Check battery level and charge if below 20%.' },
      { text: 'Check skin contact and sensor placement.' },
      { text: 'Re-pair the device from Profile → Devices.' },
      { text: 'Compare one reading against a reference instrument.' },
    ],
    escalation: 'If data cannot be restored, inform the crew medical officer so monitoring can use a backup instrument.',
    equipment: ['Backup pulse oximeter', 'Charger'],
    approval: demoApproval,
    references: [],
  },
];

export const findProtocol = (id: string) => PROTOCOLS.find((p) => p.id === id);
