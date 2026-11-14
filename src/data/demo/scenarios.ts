/* Copied verbatim from the CosmicPulse mobile app (src/data/demo/scenarios.ts) by scripts/sync-mobile-core.mjs.
 * Edit the mobile original and re-run `npm run sync:mobile`; do not edit this copy. */
import type {
  AppNotification,
  Appointment,
  Astronaut,
  CrewMessage,
  Device,
  DoseLog,
  EnvironmentReading,
  ExerciseSession,
  HealthAlert,
  Incident,
  InventoryItem,
  JournalEntry,
  LabResult,
  Measurement,
  MedicalRecord,
  Medication,
  Mission,
  MissionPhase,
  MissionType,
  MoodEntry,
  PreventiveTask,
  ScreeningResult,
  SleepRecord,
  UserProfile,
  VitalType,
  Administration,
} from '../types';
import { DAY, createRng, daysAgo, daysAhead, type Rng } from './random';

/**
 * CosmicPulse demo missions. Every mission, crewmember and reading here is FICTIONAL
 * and synthetic. Measurements carry `source.kind === 'simulated'` (from a
 * named simulated device) or `'demo'`, and the UI labels them accordingly.
 */

export type ScenarioId = 'iss_nominal' | 'iss_illness' | 'lunar_surface' | 'mars_transit' | 'spe_event' | 'sensor_dropout' | 'medical_emergency';

export type ScenarioMeta = { id: ScenarioId; title: string; description: string; missionType: MissionType };

export const SCENARIOS: ScenarioMeta[] = [
  { id: 'iss_nominal', title: 'ISS increment · nominal', description: 'Day 62 aboard the station. Stable baselines, routine monitoring.', missionType: 'iss' },
  { id: 'iss_illness', title: 'ISS · early illness', description: 'Resting HR up, HRV down and a rising temperature — a physiological strain pattern.', missionType: 'iss' },
  { id: 'lunar_surface', title: 'Lunar surface operations', description: 'EVA exertion, regolith dust eye irritation and higher dose rate.', missionType: 'lunar_surface' },
  { id: 'mars_transit', title: 'Mars transit · long duration', description: 'Day 141, 11-minute one-way delay, sleep debt and rising cumulative dose.', missionType: 'mars_transit' },
  { id: 'spe_event', title: 'Solar particle event', description: 'Lunar-orbit mission during a radiation event — shelter protocol.', missionType: 'lunar_orbit' },
  { id: 'sensor_dropout', title: 'Sensor dropout', description: 'Stale biomonitor, an implausible reading and data gaps.', missionType: 'iss' },
  { id: 'medical_emergency', title: 'Medical emergency', description: 'Confirmed low SpO₂ with elevated cabin CO₂ — an open incident.', missionType: 'leo' },
];

export type Dataset = {
  scenario: ScenarioId;
  profile: UserProfile;
  /* Mission domain */
  mission: Mission;
  phaseStartedAt: string;
  crew: Astronaut[];
  astronautId: string;
  environment: EnvironmentReading[];
  sleepRecords: SleepRecord[];
  exercise: ExerciseSession[];
  inventory: InventoryItem[];
  administrations: Administration[];
  incidents: Incident[];
  alerts: HealthAlert[];
  messages: CrewMessage[];
  /* Health */
  measurements: Measurement[];
  labs: LabResult[];
  records: MedicalRecord[];
  medications: Medication[];
  doseLogs: DoseLog[];
  devices: Device[];
  notifications: AppNotification[];
  /* Behavioural health (private) */
  moods: MoodEntry[];
  journal: JournalEntry[];
  screenings: ScreeningResult[];
  /* Retained for compatibility; unused in mission context. */
  appointments: Appointment[];
  prevention: PreventiveTask[];
};

/* --------------------------------- Devices --------------------------------- */

const BIO = { kind: 'simulated' as const, deviceId: 'dev-bio', deviceName: 'Biomonitor vest (sim)' };
const OXI = { kind: 'simulated' as const, deviceId: 'dev-oxi', deviceName: 'Pulse oximeter (sim)' };
const CUFF = { kind: 'simulated' as const, deviceId: 'dev-cuff', deviceName: 'BP cuff (sim)' };
const THERMO = { kind: 'simulated' as const, deviceId: 'dev-thermo', deviceName: 'Core thermometer (sim)' };
const ENV = { kind: 'simulated' as const, deviceId: 'env-ecls', deviceName: 'Vehicle ECLSS feed (sim)' };
const RAD = { kind: 'simulated' as const, deviceId: 'env-rad', deviceName: 'Area dosimeter (sim)' };

