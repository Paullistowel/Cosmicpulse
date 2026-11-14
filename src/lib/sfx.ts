'use client';

/**
 * Tiny synthesised sound effects (Web Audio — no audio files, nothing to license).
 * Only plays after a user gesture and when the user hasn't muted sound.
 */
let ctx: AudioContext | null = null;
function ac(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!ctx) {
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
  }
  void ctx.resume();
  return ctx;
}

function tone(freq: number, dur: number, type: OscillatorType, gain: number, slideTo?: number, delay = 0) {
  const c = ac();
  if (!c) return;
  const t = c.currentTime + delay;
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(gain, t + 0.02);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(c.destination);
  o.start(t);
  o.stop(t + dur + 0.05);
}

function noise(dur: number, gain: number, from: number, to: number) {
  const c = ac();
  if (!c) return;
  const buf = c.createBuffer(1, Math.floor(c.sampleRate * dur), c.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  const src = c.createBufferSource();
  src.buffer = buf;
  const f = c.createBiquadFilter();
  f.type = 'lowpass';
  f.frequency.setValueAtTime(from, c.currentTime);
  f.frequency.exponentialRampToValueAtTime(to, c.currentTime + dur);
  const g = c.createGain();
  g.gain.setValueAtTime(0.0001, c.currentTime);
  g.gain.exponentialRampToValueAtTime(gain, c.currentTime + dur * 0.3);
  g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + dur);
  src.connect(f).connect(g).connect(c.destination);
  src.start();
}

export const sfx = {
  /** soft UI tick */
  tick: () => tone(1200, 0.06, 'sine', 0.04),
  /** discovery chime (two notes) */
  chime: () => {
    tone(880, 0.25, 'triangle', 0.08);
    tone(1318.5, 0.35, 'triangle', 0.07, undefined, 0.1);
  },
  /** reward sparkle */
  sparkle: () => [1046.5, 1318.5, 1568, 2093].forEach((f, i) => tone(f, 0.18, 'sine', 0.05, undefined, i * 0.06)),
  /** launch: rumble + rising whoosh */
  launch: () => {
    noise(2.2, 0.35, 180, 2400);
    tone(55, 1.8, 'sawtooth', 0.12, 110);
    tone(220, 1.6, 'sine', 0.05, 1760, 0.3);
  },
};
