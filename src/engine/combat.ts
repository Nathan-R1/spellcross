// The battle engine for the 2026-11 combat rework (docs/combat.md). Pure functions: state in, { state, events } out.
// One enemy feeds tiles onto an 8×8 board from its generator; the player matches tools to hold them off.
//
// Every tile's behaviour is its triggers and effects (docs/tile-effects.md): runSetEffects runs Set formed and On
// use, activateEnemies runs Each step and At bottom, onActivate runs On activate.
//
// Resolution is resumable: an Attack the player aims (Choose anywhere / Choose shape) queues a Placement and pauses
// in phase 'placing'. place() applies it and carries on from where the battle left off (`stage`).

import type { Content } from '../content';
import { genCell, generatorEnemyTiles } from '../content/enemies';
import { FRUIT_IDS } from '../content/fruits';
import { junk as JUNK, STONE } from '../content/tools';
import { createRng, type Rng } from './rng';
import type {
  Amount, BattleEvent, Gainable, Targets, BattleResult, BattleState, BattleTool, Board, Effect, FruitId, Placement, PlacementTarget, Player, Pos, Tile, TileDef, TileRef, TileStatus, TimedEvent,
  ToolInstance, ViewSnapshot,
} from './types';

export interface BattleSetup {
  player: Player;
  enemyId: string;
  /** Tool instance uids taken into this battle (3). */
  loadout: string[];
  seed: number;
}

interface Ctx {
  s: BattleState;
  c: Content;
  rng: Rng;
  events: TimedEvent[];
  /** Set by incomingHits: the uids of enemy tiles whose At bottom hits you. */
  hits?: Set<number>;
}

// ---------------------------------------------------------------- helpers

export function resolveTool(inst: ToolInstance, c: Content): BattleTool {
  const def = c.tools[inst.toolId];
  const fruit = Object.fromEntries(FRUIT_IDS.map((f) => [f, 0])) as Record<FruitId, number>;
  for (const f of inst.sockets) if (f) fruit[f] += 1;
  return {
    uid: inst.uid, toolId: inst.toolId, name: def.name, pillar: inst.pillar, icon: def.icon, color: def.color,
    weight: 1 + c.config.pool.weightPerLove * fruit.love, fruit,
  };
}

const idx = (b: Board, x: number, y: number) => y * b.width + x;
export const tileAt = (b: Board, x: number, y: number): Tile | null =>
  x < 0 || y < 0 || x >= b.width || y >= b.height ? null : b.cells[idx(b, x, y)];
const inBounds = (b: Board, p: Pos) => p.x >= 0 && p.y >= 0 && p.x < b.width && p.y < b.height;

/**
 * What a tile matches with: tools by instance, junk by type, Stones together. Only tiles with a Set formed trigger
 * form sets (so never enemy tiles or Space).
 */
export function matchKey(t: Tile | null): string | null {
  if (!t) return null;
  if (t.kind === 'tool') return `tool:${t.id}`;
  // Junk not in the built-in table (test content) matches, as before.
  if (t.kind === 'junk') return !JUNK[t.id] || JUNK[t.id].triggers.setFormed ? `junk:${t.id}` : null;
  if (t.kind === 'stone') return STONE.triggers.setFormed ? 'stone' : null;
  return null;
}

/**
 * Extra Set formed effects a tool's fruit adds, after the tool's own (tools.md § 2): Peace (Block per tile),
 * Goodness (heal), Self-Control (a move, once per turn).
 */
export function fruitSetEffects(fruit: Record<FruitId, number>): Effect[] {
  const out: Effect[] = [];
  if (fruit.peace > 0) out.push({ type: 'gain', what: 'block', amount: { perSetTile: fruit.peace }, source: 'Peace' });
  if (fruit.goodness > 0) out.push({ type: 'gain', what: 'courage', amount: fruit.goodness, source: 'Goodness' });
  if (fruit.self_control > 0) out.push({ type: 'gain', what: 'moves', amount: fruit.self_control, oncePerTurn: true, source: 'Self-Control' });
  return out;
}

function posOf(b: Board, uid: number): Pos | null {
  const i = b.cells.findIndex((t) => t?.uid === uid);
  return i < 0 ? null : { x: i % b.width, y: Math.floor(i / b.width) };
}

/** Steps per enemy turn for an enemy tile in this fight: the fight's override, else the tile's own speed. */
export const enemyTileSpeed = (c: Content, enemyId: string, tileId: string): number =>
  c.enemies[enemyId]?.tileSpeed?.[tileId] ?? c.enemyTiles[tileId].speed;

/** Is this tile Locked right now (combat § 4.4)? */
export const isLocked = (t: Tile | null, round: number) => !!t && t.lockedUntil !== undefined && t.lockedUntil >= round;

const enemyCount = (b: Board) => b.cells.filter((t) => t?.kind === 'enemy').length;

export function enemyToCome(s: BattleState, c: Content): number {
  const gen = c.enemies[s.enemyId].generator;
  let n = 0;
  for (let x = 0; x < s.board.width; x++) for (let r = s.genPos[x]; r < gen.length; r++) if (genCell(gen[r], x)) n += 1;
  return n;
}

export function snapshot(s: BattleState, c: Content): ViewSnapshot {
  const p = s.player;
  return {
    board: structuredClone(s.board),
    player: { hp: p.hp, maxHp: p.maxHp, block: p.block, critical: p.critical, foresight: p.foresight, momentum: p.momentum },
    movesLeft: s.movesLeft,
    round: s.round,
    phase: s.phase,
    pending: s.pending[0] ?? null,
    enemyOnBoard: enemyCount(s.board),
    enemyToCome: enemyToCome(s, c),
    genPos: [...s.genPos],
  };
}

function emit(ctx: Ctx, event: BattleEvent) {
  ctx.events.push({ event, after: snapshot(ctx.s, ctx.c) });
}

function begin(state: BattleState, c: Content): Ctx {
  const s = structuredClone(state);
  return { s, c, rng: createRng(s.rng), events: [] };
}

function finish(ctx: Ctx): BattleResult {
  ctx.s.rng = ctx.rng.state();
  return { state: ctx.s, events: ctx.events };
}

// ---------------------------------------------------------------- tile creation

function poolTile(ctx: Ctx): Tile {
  const e = ctx.rng.weighted(ctx.s.pool, (p) => p.weight);
  const hp = e.kind === 'tool' ? 1 + ctx.s.tools[e.id].fruit.gentleness : 1;
  return { uid: ctx.s.nextUid++, kind: e.kind, id: e.id, hp, maxHp: hp };
}

function enemyTile(ctx: Ctx, id: string): Tile {
  const def = ctx.c.enemyTiles[id];
  return { uid: ctx.s.nextUid++, kind: 'enemy', id, hp: def.hp, maxHp: def.hp };
}

