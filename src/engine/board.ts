// Board module (doc 02, spec §6.2). Ports Spellford's Board.kt: weighted fill with no starting sets,
// 3+ line matching with L/T merging, linked-tile pulls, gravity + refill, and locked tiles (from intents).
// All functions mutate the board passed in; callers clone first (battle.ts does).

import type { Rng } from './rng';
import type { Board, Pos, ResolvedSpell, SpellRef, Tile } from './types';

export const BOARD_SIZE = { width: 8, visibleRows: 6, bufferRows: 6 } as const;

export type SpellLookup = (ref: SpellRef) => Pick<ResolvedSpell, 'spellClass' | 'linked'> | undefined;

export const idx = (b: Board, x: number, y: number) => y * b.width + x;
export const tileAt = (b: Board, x: number, y: number): Tile => b.cells[idx(b, x, y)];
export const inBounds = (b: Board, x: number, y: number) => x >= 0 && x < b.width && y >= 0 && y < b.height;
export const isVisible = (b: Board, y: number) => y >= b.visibleFrom;

/** A tile can be swapped or matched: visible and not locked (Spellford `available()`). */
export function isAvailable(b: Board, x: number, y: number): boolean {
  if (!inBounds(b, x, y) || !isVisible(b, y)) return false;
  const t = tileAt(b, x, y);
  return t.spell !== null && t.lock !== 'locked';
}

function matchable(lookup: SpellLookup, ref: SpellRef | null): boolean {
  if (ref === null) return false;
  const cls = lookup(ref)?.spellClass;
  // D22: duds match too (3+ of the same type clear, with no effect). Novas never match.
  return cls === 'player' || cls === 'both' || cls === 'enemy' || cls === 'dud';
}

/** A tile whose set casts a spell (duds clear without casting, D22). */
export function casts(lookup: SpellLookup, ref: SpellRef): boolean {
  const cls = lookup(ref)?.spellClass;
  return cls === 'player' || cls === 'both' || cls === 'enemy';
}

export function pickFromPool(pool: { ref: SpellRef; weight: number }[], rng: Rng): SpellRef {
  return rng.weighted(pool, (p) => p.weight).ref;
}

export function emptyBoard(width: number = BOARD_SIZE.width, visibleRows: number = BOARD_SIZE.visibleRows, bufferRows: number = BOARD_SIZE.bufferRows): Board {
  const height = visibleRows + bufferRows;
  return {
    width,
    height,
    visibleFrom: bufferRows,
    cells: Array.from({ length: width * height }, (_, i) => ({ uid: i + 1, spell: null, lock: 'free' as const })),
    nextUid: width * height + 1,
  };
}

/**
 * Fill every cell from the weighted pool, re-rolling each cell until it forms no set with the cells
 * already placed (Spellford `populateBoard`). Buffer rows are filled too, so drops start set-free.
 */
export function createBoard(pool: { ref: SpellRef; weight: number }[], lookup: SpellLookup, rng: Rng, size = BOARD_SIZE): Board {
  const b = emptyBoard(size.width, size.visibleRows, size.bufferRows);
  for (let y = 0; y < b.height; y++) {
    for (let x = 0; x < b.width; x++) {
      const t = tileAt(b, x, y);
      t.spell = pickFromPool(pool, rng);
      let tries = 0;
      while (formsSetIgnoringVisibility(b, lookup, x, y) && tries++ < 200) {
        t.spell = pickFromPool(pool, rng);
      }
    }
  }
  return b;
}

function formsSetIgnoringVisibility(b: Board, lookup: SpellLookup, x: number, y: number): boolean {
  const ref = tileAt(b, x, y).spell;
  if (!matchable(lookup, ref)) return false;
  const run = (dx: number, dy: number) => {
    let n = 0;
    let cx = x + dx;
    let cy = y + dy;
    while (inBounds(b, cx, cy) && tileAt(b, cx, cy).spell === ref) {
      n++;
      cx += dx;
      cy += dy;
    }
    return n;
  };
  return run(-1, 0) + 1 + run(1, 0) >= 3 || run(0, -1) + 1 + run(0, 1) >= 3;
}

