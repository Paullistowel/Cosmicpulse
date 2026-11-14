/* Copied verbatim from the CosmicPulse mobile app (src/shared/contract.ts) by scripts/sync-mobile-core.mjs.
 * Edit the mobile original and re-run `npm run sync:mobile`; do not edit this copy. */
/**
 * CosmicPulse API contract — shared by the mobile app, the Medical Command Centre
 * and (mirrored in Pydantic) the FastAPI server in /server.
 *
 * Conventions
 * - JSON over HTTPS; bearer JWT in `Authorization`.
 * - All timestamps ISO-8601 UTC.
 * - Errors: `{ "error": { "code": string, "message": string } }` with an HTTP status.
 * - Authorisation is enforced on the server (RBAC + mission/assignment ABAC);
 *   client-side role checks are presentation only.
 */

import type {
  Administration,
  AlertState,
  Astronaut,
  CrewMessage,
  EnvironmentReading,
  HealthAlert,
  Incident,
  Measurement,
  MedicalRecord,
  Mission,
  SyncEntity,
} from '@/data/types';

export type Role = 'astronaut' | 'flight_surgeon' | 'mission_ops' | 'admin';

export type AuthUser = { id: string; email: string; name: string; role: Role; astronautId?: string; missionIds: string[]; mfaEnabled: boolean };

/* POST /auth/login */
export type LoginRequest = { email: string; password: string; totp?: string; deviceId: string; deviceName: string };
export type LoginResponse =
  | { status: 'ok'; accessToken: string; refreshToken: string; expiresAt: string; user: AuthUser }
  | { status: 'mfa_required' };

/* POST /auth/refresh */
export type RefreshRequest = { refreshToken: string; deviceId: string };
export type RefreshResponse = { accessToken: string; refreshToken: string; expiresAt: string };

/* GET /auth/sessions, DELETE /auth/sessions/{id} (device revocation) */
export type SessionInfo = { id: string; deviceName: string; createdAt: string; lastSeenAt: string; current: boolean };

/* GET /health — unauthenticated liveness, used for link detection */
export type HealthResponse = { status: 'ok'; version: string; time: string };

/* ------------------------------- Sync ------------------------------- */

/** POST /sync/push — batch of idempotent client events (max 100). */
export type PushEvent = {
  id: string; // idempotency key (UUID)
  entity: SyncEntity;
  op: 'upsert' | 'delete';
  entityId: string;
  /** Client's last-seen server revision for this entity (conflict detection); 0 for new. */
  baseRevision: number;
  payload: unknown;
  createdAt: string;
};
export type PushRequest = { deviceId: string; astronautId: string; events: PushEvent[] };
export type PushResult =
  | { id: string; status: 'accepted'; revision: number }
  | { id: string; status: 'duplicate'; revision: number }
  /** Server copy wins for server-authoritative fields; client must apply `server`. */
  | { id: string; status: 'conflict'; revision: number; server: unknown }
  | { id: string; status: 'rejected'; error: string };
export type PushResponse = { results: PushResult[]; serverTime: string };

/** GET /sync/pull?cursor=…&astronautId=… — changes made on the server since `cursor`. */
export type PullChange = { entity: SyncEntity; entityId: string; revision: number; op: 'upsert' | 'delete'; payload: unknown; at: string };
export type PullResponse = { changes: PullChange[]; cursor: string; hasMore: boolean };

/* ----------------------------- Command Centre ----------------------------- */

/* GET /missions, GET /missions/{id} */
export type MissionSummary = Mission & { crew: (Astronaut & { status: CrewStatus })[]; lastSyncAt?: string };

export type CrewStatus = {
  astronautId: string;
  riskLevel: 'nominal' | 'monitor' | 'elevated' | 'high' | 'critical';
  openAlerts: number;
  openIncidents: number;
  lastSyncAt?: string;
  latest: Partial<Record<'heart_rate' | 'hrv' | 'spo2' | 'temperature' | 'respiratory_rate' | 'blood_pressure', { value: number; value2?: number; at: string }>>;
};

/* GET /astronauts/{id}/vitals?type=&from=&to= */
export type VitalsResponse = { measurements: Measurement[] };

/* GET /astronauts/{id}/records, /environment, /administrations */
export type RecordsResponse = { records: MedicalRecord[] };
export type EnvironmentResponse = { readings: EnvironmentReading[] };
export type AdministrationsResponse = { administrations: Administration[] };

/* GET /alerts?missionId=&state=  ·  POST /alerts/{id}/transition */
export type AlertTransitionRequest = { to: AlertState; note?: string };
export type AlertsResponse = { alerts: (HealthAlert & { astronautId: string; missionId: string; revision: number })[] };

/* GET /incidents?missionId=  ·  POST /incidents/{id}/entries  ·  POST /incidents/{id}/status */
export type IncidentsResponse = { incidents: (Incident & { astronautId: string; missionId: string; assignedTo?: string; revision: number })[] };
export type IncidentEntryRequest = { kind: 'note' | 'instruction'; text: string };

/* GET /messages?astronautId=  ·  POST /messages */
export type MessagesResponse = { messages: CrewMessage[] };
export type SendMessageRequest = { astronautId: string; body: string; incidentId?: string };

/* GET /audit?target=  (admin, flight_surgeon for own missions) */
export type AuditResponse = { entries: { id: string; at: string; actor: string; role: Role; action: string; target: string; ip?: string }[] };

/* GET /analytics/missions/{id} */
export type MissionAnalytics = {
  riskDistribution: Record<CrewStatus['riskLevel'], number>;
  alertsByDay: { day: string; count: number }[];
  incidentsByCategory: Record<string, number>;
  cumulativeDose: { astronautId: string; msv: number }[];
};