function devices(opts: { staleBio?: boolean } = {}): Device[] {
  const now = new Date().toISOString();
  const d = (id: string, name: string, category: Device['category'], measures: VitalType[], extra: Partial<Device> = {}): Device => ({
    id,
    name,
    manufacturer: 'Simulated hardware',
    category,
    state: 'connected',
    simulated: true,
    lastSyncAt: now,
    battery: 78,
    measures,
    syncHistory: [0, 1, 2].map((i) => ({ at: daysAgo(i, 7), records: 24, ok: true })),
    ...extra,
  });
  return [
    d('dev-bio', 'Biomonitor vest (sim)', 'smartwatch', ['heart_rate', 'hrv', 'respiratory_rate', 'sleep'], opts.staleBio ? { state: 'error', battery: 3, lastSyncAt: daysAgo(2, 4), errorMessage: 'No data for 2 days — battery critically low.', syncHistory: [{ at: daysAgo(0, 7), records: 0, ok: false, message: 'Device not reachable' }, { at: daysAgo(2, 4), records: 12, ok: true }] } : {}),
    d('dev-oxi', 'Pulse oximeter (sim)', 'pulse_oximeter', ['spo2', 'heart_rate']),
    d('dev-cuff', 'BP cuff (sim)', 'bp_monitor', ['blood_pressure']),
    d('dev-thermo', 'Core thermometer (sim)', 'thermometer', ['temperature']),
  ];
}

/* --------------------------------- Vitals --------------------------------- */

type VitalPlan = {
  hr: number;
  hrv: number;
  temp: number;
  rr: number;
  sys: number;
  dia: number;
  spo2: number;
  weight: number;
  /** Changes applied over the last `days` days (linear ramp). */
  drift?: Partial<Record<'hr' | 'hrv' | 'temp' | 'rr' | 'spo2', number>>;
  driftDays?: number;
};

function vitals(rng: Rng, plan: VitalPlan, totalDays: number, launchDaysAgo: number): Measurement[] {
  const out: Measurement[] = [];
  const rampDays = plan.driftDays ?? 4;
  const ramp = (d: number) => (d < rampDays ? (rampDays - d) / rampDays : 0);
  const push = (type: VitalType, d: number, h: number, value: number, source: Measurement['source'], extra: Partial<Measurement> = {}) =>
    out.push({ id: `${type}-${d}-${h}`, type, value, unit: '', takenAt: daysAgo(d, h, rng.int(0, 40)), source, ...extra });
  for (let d = totalDays - 1; d >= 0; d--) {
    const r = ramp(d);
    // Fluid shift: resting HR settles a little lower in flight after launch.
    const flight = d < launchDaysAgo ? -2 : 0;
    const dr = plan.drift ?? {};
    for (const h of [6, 12, 18, 23]) push('heart_rate', d, h, Math.round(rng.normal(plan.hr + flight + (dr.hr ?? 0) * r, 2.2)), BIO);
    push('hrv', d, 6, Math.round(rng.normal(plan.hrv + (dr.hrv ?? 0) * r, 3.5)), BIO);
    for (const h of [6, 18]) push('respiratory_rate', d, h, Math.round(rng.normal(plan.rr + (dr.rr ?? 0) * r, 0.8)), BIO);
    for (const h of [7, 19]) push('spo2', d, h, Math.min(100, Math.round(rng.normal(plan.spo2 + (dr.spo2 ?? 0) * r, 0.6))), OXI);
    push('temperature', d, 7, Math.round(rng.normal(plan.temp + (dr.temp ?? 0) * r, 0.1) * 10) / 10, THERMO);
    if (rng.chance(0.85)) {
      const sys = Math.round(rng.normal(plan.sys, 4));
      out.push({ id: `bp-${d}`, type: 'blood_pressure', value: sys, value2: Math.round(rng.normal(plan.dia, 3)), unit: 'mmHg', takenAt: daysAgo(d, 7, 15), source: CUFF, context: 'morning' });
    }
    if (d % 3 === 0) push('weight', d, 7, Math.round(rng.normal(plan.weight - (d < launchDaysAgo ? 0.8 : 0), 0.25) * 10) / 10, { kind: 'demo' });
  }
  return out.map((m) => ({ ...m, unit: unitFor(m.type) }));
}