/** A new tile for a Create or On destroy effect, or null if it can't exist here (a tool not in this battle). */
function createTile(ctx: Ctx, ref: TileRef, hpBonus = 0): Tile | null {
  const { s, c } = ctx;
  const make = (kind: Tile['kind'], id: string, hp: number): Tile => ({ uid: s.nextUid++, kind, id, hp: hp + hpBonus, maxHp: hp + hpBonus });
  switch (ref.kind) {
    case 'stone': return make('stone', 'stone', c.config.stoneHp);
    case 'junk': return make('junk', ref.id, c.junk[ref.id]?.hp ?? 1);
    case 'enemy': return make('enemy', ref.id, c.enemyTiles[ref.id].hp);
    case 'tool': {
      const t = (ref.uid && s.tools[ref.uid]) || Object.values(s.tools).find((bt) => bt.toolId === ref.id);
      return t ? make('tool', t.uid, 1 + t.fruit.gentleness) : null;
    }
  }
}

/** The tile for column `x` of generated row `row` (0 = the bottom row of the board). */
function generatedTile(ctx: Ctx, row: number, x: number): Tile {
  const id = genCell(ctx.c.enemies[ctx.s.enemyId].generator[row], x);
  return id ? enemyTile(ctx, id) : poolTile(ctx);
}

// ---------------------------------------------------------------- creation

export function createBattle(setup: BattleSetup, c: Content): BattleResult {
  const enemy = c.enemies[setup.enemyId];
  if (!enemy) throw new Error(`Unknown enemy ${setup.enemyId}`);
  if (setup.loadout.length === 0) throw new Error('Choose your tools');
  const tools: Record<string, BattleTool> = {};
  for (const uid of setup.loadout) {
    const inst = setup.player.tools.find((t) => t.uid === uid);
    if (!inst) throw new Error(`Tool ${uid} not owned`);
    tools[uid] = resolveTool(inst, c);
  }
  const totalW = Object.values(tools).reduce((a, t) => a + t.weight, 0);
  const pool: BattleState['pool'] = [
    ...Object.values(tools).map((t) => ({ kind: 'tool' as const, id: t.uid, weight: (c.config.pool.tools * t.weight) / totalW })),
    ...c.config.junk.map((id) => ({ kind: 'junk' as const, id, weight: c.config.pool.junk / c.config.junk.length })),
  ];
  const { width, height } = c.config.board;
  const s: BattleState = {
    board: { width, height, cells: Array.from({ length: width * height }, () => null) },
    enemyId: enemy.id,
    genPos: Array.from({ length: width }, () => height),
    tools,
    pool,
    player: {
      hp: setup.player.hp, maxHp: setup.player.maxHp, block: 0, critical: 0, foresight: 0, momentum: 0,
      movesPerTurn: setup.player.movesPerTurn, abilities: structuredClone(setup.player.abilities),
    },
    movesLeft: setup.player.movesPerTurn,
    round: 1,
    phase: 'player',
    stage: 'player',
    pending: [],
    focusUsed: [],
    outcome: null,
    nextUid: 1,
    rng: setup.seed,
  };
  const ctx: Ctx = { s, c, rng: createRng(setup.seed), events: [] };
  // Initial fill: generated row 0 is the bottom row. Normal cells avoid ready-made matches.
  for (let y = height - 1; y >= 0; y--) {
    const row = height - 1 - y;
    for (let x = 0; x < width; x++) {
      const id = genCell(enemy.generator[row], x);
      if (id) {
        s.board.cells[idx(s.board, x, y)] = enemyTile(ctx, id);
        continue;
      }
      let t = poolTile(ctx);
      for (let tries = 0; tries < 50 && makesMatch(s.board, x, y, t); tries++) {
        s.nextUid -= 1;
        t = poolTile(ctx);
      }
      s.board.cells[idx(s.board, x, y)] = t;
    }
  }
  return finish(ctx);
}

/** Would placing `t` at (x, y) complete a line with the two tiles to its left or the two below? */
function makesMatch(b: Board, x: number, y: number, t: Tile): boolean {
  const k = matchKey(t);
  if (!k) return false;
  const same = (dx: number, dy: number) => matchKey(tileAt(b, x + dx, y + dy)) === k;
  return (same(-1, 0) && same(-2, 0)) || (same(0, 1) && same(0, 2));
}

// ---------------------------------------------------------------- matching

export interface FoundSet {
  key: string;
  /** Matched cells. */
  cells: Pos[];
  /** Supportive tiles pulled in (tool sets only). */
  support: Pos[];
  /** Extra size from Supportive (sum of their Kindness) and Strengthen (sum over the set's tiles). */
  bonus: number;
  /** Strengthened tiles in the set and their points: each point also grows a placed shape by 1 cell. */
  strengthened: { p: Pos; n: number }[];
}

/**
 * Straight runs of 3+ cells with the same non-null key, in rows and columns, joined into groups where they touch
 * (so an L or T is one group). Sets use matchKey; Community uses its own id (it never forms sets).
 */
function lineGroups(b: Board, key: (t: Tile | null) => string | null): number[][] {
  const parent = new Map<number, number>();
  const find = (i: number): number => {
    let r = i;
    while (parent.get(r) !== r) r = parent.get(r)!;
    parent.set(i, r);
    return r;
  };
  const union = (a: number, c2: number) => {
    if (!parent.has(a)) parent.set(a, a);
    if (!parent.has(c2)) parent.set(c2, c2);
    parent.set(find(a), find(c2));
  };
  const scan = (len: number, lines: number, cell: (line: number, i: number) => number) => {
    for (let line = 0; line < lines; line++) {
      let start = 0;
      for (let i = 1; i <= len; i++) {
        const k = i < len ? key(b.cells[cell(line, i)]) : null;
        const prev = key(b.cells[cell(line, start)]);
        if (i < len && k !== null && k === prev) continue;
        if (prev !== null && i - start >= 3) for (let j = start; j < i - 1; j++) union(cell(line, j), cell(line, j + 1));
        start = i;
      }
    }
  };
  scan(b.width, b.height, (y, x) => idx(b, x, y));
  scan(b.height, b.width, (x, y) => idx(b, x, y));

  const groups = new Map<number, number[]>();
  for (const i of parent.keys()) {
    const r = find(i);
    groups.set(r, [...(groups.get(r) ?? []), i]);
  }
  return [...groups.values()];
}

/** Board cells of tiles in a straight line of 3+ tiles of their own kind and id, matching or not (Community). */
export function inLineCells(b: Board): Set<number> {
  return new Set(lineGroups(b, (t) => (t ? `${t.kind}:${t.id}` : null)).flat());
}

