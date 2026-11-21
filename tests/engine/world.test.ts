// World map generation invariants (spec §3, features §3.1) across many seeds.

import { generateMap, generateTerrain, neighbours, roadPath, STOP_TYPES } from '../../src/engine/world';

const W = 4670;
const H = 1080;

describe('generateMap', () => {
  const seeds = Array.from({ length: 300 }, (_, i) => i + 1);

  it('has one Start (left) and one Finish (right), vertically centred', () => {
    for (const seed of seeds.slice(0, 50)) {
      const m = generateMap(seed, W, H);
      const start = m.stops.filter((s) => s.type === 'start');
      const finish = m.stops.filter((s) => s.type === 'finish');
      expect(start).toHaveLength(1);
      expect(finish).toHaveLength(1);
      expect(start[0].x).toBeCloseTo(W / 6);
      expect(finish[0].x).toBeCloseTo(W - W / 6);
      expect(start[0].y).toBe(H / 2);
    }
  });

  it('has three paths of 4–6 intermediate stops at 25/50/75% height', () => {
    for (const seed of seeds) {
      const m = generateMap(seed, W, H);
      expect(m.paths).toHaveLength(3);
      m.paths.forEach((path, i) => {
        const inner = path.slice(1, -1).map((id) => m.stops[id]);
        expect(inner.length).toBeGreaterThanOrEqual(4);
        expect(inner.length).toBeLessThanOrEqual(6);
        for (const s of inner) expect(Math.abs(s.y - H * [0.25, 0.5, 0.75][i])).toBeLessThanOrEqual(25);
      });
    }
  });

  it('meets the minimums: ≥1 Town, Campfire, Market and ≥1 Trail', () => {
    for (const seed of seeds) {
      const m = generateMap(seed, W, H);
      for (const t of STOP_TYPES.filter((x) => x.minimum > 0)) expect(m.stops.some((s) => s.type === t.id)).toBe(true);
      expect(m.roads.some((r) => r.type === 'trail')).toBe(true);
    }
  });

  it('has no duplicate roads and every stop is reachable from Start', () => {
    for (const seed of seeds) {
      const m = generateMap(seed, W, H);
      const keys = m.roads.map((r) => [Math.min(r.a, r.b), Math.max(r.a, r.b)].join('-'));
      expect(new Set(keys).size).toBe(keys.length);
      const start = m.stops.find((s) => s.type === 'start')!.id;
      const seen = new Set([start]);
      const queue = [start];
      while (queue.length) for (const n of neighbours(m, queue.shift()!)) if (!seen.has(n.stop.id)) { seen.add(n.stop.id); queue.push(n.stop.id); }
      expect(seen.size).toBe(m.stops.length);
    }
  });

  it('only towns and villages are rotated; highways render straight', () => {
    for (const seed of seeds.slice(0, 100)) {
      const m = generateMap(seed, W, H);
      for (const s of m.stops) if (s.type !== 'town' && s.type !== 'village') expect(s.rotation).toBe(0);
      // Connectors store an S-curve, but highways always render straight (Spellford drawRoad).
      for (const r of m.roads) if (r.type === 'highway') expect(roadPath(m, r)).toMatch(/^M[-\d.]+,[-\d.]+ L/);
    }
  });

  it('is deterministic for a seed and differs across seeds', () => {
    expect(generateMap(77, W, H)).toEqual(generateMap(77, W, H));
    expect(generateMap(77, W, H)).not.toEqual(generateMap(78, W, H));
  });

  it('road paths are valid SVG and independent of direction', () => {
    const m = generateMap(5, W, H);
    for (const r of m.roads) {
      expect(roadPath(m, r)).toMatch(/^M[-\d.]+,[-\d.]+ [LQ]/);
      expect(roadPath(m, r, r.b)).toMatch(/^M/);
    }
  });
});

describe('generateTerrain', () => {
  it('produces feature counts in Spellford ranges, deterministically', () => {
    for (let seed = 1; seed <= 50; seed++) {
      const t = generateTerrain(seed, W, H);
      const count = (type: string) => t.filter((f) => f.type === type).length;
      expect(count('forest')).toBeGreaterThanOrEqual(5);
      expect(count('forest')).toBeLessThan(15);
      expect(count('mountain')).toBeGreaterThanOrEqual(5);
      expect(count('lake')).toBeLessThan(6);
      expect(count('river')).toBeGreaterThanOrEqual(1);
      expect(count('river')).toBeLessThan(5);
      for (const f of t) if (f.type === 'river') expect(f.points.length).toBeGreaterThanOrEqual(2);
    }
    expect(generateTerrain(3, W, H)).toEqual(generateTerrain(3, W, H));
  });
});
