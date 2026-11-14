/* Copied verbatim from the CosmicPulse mobile app (src/data/demo/reference.ts) by scripts/sync-mobile-core.mjs.
 * Edit the mobile original and re-run `npm run sync:mobile`; do not edit this copy. */
import type { Professional } from '../types';

/**
 * FICTIONAL DIRECTORY. These people do not exist; credentials are illustrative
 * and unverified. The UI labels every entry as demo. Replace with a verified
 * provider directory (e.g. NPPES / national registers) before production.
 */
export const PROFESSIONALS: Professional[] = [
  {
    id: 'pro-1',
    name: 'Dr. Elena Varga',
    role: 'doctor',
    specialty: 'Family medicine',
    qualifications: ['MD (demo)', 'Board certification (demo)'],
    serviceArea: 'Downtown clinic · Telehealth',
    languages: ['English', 'Hungarian'],
    verified: false,
    telehealth: true,
    bio: 'Primary care with an interest in preventive health and chronic condition follow-up.',
  },
  {
    id: 'pro-2',
    name: 'Dr. Marcus Oyelaran',
    role: 'doctor',
    specialty: 'Cardiology',
    qualifications: ['MD (demo)', 'Cardiology fellowship (demo)'],
    serviceArea: 'Riverside Heart Centre',
    languages: ['English', 'Yoruba'],
    verified: false,
    telehealth: false,
    bio: 'General cardiology, hypertension and rhythm follow-up.',
  },
  {
    id: 'pro-3',
    name: 'Dr. Hana Sato',
    role: 'doctor',
    specialty: 'Endocrinology',
    qualifications: ['MD (demo)'],
    serviceArea: 'Telehealth only',
    languages: ['English', 'Japanese'],
    verified: false,
    telehealth: true,
    bio: 'Diabetes, thyroid and metabolic health.',
  },
  {
    id: 'pro-4',
    name: 'Leo Brandt, PharmD',
    role: 'pharmacist',
    specialty: 'Medication review',
    qualifications: ['PharmD (demo)'],
    serviceArea: 'Northside Pharmacy · Phone',
    languages: ['English', 'German'],
    verified: false,
    telehealth: true,
    bio: 'Medication reviews, interaction questions and adherence planning.',
  },
  {
    id: 'pro-5',
    name: 'Dr. Amira Haddad',
    role: 'psychologist',
    specialty: 'Clinical psychology · CBT',
    qualifications: ['PsyD (demo)'],
    serviceArea: 'Telehealth',
    languages: ['English', 'Arabic', 'French'],
    verified: false,
    telehealth: true,
    bio: 'Anxiety, low mood and stress using cognitive behavioural approaches.',
  },
  {
    id: 'pro-6',
    name: 'Dr. Tomás Reyes',
    role: 'psychiatrist',
    specialty: 'Adult psychiatry',
    qualifications: ['MD (demo)', 'Psychiatry residency (demo)'],
    serviceArea: 'Westgate Mental Health Clinic',
    languages: ['English', 'Spanish'],
    verified: false,
    telehealth: true,
    bio: 'Assessment and medication management for mood and anxiety conditions.',
  },
  {
    id: 'pro-7',
    name: 'Grace Whitfield, LPC',
    role: 'counsellor',
    specialty: 'Licensed professional counsellor',
    qualifications: ['MA Counselling (demo)', 'LPC (demo)'],
    serviceArea: 'Telehealth · Evenings',
    languages: ['English'],
    verified: false,
    telehealth: true,
    bio: 'Burnout, life transitions and grief.',
  },
  {
    id: 'pro-8',
    name: 'Harbour Community Health Clinic',
    role: 'clinic',
    specialty: 'Walk-in & primary care',
    qualifications: ['Community clinic (demo)'],
    serviceArea: 'Harbour district',
    languages: ['English', 'Spanish', 'Mandarin'],
    verified: false,
    telehealth: false,
    bio: 'Primary care, vaccinations and lab draws.',
  },
];