export function findSets(s: BattleState): FoundSet[] {
  const b = s.board;
  const sets: FoundSet[] = lineGroups(b, matchKey)
    .map((cells) => cells.sort((a, c2) => a - c2))
    .sort((a, c2) => a[0] - c2[0])
    .map((cells) => ({
      key: matchKey(b.cells[cells[0]])!,
      cells: cells.map((i) => ({ x: i % b.width, y: Math.floor(i / b.width) })),
      support: [],
      bonus: 0,
      strengthened: [],
    }));

  // Supportive (Kindness): adjacent tiles of other tools join tool sets, first set in reading order wins.
  const taken = new Set<number>(sets.flatMap((st) => st.cells.map((p) => idx(b, p.x, p.y))));
  for (const st of sets) {
    if (!st.key.startsWith('tool:')) continue;
    const own = st.key.slice(5);
    for (const p of st.cells) {
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const q = { x: p.x + dx, y: p.y + dy };
        const t = tileAt(b, q.x, q.y);
        const i = idx(b, q.x, q.y);
        if (!t || t.kind !== 'tool' || t.id === own || taken.has(i)) continue;
        const kindness = s.tools[t.id]?.fruit.kindness ?? 0;
        if (kindness <= 0) continue;
        taken.add(i);
        st.support.push(q);
        st.bonus += kindness;
      }
    }
  }
  // Strengthen (Anoint): each point on a tile in the set (or pulled in by Supportive) counts +1 tile.
  for (const st of sets) {
    for (const p of [...st.cells, ...st.support]) {
      const n = tileAt(b, p.x, p.y)?.strength ?? 0;
      if (n <= 0) continue;
      st.bonus += n;
      st.strengthened.push({ p, n });
    }
  }
  return sets;
}

/** Offsets of a shape from its top-left corner. */
function normalise(cells: Pos[]): Pos[] {
  const minX = Math.min(...cells.map((p) => p.x));
  const minY = Math.min(...cells.map((p) => p.y));
  return cells.map((p) => ({ x: p.x - minX, y: p.y - minY })).sort((a, b) => a.y - b.y || a.x - b.x);
}

/**
 * Strengthen grows a set's shape by 1 cell per point, always along the set's longest straight line, at the end nearest
 * the Strengthened tile. So a row of 3 with +2 is a row of 5 wherever the points were; L and T sets grow along their
 * longest arm. Ties: horizontal before vertical, then the top-left line; the right/bottom end when both are as near.
 * The line stops growing at the board's length (`maxLen`), so the shape always fits somewhere; the set still counts its
 * full size for per-tile amounts.
 */
function grow(cells: Pos[], strengthened: { p: Pos; n: number }[], maxLen: { x: number; y: number }): Pos[] {
  if (strengthened.length === 0) return cells;
  const has = (q: Pos) => cells.some((c) => c.x === q.x && c.y === q.y);
  // The longest run: from each cell that starts one (no cell before it), count along +x and +y.
  let best = { from: cells[0], dx: 1, dy: 0, len: 1 };
  for (const [dx, dy] of [[1, 0], [0, 1]]) {
    for (const c of [...cells].sort((a, b) => a.y - b.y || a.x - b.x)) {
      if (has({ x: c.x - dx, y: c.y - dy })) continue;
      let len = 1;
      while (has({ x: c.x + dx * len, y: c.y + dy * len })) len++;
      if (len > best.len) best = { from: c, dx, dy, len };
    }
  }
  const { dx, dy } = best;
  let head = best.from; // the top/left end
  let tail = { x: head.x + dx * (best.len - 1), y: head.y + dy * (best.len - 1) }; // the bottom/right end
  const out = [...cells];
  const dist = (a: Pos, b: Pos) => Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
  let room = (dx ? maxLen.x : maxLen.y) - best.len;
  for (const { p, n } of strengthened) {
    const atHead = dist(p, head) < dist(p, tail);
    for (let k = 0; k < n && room > 0; k++, room--) {
      if (atHead) {
        head = { x: head.x - dx, y: head.y - dy };
        out.push(head);
      } else {
        tail = { x: tail.x + dx, y: tail.y + dy };
        out.push(tail);
      }
    }
  }
  return out;
}

function resolveSets(ctx: Ctx, sets: FoundSet[]) {
  const { s } = ctx;
  const b = s.board;
  const uidsOf = (ps: Pos[]) => ps.map((p) => tileAt(b, p.x, p.y)!.uid);
  emit(ctx, { type: 'matched', uids: sets.flatMap((st) => [...uidsOf(st.cells), ...uidsOf(st.support)]) });
  const keys = sets.map((st) => ({ st, key: st.key }));
  for (const st of sets) for (const p of [...st.cells, ...st.support]) b.cells[idx(b, p.x, p.y)] = null;
  for (const { st, key } of keys) applySet(ctx, st, key);
}

function applySet(ctx: Ctx, st: FoundSet, key: string) {
  const { s, c } = ctx;
  const p = s.player;
  const shape = normalise(grow([...st.cells, ...st.support], st.strengthened, { x: s.board.width, y: s.board.height }));
  const size = st.cells.length + st.bonus;
  if (key.startsWith('junk:')) {
    const j = c.junk[key.slice(5)];
    const texts = runSetEffects(ctx, j.triggers.setFormed ?? [], { source: j.name, sourceTile: { kind: 'junk', id: key.slice(5) }, size, shape, mult: 1, tool: null });
    if (texts.length) emit(ctx, { type: 'effect', source: j.name, text: `${j.name}: ${texts.join(', ')}` });
    return;
  }
  if (!key.startsWith('tool:')) return; // Stones: Clears self
  const tool = s.tools[key.slice(5)];
  const effects = [...(c.tools[tool.toolId].triggers.setFormed ?? []), ...fruitSetEffects(tool.fruit)];
  // Critical doubles everything this set does (once-per-turn effects still fire once). A set with nothing to double
  // (Fellowship's Becomes) leaves it for the next set.
  const doubles = effects.some((e) => e.type !== 'becomes' && e.type !== 'clearsSelf');
  const mult = doubles && p.critical > 0 ? 2 : 1;
  if (mult === 2) p.critical -= 1;
  const texts = runSetEffects(ctx, effects, { source: tool.name, sourceTile: { kind: 'tool', id: tool.toolId, uid: tool.uid }, size, shape, mult, tool, cells: st.cells });
  emit(ctx, { type: 'effect', source: tool.name, text: `${tool.name}${mult > 1 ? ' (Critical)' : ''}: ${texts.join(', ')}` });
}

interface EffectSource {
  /** Shown on placements and in the log. */
  source: string;
  /** The tile behind it, for its placements' icon (abilities have none). */
  sourceTile?: TileRef;
  /** Tiles in the set (for "per tile in the set"); 0 outside Set formed. */
  size: number;
  /** The set's shape (offsets), for Choose shape: the set's shape. */
  shape: Pos[];
  /** ×2 under Critical. */
  mult: number;
  /** The tool whose set this is: its fruit and pillar modify the effects. */
  tool: BattleTool | null;
  /** The set's own cells (emptied already), for Becomes. */
  cells?: Pos[];
}

const amountOf = (a: Amount, size: number) => (typeof a === 'number' ? a : 'perTiles' in a ? Math.ceil(size / a.perTiles) : a.perSetTile * size);

/**
 * Run Set formed or On use effects in order. Attacks you aim queue placements; everything else applies now.
 * Modifiers: Faithfulness +Dmg; Foresight +1 Dmg per 3 on Truth tools (read when the Attack runs, so a Gain of
 * Foresight later in the list boosts later sets only); Patience +HP on tiles the tool creates. Returns log texts.
 */
