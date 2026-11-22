// Board rules (spec §6.2). Includes ports of Spellford's BoardSetTest / BoardFullTest cases.

import {
  boardFromAscii, canSwap, clearTiles, collapse, createBoard, endTurnLocks, findSet, findSetsInColumns, groupForTrigger,
  linkedNeighbours, matchingMoves, swap, tileAt, validMoves, type SpellLookup,
} from '../../src/engine/board';
import { createRng } from '../../src/engine/rng';
import type { Board } from '../../src/engine/types';

// Letters A–G are player spells; d = dud, n = nova, k = linked dud, u = surge (linked nova, mimic), c = critical ('both').
const CLASSES: Record<string, { spellClass: 'player' | 'dud' | 'nova' | 'both'; linked: boolean; mimic?: boolean }> = {
  A: { spellClass: 'player', linked: false }, B: { spellClass: 'player', linked: false }, C: { spellClass: 'player', linked: false },
  D: { spellClass: 'player', linked: false }, E: { spellClass: 'player', linked: false }, F: { spellClass: 'player', linked: false },
  G: { spellClass: 'player', linked: false },
  d: { spellClass: 'dud', linked: false }, n: { spellClass: 'nova', linked: false }, k: { spellClass: 'dud', linked: true },
  u: { spellClass: 'nova', linked: true, mimic: true }, c: { spellClass: 'both', linked: false },
};
const lookup: SpellLookup = (ref) => CLASSES[ref];
const mimic = (ref: string) => (CLASSES[ref]?.mimic ? 'mimicNeighbour' : undefined);
const make = (rows: string[]) => boardFromAscii(rows, (ch) => ch);
const coords = (ps: { x: number; y: number }[]) => ps.map((p) => `${p.x},${p.y}`).sort();

describe('findSet (Spellford BoardSetTest)', () => {
  it('returns empty for a lone tile', () => {
    expect(findSet(make(['ABC', 'BCA', 'CAB']), lookup, 0, 0)).toEqual([]);
  });

  it('finds a horizontal 3', () => {
    expect(findSet(make(['AAAB', 'BCDE']), lookup, 1, 0)).toHaveLength(3);
  });

  it('finds a vertical 4 from any of its tiles, not from a neighbour', () => {
    const b = make(['AB', 'AC', 'AD', 'AE']);
    expect(findSet(b, lookup, 0, 1)).toHaveLength(4);
    expect(findSet(b, lookup, 1, 0)).toEqual([]);
  });

  it('C pattern: an edge tile gets its line (3), the corner gets both (5)', () => {
    const b = make(['AAA', 'BCA', 'CBA']);
    expect(findSet(b, lookup, 1, 0)).toHaveLength(3);
    expect(findSet(b, lookup, 2, 0)).toHaveLength(5);
  });

  it('cross pattern: the middle tile collects all 5 once', () => {
    const b = make(['BAC', 'AAA', 'CAB']);
    expect(coords(findSet(b, lookup, 1, 1))).toEqual(coords([{ x: 0, y: 1 }, { x: 1, y: 0 }, { x: 1, y: 1 }, { x: 1, y: 2 }, { x: 2, y: 1 }]));
  });

  it('long line of 6', () => {
    expect(findSet(make(['BAAAAAAB']), lookup, 4, 0)).toHaveLength(6);
  });

  it('duds of the same type match (D22); novas never do; both block other lines', () => {
    expect(findSet(make(['ddd']), lookup, 1, 0)).toHaveLength(3);
    expect(findSet(make(['dkd']), lookup, 1, 0)).toEqual([]); // different dud types
    expect(findSet(make(['nnn']), lookup, 1, 0)).toEqual([]);
    expect(findSet(make(['AAdAA']), lookup, 0, 0)).toEqual([]);
  });

  it("'both' class (Critical) can match", () => {
    expect(findSet(make(['ccc']), lookup, 1, 0)).toHaveLength(3);
  });

  it('locked tiles are not matched and break lines', () => {
    const b = make(['AAAA']);
    tileAt(b, 1, 0).lock = 'locked';
    expect(findSet(b, lookup, 0, 0)).toEqual([]);
    expect(findSet(b, lookup, 3, 0)).toEqual([]);
  });

  it('pending tiles (just swapped) can still match', () => {
    const b = make(['AAA']);
    tileAt(b, 1, 0).lock = 'pending';
    expect(findSet(b, lookup, 1, 0)).toHaveLength(3);
  });

  it('hidden buffer rows never match', () => {
    const b = boardFromAscii(['AAA', 'BCB'], (c) => c, 1); // row 0 is buffer
    expect(findSet(b, lookup, 1, 0)).toEqual([]);
  });

  it('matches the Spellford 8x8 layout test', () => {
    const b = make(['AAAEEECG', 'GGGGBDCC', 'GDCFBDEE', 'GCCFBEEC', 'FEFDGCDC', 'GEECEGFG', 'EEGGCFFE', 'FCGEGDEE']);
    expect(findSet(b, lookup, 0, 0).every((p) => tileAt(b, p.x, p.y).spell === 'A')).toBe(true);
    expect(findSet(b, lookup, 0, 0)).toHaveLength(3);
    expect(findSet(b, lookup, 3, 0)).toHaveLength(3); // EEE
    expect(findSet(b, lookup, 0, 1)).toHaveLength(6); // GGGG row + G column (0,1)-(0,3)
    expect(findSet(b, lookup, 4, 1)).toHaveLength(3); // B column
  });
});