export const ROLE_LABEL: Record<Professional['role'], string> = {
  doctor: 'Doctor',
  pharmacist: 'Pharmacist',
  psychologist: 'Psychologist',
  psychiatrist: 'Psychiatrist',
  counsellor: 'Counsellor',
  clinic: 'Clinic',
};

/* ------------------------------ Wellness ------------------------------ */

export type ExerciseKind = 'breathing' | 'grounding' | 'meditation' | 'body_scan';

export type Exercise = {
  id: string;
  kind: ExerciseKind;
  title: string;
  subtitle: string;
  minutes: number;
  /** Breathing pattern in seconds: inhale, hold, exhale, hold. */
  pattern?: [number, number, number, number];
  steps: string[];
  evidence: string;
};

export const EXERCISES: Exercise[] = [
  {
    id: 'box-breathing',
    kind: 'breathing',
    title: 'Box breathing',
    subtitle: 'Even 4-4-4-4 rhythm to steady the body',
    minutes: 3,
    pattern: [4, 4, 4, 4],
    steps: ['Breathe in through your nose', 'Hold gently', 'Breathe out slowly', 'Hold'],
    evidence: 'Slow, paced breathing is associated with reduced self-reported stress in several small trials.',
  },
  {
    id: 'extended-exhale',
    kind: 'breathing',
    title: 'Longer exhale',
    subtitle: '4-in, 6-out breathing to wind down',
    minutes: 4,
    pattern: [4, 0, 6, 0],
    steps: ['Breathe in for four', 'Breathe out for six'],
    evidence: 'Exhale-focused breathing has been studied for short-term mood and anxiety benefits.',
  },
  {
    id: '54321',
    kind: 'grounding',
    title: '5-4-3-2-1 grounding',
    subtitle: 'Use your senses to come back to the present',
    minutes: 5,
    steps: [
      'Notice 5 things you can see',
      'Notice 4 things you can feel',
      'Notice 3 things you can hear',
      'Notice 2 things you can smell',
      'Notice 1 thing you can taste',
    ],
    evidence: 'A common grounding technique used in anxiety and trauma-informed care.',
  },
  {
    id: 'body-scan',
    kind: 'body_scan',
    title: 'Body scan',
    subtitle: 'Release tension from head to toe',
    minutes: 8,
    steps: [
      'Settle into a comfortable position',
      'Notice your forehead, jaw and shoulders',
      'Move attention to your chest and breath',
      'Notice your stomach and lower back',
      'Notice your legs and feet',
      'Rest your attention on the whole body',
    ],
    evidence: 'Part of mindfulness-based stress reduction (MBSR) programmes.',
  },
  {
    id: 'loving-kindness',
    kind: 'meditation',
    title: 'Kindness meditation',
    subtitle: 'A short practice of self-compassion',
    minutes: 6,
    steps: [
      'Bring to mind someone you care about',
      'Silently wish them well',
      'Offer the same wish to yourself',
      'Extend it to people around you',
    ],
    evidence: 'Loving-kindness practice has modest evidence for improving positive emotion.',
  },
];

/* ------------------------------ Screening ------------------------------ */

/**
 * PHQ-9 and GAD-7 were developed by Drs. Spitzer, Williams, Kroenke and colleagues
 * with an educational grant from Pfizer Inc. The instruments' publisher states:
 * "No permission required to reproduce, translate, display or distribute."
 * Source: https://www.phqscreeners.com
 */
export const SCREENING_OPTIONS = [
  { value: 0, label: 'Not at all' },
  { value: 1, label: 'Several days' },
  { value: 2, label: 'More than half the days' },
  { value: 3, label: 'Nearly every day' },
] as const;