/**
 * Tiles forming a set through (x, y): 3+ in a row horizontally and/or vertically, same spell,
 * all visible and available. Dud and nova tiles never match (Spellford `getSetTiles`).
 */
export function findSet(b: Board, lookup: SpellLookup, x: number, y: number): Pos[] {
  if (!isAvailable(b, x, y)) return [];
  const ref = tileAt(b, x, y).spell;
  if (!matchable(lookup, ref)) return [];
  const line = (dx: number, dy: number): Pos[] => {
    const out: Pos[] = [];
    let cx = x + dx;
    let cy = y + dy;
    while (isAvailable(b, cx, cy) && tileAt(b, cx, cy).spell === ref) {
      out.push({ x: cx, y: cy });
      cx += dx;
      cy += dy;
    }
    return out;
  };
  const horizontal = [...line(-1, 0), { x, y }, ...line(1, 0)];
  const vertical = [...line(0, -1), { x, y }, ...line(0, 1)];
  const result = new Map<number, Pos>();
  if (horizontal.length >= 3) horizontal.forEach((p) => result.set(idx(b, p.x, p.y), p));
  if (vertical.length >= 3) vertical.forEach((p) => result.set(idx(b, p.x, p.y), p));
  return [...result.values()];
}

/** All sets among visible tiles in the given columns. */
export function findSetsInColumns(b: Board, lookup: SpellLookup, columns: Iterable<number>): Pos[] {
  const out = new Map<number, Pos>();
  for (const x of columns) {
    for (let y = b.visibleFrom; y < b.height; y++) {
      for (const p of findSet(b, lookup, x, y)) out.set(idx(b, p.x, p.y), p);
    }
  }
  return [...out.values()];
}

const DIRS: readonly Pos[] = [{ x: 0, y: 1 }, { x: 0, y: -1 }, { x: 1, y: 0 }, { x: -1, y: 0 }];

/** Available linked tiles orthogonally adjacent to any of the given tiles (Spellford `getLinkedAdjacentTiles`). */
export function linkedNeighbours(b: Board, lookup: SpellLookup, tiles: Pos[]): Pos[] {
  const inSet = new Set(tiles.map((p) => idx(b, p.x, p.y)));
  const out = new Map<number, Pos>();
  for (const p of tiles) {
    for (const d of DIRS) {
      const x = p.x + d.x;
      const y = p.y + d.y;
      if (!isAvailable(b, x, y)) continue;
      const i = idx(b, x, y);
      if (inSet.has(i)) continue;
      const ref = tileAt(b, x, y).spell;
      if (ref !== null && lookup(ref)?.linked) out.set(i, { x, y });
    }
  }
  return [...out.values()];
}

export interface TriggerGroup {
  ref: SpellRef;
  tiles: Pos[];
}

/**
 * Group matched tiles into casts (Spellford `triggerSpells`): normal tiles by spell; a linked Surge
 * (mimicNeighbour) joins the group of an adjacent normal tile and adds to its power; other linked
 * tiles are cleared without casting (D10).
 */
export function groupForTrigger(b: Board, lookup: SpellLookup, linkBehaviourOf: (ref: SpellRef) => string | undefined, normal: Pos[], linked: Pos[]): TriggerGroup[] {
  const sorted = [...normal].sort((p, q) => p.y - q.y || p.x - q.x);
  const groups = new Map<SpellRef, TriggerGroup>();
  for (const p of sorted) {
    const ref = tileAt(b, p.x, p.y).spell!;
    if (!groups.has(ref)) groups.set(ref, { ref, tiles: [] });
    groups.get(ref)!.tiles.push(p);
  }
  const normalIdx = new Map(sorted.map((p) => [idx(b, p.x, p.y), p]));
  for (const l of linked) {
    const ref = tileAt(b, l.x, l.y).spell!;
    if (linkBehaviourOf(ref) !== 'mimicNeighbour') continue;
    for (const d of DIRS) {
      const n = normalIdx.get(idx(b, l.x + d.x, l.y + d.y));
      // Surge only joins spell sets, never dud sets (D22).
      if (n && casts(lookup, tileAt(b, n.x, n.y).spell!)) {
        const target = tileAt(b, n.x, n.y).spell!;
        groups.get(target)!.tiles.push(l);
        break;
      }
    }
  }
  return [...groups.values()];
}

