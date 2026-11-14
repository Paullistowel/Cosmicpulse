import { ACTIVITY, dayKey, rankFor, totalXp, type ActivityType, type XpEvent } from './progress';

/**
 * Daily objectives, weekly missions and achievements — all evaluated from
 * participation events only (see progress.ts safety rules).
 */
export type ArtKey = 'pulse' | 'moon' | 'bed' | 'orbit' | 'radar' | 'atom' | 'book' | 'shield' | 'steps' | 'brain' | 'station' | 'star';

export type Objective = { id: string; title: string; explain: string; art: ArtKey; types: ActivityType[]; href: string; action: string; target: number; xp: number };

export const DAILY: Objective[] = [
  { id: 'd-health', title: 'Daily health check', explain: 'Record one vital sign — any reading counts, whatever the value.', art: 'pulse', types: ['vital_recorded'], href: '/record', action: 'Record a vital', target: 1, xp: ACTIVITY.vital_recorded.xp },
  { id: 'd-mood', title: 'Mood check-in', explain: 'Tell CosmicPulse how your mood, energy and stress feel today.', art: 'brain', types: ['mood_checkin'], href: '/record?tab=mood', action: 'Check in', target: 1, xp: ACTIVITY.mood_checkin.xp },
  { id: 'd-sleep', title: 'Review your sleep report', explain: 'Look over last night’s sleep and your recovery.', art: 'bed', types: ['sleep_review'], href: '/sleep', action: 'Open sleep', target: 1, xp: ACTIVITY.sleep_review.xp },
  { id: 'd-briefing', title: 'Receive the Sentinel briefing', explain: 'Hear what changed in your health data since yesterday.', art: 'radar', types: ['briefing_viewed'], href: '/sentinel', action: 'Play briefing', target: 1, xp: ACTIVITY.briefing_viewed.xp },
  { id: 'd-move', title: 'Log a movement activity', explain: 'Record today’s steps or exercise session — no minimum required.', art: 'steps', types: ['activity_logged'], href: '/record?tab=activity', action: 'Log activity', target: 1, xp: ACTIVITY.activity_logged.xp },
];

export type Mission = Objective & { scope: 'week'; distinctDays?: boolean; distinctKeys?: boolean };

export const WEEKLY: Mission[] = [
  { id: 'w-consistency', scope: 'week', title: 'Five-day check-in streak', explain: 'Do a mood check-in on 5 different days this week.', art: 'star', types: ['mood_checkin'], href: '/record?tab=mood', action: 'Check in', target: 5, xp: 60, distinctDays: true },
  { id: 'w-hazards', scope: 'week', title: 'Hazard field study', explain: 'Explore 2 of the 5 NASA spaceflight hazards.', art: 'atom', types: ['hazard_explored'], href: '/simulator', action: 'Explore hazards', target: 2, xp: 60, distinctKeys: true },
  { id: 'w-confinement', scope: 'week', title: 'Crew wellbeing check', explain: 'Complete one confinement wellbeing check-in.', art: 'shield', types: ['confinement_checkin'], href: '/wellness', action: 'Open wellness', target: 1, xp: 60 },
  { id: 'w-sentinel', scope: 'week', title: 'Work with Sentinel', explain: 'Review 2 Sentinel recommendations or complete a follow-up.', art: 'radar', types: ['recommendation_reviewed', 'followup_completed'], href: '/sentinel', action: 'Open Sentinel', target: 2, xp: 60 },
  { id: 'w-research', scope: 'week', title: 'Read the science', explain: 'Read 3 NASA or CSA research sources.', art: 'book', types: ['research_read'], href: '/research', action: 'Open library', target: 3, xp: 60, distinctKeys: true },
  { id: 'w-sleep', scope: 'week', title: 'Sleep log', explain: 'Log or review sleep on 4 days this week.', art: 'moon', types: ['sleep_logged', 'sleep_review'], href: '/sleep', action: 'Open sleep', target: 4, xp: 60, distinctDays: true },
];

const startOfWeek = (now: number) => {
  const d = new Date(now);
  const day = (d.getDay() + 6) % 7;
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - day);
  return d.getTime();
};
export const weekKey = (now: number) => new Date(startOfWeek(now)).toISOString().slice(0, 10);

export function dailyProgress(o: Objective, events: XpEvent[], now: number) {
  const n = events.filter((e) => o.types.includes(e.type) && dayKey(e.at) === dayKey(now)).length;
  return { done: Math.min(n, o.target), complete: n >= o.target };
}

