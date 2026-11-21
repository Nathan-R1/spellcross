// Seeded RNG (doc 02). mulberry32: tiny, fast, deterministic, and its whole state is one 32-bit int,
// so it serialises into saves and battle snapshots.

export type RngState = number;

export interface Rng {
  /** Float in [0, 1). */
  next(): number;
  /** Integer in [min, maxExclusive). */
  int(min: number, maxExclusive: number): number;
  /** Pick by weight. Items with weight <= 0 are never picked (unless all are 0, then uniform). */
  weighted<T>(items: readonly T[], weightOf: (item: T) => number): T;
  pick<T>(items: readonly T[]): T;
  shuffle<T>(items: readonly T[]): T[];
  /** Current state, for saving. */
  state(): RngState;
}

export function createRng(seed: RngState): Rng {
  let s = seed >>> 0;
  const next = () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const int = (min: number, maxExclusive: number) => {
    if (maxExclusive <= min) return min;
    return min + Math.floor(next() * (maxExclusive - min));
  };
  return {
    next,
    int,
    weighted<T>(items: readonly T[], weightOf: (item: T) => number): T {
      if (items.length === 0) throw new Error('rng.weighted: empty list');
      const weights = items.map((i) => Math.max(0, weightOf(i)));
      const total = weights.reduce((a, b) => a + b, 0);
      if (total <= 0) return items[int(0, items.length)];
      let roll = next() * total;
      for (let i = 0; i < items.length; i++) {
        roll -= weights[i];
        if (roll < 0) return items[i];
      }
      return items[items.length - 1];
    },
    pick<T>(items: readonly T[]): T {
      if (items.length === 0) throw new Error('rng.pick: empty list');
      return items[int(0, items.length)];
    },
    shuffle<T>(items: readonly T[]): T[] {
      const a = [...items];
      for (let i = a.length - 1; i > 0; i--) {
        const j = int(0, i + 1);
        [a[i], a[j]] = [a[j], a[i]];
      }
      return a;
    },
    state: () => s,
  };
}

/** Derive an independent stream seed from a run seed and a label ('map', 'events', 'board:3', ...). */
export function forkSeed(seed: number, label: string): RngState {
  // FNV-1a over the label, mixed with the seed, then one mulberry step to decorrelate.
  let h = 0x811c9dc5 ^ (seed >>> 0);
  for (let i = 0; i < label.length; i++) {
    h ^= label.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return createRng(h).int(0, 0xffffffff) >>> 0;
}

/**
 * Run a function against a stored RNG state and get the new state back. Keeps engine functions pure:
 * state in, state out.
 */
export function withRng<T>(state: RngState, fn: (rng: Rng) => T): [T, RngState] {
  const rng = createRng(state);
  const result = fn(rng);
  return [result, rng.state()];
}
