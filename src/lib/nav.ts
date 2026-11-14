import {
  ClipboardList,
  Compass,
  FileText,
  HeartPulse,
  House,
  PlusCircle,
  Rocket,
  Settings,
  Stethoscope,
  Trophy,
  type LucideIcon,
} from 'lucide-react';

export type NavItem = { href: string; label: string; icon: LucideIcon; /** mobile screen name, for AI context */ screen: string; hint?: string; section?: SectionId };

/* ------------------------------------------------------------------ story */

/**
 * The CosmicPulse story — "Humanity is exploring beyond Earth. Your mission is to protect the
 * human body on that journey." Seven chapters frame every screen. They are a map, never a gate:
 * health data, alerts and Emergency are always reachable.
 */
export type ChapterId = 'call' | 'aboard' | 'body' | 'daily' | 'dangers' | 'story' | 'mission';
export const CHAPTERS: { id: ChapterId; n: string; name: string; tagline: string; href: string; image: string }[] = [
  { id: 'call', n: '01', name: 'The call to explore', tagline: 'Why the human body needs protecting', href: '/intro?replay=1', image: '/images/nasa/earth-night.jpg' },
  { id: 'aboard', n: '02', name: 'Welcome aboard', tagline: 'Meet Nova and your mission', href: '/welcome', image: '/images/nasa/quarters.jpg' },
  { id: 'body', n: '03', name: 'Discover your body', tagline: 'Your personal health lab', href: '/twin', image: '/images/nasa/cupola.jpg' },
  { id: 'daily', n: '04', name: 'Your daily mission', tagline: 'Check in, get briefed, stay on course', href: '/', image: '/images/nasa/mission-control.jpg' },
  { id: 'dangers', n: '05', name: 'Dangers of space', tagline: 'Expeditions into five hazards', href: '/simulator', image: '/images/nasa/solar-flare.jpg' },
  { id: 'story', n: '06', name: 'Your health story', tagline: 'Every reading becomes part of the journey', href: '/timeline', image: '/images/nasa/aurora.jpg' },
  { id: 'mission', n: '07', name: 'Complete the mission', tagline: 'Milestones, insignia and rank', href: '/missions', image: '/images/nasa/iss-orbit.jpg' },
];
export const CHAPTER_BY_ID = Object.fromEntries(CHAPTERS.map((c) => [c.id, c])) as Record<ChapterId, (typeof CHAPTERS)[number]>;

/* ------------------------------------------------------------------ sections */

/** Four primary sections — simple enough for anyone, with advanced tools inside. */
export type SectionId = 'home' | 'health' | 'explore' | 'rewards';

export const NAV: { group: string; items: NavItem[] }[] = [
  {
    group: 'Mission',
    items: [
      { href: '/', label: 'Home', icon: House, screen: 'Home', hint: 'Your mission hub', section: 'home' },
      { href: '/twin', label: 'My Health', icon: HeartPulse, screen: 'Health', hint: 'Body lab, Sentinel, health story', section: 'health' },
      { href: '/simulator', label: 'Explore', icon: Compass, screen: 'AI', hint: 'Expeditions into space hazards', section: 'explore' },
      { href: '/missions', label: 'My Rewards', icon: Trophy, screen: 'Home', hint: 'Missions, insignia, rank', section: 'rewards' },
    ],
  },
  {
    group: 'Records',
    items: [
      { href: '/record', label: 'Record data', icon: PlusCircle, screen: 'Health' },
      { href: '/medical', label: 'Medical', icon: Stethoscope, screen: 'Medical' },
      { href: '/reports', label: 'Medical reports', icon: FileText, screen: 'Medical' },
    ],
  },
  { group: 'System', items: [{ href: '/settings', label: 'Settings & data', icon: Settings, screen: 'Profile' }] },
];

export const ALL_NAV = NAV.flatMap((g) => g.items);

/** Section tabs (progressive disclosure). `also` = routes that belong to the section without their own tab. */
export const HUBS: { root: string; label: string; section: SectionId; tabs: { href: string; label: string; screen: string }[]; also?: string[] }[] = [
  {
    root: '/twin',
    label: 'My Health',
    section: 'health',
    tabs: [
      { href: '/twin', label: 'Body lab', screen: 'Health' },
      { href: '/sentinel', label: 'Sentinel', screen: 'AI' },
      { href: '/analytics', label: 'Today', screen: 'Health' },
      { href: '/timeline', label: 'Health story', screen: 'Health' },
      { href: '/vitals', label: 'Vital signs', screen: 'Health' },
      { href: '/sleep', label: 'Sleep', screen: 'Health' },
      { href: '/activity', label: 'Activity', screen: 'Activity' },
      { href: '/wellness', label: 'Mind', screen: 'Health' },
      { href: '/assessments', label: 'Check-ups', screen: 'AI' },
      { href: '/alerts', label: 'Alerts', screen: 'AI' },
    ],
    also: ['/assistant', '/history'],
  },
  {
    root: '/simulator',
    label: 'Explore',
    section: 'explore',
    tabs: [
      { href: '/simulator', label: 'Hazard expeditions', screen: 'AI' },
      { href: '/risk', label: 'Your risk', screen: 'AI' },
      { href: '/research', label: 'Research', screen: 'AI' },
      { href: '/station', label: 'Station tour', screen: 'Home' },
    ],
  },
  { root: '/missions', label: 'My Rewards', section: 'rewards', tabs: [{ href: '/missions', label: 'Missions', screen: 'Home' }, { href: '/achievements', label: 'Insignia', screen: 'Home' }] },
];

const under = (pathname: string, href: string) => pathname === href || pathname.startsWith(`${href}/`);

export function hubFor(pathname: string) {
  return HUBS.find((h) => h.tabs.some((t) => under(pathname, t.href)) || h.also?.some((a) => under(pathname, a)));
}

/** Which primary nav item is active for a path (section sub-pages light up their parent). */
export function activeHref(pathname: string): string | undefined {
  const hub = hubFor(pathname);
  if (hub) return hub.root;
  const hit = [...ALL_NAV].sort((a, b) => b.href.length - a.href.length).find((i) => (i.href === '/' ? pathname === '/' : under(pathname, i.href)));
  return hit?.href;
}

/** Story chapter for a route. */
export function chapterFor(pathname: string): ChapterId {
  if (pathname === '/' || under(pathname, '/sentinel') || under(pathname, '/assistant') || under(pathname, '/record')) return 'daily';
  if (under(pathname, '/twin')) return 'body';
  if (['/simulator', '/risk', '/research', '/station'].some((p) => under(pathname, p))) return 'dangers';
  if (['/missions', '/achievements'].some((p) => under(pathname, p))) return 'mission';
  return 'story';
}

export const MOBILE_TABS: NavItem[] = NAV[0].items;

export function screenFor(pathname: string): string {
  const hub = hubFor(pathname);
  const tab = hub?.tabs.find((t) => under(pathname, t.href));
  if (tab) return tab.screen;
  return ALL_NAV.find((i) => i.href === activeHref(pathname))?.screen ?? 'Home';
}

export const QUICK_ICON = ClipboardList;
export const RANK_ICON = Rocket;