function unitFor(t: VitalType) {
  return ({ heart_rate: 'bpm', hrv: 'ms', respiratory_rate: 'br/min', spo2: '%', temperature: '°C', blood_pressure: 'mmHg', weight: 'kg', sleep: 'h', steps: 'steps', glucose: 'mg/dL', ecg: 'bpm' } as Record<VitalType, string>)[t];
}

function sleep(rng: Rng, days: number, hours: number, debtLastNights = 0): { records: SleepRecord[]; measurements: Measurement[] } {
  const records: SleepRecord[] = [];
  const measurements: Measurement[] = [];
  for (let d = days - 1; d >= 0; d--) {
    const short = d < debtLastNights;
    const h = Math.round(Math.max(3.5, rng.normal(short ? hours - 1.9 : hours, 0.45)) * 10) / 10;
    const q = Math.round(Math.max(20, Math.min(95, rng.normal(short ? 52 : 78, 7))));
    records.push({ id: `sleep-${d}`, night: daysAgo(d, 6), hours: h, quality: q, disruptions: short ? rng.int(2, 5) : rng.int(0, 2), medicationAssisted: false, source: BIO });
    measurements.push({ id: `sleepm-${d}`, type: 'sleep', value: h, unit: 'h', takenAt: daysAgo(d, 6), source: BIO });
  }
  return { records, measurements };
}

function exercise(rng: Rng, days: number, eva = false): ExerciseSession[] {
  const out: ExerciseSession[] = [];
  for (let d = days - 1; d >= 0; d--) {
    if (eva && d % 3 === 1) {
      out.push({ id: `eva-${d}`, at: daysAgo(d, 9), device: 'eva', minutes: rng.int(300, 420), avgHr: rng.int(98, 112), peakHr: rng.int(138, 152), load: 'Surface EVA', source: BIO });
      continue;
    }
    out.push({ id: `tvis-${d}`, at: daysAgo(d, 14), device: 'treadmill', minutes: rng.int(30, 45), avgHr: rng.int(128, 140), peakHr: rng.int(150, 162), load: 'Harness 70% BW', source: BIO });
    out.push({ id: `ared-${d}`, at: daysAgo(d, 16), device: 'resistive', minutes: rng.int(50, 70), avgHr: rng.int(100, 115), load: 'Squat · deadlift · heel raise', source: BIO });
  }
  return out;
}

/* ------------------------------- Environment ------------------------------- */

function environment(rng: Rng, opts: { days: number; doseRate: number; priorDoseMsv: number; co2: number; spe?: boolean; co2High?: boolean; location: string }): EnvironmentReading[] {
  const out: EnvironmentReading[] = [];
  let cumulative = opts.priorDoseMsv;
  for (let d = opts.days - 1; d >= 0; d--) {
    for (const h of [3, 9, 15, 21]) {
      const spe = opts.spe && d === 0 && h >= 9 ? (h === 9 ? 6 : h === 15 ? 14 : 9) : 1;
      const rate = Math.round(rng.normal(opts.doseRate, opts.doseRate * 0.08) * spe * 100) / 100;
      cumulative += rate / 4;
      out.push({ id: `rad-${d}-${h}`, kind: 'radiation_dose_rate', value: rate, unit: 'mSv/day', at: daysAgo(d, h), location: opts.location, source: RAD, quality: 0.95 });
      const co2 = opts.co2High && d === 0 && h >= 15 ? 4.3 : rng.normal(opts.co2, 0.25);
      out.push({ id: `co2-${d}-${h}`, kind: 'cabin_co2', value: Math.round(co2 * 10) / 10, unit: 'mmHg', at: daysAgo(d, h), location: opts.location, source: ENV });
    }
    out.push({ id: `cum-${d}`, kind: 'radiation_cumulative', value: Math.round(cumulative * 10) / 10, unit: 'mSv', at: daysAgo(d, 23), location: 'Personal dosimeter', source: RAD });
    out.push({ id: `o2-${d}`, kind: 'cabin_o2', value: Math.round(rng.normal(21.2, 0.2) * 10) / 10, unit: 'kPa', at: daysAgo(d, 12), location: opts.location, source: ENV });
    out.push({ id: `p-${d}`, kind: 'cabin_pressure', value: Math.round(rng.normal(101.2, 0.3) * 10) / 10, unit: 'kPa', at: daysAgo(d, 12), location: opts.location, source: ENV });
    out.push({ id: `t-${d}`, kind: 'cabin_temp', value: Math.round(rng.normal(22.5, 0.6) * 10) / 10, unit: '°C', at: daysAgo(d, 12), location: opts.location, source: ENV });
    out.push({ id: `h-${d}`, kind: 'cabin_humidity', value: Math.round(rng.normal(48, 4)), unit: '%', at: daysAgo(d, 12), location: opts.location, source: ENV });
  }
  return out;
}