describe('swapping and clearing (Spellford BoardFullTest)', () => {
  it('swap clears the formed set and leaves the rest', () => {
    // B A B / A B A / B A C, swap (1,1) with (2,1): row 1 becomes A A B? (Spellford test 3x3a)
    const b = make(['BAB', 'ABA', 'BAC']);
    swap(b, { x: 1, y: 1 }, { x: 2, y: 1 });
    const set = [...findSet(b, lookup, 1, 1), ...findSet(b, lookup, 2, 1)];
    clearTiles(b, set);
    expect(tileAt(b, 0, 0).spell).toBe('B');
    expect(tileAt(b, 0, 2).spell).toBe('B');
    expect(tileAt(b, 2, 2).spell).toBe('C');
  });

  it('double four set: bottom row untouched', () => {
    const b = make(['AABA', 'BBAB', 'CDCD']);
    swap(b, { x: 2, y: 0 }, { x: 2, y: 1 });
    const set = [...findSet(b, lookup, 2, 0), ...findSet(b, lookup, 2, 1)];
    expect(set.length).toBe(8);
    clearTiles(b, set);
    expect([0, 1, 2, 3].map((x) => tileAt(b, x, 2).spell).join('')).toBe('CDCD');
  });

  it('swap marks both tiles pending; end of turn: pending → locked → free', () => {
    const b = make(['AB']);
    swap(b, { x: 0, y: 0 }, { x: 1, y: 0 });
    expect(tileAt(b, 0, 0).lock).toBe('pending');
    endTurnLocks(b);
    expect(tileAt(b, 0, 0).lock).toBe('locked');
    endTurnLocks(b);
    expect(tileAt(b, 0, 0).lock).toBe('free');
  });

  it('canSwap: orthogonal neighbours only, both available', () => {
    const b = make(['AB', 'CD']);
    expect(canSwap(b, { x: 0, y: 0 }, { x: 1, y: 0 })).toBe(true);
    expect(canSwap(b, { x: 0, y: 0 }, { x: 1, y: 1 })).toBe(false);
    expect(canSwap(b, { x: 0, y: 0 }, { x: 0, y: 0 })).toBe(false);
    tileAt(b, 1, 0).lock = 'locked';
    expect(canSwap(b, { x: 0, y: 0 }, { x: 1, y: 0 })).toBe(false);
  });

  it('cannot swap into the hidden buffer', () => {
    const b = boardFromAscii(['AB', 'CD'], (c) => c, 1);
    expect(canSwap(b, { x: 0, y: 1 }, { x: 0, y: 0 })).toBe(false);
  });

  it('validMoves counts every legal adjacent pair; matchingMoves only those forming a set', () => {
    const b = make(['AABA', 'CDEF']);
    expect(validMoves(b)).toHaveLength(3 * 2 + 4);
    expect(matchingMoves(b, lookup).map(([p, q]) => `${p.x},${p.y}-${q.x},${q.y}`)).toEqual(['2,0-3,0']);
  });
});

