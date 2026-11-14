import { Atom, Globe2, Orbit, Users, Wind } from 'lucide-react';

import type { HazardId } from '@/research/hazards';
import type { SystemId } from '@/twin/systems';

export const HAZARD_ICON: Record<HazardId, typeof Atom> = { radiation: Atom, isolation: Users, distance: Globe2, gravity: Orbit, environment: Wind };
/** NASA public-domain imagery (see public/images/nasa/credits.json and public/images/CREDITS.md). */
export const HAZARD_IMAGE: Record<HazardId, string> = { radiation: '/images/nasa/solar-flare.jpg', isolation: '/images/nasa/cupola.jpg', distance: '/images/nasa/mars.jpg', gravity: '/images/nasa/treadmill.jpg', environment: '/images/nasa/iss-orbit.jpg' };
export const HAZARD_CAPTION: Record<HazardId, string> = {
  radiation: 'NASA SDO — a significant solar flare (GSFC).',
  isolation: 'CSA astronaut David Saint-Jacques aboard the ISS (NASA).',
  distance: 'Mars from NASA’s Curiosity rover (JPL).',
  gravity: 'ISS treadmill countermeasure exercise, Expedition 18 (NASA).',
  environment: 'The International Space Station in orbit, STS-88 (NASA).',
};
export const HAZARD_SHORT_NAME: Record<HazardId, string> = { radiation: 'Radiation', isolation: 'Isolation', distance: 'Distance', gravity: 'Microgravity', environment: 'Closed habitat' };
export const HAZARD_SYSTEMS: Record<HazardId, SystemId[]> = {
  radiation: ['immune', 'cardiovascular'],
  isolation: ['neuro'],
  distance: ['metabolic', 'neuro'],
  gravity: ['musculoskeletal', 'cardiovascular', 'neuro'],
  environment: ['respiratory', 'immune'],
};