/* -------------------------------- Inventory -------------------------------- */

function inventory(): InventoryItem[] {
  const item = (id: string, name: string, form: string, strength: string, kit: string, quantity: number, minimum: number, expiresInDays: number, drugId?: string): InventoryItem => ({
    id,
    drugId,
    name,
    form,
    strength,
    kit,
    quantity,
    minimum,
    lot: `L${id.toUpperCase()}-26`,
    expiresAt: daysAhead(expiresInDays),
    storage: 'Medical kit, room temperature',
  });
  return [
    item('inv-apap', 'Acetaminophen', 'Tablet', '500 mg', 'Pharmacy pack A', 46, 20, 410),
    item('inv-ibu', 'Ibuprofen', 'Tablet', '400 mg', 'Pharmacy pack A', 18, 20, 280, 'ibuprofen'),
    item('inv-prom', 'Promethazine', 'Tablet', '25 mg', 'Pharmacy pack A', 12, 8, 150),
    item('inv-mel', 'Melatonin', 'Tablet', '3 mg', 'Pharmacy pack B', 30, 10, 38),
    item('inv-lor', 'Loratadine', 'Tablet', '10 mg', 'Pharmacy pack B', 20, 6, 520),
    item('inv-eye', 'Eye irrigation solution', 'Bottle', '30 mL', 'First-aid kit', 3, 2, 22),
    item('inv-gauze', 'Sterile gauze', 'Pack', '10 × 10 cm', 'First-aid kit', 24, 10, 900),
    item('inv-epi', 'Epinephrine auto-injector', 'Injector', '0.3 mg', 'Emergency kit', 2, 2, 190),
  ];
}

/* ---------------------------------- Crew ---------------------------------- */

const CREW: Astronaut[] = [
  { id: 'ast-marsh', name: 'Elena Marsh', callsign: 'KESTREL', role: 'commander', agency: 'Demo Space Agency', bloodType: 'A+', fictional: true },
  { id: 'ast-adjei', name: 'Kofi Adjei', callsign: 'MERIDIAN', role: 'crew_medical_officer', agency: 'Demo Space Agency', bloodType: 'O+', fictional: true },
  { id: 'ast-tanabe', name: 'Yuki Tanabe', callsign: 'SPARROW', role: 'flight_engineer', agency: 'Demo Space Agency', bloodType: 'B+', fictional: true },
  { id: 'ast-ortiz', name: 'Rafael Ortiz', callsign: 'ATLAS', role: 'mission_specialist', agency: 'Demo Space Agency', bloodType: 'AB-', fictional: true },
];

function profileFor(a: Astronaut, extra: Partial<UserProfile> = {}): UserProfile {
  return {
    id: a.id,
    name: a.name,
    email: `${a.callsign.toLowerCase()}@crew.aegis.demo`,
    dateOfBirth: '1986-05-14',
    sexAtBirth: 'prefer_not',
    heightCm: 176,
    weightKg: 72,
    conditions: [],
    allergies: ['Sulfonamides'],
    goals: [],
    emergencyContact: { name: 'Flight surgeon on call', phone: 'Priority medical channel', relation: 'Flight surgeon' },
    avatarSeed: CREW.indexOf(a),
    ...extra,
  };
}

