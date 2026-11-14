/* Copied verbatim from the CosmicPulse mobile app (src/data/types.ts) by scripts/sync-mobile-core.mjs.
 * Edit the mobile original and re-run `npm run sync:mobile`; do not edit this copy. */
/**
 * CosmicPulse domain model.
 *
 * Shapes are deliberately close to the FHIR resources they will eventually map to
 * (Observation, MedicationStatement, DiagnosticReport, Appointment, Device …) so the
 * repository layer can swap the demo store for a FHIR-backed API without screen changes.
 */

export type ISODate = string;

/** Where a datum came from. Rendered on every measurement — never hidden. */
export type DataSource =
  | { kind: 'live'; deviceId: string; deviceName: string }
  | { kind: 'synced'; deviceId: string; deviceName: string }
  | { kind: 'manual' }
  | { kind: 'demo' }
  | { kind: 'simulated'; deviceId: string; deviceName: string }
  | { kind: 'clinician'; name: string }
  | { kind: 'import'; documentId: string };

export type VitalType =
  | 'heart_rate'
  | 'blood_pressure'
  | 'glucose'
  | 'spo2'
  | 'respiratory_rate'
  | 'temperature'
  | 'weight'
  | 'sleep'
  | 'steps'
  | 'ecg'
  | 'hrv';

export type GlucoseContext = 'fasting' | 'pre_meal' | 'post_meal' | 'bedtime' | 'random';
export type MeasurementContext =
  | GlucoseContext
  | 'resting'
  | 'after_activity'
  | 'morning'
  | 'evening'
  | 'unspecified';

export type Measurement = {
  id: string;
  type: VitalType;
  /** Primary value in canonical unit (see VITAL_META). For BP this is systolic. */
  value: number;
  /** Secondary value — diastolic for blood pressure. */
  value2?: number;
  unit: string;
  takenAt: ISODate;
  source: DataSource;
  context?: MeasurementContext;
  note?: string;
  /** Set when a quality heuristic flags the reading (e.g. implausible jump). */
  qualityFlag?: string;
  /** Integration that produced the reading (healthkit, health_connect, fitbit, garmin, ble, manual, demo). */
  provider?: string;
  /** When CosmicPulse received/synchronised the reading (takenAt stays the original measurement time). */
  syncedAt?: ISODate;
  /** Value and unit exactly as the source reported them, before unit normalisation. */
  original?: { value: number; value2?: number; unit: string };
};

export type Severity = 'info' | 'low' | 'moderate' | 'high' | 'critical';

/**
 * Clinical-safety taxonomy. The UI must never present one of these as another.
 * - education: general information
 * - statistical_anomaly: deviation from the user's own baseline, no clinical judgement
 * - screening_indicator: questionnaire / guideline-threshold result
 * - risk_estimate: output of a validated risk model
 * - confirmed_diagnosis: entered by a clinician
 */
export type FindingKind =
  | 'education'
  | 'statistical_anomaly'
  | 'screening_indicator'
  | 'risk_estimate'
  | 'confirmed_diagnosis';

export type ReviewStatus = 'new' | 'acknowledged' | 'shared_with_clinician' | 'reviewed' | 'dismissed';

export type Insight = {
  id: string;
  kind: FindingKind;
  module: InsightModule;
  title: string;
  summary: string;
  severity: Severity;
  detectedAt: ISODate;
  /** What changed, in plain language. */
  whatChanged: string;
  /** Why it was flagged — the actual rule or statistic used. */
  why: string;
  contributing: { label: string; value: string; measurementType?: VitalType }[];
  uncertainty: string;
  nextStep: string;
  status: ReviewStatus;
  method: string;
  /** Knowledge-base protocols relevant to this finding (decision support, autonomy ≥ 3). */
  protocolIds?: string[];
  /** True when the finding rests only on simulated (demo) readings. */
  simulated?: boolean;
};

export type InsightModule =
  | 'vitals'
  | 'pattern'
  | 'environment'
  | 'recovery'
  | 'data_quality'
  | 'metabolic'
  | 'cardiovascular'
  | 'oncology'
  | 'neurological'
  | 'labs'
  | 'anomaly';

export type LabResult = {
  id: string;
  panel: string;
  test: string;
  value: number;
  unit: string;
  refLow?: number;
  refHigh?: number;
  collectedAt: ISODate;
  source: DataSource;
  /** OCR extraction confidence 0–1, when imported from a document. */
  extractionConfidence?: number;
};

