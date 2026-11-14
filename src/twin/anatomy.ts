import type { SystemId } from '@/twin/systems';

/**
 * Anatomical structures in public/models/anatomy.glb (built from BodyParts3D by
 * scripts/anatomy/build.mjs). Node names in the GLB are these keys.
 */
export type StructureId =
  | 'skin' | 'muscles' | 'skeleton' | 'heart' | 'arteries' | 'veins' | 'lungs' | 'airway' | 'diaphragm'
  | 'brain' | 'spinalcord' | 'eyes' | 'liver' | 'stomach' | 'intestines' | 'pancreas' | 'kidneys' | 'spleen' | 'thymus';

export type LayerId = 'skin' | 'muscles' | 'skeleton' | 'organs' | 'vessels';

export type Structure = { id: StructureId; label: string; plain: string; system: SystemId | null; layer: LayerId; color: string; roughness: number };

export const STRUCTURES: Structure[] = [
  { id: 'skin', label: 'Skin', plain: 'Your body’s outer layer — and where temperature is sensed.', system: 'immune', layer: 'skin', color: '#D7A68D', roughness: 0.62 },
  { id: 'muscles', label: 'Muscles', plain: 'They move you — and shrink without loading in microgravity.', system: 'musculoskeletal', layer: 'muscles', color: '#9C3B32', roughness: 0.5 },
  { id: 'skeleton', label: 'Skeleton', plain: 'Bones carry your weight; in orbit they can lose density.', system: 'musculoskeletal', layer: 'skeleton', color: '#E9E0CC', roughness: 0.55 },
  { id: 'heart', label: 'Heart', plain: 'Pumps blood. Heart rate and HRV come from here.', system: 'cardiovascular', layer: 'organs', color: '#9E1F27', roughness: 0.38 },
  { id: 'arteries', label: 'Arteries', plain: 'Carry oxygen-rich blood away from the heart.', system: 'cardiovascular', layer: 'vessels', color: '#C8242D', roughness: 0.35 },
  { id: 'veins', label: 'Veins', plain: 'Return blood to the heart. Fluids shift headward in space.', system: 'cardiovascular', layer: 'vessels', color: '#2F5BD3', roughness: 0.35 },
  { id: 'lungs', label: 'Lungs', plain: 'Exchange oxygen and CO₂. Breathing rate and SpO₂ live here.', system: 'respiratory', layer: 'organs', color: '#E58A93', roughness: 0.62 },
  { id: 'airway', label: 'Airway', plain: 'Trachea and bronchi carry air to the lungs.', system: 'respiratory', layer: 'organs', color: '#DCC6B4', roughness: 0.5 },
  { id: 'diaphragm', label: 'Diaphragm', plain: 'The breathing muscle beneath the lungs.', system: 'respiratory', layer: 'organs', color: '#A8493E', roughness: 0.5 },
  { id: 'brain', label: 'Brain', plain: 'Sleep, mood and stress are its signals.', system: 'neuro', layer: 'organs', color: '#E4B4AB', roughness: 0.55 },
  { id: 'spinalcord', label: 'Spinal cord', plain: 'The nervous system’s main highway.', system: 'neuro', layer: 'organs', color: '#F0DFB0', roughness: 0.5 },
  { id: 'eyes', label: 'Eyes', plain: 'Vision can change on long missions (SANS).', system: 'neuro', layer: 'organs', color: '#D9D2C8', roughness: 0.25 },
  { id: 'liver', label: 'Liver', plain: 'Processes nutrients and stores energy.', system: 'metabolic', layer: 'organs', color: '#7B2A1E', roughness: 0.42 },
  { id: 'stomach', label: 'Stomach', plain: 'Digests food — appetite often changes in space.', system: 'metabolic', layer: 'organs', color: '#D88A78', roughness: 0.5 },
  { id: 'intestines', label: 'Intestines', plain: 'Absorb nutrients and water.', system: 'metabolic', layer: 'organs', color: '#D49A82', roughness: 0.55 },
  { id: 'pancreas', label: 'Pancreas', plain: 'Regulates blood sugar.', system: 'metabolic', layer: 'organs', color: '#E2B37C', roughness: 0.55 },
  { id: 'kidneys', label: 'Kidneys', plain: 'Filter blood; kidney-stone risk rises in spaceflight.', system: 'metabolic', layer: 'organs', color: '#8A2C26', roughness: 0.42 },
  { id: 'spleen', label: 'Spleen', plain: 'Filters blood and supports immunity.', system: 'immune', layer: 'organs', color: '#6B1F2D', roughness: 0.42 },
  { id: 'thymus', label: 'Thymus', plain: 'Trains immune cells.', system: 'immune', layer: 'organs', color: '#D9A07A', roughness: 0.5 },
];

export const STRUCTURE_BY_ID = Object.fromEntries(STRUCTURES.map((s) => [s.id, s])) as Record<StructureId, Structure>;

export const LAYERS: { id: LayerId; label: string }[] = [
  { id: 'skin', label: 'Skin' },
  { id: 'muscles', label: 'Muscles' },
  { id: 'skeleton', label: 'Skeleton' },
  { id: 'organs', label: 'Organs' },
  { id: 'vessels', label: 'Vessels' },
];

/** Which layers to show when a body system is selected (so the system is never hidden behind skin or muscle). */
export const SYSTEM_LAYERS: Record<SystemId | 'body', LayerId[]> = {
  body: ['skin', 'skeleton', 'organs', 'vessels'],
  cardiovascular: ['skeleton', 'organs', 'vessels'],
  respiratory: ['skeleton', 'organs', 'vessels'],
  neuro: ['skeleton', 'organs'],
  musculoskeletal: ['muscles', 'skeleton'],
  immune: ['skin', 'skeleton', 'organs'],
  metabolic: ['skeleton', 'organs', 'vessels'],
};

export type AnatomyMeta = { structures: Partial<Record<StructureId, { parts: number; of: number; tris: number }>>; source: string };
