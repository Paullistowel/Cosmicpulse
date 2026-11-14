/* Copied verbatim from the CosmicPulse mobile app (src/features/emergency/lib.ts) by scripts/sync-mobile-core.mjs.
 * Edit the mobile original and re-run `npm run sync:mobile`; do not edit this copy. */
import { HeartPulse, Bone, Wind, Biohazard, UserX, CircleQuestionMark, type LucideIcon } from 'lucide-react-native';
import { z } from 'zod';

import type { Incident, IncidentSeverity } from '@/data/types';

/**
 * Emergency assistance — incident categories, their approved-guidance links
 * and the report form schema. Pure data; no React state.
 */

export type EmergencyKind = 'cardiac' | 'breathing' | 'injury' | 'unresponsive' | 'exposure' | 'other';

export const EMERGENCY_KINDS: { id: EmergencyKind; label: string; icon: LucideIcon; category: Incident['category']; protocolIds: string[] }[] = [
  { id: 'cardiac', label: 'Chest pain / cardiac', icon: HeartPulse, category: 'illness', protocolIds: ['AEG-EM-001', 'AEG-EM-003'] },
  { id: 'breathing', label: 'Breathing / low oxygen', icon: Wind, category: 'illness', protocolIds: ['AEG-EM-001', 'AEG-EM-002'] },
  { id: 'injury', label: 'Injury / bleeding', icon: Bone, category: 'injury', protocolIds: ['AEG-EM-001', 'AEG-MD-003'] },
  { id: 'unresponsive', label: 'Collapse / unresponsive', icon: UserX, category: 'illness', protocolIds: ['AEG-EM-001'] },
  { id: 'exposure', label: 'Toxic / environmental', icon: Biohazard, category: 'environmental', protocolIds: ['AEG-EM-001', 'AEG-EN-001'] },
  { id: 'other', label: 'Other', icon: CircleQuestionMark, category: 'other', protocolIds: ['AEG-EM-001'] },
];

export const kindMeta = (id: EmergencyKind) => EMERGENCY_KINDS.find((k) => k.id === id) ?? EMERGENCY_KINDS[EMERGENCY_KINDS.length - 1];

export const emergencySchema = z.object({
  kind: z.enum(['cardiac', 'breathing', 'injury', 'unresponsive', 'exposure', 'other'], { message: 'Choose an incident category' }),
  severity: z.enum(['serious', 'critical']),
  description: z.string().trim().min(8, 'Describe what is happening (at least 8 characters)').max(600, 'Keep it under 600 characters'),
});

export type EmergencyForm = z.infer<typeof emergencySchema>;

export const SEVERITY_OPTIONS: { value: Extract<IncidentSeverity, 'serious' | 'critical'>; label: string }[] = [
  { value: 'critical', label: 'Critical' },
  { value: 'serious', label: 'Serious' },
];

/** Builds the incident record created when an emergency report is submitted. */
export function emergencyIncident(form: EmergencyForm, reporter: string, vitals: Incident['vitalsSnapshot']) {
  const k = kindMeta(form.kind);
  return {
    title: `Emergency · ${k.label}`,
    category: k.category,
    severity: form.severity,
    description: form.description.trim(),
    reportedBy: reporter,
    vitalsSnapshot: vitals,
    protocolIds: k.protocolIds,
  } satisfies Omit<Incident, 'id' | 'openedAt' | 'updatedAt' | 'timeline' | 'status'>;
}

/** Timeline markers used to reconstruct workflow state from a persisted incident. */
export const MARK = {
  activated: 'Emergency assistance activated on board.',
  acknowledged: 'Crew medical officer acknowledged the emergency.',
  priorityQueued: 'Priority message to flight surgeon queued on board.',
} as const;

export const hasMark = (i: Pick<Incident, 'timeline'>, text: string) => i.timeline.some((e) => e.text === text);