/** "Lock" or "+2 Strengthen", for the log. */
const applyText = (e: { apply?: TileStatus; applyAmount?: number }) => (e.apply === 'locked' ? 'Lock' : e.apply === 'strengthen' ? `+${e.applyAmount ?? 1} Strengthen` : '');

/**
 * The placement a Choose shape effect queues: the cells it covers (offsets from its top-left), or a line, plus its
 * filter. `setShape` and `size` are the set's own shape and size (Strengthen already counted). Add new shapes here.
 */
function shapeTarget(t: Extract<Targets, { type: 'chooseShape' }>, setShape: Pos[], size: number, b: Board): Exclude<PlacementTarget, { type: 'anywhere' }> {
  const filter = t.filter && { filter: t.filter };
  switch (t.shape) {
    case 'set': return { type: 'shape', cells: setShape, ...filter };
    case 'square': {
      const side = Math.min(size, b.width, b.height); // as wide as the set is big, but always fits
      return { type: 'shape', cells: Array.from({ length: side * side }, (_, i) => ({ x: i % side, y: Math.floor(i / side) })), ...filter };
    }
    case 'line': return { type: 'line', length: t.length, ...filter };
  }
}

function runSetEffects(ctx: Ctx, effects: Effect[], src: EffectSource): string[] {
  const { s, c } = ctx;
  const p = s.player;
  const { tool, mult, size } = src;
  const texts: string[] = [];
  // Momentum: the first set (not an ability) with an Attack of Dmg > 0 spends all of it, +1 Dmg per 3 on those Attacks.
  let momentum = 0;
  if (src.sourceTile && p.momentum > 0 && effects.some((e) => e.type === 'attack' && e.dmg > 0)) {
    momentum = Math.floor(p.momentum / c.config.momentumPerBonus);
    texts.push(`Momentum ${p.momentum} spent${momentum ? `: +${momentum} damage` : ''}`);
    p.momentum = 0;
  }
  for (const e of effects) {
    switch (e.type) {
      case 'attack': {
        const truth = tool?.pillar === 'truth' ? Math.floor(p.foresight / c.config.foresightPerBonus) : 0;
        // Time: 1 per 3 tiles in the set, rounded up (a Strengthened set counts bigger).
        const base = e.dmgPerTiles ? e.dmg * Math.ceil(size / e.dmgPerTiles) : e.dmg;
        const damage = base + (tool ? tool.fruit.faithfulness + truth : 0) + (e.dmg > 0 ? momentum : 0);
        const onDestroy = {
          ...(e.onDestroy && { onDestroy: e.onDestroy, ...(tool && tool.fruit.patience ? { onDestroyHp: tileBaseHp(ctx, e.onDestroy) + tool.fruit.patience } : {}) }),
          ...(e.apply && { apply: e.apply, ...(e.applyAmount && e.applyAmount !== 1 && { applyAmount: e.applyAmount }) }),
        };
        const t = e.targets;
        if (t.type === 'chooseShape') {
          const target = shapeTarget(t, src.shape, size, s.board);
          for (let i = 0; i < mult; i++) s.pending.push({ target, damage, source: src.source, ...(src.sourceTile && { sourceTile: src.sourceTile }), ...onDestroy });
          const only = t.filter ? ` (${t.filter.join(' or ')} only)` : '';
          texts.push(`${mult > 1 ? `${mult} × ` : ''}${target.type === 'shape' ? `${target.cells.length}-tile shape` : `line of ${target.length}`}${only}, ${damage > 0 || !e.apply ? `${damage} damage` : applyText(e)}${damage > 0 && e.apply ? ` + ${applyText(e)}` : ''}`);
        } else if (t.type === 'chooseAnywhere') {
          const n = amountOf(t.count, size) * mult;
          const target = { type: 'anywhere' as const, ...(t.filter && { filter: t.filter }) };
          for (let i = 0; i < n; i++) s.pending.push({ target, damage, source: src.source, ...(src.sourceTile && { sourceTile: src.sourceTile }), ...onDestroy });
          texts.push(`${n} × ${damage > 0 || !e.apply ? `${damage} damage` : ''}${damage > 0 && e.apply ? ' + ' : ''}${e.apply ? applyText(e) : ''}${e.onDestroy?.kind === 'stone' ? ' (Stones)' : ''}`);
        } else {
          texts.push(...applyNow(ctx, e, null));
        }
        break;
      }
      case 'gain': {
        if (e.oncePerTurn) {
          const key = tool?.uid ?? src.source;
          if (s.focusUsed.includes(key)) break;
          s.focusUsed.push(key);
        }
        const v = amountOf(e.amount, size) * (e.oncePerTurn ? 1 : mult);
        texts.push(...gain(ctx, e.what, v, e.source));
        break;
      }
      case 'create':
        texts.push(...applyNow(ctx, e, null));
        break;
      case 'becomes': {
        // The set's cells were just emptied: fill each with the new tile, so nothing falls in (Patience: +HP).
        const hp = tool?.fruit.patience ?? 0;
        const uids: number[] = [];
        for (const q of src.cells ?? []) {
          const t = createTile(ctx, e.what, hp);
          if (!t) continue;
          s.board.cells[idx(s.board, q.x, q.y)] = t;
          uids.push(t.uid);
        }
        if (uids.length) {
          emit(ctx, { type: 'created', uids });
          texts.push(`${uids.length} × ${tileName(c, e.what)}`);
        }
        break;
      }
      case 'clearsSelf':
      case 'removeSelf': // a set's tiles clear anyway
        break;
    }
  }
  return texts;
}

/** The player gains `v` of something. Returns the log text. */
function gain(ctx: Ctx, what: Gainable, v: number, source?: string): string[] {
  const { s } = ctx;
  const p = s.player;
  const tag = source ? ` (${source})` : '';
  switch (what) {
    case 'block': p.block += v; return [`+${v} Block${tag}`];
    case 'critical': p.critical += v; return [`Critical +${v}`];
    case 'foresight': p.foresight += v; return [`Foresight +${v}`];
    case 'moves': s.movesLeft += v; return [`+${v} move${v > 1 ? 's' : ''}`];
    case 'courage': {
      const before = p.hp;
      p.hp = Math.min(p.maxHp, p.hp + v);
      return p.hp > before ? [`+${p.hp - before} Courage`] : [];
    }
  }
}

function tileBaseHp(ctx: Ctx, ref: TileRef): number {
  const { c } = ctx;
  if (ref.kind === 'stone') return c.config.stoneHp;
  if (ref.kind === 'junk') return c.junk[ref.id]?.hp ?? 1;
  if (ref.kind === 'enemy') return c.enemyTiles[ref.id].hp;
  return 1;
}