export type RecordCategory =
  | 'condition'
  | 'allergy'
  | 'prescription'
  | 'lab_report'
  | 'imaging'
  | 'consultation'
  | 'vaccination'
  | 'hospital_visit'
  | 'document';

export type MedicalRecord = {
  id: string;
  category: RecordCategory;
  title: string;
  date: ISODate;
  provider?: string;
  summary: string;
  source: DataSource;
  attachmentUri?: string;
  tags?: string[];
};

export type Medication = {
  id: string;
  drugId: string;
  name: string;
  strength: string;
  form: string;
  instructions: string;
  prescriber?: string;
  startedAt: ISODate;
  active: boolean;
  schedule: DoseSchedule;
  supplyRemaining?: number;
  refillThreshold?: number;
  isPsychiatric?: boolean;
  source: DataSource;
};

export type DoseSchedule = {
  frequency: 'daily' | 'twice_daily' | 'three_times_daily' | 'weekly' | 'as_needed';
  /** Local times, "HH:mm". */
  times: string[];
  remindersEnabled: boolean;
};

export type DoseStatus = 'taken' | 'skipped' | 'snoozed' | 'missed' | 'pending';

export type DoseLog = {
  id: string;
  medicationId: string;
  scheduledFor: ISODate;
  status: DoseStatus;
  recordedAt?: ISODate;
};

/** Reference drug monograph — from the demo knowledge base until a licensed source is wired. */
export type DrugMonograph = {
  id: string;
  generic: string;
  brands: string[];
  drugClass: string;
  uses: string[];
  contraindications: string[];
  commonSideEffects: string[];
  seriousSideEffects: string[];
  precautions: string[];
  storage: string;
  monitoring: string[];
  ingredients: string[];
  references: Reference[];
  contentType: 'educational_summary' | 'official_label';
  reviewedAt: ISODate;
};

export type InteractionSeverity = 'minor' | 'moderate' | 'major' | 'contraindicated';

export type DrugInteraction = {
  id: string;
  drugs: [string, string];
  severity: InteractionSeverity;
  summary: string;
  mechanism: string;
  precautions: string[];
  followUp: string;
  references: Reference[];
  reviewedAt: ISODate;
};

export type Reference = { title: string; publisher: string; url?: string };

export type MoodEntry = {
  id: string;
  at: ISODate;
  /** 1 (very low) – 5 (very good) */
  mood: 1 | 2 | 3 | 4 | 5;
  energy: 1 | 2 | 3 | 4 | 5;
  stress: 1 | 2 | 3 | 4 | 5;
  tags: string[];
  note?: string;
};

export type JournalEntry = {
  id: string;
  at: ISODate;
  title: string;
  body: string;
  /** Journal entries are excluded from summaries/reports unless explicitly shared. */
  shareWithSummaries: boolean;
};

export type ScreeningInstrument = 'phq9' | 'gad7';

export type ScreeningResult = {
  id: string;
  instrument: ScreeningInstrument;
  at: ISODate;
  answers: number[];
  score: number;
  band: string;
};

export type DeviceCategory =
  | 'smartwatch'
  | 'heart_rate_monitor'
  | 'bp_monitor'
  | 'pulse_oximeter'
  | 'thermometer'
  | 'ecg'
  | 'cgm'
  | 'scale';

export type ConnectionState = 'connected' | 'syncing' | 'disconnected' | 'error' | 'pairing';

export type Device = {
  id: string;
  name: string;
  manufacturer: string;
  category: DeviceCategory;
  state: ConnectionState;
  /** All devices are simulated until a real BLE / HealthKit / Health Connect integration ships. */
  simulated: true;
  lastSyncAt?: ISODate;
  battery?: number;
  measures: VitalType[];
  syncHistory: { at: ISODate; records: number; ok: boolean; message?: string }[];
  errorMessage?: string;
};

export type ProfessionalRole =
  | 'doctor'
  | 'pharmacist'
  | 'psychologist'
  | 'psychiatrist'
  | 'counsellor'
  | 'clinic';

export type Professional = {
  id: string;
  /** Demo entries are fictional and unverified; flagged visibly in the UI. */
  name: string;
  role: ProfessionalRole;
  specialty: string;
  qualifications: string[];
  serviceArea: string;
  languages: string[];
  verified: false;
  telehealth: boolean;
  bio: string;
};