export function weeklyProgress(m: Mission, events: XpEvent[], now: number) {
  const from = startOfWeek(now);
  const evs = events.filter((e) => m.types.includes(e.type) && new Date(e.at).getTime() >= from);
  const n = m.distinctDays ? new Set(evs.map((e) => dayKey(e.at))).size : m.distinctKeys ? new Set(evs.map((e) => e.key)).size : evs.length;
  return { done: Math.min(n, m.target), complete: n >= m.target };
}

export type Achievement = { id: string; title: string; detail: string; shape: 'hex' | 'circle' | 'shield' | 'star' | 'diamond' | 'ring'; hue: string; art: ArtKey; test: (ev: XpEvent[], unlocked: Record<string, string>) => boolean; hint: string };

const count = (ev: XpEvent[], t: ActivityType) => ev.filter((e) => e.type === t).length;
const days = (ev: XpEvent[], ts: ActivityType[]) => new Set(ev.filter((e) => ts.includes(e.type)).map((e) => dayKey(e.at))).size;
const keys = (ev: XpEvent[], t: ActivityType) => new Set(ev.filter((e) => e.type === t).map((e) => e.key)).size;

export const ACHIEVEMENTS: Achievement[] = [
  { id: 'cadet_graduate', title: 'Mission Briefed', detail: 'Completed the CosmicPulse onboarding.', shape: 'ring', hue: '#7CC8F2', art: 'orbit', test: (e) => count(e, 'onboarding') > 0, hint: 'Finish the welcome briefing.' },
  { id: 'first_check', title: 'First Health Check', detail: 'Recorded your first health check.', shape: 'circle', hue: '#3FD38E', art: 'pulse', test: (e) => count(e, 'vital_recorded') + count(e, 'mood_checkin') > 0, hint: 'Record a vital or check in.' },
  { id: 'sleep_guardian', title: 'Sleep Guardian', detail: 'Looked after sleep on 5 different days.', shape: 'shield', hue: '#A9B5F2', art: 'moon', test: (e) => days(e, ['sleep_review', 'sleep_logged']) >= 5, hint: 'Review or log sleep on 5 days.' },
  { id: 'consistency_champion', title: 'Consistency Champion', detail: 'Checked in on 7 different days.', shape: 'star', hue: '#F2B84B', art: 'star', test: (e) => days(e, ['mood_checkin', 'vital_recorded']) >= 7, hint: 'Check in on 7 different days.' },
  { id: 'hazard_researcher', title: 'Hazard Researcher', detail: 'Explored all five NASA spaceflight hazards.', shape: 'hex', hue: '#FF8A65', art: 'atom', test: (e) => keys(e, 'hazard_explored') >= 5, hint: 'Explore all 5 hazards.' },
  { id: 'data_detective', title: 'Data Detective', detail: 'Explored your timeline and assessments.', shape: 'diamond', hue: '#62D2E6', art: 'radar', test: (e) => days(e, ['timeline_explored']) >= 2 && count(e, 'assessment_review') > 0, hint: 'Explore the timeline on 2 days and review an assessment.' },
  { id: 'sentinel_collaborator', title: 'Sentinel Collaborator', detail: 'Reviewed recommendations and followed up.', shape: 'ring', hue: '#B39DFF', art: 'radar', test: (e) => count(e, 'recommendation_reviewed') >= 2 || count(e, 'followup_completed') >= 1, hint: 'Review 2 recommendations or complete a follow-up.' },
  { id: 'mission_explorer', title: 'Mission Explorer', detail: 'Toured the station and the digital twin.', shape: 'hex', hue: '#7CC8F2', art: 'station', test: (e) => keys(e, 'station_visited') + keys(e, 'twin_explored') >= 5, hint: 'Visit 5 station modules or body systems.' },
  { id: 'research_scholar', title: 'Research Scholar', detail: 'Read 5 research sources.', shape: 'shield', hue: '#3FD38E', art: 'book', test: (e) => keys(e, 'research_read') >= 5, hint: 'Read 5 sources in the library.' },
  { id: 'mission_planner', title: 'Mission Planner', detail: 'Ran scenario simulations on 3 days.', shape: 'diamond', hue: '#F2B84B', art: 'orbit', test: (e) => days(e, ['simulator_run']) >= 3, hint: 'Run the scenario simulator on 3 days.' },
  { id: 'crew_care', title: 'Crew Care', detail: 'Completed 3 confinement wellbeing check-ins.', shape: 'circle', hue: '#A9B5F2', art: 'shield', test: (e) => count(e, 'confinement_checkin') >= 3, hint: 'Complete 3 confinement check-ins.' },
  { id: 'commander', title: 'Mission Commander', detail: 'Reached the highest mission rank.', shape: 'star', hue: '#EAF1F8', art: 'star', test: (e) => rankFor(totalXp(e)).rank.id === 'mission_commander', hint: 'Reach 2,200 XP.' },
];