export const PHQ9 = {
  id: 'phq9' as const,
  name: 'PHQ-9',
  title: 'Mood (PHQ-9)',
  stem: 'Over the last 2 weeks, how often have you been bothered by any of the following problems?',
  items: [
    'Little interest or pleasure in doing things',
    'Feeling down, depressed, or hopeless',
    'Trouble falling or staying asleep, or sleeping too much',
    'Feeling tired or having little energy',
    'Poor appetite or overeating',
    'Feeling bad about yourself — or that you are a failure or have let yourself or your family down',
    'Trouble concentrating on things, such as reading the newspaper or watching television',
    'Moving or speaking so slowly that other people could have noticed? Or the opposite — being so fidgety or restless that you have been moving around a lot more than usual',
    'Thoughts that you would be better off dead or of hurting yourself in some way',
  ],
  bands: [
    { max: 4, label: 'Minimal' },
    { max: 9, label: 'Mild' },
    { max: 14, label: 'Moderate' },
    { max: 19, label: 'Moderately severe' },
    { max: 27, label: 'Severe' },
  ],
  /** Index of item 9 — any non-zero answer triggers the crisis-support pathway. */
  safetyItem: 8,
  source: 'Kroenke K, Spitzer RL, Williams JB. J Gen Intern Med. 2001;16(9):606-613.',
};

export const GAD7 = {
  id: 'gad7' as const,
  name: 'GAD-7',
  title: 'Anxiety (GAD-7)',
  stem: 'Over the last 2 weeks, how often have you been bothered by the following problems?',
  items: [
    'Feeling nervous, anxious, or on edge',
    'Not being able to stop or control worrying',
    'Worrying too much about different things',
    'Trouble relaxing',
    'Being so restless that it is hard to sit still',
    'Becoming easily annoyed or irritable',
    'Feeling afraid, as if something awful might happen',
  ],
  bands: [
    { max: 4, label: 'Minimal' },
    { max: 9, label: 'Mild' },
    { max: 14, label: 'Moderate' },
    { max: 21, label: 'Severe' },
  ],
  safetyItem: -1,
  source: 'Spitzer RL, Kroenke K, Williams JB, Löwe B. Arch Intern Med. 2006;166(10):1092-1097.',
};

export const INSTRUMENTS = { phq9: PHQ9, gad7: GAD7 };

export function scoreBand(instrument: 'phq9' | 'gad7', score: number) {
  return INSTRUMENTS[instrument].bands.find((b) => score <= b.max)?.label ?? 'Unknown';
}

/* ---------------------------- Crisis resources ---------------------------- */

/**
 * Compiled from the services' own public websites. Numbers change — production
 * must re-verify per region and localise using a verified location, never a guess.
 */
export type CrisisLine = { region: string; name: string; contact: string; dial?: string; sms?: string; url: string };

export const CRISIS_LINES: CrisisLine[] = [
  { region: 'United States', name: '988 Suicide & Crisis Lifeline', contact: 'Call or text 988', dial: '988', sms: '988', url: 'https://988lifeline.org' },
  { region: 'United States', name: 'Emergency services', contact: 'Call 911', dial: '911', url: 'https://www.911.gov' },
  { region: 'Canada', name: '9-8-8 Suicide Crisis Helpline', contact: 'Call or text 988', dial: '988', sms: '988', url: 'https://988.ca' },
  { region: 'United Kingdom & Ireland', name: 'Samaritans', contact: 'Call 116 123', dial: '116123', url: 'https://www.samaritans.org' },
  { region: 'United Kingdom', name: 'Emergency services', contact: 'Call 999', dial: '999', url: 'https://www.nhs.uk/nhs-services/urgent-and-emergency-care-services/when-to-call-999/' },
  { region: 'European Union', name: 'Emergency services', contact: 'Call 112', dial: '112', url: 'https://digital-strategy.ec.europa.eu/en/policies/112' },
  { region: 'Australia', name: 'Lifeline', contact: 'Call 13 11 14', dial: '131114', url: 'https://www.lifeline.org.au' },
  { region: 'Anywhere', name: 'Find A Helpline', contact: 'Directory of free, confidential helplines by country', url: 'https://findahelpline.com' },
];

export const CRISIS_VERIFIED_NOTE =
  'Numbers come from each service’s public website and must be re-checked before release. If you are outside these regions, contact your local emergency number.';