export type AppointmentStatus = 'requested' | 'confirmed' | 'completed' | 'cancelled';

export type Appointment = {
  id: string;
  professionalId: string;
  reason: string;
  preferredAt: ISODate;
  status: AppointmentStatus;
  mode: 'in_person' | 'video' | 'phone';
  sharedRecordIds: string[];
  consentToShare: boolean;
  notes?: string;
  followUps: string[];
  /** Follow-up items the user has ticked off. */
  followUpsDone?: string[];
};

export type NotificationCategory =
  | 'medication'
  | 'measurement'
  | 'insight'
  | 'lab'
  | 'appointment'
  | 'wellness'
  | 'security';

export type AppNotification = {
  id: string;
  category: NotificationCategory;
  title: string;
  body: string;
  at: ISODate;
  read: boolean;
  sensitive: boolean;
  href?: string;
};

export type PreventiveTask = {
  id: string;
  category: 'screening' | 'vaccination' | 'checkup' | 'follow_up' | 'lifestyle';
  title: string;
  detail: string;
  due?: ISODate;
  completedAt?: ISODate;
  evidence: string;
};

export type ChatRole = 'user' | 'assistant' | 'system';

export type ChatMessage = {
  id: string;
  role: ChatRole;
  text: string;
  at: ISODate;
  /** True when the reply came from the demo responder, not a model. */
  demo?: boolean;
  citations?: Reference[];
  escalation?: 'emergency' | 'crisis';
  /** Knowledge-base protocols the answer was grounded in (id + version). */
  protocolRefs?: { id: string; version: string; title: string }[];
  /** Personal data the answer used, e.g. "HRV baseline (42 readings)". */
  dataUsed?: string[];
  /** Which engine produced the answer. */
  engine?: string;
};

export type Conversation = {
  id: string;
  channel: 'health' | 'mind';
  title: string;
  messages: ChatMessage[];
  updatedAt: ISODate;
};

export type UserProfile = {
  id: string;
  name: string;
  email: string;
  dateOfBirth?: ISODate;
  sexAtBirth?: 'female' | 'male' | 'intersex' | 'prefer_not';
  heightCm?: number;
  weightKg?: number;
  conditions: string[];
  allergies: string[];
  goals: string[];
  emergencyContact?: { name: string; phone: string; relation: string };
  avatarSeed: number;
};

export type Consent = {
  id: 'share_journal' | 'ai_processing' | 'share_with_clinicians' | 'research' | 'device_sync';
  granted: boolean;
  updatedAt: ISODate;
};

export type ReportConfig = {
  rangeDays: 7 | 30 | 90 | 365;
  includeVitals: boolean;
  includeLabs: boolean;
  includeMedications: boolean;
  includeHistory: boolean;
  includeAiSummary: boolean;
  includeAlerts: boolean;
  includeMood: boolean;
};

export type GeneratedReport = {
  id: string;
  createdAt: ISODate;
  config: ReportConfig;
  title: string;
};

/* ============================================================================
 * Astronaut & mission domain (CosmicPulse)
 * ==========================================================================*/

export type MissionType = 'iss' | 'leo' | 'lunar_orbit' | 'lunar_surface' | 'mars_transit' | 'mars_surface' | 'deep_space';

/** Mission phase drives which personal baseline applies. */
export type MissionPhase = 'preflight' | 'launch' | 'early_flight' | 'steady_state' | 'eva_ops' | 'late_mission' | 'return' | 'postflight';

export type CommStatus = 'aos' | 'los' | 'degraded';

export type Mission = {
  id: string;
  /** Fictional designator. */
  designator: string;
  name: string;
  type: MissionType;
  phase: MissionPhase;
  launchedAt: ISODate;
  plannedDays: number;
  crewIds: string[];
  /** One-way light-time / relay latency to ground, seconds. */
  commDelaySec: number;
  /** Next predicted acquisition of signal when in LOS. */
  nextAosAt?: ISODate;
  habitat: string;
  medicalOfficerIds: string[];
};

export type CrewRole = 'commander' | 'pilot' | 'flight_engineer' | 'mission_specialist' | 'crew_medical_officer' | 'payload_specialist';

export type Astronaut = {
  id: string;
  name: string;
  callsign: string;
  role: CrewRole;
  agency: string;
  bloodType?: string;
  /** Fictional demo crew only. */
  fictional: true;
};

