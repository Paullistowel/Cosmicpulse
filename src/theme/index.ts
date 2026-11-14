/** Semantic tones shared with the mobile core (`Tone` from the mobile theme). */
export type Tone = 'neutral' | 'primary' | 'accent' | 'mind' | 'success' | 'warning' | 'critical' | 'info' | 'demo';

/** Tailwind classes for a tone: foreground + soft background (tokens in globals.css). */
export const TONE_CLASS: Record<Tone, string> = {
  neutral: 'text-ink-2 bg-sunken',
  primary: 'text-primary bg-primary-soft',
  accent: 'text-accent bg-accent-soft',
  mind: 'text-mind bg-mind-soft',
  success: 'text-success bg-success-soft',
  warning: 'text-warning-ink bg-warning-soft',
  critical: 'text-critical bg-critical-soft',
  info: 'text-info bg-info-soft',
  demo: 'text-demo bg-demo-soft',
};

export const TONE_TEXT: Record<Tone, string> = {
  neutral: 'text-ink-2',
  primary: 'text-primary',
  accent: 'text-accent',
  mind: 'text-mind',
  success: 'text-success',
  warning: 'text-warning-ink',
  critical: 'text-critical',
  info: 'text-info',
  demo: 'text-demo',
};

/** CSS variable for a tone's foreground colour (for SVG / charts). */
export const toneVar = (t: Tone) => (t === 'neutral' ? 'var(--ink-2)' : t === 'warning' ? 'var(--warning)' : `var(--${t})`);