/** The tiles a game-chosen target picks around `at` (Below, Adjacent), as board indexes. You → []. */
function gameTargets(ctx: Ctx, t: Targets, at: Pos | null, claimed?: Set<number>): number[] {
  const b = ctx.s.board;
  if (!at) return [];
  if (t.type === 'below') return tileAt(b, at.x, at.y + 1) ? [idx(b, at.x, at.y + 1)] : [];
  if (t.type !== 'adjacent') return [];
  const open: number[] = [];
  for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
    const n = tileAt(b, at.x + dx, at.y + dy);
    const i = idx(b, at.x + dx, at.y + dy);
    if (n && t.filter.includes(n.kind) && (!t.ids || t.ids.includes(n.id)) && !claimed?.has(i)) open.push(i);
  }
  if (t.pick === 'every') return open;
  const out: number[] = [];
  for (let k = 0; k < t.pick && open.length; k++) out.push(...open.splice(open.indexOf(ctx.rng.pick(open)), 1));
  return out;
}

/** Apply a game-targeted effect from the tile at `at` right away (Each step extras, At bottom, abilities). */
function applyNow(ctx: Ctx, e: Effect, at: Pos | null): string[] {
  const { s } = ctx;
  if (e.type === 'gain') return gain(ctx, e.what, amountOf(e.amount, 0), e.source);
  if (e.type === 'becomes') return []; // Set formed only
  if (e.type === 'attack') {
    if (e.targets.type === 'you') {
      hitPlayer(ctx, e.dmg);
      return [];
    }
    const b = s.board;
    const cells = gameTargets(ctx, e.targets, at).map((i) => ({ x: i % b.width, y: Math.floor(i / b.width) }));
    for (const q of damageAt(ctx, cells, e.dmg)) {
      const t = e.onDestroy && createTile(ctx, e.onDestroy);
      if (t) s.board.cells[idx(b, q.x, q.y)] = t;
    }
    return [];
  }
  if (e.type === 'removeSelf') {
    const t = at && tileAt(s.board, at.x, at.y);
    if (t) {
      s.board.cells[idx(s.board, at.x, at.y)] = null;
      emit(ctx, { type: 'removed', uids: [t.uid] });
    }
    return [];
  }
  if (e.type === 'create') {
    const claims = new Map<number, Effect & { type: 'create' }>();
    for (const i of gameTargets(ctx, e.targets, at)) claims.set(i, e);
    applyCreates(ctx, claims);
  }
  return [];
}

/** Turn claimed board cells into their new tiles, in reading order, and emit one 'created' event. */
function applyCreates(ctx: Ctx, claims: Map<number, Effect & { type: 'create' }>) {
  const { s } = ctx;
  const b = s.board;
  const junkIds = s.pool.filter((e) => e.kind === 'junk').map((e) => e.id);
  const uids: number[] = [];
  for (const i of [...claims.keys()].sort((a, z) => a - z)) {
    const w = claims.get(i)!.what;
    let t: Tile | null = null;
    if (w.kind === 'randomJunk') {
      if (junkIds.length) t = createTile(ctx, { kind: 'junk', id: ctx.rng.pick(junkIds) });
    } else t = createTile(ctx, w);
    if (!t) continue;
    b.cells[i] = t;
    uids.push(t.uid);
  }
  if (uids.length) emit(ctx, { type: 'created', uids });
}

// ---------------------------------------------------------------- damage, gravity, settling

/** Damage tiles at positions. Returns deleted positions. */
function damageAt(ctx: Ctx, positions: Pos[], amount: number): Pos[] {
  const b = ctx.s.board;
  const hit: number[] = [];
  const deleted: number[] = [];
  const out: Pos[] = [];
  for (const p of positions) {
    const t = tileAt(b, p.x, p.y);
    if (!t) continue;
    hit.push(t.uid);
    t.hp -= amount;
    if (t.hp <= 0) {
      deleted.push(t.uid);
      b.cells[idx(b, p.x, p.y)] = null;
      out.push(p);
    }
  }
  if (hit.length) emit(ctx, { type: 'damaged', uids: hit, deleted });
  return out;
}

function checkVictory(ctx: Ctx): boolean {
  const { s } = ctx;
  if (s.outcome) return true;
  if (enemyCount(s.board) > 0) return false;
  s.outcome = 'victory';
  s.phase = 'over';
  s.pending = [];
  emit(ctx, { type: 'battleEnd', outcome: 'victory' });
  return true;
}

function gravity(ctx: Ctx) {
  const b = ctx.s.board;
  let changed = false;
  const fresh: Pos[] = [];
  for (let x = 0; x < b.width; x++) {
    const col: Tile[] = [];
    for (let y = 0; y < b.height; y++) {
      const t = tileAt(b, x, y);
      if (t) col.push(t);
    }
    const empty = b.height - col.length;
    if (empty === 0) continue;
    changed = true;
    for (let y = b.height - 1, i = col.length - 1; y >= empty; y--, i--) b.cells[idx(b, x, y)] = col[i];
    // The lowest gap gets the next generated row for this column, the one above it the row after, …
    for (let y = empty - 1; y >= 0; y--) {
      const t = generatedTile(ctx, ctx.s.genPos[x]++, x);
      b.cells[idx(b, x, y)] = t;
      if (t.kind !== 'enemy') fresh.push({ x, y });
    }
  }
  damp(ctx, fresh);
  if (changed) emit(ctx, { type: 'collapsed' });
}

/** Is the tile at (x, y) part of a line of 3+ in its row or column? */
function inLine(b: Board, x: number, y: number): boolean {
  const k = matchKey(tileAt(b, x, y));
  if (!k) return false;
  const run = (dx: number, dy: number) => {
    let n = 0;
    for (let i = 1; matchKey(tileAt(b, x + dx * i, y + dy * i)) === k; i++) n++;
    return n;
  };
  return run(-1, 0) + run(1, 0) >= 2 || run(0, -1) + run(0, 1) >= 2;
}

/**
 * Refill damping (combat § 3.4): each new tile that would complete a set is, with chance refillNoMatchChance,
 * redrawn until it doesn't. Tiles already on the board are never changed.
 */
function damp(ctx: Ctx, fresh: Pos[]) {
  const p = ctx.c.config.refillNoMatchChance;
  if (p <= 0) return;
  const b = ctx.s.board;
  for (const { x, y } of fresh) {
    if (!inLine(b, x, y) || ctx.rng.next() >= p) continue;
    const i = idx(b, x, y);
    for (let tries = 0; tries < 20 && inLine(b, x, y); tries++) {
      const t = poolTile(ctx);
      ctx.s.nextUid -= 1; // the redrawn tile keeps the original's uid
      b.cells[i] = { ...t, uid: b.cells[i]!.uid };
    }
  }
}

/**
 * Resolve sets until the board is stable, or a placement is needed, or the battle is over. The board always
 * falls and refills before the player places anything, so there are no holes to aim at (combat § 5).
 */
function settle(ctx: Ctx): 'stable' | 'waiting' | 'over' {
  const { s } = ctx;
  for (let guard = 0; guard < 500; guard++) {
    if (s.outcome) return 'over';
    if (s.board.cells.some((t) => t === null)) gravity(ctx);
    if (checkVictory(ctx)) return 'over';
    if (s.pending.length > 0) {
      s.phase = 'placing';
      return 'waiting';
    }
    const sets = findSets(s);
    if (sets.length === 0) return 'stable';
    resolveSets(ctx, sets);
  }
  return 'stable';
}

