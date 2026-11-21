import { createRng, forkSeed, withRng } from '../../src/engine/rng';

describe('rng', () => {
  it('is deterministic for a seed', () => {
    const a = createRng(42);
    const b = createRng(42);
    expect(Array.from({ length: 20 }, () => a.next())).toEqual(Array.from({ length: 20 }, () => b.next()));
  });

  it('produces values in range', () => {
    const r = createRng(1);
    for (let i = 0; i < 2000; i++) {
      const f = r.next();
      expect(f).toBeGreaterThanOrEqual(0);
      expect(f).toBeLessThan(1);
      const n = r.int(3, 7);
      expect(n).toBeGreaterThanOrEqual(3);
      expect(n).toBeLessThan(7);
    }
  });

  it('weighted() respects weights and never picks zero weight', () => {
    const r = createRng(7);
    const counts = { a: 0, b: 0, z: 0 };
    for (let i = 0; i < 6000; i++) counts[r.weighted(['a', 'b', 'z'] as const, (x) => (x === 'a' ? 3 : x === 'b' ? 1 : 0))]++;
    expect(counts.z).toBe(0);
    expect(counts.a / counts.b).toBeGreaterThan(2.5);
    expect(counts.a / counts.b).toBeLessThan(3.5);
  });

  it('shuffle is a permutation', () => {
    const r = createRng(3);
    const s = r.shuffle([1, 2, 3, 4, 5, 6]);
    expect([...s].sort()).toEqual([1, 2, 3, 4, 5, 6]);
  });

  it('state round-trips, so saves resume the same stream', () => {
    const r = createRng(99);
    r.next();
    const saved = r.state();
    const expected = r.next();
    expect(createRng(saved).next()).toBe(expected);
  });

  it('forkSeed gives independent, stable streams', () => {
    expect(forkSeed(5, 'map')).toBe(forkSeed(5, 'map'));
    expect(forkSeed(5, 'map')).not.toBe(forkSeed(5, 'events'));
    expect(forkSeed(5, 'map')).not.toBe(forkSeed(6, 'map'));
  });

  it('withRng returns the advanced state', () => {
    const [v, st] = withRng(10, (r) => r.next());
    const r = createRng(10);
    expect(v).toBe(r.next());
    expect(st).toBe(r.state());
  });
});
