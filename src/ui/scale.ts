// UI scale: 1 on a phone, growing with the window up to 1.8 on a large desktop. Exposed to CSS as `--s`
// (multiply px sizes by it with calc) and to components through useUiScale() for sizes set in code
// (images, pattern cells).

import { useSyncExternalStore } from 'react';

const MIN = 1;
const MAX = 1.8;
/** Window size at which the scale starts to grow past 1: a little bigger than a landscape phone. */
const BASE_W = 900;
const BASE_H = 560;

function compute(): number {
  if (typeof window === 'undefined') return 1;
  const s = Math.min(window.innerWidth / BASE_W, window.innerHeight / BASE_H);
  return Math.round(Math.max(MIN, Math.min(MAX, s)) * 100) / 100;
}

let scale = compute();
const listeners = new Set<() => void>();

function apply() {
  scale = compute();
  document.documentElement.style.setProperty('--s', String(scale));
  listeners.forEach((l) => l());
}

if (typeof window !== 'undefined') {
  apply();
  window.addEventListener('resize', apply);
}

function subscribe(l: () => void) {
  listeners.add(l);
  return () => listeners.delete(l);
}

/** The current UI scale; re-renders when the window is resized across a step. */
export function useUiScale(): number {
  return useSyncExternalStore(subscribe, () => scale, () => 1);
}

/** A px size scaled by the UI scale, rounded to whole pixels. */
export function useScaled(px: number): number {
  return Math.round(px * useUiScale());
}