/** Carry the battle forward through the turn stages until it needs the player. */
function proceed(ctx: Ctx) {
  const { s } = ctx;
  for (let guard = 0; guard < 20; guard++) {
    if (settle(ctx) !== 'stable') return;
    switch (s.stage) {
      case 'player':
        if (s.movesLeft > 0) {
          s.phase = 'player';
          return;
        }
        s.stage = 'endTurn';
        break;
      case 'endTurn':
        shining(ctx);
        if (s.outcome) return;
        turnEnd(ctx);
        s.stage = 'enemy';
        break;
      case 'enemy':
        activateEnemies(ctx);
        if (s.outcome) return;
        s.stage = 'newTurn';
        break;
      case 'newTurn':
        s.round += 1;
        // Unspent Block isn't lost: it becomes Momentum (combat § 4.3).
        if (s.player.block > 0) {
          s.player.momentum += s.player.block;
          emit(ctx, { type: 'effect', source: 'Momentum', text: `+${s.player.block} Momentum (unspent Block)` });
        }
        s.player.block = 0;
        s.movesLeft = s.player.movesPerTurn;
        s.focusUsed = [];
        s.stage = 'player';
        s.phase = 'player';
        emit(ctx, { type: 'turnStart', round: s.round });
        return;
    }
  }
}

// ---------------------------------------------------------------- end of turn and the enemy turn

/** Joy: each Shining tool tile damages orthogonally adjacent enemy tiles. */
function shining(ctx: Ctx) {
  const { s } = ctx;
  const b = s.board;
  const dmg = new Map<number, number>();
  const sources: number[] = [];
  for (let y = 0; y < b.height; y++) {
    for (let x = 0; x < b.width; x++) {
      const t = tileAt(b, x, y);
      const joy = t?.kind === 'tool' ? s.tools[t.id]?.fruit.joy ?? 0 : 0;
      if (!t || joy <= 0) continue;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const n = tileAt(b, x + dx, y + dy);
        if (n?.kind !== 'enemy') continue;
        dmg.set(n.uid, (dmg.get(n.uid) ?? 0) + joy);
        if (!sources.includes(t.uid)) sources.push(t.uid);
      }
    }
  }
  if (dmg.size === 0) return;
  emit(ctx, { type: 'shining', uids: sources });
  for (const [uid, amount] of dmg) {
    const p = posOf(b, uid);
    if (p) damageAt(ctx, [p], amount);
  }
  checkVictory(ctx);
}

/**
 * The tiles whose End of turn effects will fire, by board index, with those effects: unlocked tiles that have the
 * trigger, keeping only the `inLine` Gains of tiles in a straight line of 3+ of their own kind. The board shows these
 * tiles glowing (Community in a line), and turnEnd runs them.
 */
export function turnEndFiring(b: Board, round: number, s: Pick<BattleState, 'tools'>, c: Content): Map<number, Effect[]> {
  const out = new Map<number, Effect[]>();
  let lines: Set<number> | null = null;
  for (let i = 0; i < b.cells.length; i++) {
    const t = b.cells[i];
    if (!t || isLocked(t, round)) continue;
    const effects = (tileDef(c, s, t)?.triggers.turnEnd ?? []).filter((e) => e.type !== 'gain' || !e.inLine || (lines ??= inLineCells(b)).has(i));
    if (effects.length) out.set(i, effects);
  }
  return out;
}

/**
 * At end of turn, for every tile on the board that has it (Community; tile-effects.md § 2), after Shining and before
 * the enemy turn, so Block gained here covers this enemy turn's hits. Locked tiles skip it. A Gain with `inLine` only
 * counts tiles in a straight line of 3+ of their own kind, and Strengthen counts there as it does in a set: each point
 * is one more tile. A tile that fires loses its Strengthen. Gains are added up per tile type for one log line.
 */
function turnEnd(ctx: Ctx) {
  const { s, c } = ctx;
  const b = s.board;
  const totals = new Map<string, { what: Gainable; v: number; uids: number[] }>();
  for (const [i, effects] of turnEndFiring(b, s.round, s, c)) {
    const t = b.cells[i]!;
    const at = { x: i % b.width, y: Math.floor(i / b.width) };
    const name = tileDef(c, s, t)!.name;
    for (const e of effects) {
      if (e.type !== 'gain') {
        applyNow(ctx, e, at);
        continue;
      }
      const key = `${name}|${e.what}`;
      const sum = totals.get(key) ?? { what: e.what, v: 0, uids: [] };
      sum.v += amountOf(e.amount, 0) * (e.inLine ? 1 + (t.strength ?? 0) : 1);
      if (!sum.uids.includes(t.uid)) sum.uids.push(t.uid);
      totals.set(key, sum);
    }
    delete t.strength; // used up
  }
  for (const [key, { what, v, uids }] of totals) {
    const name = key.split('|')[0];
    emit(ctx, { type: 'shining', uids });
    emit(ctx, { type: 'effect', source: name, text: `${name}: ${gain(ctx, what, v).join(', ')}` });
  }
}

/** The definition behind a board tile (tools by their instance's tool). */
function tileDef(c: Content, s: Pick<BattleState, 'tools'>, t: Tile): TileDef | undefined {
  switch (t.kind) {
    case 'tool': return c.tools[s.tools[t.id]?.toolId];
    case 'junk': return c.junk[t.id];
    case 'enemy': return c.enemyTiles[t.id];
    case 'stone': return STONE;
  }
}

/** A tile's name, for log lines. */
function tileName(c: Content, ref: TileRef): string {
  return ref.kind === 'junk' ? c.junk[ref.id]?.name ?? ref.id : ref.kind === 'enemy' ? c.enemyTiles[ref.id]?.name ?? ref.id
    : ref.kind === 'tool' ? c.tools[ref.id]?.name ?? ref.id : 'Stone';
}