describe('gravity and refill', () => {
  it('tiles fall keeping uid and lock; new tiles spawn on top from the pool', () => {
    const b = make(['A', 'B', 'C', 'D']);
    const uidA = tileAt(b, 0, 0).uid;
    tileAt(b, 0, 0).lock = 'locked';
    clearTiles(b, [{ x: 0, y: 2 }]);
    const cols = collapse(b, [{ ref: 'E', weight: 1 }], createRng(1));
    expect([...cols]).toEqual([0]);
    expect([0, 1, 2, 3].map((y) => tileAt(b, 0, y).spell).join('')).toBe('EABD');
    expect(tileAt(b, 0, 1).uid).toBe(uidA);
    expect(tileAt(b, 0, 1).lock).toBe('locked');
    expect(tileAt(b, 0, 0).lock).toBe('free');
  });

  it('findSetsInColumns finds new sets after a drop', () => {
    const b = make(['A..', 'BAA']);
    tileAt(b, 1, 0).spell = null;
    tileAt(b, 2, 0).spell = null;
    clearTiles(b, [{ x: 0, y: 1 }]);
    collapse(b, [{ ref: 'n', weight: 1 }], createRng(1));
    expect(findSetsInColumns(b, lookup, [0])).toHaveLength(3);
  });
});

describe('createBoard', () => {
  it('never starts with a set, across many seeds', () => {
    const pool = ['A', 'B', 'C', 'd', 'k', 'u', 'c'].map((ref) => ({ ref, weight: ref <= 'C' && ref >= 'A' ? 2 : 1 }));
    for (let seed = 1; seed <= 150; seed++) {
      const b: Board = createBoard(pool, lookup, createRng(seed));
      expect(b.width).toBe(8);
      expect(b.height).toBe(12);
      expect(b.visibleFrom).toBe(6);
      expect(findSetsInColumns(b, lookup, [0, 1, 2, 3, 4, 5, 6, 7])).toEqual([]);
      expect(b.cells.every((t) => t.spell !== null && t.lock === 'free')).toBe(true);
    }
  });

  it('is deterministic for a seed', () => {
    const pool = [{ ref: 'A', weight: 1 }, { ref: 'B', weight: 1 }, { ref: 'd', weight: 1 }];
    expect(createBoard(pool, lookup, createRng(9)).cells.map((t) => t.spell)).toEqual(createBoard(pool, lookup, createRng(9)).cells.map((t) => t.spell));
  });
});

describe('linked tiles and grouping (D10)', () => {
  it('pulls in available linked neighbours only', () => {
    const b = make(['kAAAk', 'dkddd']);
    tileAt(b, 4, 0).lock = 'locked';
    const set = findSet(b, lookup, 1, 0);
    expect(coords(linkedNeighbours(b, lookup, set))).toEqual(['0,0', '1,1']);
  });

  it('Surge does not join a dud set (D22)', () => {
    const b = make(['udddA']);
    const set = findSet(b, lookup, 1, 0);
    const groups = groupForTrigger(b, lookup, mimic, set, linkedNeighbours(b, lookup, set));
    expect(groups.map((g) => [g.ref, g.tiles.length])).toEqual([['d', 3]]);
  });

  it('Surge joins the adjacent set and adds power; other linked tiles cast nothing', () => {
    const b = make(['uAAAk']);
    const set = findSet(b, lookup, 1, 0);
    const linked = linkedNeighbours(b, lookup, set);
    const groups = groupForTrigger(b, lookup, mimic, set, linked);
    expect(groups).toHaveLength(1);
    expect(groups[0].ref).toBe('A');
    expect(groups[0].tiles).toHaveLength(4);
  });

  it('same spell across separate sets in one step forms one group', () => {
    const b = make(['AAAd', 'dddd', 'AAAd']);
    const set = [...findSet(b, lookup, 0, 0), ...findSet(b, lookup, 0, 2)];
    const groups = groupForTrigger(b, lookup, mimic, set, []);
    expect(groups).toHaveLength(1);
    expect(groups[0].tiles).toHaveLength(6);
  });
});
