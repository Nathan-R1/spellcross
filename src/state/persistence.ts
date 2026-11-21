// One save slot in localStorage (doc 04). Corrupt or unknown saves are moved aside, not thrown away.

import type { RunState } from '../engine/run';

export const SAVE_KEY = 'spellcross:run:v1';

function storage(): Storage | null {
  try {
    return typeof localStorage !== 'undefined' ? localStorage : null;
  } catch {
    return null;
  }
}

export function loadSave(): RunState | null {
  const s = storage();
  if (!s) return null;
  try {
    const raw = s.getItem(SAVE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw) as RunState;
    if (data?.version !== 1 || !data.map || !data.player) throw new Error('bad save');
    return data;
  } catch {
    try {
      const raw = s.getItem(SAVE_KEY);
      if (raw) s.setItem(`${SAVE_KEY}:corrupt`, raw);
      s.removeItem(SAVE_KEY);
    } catch {
      /* ignore */
    }
    return null;
  }
}

export function writeSave(run: RunState): void {
  try {
    storage()?.setItem(SAVE_KEY, JSON.stringify(run));
  } catch {
    /* storage full or blocked: the run continues unsaved */
  }
}

export function clearSave(): void {
  try {
    storage()?.removeItem(SAVE_KEY);
  } catch {
    /* ignore */
  }
}