function activateEnemies(ctx: Ctx) {
  const { s, c } = ctx;
  const b = s.board;
  emit(ctx, { type: 'enemyTurn' });
  const order: number[] = [];
  for (let y = b.height - 1; y >= 0; y--) for (let x = 0; x < b.width; x++) {
    const t = tileAt(b, x, y);
    if (t?.kind === 'enemy') order.push(t.uid);
  }
  const runAll = (effects: Effect[] | undefined, at: Pos) => {
    for (const e of effects ?? []) {
      applyNow(ctx, e, at);
      if (s.outcome) return;
    }
  };
  for (const uid of order) {
    let p = posOf(b, uid);
    if (!p) continue;
    const t = tileAt(b, p.x, p.y)!;
    if (isLocked(t, s.round)) continue; // Locked: no steps, no At bottom
    const def = c.enemyTiles[t.id];
    const speed = enemyTileSpeed(c, s.enemyId, t.id);
    const step = def.triggers.eachStep ?? [];
    // The push: an Each step Attack on the tile below. It moves in if that breaks the tile.
    const pushDmg = step.reduce((n, e) => n + (e.type === 'attack' && e.targets.type === 'below' ? e.dmg : 0), 0);
    const extras = step.filter((e) => !(e.type === 'attack' && e.targets.type === 'below'));
    const hitsYou = (def.triggers.atBottom ?? []).some((e) => e.type === 'attack' && e.targets.type === 'you' && e.dmg > 0);
    // A tile that doesn't move (Depression) still fires At bottom from the bottom row.
    if (speed === 0 && p.y === b.height - 1) {
      if (hitsYou) ctx.hits?.add(uid);
      runAll(def.triggers.atBottom, p);
      if (s.outcome) return;
      continue;
    }
    for (let k = 0; k < speed && p; k++) {
      if (p.y === b.height - 1) {
        if (hitsYou) ctx.hits?.add(uid);
        runAll(def.triggers.atBottom, p);
        if (s.outcome) return;
        break;
      }
      const below = tileAt(b, p.x, p.y + 1);
      if (below?.kind === 'enemy') break;
      if (below) {
        if (pushDmg <= 0) break;
        const gone = damageAt(ctx, [{ x: p.x, y: p.y + 1 }], pushDmg);
        if (gone.length === 0) break; // it survived (a Stone with HP left): the enemy tile stays put
      }
      b.cells[idx(b, p.x, p.y + 1)] = t;
      b.cells[idx(b, p.x, p.y)] = null;
      p = { x: p.x, y: p.y + 1 };
      emit(ctx, { type: 'enemyStep', uid });
      runAll(extras, p);
      if (s.outcome) return;
    }
  }
  onActivate(ctx);
}

/**
 * On activate, for every tile on the board that has it (Greed, Depression, Worship; tile-effects.md § 2). Locked
 * tiles skip it. Targets are claimed in reading order from
 * the board as it is before anything applies, so a tile changed this turn doesn't act until next turn. A cell can
 * be claimed once per turn: the first claim wins, and "N random" picks skip claimed cells. Then all Creates apply
 * in reading order of their cells, then the other effects in claim order.
 */
function onActivate(ctx: Ctx) {
  const { s, c } = ctx;
  const b = s.board;
  const claims = new Map<number, Effect & { type: 'create' }>();
  const rest: [Effect, Pos][] = [];
  for (let y = 0; y < b.height; y++) for (let x = 0; x < b.width; x++) {
    const t = tileAt(b, x, y);
    if (!t || isLocked(t, s.round)) continue;
    const effects = t.kind === 'enemy' ? c.enemyTiles[t.id].triggers.onActivate
      : t.kind === 'tool' ? c.tools[s.tools[t.id]?.toolId]?.triggers.onActivate : undefined;
    for (const e of effects ?? []) {
      if (e.type !== 'create') {
        rest.push([e, { x, y }]);
        continue;
      }
      for (const i of gameTargets(ctx, e.targets, { x, y }, new Set(claims.keys()))) claims.set(i, e);
    }
  }
  applyCreates(ctx, claims);
  for (const [e, at] of rest) {
    applyNow(ctx, e, at);
    if (s.outcome) return;
  }
}

function hitPlayer(ctx: Ctx, amount: number) {
  const p = ctx.s.player;
  const blocked = Math.min(p.block, amount);
  p.block -= blocked;
  p.hp = Math.max(0, p.hp - (amount - blocked));
  emit(ctx, { type: 'playerHit', amount: amount - blocked, blocked });
  if (p.hp <= 0) {
    ctx.s.outcome = 'defeat';
    ctx.s.phase = 'over';
    ctx.s.pending = [];
    emit(ctx, { type: 'battleEnd', outcome: 'defeat' });
  }
}

// ---------------------------------------------------------------- player actions

export function canSwap(s: BattleState, a: Pos, b: Pos): boolean {
  if (s.phase !== 'player' || s.movesLeft <= 0) return false;
  if (!inBounds(s.board, a) || !inBounds(s.board, b)) return false;
  if (Math.abs(a.x - b.x) + Math.abs(a.y - b.y) !== 1) return false;
  const ta = tileAt(s.board, a.x, a.y);
  const tb = tileAt(s.board, b.x, b.y);
  // Any two tiles can swap, enemy tiles included (combat § 2).
  return !!ta && !!tb;
}

/** Swap two adjacent tiles. Costs a move even without a match. */
export function playerMove(state: BattleState, a: Pos, b: Pos, c: Content): BattleResult {
  if (!canSwap(state, a, b)) throw new Error("Can't swap those");
  const ctx = begin(state, c);
  const bd = ctx.s.board;
  const ia = idx(bd, a.x, a.y);
  const ib = idx(bd, b.x, b.y);
  [bd.cells[ia], bd.cells[ib]] = [bd.cells[ib], bd.cells[ia]];
  ctx.s.movesLeft -= 1;
  emit(ctx, { type: 'swapped', a, b });
  proceed(ctx);
  return finish(ctx);
}

/**
 * The enemy tiles that will hit you in the coming enemy turn if you end your turn now: the real end of turn (Shining,
 * then every enemy tile's steps, bottom first) run on a copy. Works from any row: a Speed 3 tile two rows up that
 * has a clear path still reaches the bottom and hits. Block doesn't matter; the tile still hits.
 */
export function incomingHits(state: BattleState, c: Content): Set<number> {
  if (state.phase !== 'player' || state.outcome) return new Set();
  const ctx = begin(state, c);
  ctx.hits = new Set();
  ctx.s.player.hp = Number.MAX_SAFE_INTEGER; // so an early defeat doesn't stop the count
  ctx.s.movesLeft = 0;
  ctx.s.stage = 'endTurn';
  proceed(ctx);
  return ctx.hits;
}

export function endTurn(state: BattleState, c: Content): BattleResult {
  if (state.phase !== 'player') throw new Error('Not your turn');
  const ctx = begin(state, c);
  ctx.s.movesLeft = 0;
  ctx.s.stage = 'endTurn';
  proceed(ctx);
  return finish(ctx);
}

export function useAbility(state: BattleState, index: number, c: Content): BattleResult {
  if (state.phase !== 'player') throw new Error('Not now');
  const ab = state.player.abilities[index];
  if (!ab || ab.uses <= 0) throw new Error('No uses left');
  const ctx = begin(state, c);
  const p = ctx.s.player;
  p.abilities[index].uses -= 1;
  const def = c.abilities[ab.id];
  runSetEffects(ctx, def.onUse, { source: def.name, size: 0, shape: [], mult: 1, tool: null });
  emit(ctx, { type: 'ability', id: ab.id });
  proceed(ctx);
  return finish(ctx);
}

/**
 * The board cells a placement covers at `at` (its top-left for shapes and lines, which may be off the board), or null
 * if none of it is on the board (or a Choose anywhere pick isn't a valid tile).
 */