function mission(type: MissionType, phase: MissionPhase, dayOfMission: number, extra: Partial<Mission> = {}): Mission {
  return {
    id: `msn-${type}`,
    designator: `CP-${type === 'iss' ? 'ISS' : type === 'leo' ? 'LEO' : type === 'mars_transit' ? 'MTV' : type === 'lunar_surface' ? 'LSO' : 'LOR'}-07`,
    name: extra.name ?? 'Demo mission',
    type,
    phase,
    launchedAt: daysAgo(dayOfMission, 9),
    plannedDays: 180,
    crewIds: CREW.map((c) => c.id),
    commDelaySec: 0.6,
    habitat: 'Habitat module',
    medicalOfficerIds: ['fs-1'],
    ...extra,
  };
}

/* ------------------------------ Shared records ------------------------------ */

function records(a: Astronaut): MedicalRecord[] {
  const clinician = { kind: 'clinician' as const, name: 'Flight surgeon (demo)' };
  return [
    { id: 'rec-l-180', category: 'consultation', title: 'Pre-flight medical certification (L-180)', date: daysAgo(240), provider: 'Flight medicine (demo)', summary: 'Certified for long-duration flight. No restrictions.', source: clinician },
    { id: 'rec-allergy', category: 'allergy', title: 'Sulfonamide allergy', date: daysAgo(4000), summary: 'Rash (2015). Avoid sulfonamide antibiotics.', source: clinician },
    { id: 'rec-eye', category: 'consultation', title: 'Baseline ocular exam & OCT', date: daysAgo(150), provider: 'Ophthalmology (demo)', summary: 'Baseline retinal imaging for neuro-ocular monitoring. Normal.', source: clinician },
    { id: 'rec-vax', category: 'vaccination', title: 'Pre-flight immunisations', date: daysAgo(200), summary: 'Influenza, Tdap up to date.', source: clinician },
    { id: 'rec-blood', category: 'condition', title: `Blood type ${a.bloodType}`, date: daysAgo(4000), summary: 'Recorded for emergency summary.', source: clinician },
  ];
}

function crewMeds(): Medication[] {
  return [
    {
      id: 'med-mel',
      drugId: 'custom:melatonin',
      name: 'Melatonin',
      strength: '3 mg',
      form: 'Tablet',
      instructions: 'As authorised by flight surgeon for sleep-shift nights only.',
      prescriber: 'Flight surgeon (demo)',
      startedAt: daysAgo(40),
      active: true,
      schedule: { frequency: 'as_needed', times: [], remindersEnabled: false },
      source: { kind: 'clinician', name: 'Flight surgeon (demo)' },
    },
  ];
}

const msg = (id: string, from: string, to: string, body: string, d: number, h: number, direction: CrewMessage['direction'], delivery: CrewMessage['delivery'] = 'delivered'): CrewMessage => ({ id, from, to, body, at: daysAgo(d, h), direction, delivery });

/* -------------------------------- Builders -------------------------------- */

type B = (rng: Rng) => Dataset;

function base(rng: Rng, opts: {
  scenario: ScenarioId;
  mission: Mission;
  phaseDays: number;
  plan: VitalPlan;
  sleepDebt?: number;
  eva?: boolean;
  env: Parameters<typeof environment>[1];
  staleBio?: boolean;
}): Dataset {
  const me = CREW[0];
  const launchDaysAgo = Math.round((Date.now() - new Date(opts.mission.launchedAt).getTime()) / DAY);
  const totalDays = Math.min(launchDaysAgo + 30, 120);
  const s = sleep(rng, 30, 7.1, opts.sleepDebt);
  return {
    scenario: opts.scenario,
    profile: profileFor(me),
    mission: opts.mission,
    phaseStartedAt: daysAgo(opts.phaseDays, 9),
    crew: CREW,
    astronautId: me.id,
    environment: environment(rng, opts.env),
    sleepRecords: s.records,
    exercise: exercise(rng, 14, opts.eva),
    inventory: inventory(),
    administrations: [
      { id: 'adm-1', itemId: 'inv-mel', quantity: 1, at: daysAgo(6, 22), authorisedBy: 'Flight surgeon (demo)', reason: 'Sleep shift', recordedBy: me.name },
    ],
    incidents: [],
    alerts: [],
    messages: [
      msg('m-g1', 'Flight surgeon (demo)', me.name, 'Weekly private medical conference confirmed for Thursday. Please complete the sleep log beforehand.', 3, 15, 'inbound'),
      msg('m-c1', me.name, 'Flight surgeon (demo)', 'Copy. Sleep log will be up to date.', 3, 16, 'outbound'),
    ],
    measurements: [...vitals(rng, opts.plan, totalDays, launchDaysAgo), ...s.measurements],
    labs: [],
    records: records(me),
    medications: crewMeds(),
    doseLogs: [],
    devices: devices({ staleBio: opts.staleBio }),
    notifications: [],
    moods: [],
    journal: [],
    screenings: [],
    appointments: [],
    prevention: [],
  };
}