export function clearTiles(b: Board, tiles: Pos[]): number[] {
  const uids: number[] = [];
  for (const p of tiles) {
    const t = tileAt(b, p.x, p.y);
    if (t.spell !== null) uids.push(t.uid);
    t.spell = null;
    t.lock = 'free';
  }
  return uids;
}

/**
 * Gravity then refill (Spellford `resolveTiles`/`shiftDownTiles`): in each column, tiles fall to fill
 * gaps (keeping their uid and lock state); new free tiles spawn at the top from the weighted pool.
 * Returns the affected columns.
 */
export function collapse(b: Board, pool: { ref: SpellRef; weight: number }[], rng: Rng): Set<number> {
  const columns = new Set<number>();
  for (let x = 0; x < b.width; x++) {
    const column: Tile[] = [];
    for (let y = 0; y < b.height; y++) column.push(tileAt(b, x, y));
    const filled = column.filter((t) => t.spell !== null);
    const missing = b.height - filled.length;
    if (missing === 0) continue;
    columns.add(x);
    const spawned: Tile[] = Array.from({ length: missing }, () => ({ uid: b.nextUid++, spell: pickFromPool(pool, rng), lock: 'free' as const }));
    const next = [...spawned, ...filled];
    for (let y = 0; y < b.height; y++) b.cells[idx(b, x, y)] = next[y];
  }
  return columns;
}

export function canSwap(b: Board, a: Pos, c: Pos): boolean {
  if (!isAvailable(b, a.x, a.y) || !isAvailable(b, c.x, c.y)) return false;
  return Math.abs(a.x - c.x) + Math.abs(a.y - c.y) === 1;
}

/**
 * Swap two tiles. Spellford marked them pending, then locked them for the next turn, to stop two players
 * fighting over the same tiles. Spellcross has one player on the board, so swaps don't lock (D23).
 */
export function swap(b: Board, a: Pos, c: Pos): void {
  const i = idx(b, a.x, a.y);
  const j = idx(b, c.x, c.y);
  [b.cells[i], b.cells[j]] = [b.cells[j], b.cells[i]];
}

/** End of the player's turn: locks from intents (Spin Web) free up (D23). */
export function endTurnLocks(b: Board): void {
  for (const t of b.cells) {
    if (t.lock === 'locked') t.lock = 'free';
  }
}

/** Every legal swap (any two adjacent available tiles). */
export function validMoves(b: Board): [Pos, Pos][] {
  const out: [Pos, Pos][] = [];
  for (let y = b.visibleFrom; y < b.height; y++) {
    for (let x = 0; x < b.width; x++) {
      if (x + 1 < b.width && canSwap(b, { x, y }, { x: x + 1, y })) out.push([{ x, y }, { x: x + 1, y }]);
      if (y + 1 < b.height && canSwap(b, { x, y }, { x, y: y + 1 })) out.push([{ x, y }, { x, y: y + 1 }]);
    }
  }
  return out;
}

/** Swaps that would form at least one set (for hints and the sim bot). */
export function matchingMoves(b: Board, lookup: SpellLookup): [Pos, Pos][] {
  return validMoves(b).filter(([a, c]) => {
    const copy: Board = { ...b, cells: b.cells.map((t) => ({ ...t })) };
    swap(copy, a, c);
    return findSet(copy, lookup, a.x, a.y).length > 0 || findSet(copy, lookup, c.x, c.y).length > 0;
  });
}

export function visiblePositions(b: Board): Pos[] {
  const out: Pos[] = [];
  for (let y = b.visibleFrom; y < b.height; y++) for (let x = 0; x < b.width; x++) out.push({ x, y });
  return out;
}

/** Build a board from ASCII rows for tests (like Spellford's BoardTestUtils). '.' = empty. */
export function boardFromAscii(rows: string[], refOf: (ch: string) => SpellRef, bufferRows = 0): Board {
  const height = rows.length;
  const width = rows[0].length;
  const b = emptyBoard(width, height - bufferRows, bufferRows);
  rows.forEach((row, y) => [...row].forEach((ch, x) => (tileAt(b, x, y).spell = ch === '.' ? null : refOf(ch))));
  return b;
}