export function placementCells(s: BattleState, pl: Placement, at: Pos, orientation: 'h' | 'v' = 'h', allowEmpty = false): Pos[] | null {
  const b = s.board;
  const t = pl.target;
  let cells: Pos[];
  if (t.type === 'shape') cells = t.cells.map((o) => ({ x: at.x + o.x, y: at.y + o.y }));
  else if (t.type === 'line') cells = Array.from({ length: t.length }, (_, i) => (orientation === 'h' ? { x: at.x + i, y: at.y } : { x: at.x, y: at.y + i }));
  else cells = [at];
  // Shapes and lines may hang off the board: only the cells on it count, and at least one must be.
  cells = cells.filter((p) => inBounds(b, p));
  if (cells.length === 0) return null;
  if (!allowEmpty && t.type === 'anywhere' && !tileAt(b, at.x, at.y)) return null;
  if (!allowEmpty && t.type === 'anywhere' && t.filter && !t.filter.includes(tileAt(b, at.x, at.y)!.kind)) return null;
  return cells;
}

/**
 * How many pending placements are chosen together: the run of identical placements at the front of the queue
 * (Prophecy's hits, the Word's Stones, a doubled Prayer's shapes).
 */
export function pendingGroupSize(s: BattleState): number {
  const first = s.pending[0];
  if (!first) return 0;
  if (first.target.type === 'line') return 1;
  // Identical placements only: two sets of one tool can have different shapes, and each shape is aimed on its own.
  const same = (p: Placement) => JSON.stringify(p.target) === JSON.stringify(first.target) && p.source === first.source && p.damage === first.damage
    && p.apply === first.apply && p.applyAmount === first.applyAmount && JSON.stringify(p.onDestroy) === JSON.stringify(first.onDestroy);
  let n = 1;
  while (n < s.pending.length && same(s.pending[n])) n += 1;
  return n;
}

/** Whether a placement hits this tile: any tile, or only its `filter` kinds when it has one (Worship: Junk only). */
function hitsTile(pl: Placement, t: Tile | null): boolean {
  const f = pl.target.filter;
  return !!t && (!f || f.includes(t.kind));
}

function applyPlacement(ctx: Ctx, pl: Placement, at: Pos, orientation: 'h' | 'v') {
  const s = ctx.s;
  const cells = placementCells(s, pl, at, orientation, true);
  if (!cells) return; // a later hit aimed at a tile an earlier one already deleted
  if (pl.target.type === 'anywhere' && !tileAt(s.board, at.x, at.y)) return;
  const gone = damageAt(ctx, cells.filter((p) => hitsTile(pl, tileAt(s.board, p.x, p.y))), pl.damage);
  if (pl.apply) {
    // Locked: through the coming enemy turn (this round's, or next round's once this round's is over).
    const until = s.stage === 'newTurn' ? s.round + 1 : s.round;
    const uids: number[] = [];
    for (const p of cells) {
      const t = tileAt(s.board, p.x, p.y);
      if (!t || !hitsTile(pl, t)) continue;
      if (pl.apply === 'locked') t.lockedUntil = until;
      else t.strength = (t.strength ?? 0) + (pl.applyAmount ?? 1);
      uids.push(t.uid);
    }
    if (uids.length) emit(ctx, { type: pl.apply === 'locked' ? 'locked' : 'strengthened', uids });
  }
  if (!pl.onDestroy) return;
  // On destroy: each broken tile is replaced in place, so nothing falls.
  const uids: number[] = [];
  for (const p of gone) {
    const t = createTile(ctx, pl.onDestroy, pl.onDestroyHp === undefined ? 0 : pl.onDestroyHp - tileBaseHp(ctx, pl.onDestroy));
    if (!t) continue;
    s.board.cells[idx(s.board, p.x, p.y)] = t;
    uids.push(t.uid);
  }
  if (uids.length) emit(ctx, { type: 'created', uids });
}

/** Resolve the next pending placement at `at`. */
export function place(state: BattleState, at: Pos, c: Content, orientation: 'h' | 'v' = 'h'): BattleResult {
  return placeGroup(state, [at], c, orientation, 1);
}

/**
 * Resolve the next `count` pending placements (default: the whole group) at the given targets, in order. All
 * targets are chosen on the same settled board; the same tile can be targeted more than once.
 */
export function placeGroup(state: BattleState, targets: Pos[], c: Content, orientation: 'h' | 'v' = 'h', count = pendingGroupSize(state)): BattleResult {
  if (state.phase !== 'placing' || state.pending.length === 0) throw new Error('Nothing to place');
  if (targets.length !== count || count > pendingGroupSize(state)) throw new Error(`Choose ${count} target${count > 1 ? 's' : ''}`);
  targets.forEach((at, i) => {
    if (!placementCells(state, state.pending[i], at, orientation)) throw new Error("It doesn't fit there");
  });
  const ctx = begin(state, c);
  const s = ctx.s;
  const group = s.pending.splice(0, count);
  group.forEach((pl, i) => applyPlacement(ctx, pl, targets[i], orientation));
  if (!checkVictory(ctx)) proceed(ctx);
  return finish(ctx);
}

/**
 * What a set of targets would do, for the preview: damage per tile uid, and which tiles it deletes.
 * Hits are applied in order, so stacking on one tile adds up.
 */
export function previewPlacements(s: BattleState, targets: Pos[], orientation: 'h' | 'v'): { damage: Map<number, number>; deleted: Set<number>; cells: Pos[] } {
  const damage = new Map<number, number>();
  const deleted = new Set<number>();
  const cells: Pos[] = [];
  targets.forEach((at, i) => {
    const pl = s.pending[i];
    const hit = pl && placementCells(s, pl, at, orientation);
    if (!hit) return;
    for (const p of hit) {
      cells.push(p);
      const t = tileAt(s.board, p.x, p.y);
      if (!t || deleted.has(t.uid) || !hitsTile(pl, t)) continue;
      const d = (damage.get(t.uid) ?? 0) + pl.damage;
      damage.set(t.uid, d);
      if (d >= t.hp) deleted.add(t.uid);
    }
  });
  return { damage, deleted, cells };
}

// ---------------------------------------------------------------- pattern preview (enemy panel, prep, info)

/**
 * The next `depth` generated tiles for each column, as rows top → bottom: the bottom row is the next tile to
 * drop into each column. Each cell is an enemy tile id, or null for a normal tile. Columns advance
 * independently, so pass the battle's genPos (or all = board height before the battle).
 */
export function upcomingGrid(c: Content, enemyId: string, genPos: number[], depth = 8): (string | null)[][] {
  const gen = c.enemies[enemyId].generator;
  const cell = (x: number, d: number) => genCell(gen[genPos[x] + d], x);
  return Array.from({ length: depth }, (_, i) => genPos.map((_, x) => cell(x, depth - 1 - i)));
}

/** The enemy tiles on the starting board, as rows top → bottom. */
export function startingGrid(c: Content, enemyId: string): (string | null)[][] {
  const { width, height } = c.config.board;
  return upcomingGrid(c, enemyId, Array.from({ length: width }, () => 0), height);
}

/** Total enemy tiles still to come (sum over columns), given the columns' positions. */
export const generatorTotal = (c: Content, enemyId: string) => generatorEnemyTiles(c.enemies[enemyId], c.config.board.width);