const PLAN: VitalPlan = { hr: 62, hrv: 58, temp: 36.7, rr: 14, sys: 116, dia: 74, spo2: 97.6, weight: 72 };
const ISS_ENV = { days: 30, doseRate: 0.5, priorDoseMsv: 64, co2: 2.3, location: 'US Lab' };

const builders: Record<ScenarioId, B> = {
  iss_nominal: (rng) => base(rng, { scenario: 'iss_nominal', mission: mission('iss', 'steady_state', 62, { name: 'ISS Increment (demo)', habitat: 'US Lab / Node 2' }), phaseDays: 48, plan: PLAN, env: ISS_ENV }),

  iss_illness: (rng) => {
    const d = base(rng, {
      scenario: 'iss_illness',
      mission: mission('iss', 'steady_state', 74, { name: 'ISS Increment (demo)', habitat: 'US Lab / Node 2' }),
      phaseDays: 60,
      plan: { ...PLAN, drift: { hr: 13, hrv: -20, temp: 0.9, rr: 4 }, driftDays: 4 },
      env: ISS_ENV,
      sleepDebt: 3,
    });
    d.messages.push(msg('m-c2', CREW[0].name, 'Flight surgeon (demo)', 'Feeling run down since yesterday, mild sore throat.', 0, 8, 'outbound', 'queued'));
    return d;
  },

  lunar_surface: (rng) => {
    const d = base(rng, {
      scenario: 'lunar_surface',
      mission: mission('lunar_surface', 'eva_ops', 9, { name: 'Lunar Surface Sortie (demo)', habitat: 'Surface habitat', commDelaySec: 1.3, plannedDays: 30 }),
      phaseDays: 5,
      plan: { ...PLAN, hr: 66 },
      env: { days: 9, doseRate: 1.4, priorDoseMsv: 18, co2: 2.6, location: 'Surface habitat' },
      eva: true,
    });
    d.incidents.push({
      id: 'inc-eye',
      title: 'Eye irritation after EVA (regolith dust)',
      category: 'injury',
      severity: 'minor',
      status: 'in_progress',
      openedAt: daysAgo(0, 7),
      updatedAt: daysAgo(0, 8),
      reportedBy: CREW[0].name,
      description: 'Gritty sensation in right eye after suit doffing. No vision change.',
      vitalsSnapshot: [{ type: 'heart_rate', value: '68 bpm', at: daysAgo(0, 7) }],
      protocolIds: ['AEG-MD-004'],
      timeline: [
        { at: daysAgo(0, 7), by: CREW[0].name, text: 'Incident opened.', kind: 'status' },
        { at: daysAgo(0, 7, 20), by: CREW[1].name, text: 'Irrigated right eye with kit eyewash. Vision unchanged.', kind: 'note' },
      ],
    });
    d.administrations.push({ id: 'adm-eye', itemId: 'inv-eye', quantity: 1, at: daysAgo(0, 7, 20), authorisedBy: 'Crew medical officer per AEG-MD-004', reason: 'Eye irrigation', recordedBy: CREW[1].name });
    return d;
  },

  mars_transit: (rng) => {
    const d = base(rng, {
      scenario: 'mars_transit',
      mission: mission('mars_transit', 'steady_state', 141, { name: 'Mars Transit Vehicle (demo)', habitat: 'Transit habitat', commDelaySec: 660, plannedDays: 210, nextAosAt: daysAhead(0, new Date().getHours() + 2) }),
      phaseDays: 120,
      plan: { ...PLAN, hrv: 52 },
      env: { days: 30, doseRate: 1.8, priorDoseMsv: 236, co2: 2.5, location: 'Transit habitat' },
      sleepDebt: 4,
    });
    d.messages.push(msg('m-c3', CREW[0].name, 'Flight surgeon (demo)', 'Sleep has been broken the last few nights — noise from the CDRA fan.', 0, 7, 'outbound', 'queued'));
    return d;
  },

  spe_event: (rng) =>
    base(rng, {
      scenario: 'spe_event',
      mission: mission('lunar_orbit', 'steady_state', 21, { name: 'Lunar Gateway Increment (demo)', habitat: 'Gateway HALO', commDelaySec: 1.3, plannedDays: 60 }),
      phaseDays: 18,
      plan: PLAN,
      env: { days: 21, doseRate: 1.3, priorDoseMsv: 40, co2: 2.4, location: 'HALO', spe: true },
    }),

  sensor_dropout: (rng) => {
    const d = base(rng, { scenario: 'sensor_dropout', mission: mission('iss', 'steady_state', 55, { name: 'ISS Increment (demo)', habitat: 'US Lab / Node 2' }), phaseDays: 40, plan: PLAN, env: ISS_ENV, staleBio: true });
    // Biomonitor stopped two days ago: drop its recent data.
    d.measurements = d.measurements.filter((m) => !(m.source.kind === 'simulated' && m.source.deviceId === 'dev-bio' && Date.now() - new Date(m.takenAt).getTime() < 2 * DAY));
    d.measurements.push({ id: 'hr-artefact', type: 'heart_rate', value: 214, unit: 'bpm', takenAt: daysAgo(2, 5), source: BIO, context: 'resting', qualityFlag: 'Implausible resting value — likely motion artefact before the sensor dropped out.' });
    return d;
  },

  medical_emergency: (rng) => {
    const d = base(rng, {
      scenario: 'medical_emergency',
      mission: mission('leo', 'steady_state', 33, { name: 'LEO Free-Flyer (demo)', habitat: 'Crew module' }),
      phaseDays: 20,
      plan: PLAN,
      env: { days: 30, doseRate: 0.45, priorDoseMsv: 20, co2: 2.6, co2High: true, location: 'Crew module' },
    });
    const now = Date.now();
    const at = (minAgo: number) => new Date(now - minAgo * 60_000).toISOString();
    d.measurements.push(
      { id: 'spo2-e1', type: 'spo2', value: 89, unit: '%', takenAt: at(25), source: OXI },
      { id: 'spo2-e2', type: 'spo2', value: 88, unit: '%', takenAt: at(12), source: OXI },
      { id: 'hr-e1', type: 'heart_rate', value: 104, unit: 'bpm', takenAt: at(12), source: OXI },
      { id: 'rr-e1', type: 'respiratory_rate', value: 23, unit: 'br/min', takenAt: at(12), source: BIO },
    );
    d.incidents.push({
      id: 'inc-hypoxia',
      title: 'Low SpO₂ with headache',
      category: 'environmental',
      severity: 'serious',
      status: 'awaiting_ground',
      openedAt: at(24),
      updatedAt: at(10),
      reportedBy: CREW[0].name,
      description: 'Headache and breathlessness. SpO₂ 88–89% on two sensors. Cabin CO₂ rising.',
      vitalsSnapshot: [
        { type: 'spo2', value: '88 %', at: at(12) },
        { type: 'heart_rate', value: '104 bpm', at: at(12) },
        { type: 'respiratory_rate', value: '23 br/min', at: at(12) },
      ],
      protocolIds: ['AEG-EM-002', 'AEG-EN-001'],
      timeline: [
        { at: at(24), by: CREW[0].name, text: 'Incident opened.', kind: 'status' },
        { at: at(20), by: CREW[1].name, text: 'Reading confirmed on backup oximeter. Following AEG-EM-002.', kind: 'note' },
        { at: at(10), by: CREW[1].name, text: 'Status → awaiting ground. Report queued for flight surgeon.', kind: 'status' },
      ],
    });
    return d;
  },
};

const SEEDS: Record<ScenarioId, number> = { iss_nominal: 11, iss_illness: 23, lunar_surface: 37, mars_transit: 41, spe_event: 53, sensor_dropout: 67, medical_emergency: 79 };

export function buildScenario(id: ScenarioId): Dataset {
  return builders[id](createRng(SEEDS[id]));
}

export const DEFAULT_SCENARIO: ScenarioId = 'iss_nominal';