export type EnvironmentKind = 'radiation_dose_rate' | 'radiation_cumulative' | 'cabin_co2' | 'cabin_o2' | 'cabin_pressure' | 'cabin_temp' | 'cabin_humidity' | 'noise';

export type EnvironmentReading = {
  id: string;
  kind: EnvironmentKind;
  value: number;
  unit: string;
  at: ISODate;
  location: string;
  source: DataSource;
  /** 0–1 instrument confidence where provided. */
  quality?: number;
};

export type ExerciseSession = {
  id: string;
  at: ISODate;
  device: 'treadmill' | 'cycle_ergometer' | 'resistive' | 'eva' | 'other';
  minutes: number;
  avgHr?: number;
  peakHr?: number;
  load?: string;
  source: DataSource;
};

export type SleepRecord = {
  id: string;
  night: ISODate;
  hours: number;
  /** 0–100 subjective / device quality score. */
  quality: number;
  disruptions: number;
  medicationAssisted: boolean;
  source: DataSource;
};

export type InventoryItem = {
  id: string;
  drugId?: string;
  name: string;
  form: string;
  strength: string;
  kit: string;
  quantity: number;
  minimum: number;
  lot: string;
  expiresAt: ISODate;
  storage: string;
};

export type Administration = {
  id: string;
  itemId: string;
  quantity: number;
  at: ISODate;
  /** Authorised by — never chosen by the AI. */
  authorisedBy: string;
  reason: string;
  recordedBy: string;
};

export type IncidentSeverity = 'minor' | 'moderate' | 'serious' | 'critical';
export type IncidentStatus = 'open' | 'in_progress' | 'awaiting_ground' | 'resolved';

export type Incident = {
  id: string;
  title: string;
  category: 'injury' | 'illness' | 'environmental' | 'equipment' | 'behavioral' | 'other';
  severity: IncidentSeverity;
  status: IncidentStatus;
  openedAt: ISODate;
  updatedAt: ISODate;
  reportedBy: string;
  description: string;
  vitalsSnapshot: { type: VitalType; value: string; at: ISODate }[];
  protocolIds: string[];
  timeline: { at: ISODate; by: string; text: string; kind: 'note' | 'instruction' | 'status' }[];
};

export type AlertState = 'active' | 'acknowledged' | 'escalated' | 'resolved';

/**
 * Engine-generated alert. `fingerprint` deduplicates repeats of the same
 * condition so restarts and repeated analysis never create duplicate alerts.
 */
export type HealthAlert = {
  id: string;
  fingerprint: string;
  insightId: string;
  kind: FindingKind;
  severity: Severity;
  title: string;
  state: AlertState;
  createdAt: ISODate;
  updatedAt: ISODate;
  escalation?: 'crew_medical_officer' | 'flight_surgeon';
  history: { at: ISODate; state: AlertState; by: string; note?: string }[];
  /** Raised from simulated (demo) data — never triggers real notifications or escalation. */
  simulated?: boolean;
};

export type CrewMessage = {
  id: string;
  from: string;
  to: string;
  body: string;
  at: ISODate;
  direction: 'outbound' | 'inbound';
  /** Queued while in LOS; delivered when synced. */
  delivery: 'queued' | 'sent' | 'delivered' | 'failed';
  incidentId?: string;
};

export type AutonomyLevel = 1 | 2 | 3 | 4;

export type ProtocolStep = { text: string; caution?: string };

export type Protocol = {
  id: string;
  title: string;
  version: string;
  category: 'emergency' | 'medical' | 'equipment' | 'environmental' | 'behavioral' | 'training';
  keywords: string[];
  summary: string;
  indications: string[];
  steps: ProtocolStep[];
  escalation: string;
  equipment: string[];
  approval: { status: 'demo_unapproved' | 'approved'; by?: string; at: ISODate };
  references: Reference[];
};

export type SyncEntity = 'measurement' | 'alert' | 'incident' | 'message' | 'administration' | 'environment' | 'record';

export type SyncEvent = {
  /** Idempotency key — the server ignores repeats. */
  id: string;
  entity: SyncEntity;
  op: 'upsert' | 'delete';
  entityId: string;
  payload: unknown;
  createdAt: ISODate;
  attempts: number;
  lastError?: string;
  nextAttemptAt?: ISODate;
};

export type AuditEntry = { id: string; at: ISODate; actor: string; action: string; target: string };
