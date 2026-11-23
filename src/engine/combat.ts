// The battle engine for the 2026-11 combat rework (docs/combat.md). Pure functions: state in, { state, events } out.
// One enemy feeds tiles onto an 8×8 board from its generator; the player matches tools to hold them off.
//
// Resolution is resumable: effects that need the player to pick tiles (Prayer's shape, the Word's Stones,
// Prophecy and Time hits, Abstain, Many Fish) queue a Placement and pause in phase 'placing'. place() applies it
// and carries on from where the battle left off (`stage`).

import type { Content } from '../content';
import { FRUIT_IDS } from '../content/fruits';
import { createRng, type Rng } from './rng';
import type {
  BattleEvent, BattleResult, BattleState, BattleTool, Board, FruitId, Placement, Player, Pos, Tile, TimedEvent, ToolInstance, ViewSnapshot,
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
}

// ---------------------------------------------------------------- helpers

export function resolveTool(inst: ToolInstance, c: Content): BattleTool {
  const def = c.tools[inst.toolId];
  const fruit = Object.fromEntries(FRUIT_IDS.map((f) => [f, 0])) as Record<FruitId, number>;
  for (const f of inst.sockets) if (f) fruit[f] += 1;
  return {
    uid: inst.uid, toolId: inst.toolId, name: def.name, pillar: inst.pillar, effect: def.effect, icon: def.icon, color: def.color,
    weight: 1 + c.config.pool.weightPerLove * fruit.love, fruit,
  };
}

const idx = (b: Board, x: number, y: number) => y * b.width + x;
export const tileAt = (b: Board, x: number, y: number): Tile | null =>
  x < 0 || y < 0 || x >= b.width || y >= b.height ? null : b.cells[idx(b, x, y)];
const inBounds = (b: Board, p: Pos) => p.x >= 0 && p.y >= 0 && p.x < b.width && p.y < b.height;

/** What a tile matches with: tools by instance, junk by type, Stones together. Enemy tiles never match. */
export function matchKey(t: Tile | null): string | null {
  if (!t) return null;
  if (t.kind === 'tool') return `tool:${t.id}`;
  if (t.kind === 'junk') return `junk:${t.id}`;
  if (t.kind === 'stone') return 'stone';
  return null;
}

function posOf(b: Board, uid: number): Pos | null {
  const i = b.cells.findIndex((t) => t?.uid === uid);
  return i < 0 ? null : { x: i % b.width, y: Math.floor(i / b.width) };
}

const enemyCount = (b: Board) => b.cells.filter((t) => t?.kind === 'enemy').length;

export function enemyToCome(s: BattleState, c: Content): number {
  const gen = c.enemies[s.enemyId].generator;
  let n = 0;
  for (let x = 0; x < s.board.width; x++) for (let r = s.genPos[x]; r < gen.length; r++) if (gen[r] !== 'normal') n += 1;
  return n;
}

export function snapshot(s: BattleState, c: Content): ViewSnapshot {
  const p = s.player;
  return {
    board: structuredClone(s.board),
    player: { hp: p.hp, maxHp: p.maxHp, block: p.block, critical: p.critical, foresight: p.foresight },
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

function stoneTile(ctx: Ctx, hp: number): Tile {
  return { uid: ctx.s.nextUid++, kind: 'stone', id: 'stone', hp, maxHp: hp };
}

/** The tile for generated row `row` (0 = the bottom row of the board). */
function generatedTile(ctx: Ctx, row: number): Tile {
  const r = ctx.c.enemies[ctx.s.enemyId].generator[row];
  return r && r !== 'normal' ? enemyTile(ctx, r.tile) : poolTile(ctx);
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
      hp: setup.player.hp, maxHp: setup.player.maxHp, block: 0, critical: 0, foresight: 0,
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
      const gen = enemy.generator[row];
      if (gen && gen !== 'normal') {
        s.board.cells[idx(s.board, x, y)] = enemyTile(ctx, gen.tile);
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
  /** Extra size from Supportive (sum of their Kindness). */
  bonus: number;
}

export function findSets(s: BattleState): FoundSet[] {
  const b = s.board;
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
        const k = i < len ? matchKey(b.cells[cell(line, i)]) : null;
        const prev = matchKey(b.cells[cell(line, start)]);
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
  const sets: FoundSet[] = [...groups.values()]
    .map((cells) => cells.sort((a, c2) => a - c2))
    .sort((a, c2) => a[0] - c2[0])
    .map((cells) => ({
      key: matchKey(b.cells[cells[0]])!,
      cells: cells.map((i) => ({ x: i % b.width, y: Math.floor(i / b.width) })),
      support: [],
      bonus: 0,
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
  return sets;
}

/** Offsets of a shape from its top-left corner. */
function normalise(cells: Pos[]): Pos[] {
  const minX = Math.min(...cells.map((p) => p.x));
  const minY = Math.min(...cells.map((p) => p.y));
  return cells.map((p) => ({ x: p.x - minX, y: p.y - minY })).sort((a, b) => a.y - b.y || a.x - b.x);
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
  if (key.startsWith('junk:')) {
    const j = c.junk[key.slice(5)];
    for (let i = 0; i < j.hits; i++) s.pending.push({ type: 'hit', damage: 1, source: j.name });
    if (j.hits > 0) emit(ctx, { type: 'effect', source: j.name, text: `${j.name}: deal ${j.hits} damage to a tile` });
    return;
  }
  if (!key.startsWith('tool:')) return; // Stones: no effect
  const tool = s.tools[key.slice(5)];
  const f = tool.fruit;
  const size = st.cells.length + st.bonus;
  const mult = p.critical > 0 ? 2 : 1;
  if (mult === 2) p.critical -= 1;
  const truth = tool.pillar === 'truth' ? p.foresight : 0;
  const damage = 1 + f.faithfulness + truth;
  const texts: string[] = [];
  switch (tool.effect) {
    case 'critical':
      p.critical += mult;
      texts.push(`Critical +${mult}`);
      break;
    case 'damageShape': {
      const shape = normalise([...st.cells, ...st.support]);
      for (let i = 0; i < mult; i++) s.pending.push({ type: 'shape', cells: shape, damage, source: tool.name });
      texts.push(`${mult > 1 ? `${mult} × ` : ''}${shape.length}-tile shape, ${damage} damage`);
      break;
    }
    case 'block':
      p.block += size * mult;
      texts.push(`+${size * mult} Block`);
      break;
    case 'stones': {
      const n = size * mult;
      const stoneHp = c.config.stoneHp + f.patience + truth;
      for (let i = 0; i < n; i++) s.pending.push({ type: 'stone', damage, stoneHp, source: tool.name });
      texts.push(`${n} Stones`);
      break;
    }
    case 'prophecy': {
      const n = size * mult;
      for (let i = 0; i < n; i++) s.pending.push({ type: 'hit', damage, source: tool.name });
      p.foresight += mult; // after the hits were sized, so it boosts later sets only
      texts.push(`${n} hits, Foresight +${mult}`);
      break;
    }
    case 'none':
      break;
  }
  if (f.peace > 0) {
    p.block += f.peace * size * mult;
    texts.push(`+${f.peace * size * mult} Block (Peace)`);
  }
  if (f.goodness > 0) {
    const before = p.hp;
    p.hp = Math.min(p.maxHp, p.hp + f.goodness * mult);
    if (p.hp > before) texts.push(`+${p.hp - before} Courage`);
  }
  if (f.self_control > 0 && !s.focusUsed.includes(tool.uid)) {
    s.focusUsed.push(tool.uid);
    s.movesLeft += f.self_control;
    texts.push(`+${f.self_control} move`);
  }
  emit(ctx, { type: 'effect', source: tool.name, text: `${tool.name}${mult > 1 ? ' (Critical)' : ''}: ${texts.join(', ')}` });
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
    for (let y = empty - 1; y >= 0; y--) b.cells[idx(b, x, y)] = generatedTile(ctx, ctx.s.genPos[x]++);
  }
  if (changed) emit(ctx, { type: 'collapsed' });
}

/** Resolve sets until the board is stable, or a placement is needed, or the battle is over. */
function settle(ctx: Ctx): 'stable' | 'waiting' | 'over' {
  const { s } = ctx;
  for (let guard = 0; guard < 500; guard++) {
    if (s.outcome) return 'over';
    if (s.pending.length > 0) {
      s.phase = 'placing';
      return 'waiting';
    }
    if (s.board.cells.some((t) => t === null)) gravity(ctx);
    if (checkVictory(ctx)) return 'over';
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
        s.stage = 'enemy';
        break;
      case 'enemy':
        activateEnemies(ctx);
        if (s.outcome) return;
        s.stage = 'newTurn';
        break;
      case 'newTurn':
        s.round += 1;
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

function activateEnemies(ctx: Ctx) {
  const { s, c } = ctx;
  const b = s.board;
  const order: number[] = [];
  for (let y = b.height - 1; y >= 0; y--) for (let x = 0; x < b.width; x++) {
    const t = tileAt(b, x, y);
    if (t?.kind === 'enemy') order.push(t.uid);
  }
  for (const uid of order) {
    let p = posOf(b, uid);
    if (!p) continue;
    const t = tileAt(b, p.x, p.y)!;
    const def = c.enemyTiles[t.id];
    for (let step = 0; step < def.speed && p; step++) {
      if (p.y === b.height - 1) {
        hitPlayer(ctx, def.damage);
        if (s.outcome) return;
        break;
      }
      const below = tileAt(b, p.x, p.y + 1);
      if (below?.kind === 'enemy') break;
      if (below) {
        const gone = damageAt(ctx, [{ x: p.x, y: p.y + 1 }], 1);
        if (gone.length === 0) break; // it survived (a Stone with HP left): the enemy tile stays put
      }
      b.cells[idx(b, p.x, p.y + 1)] = t;
      b.cells[idx(b, p.x, p.y)] = null;
      p = { x: p.x, y: p.y + 1 };
      emit(ctx, { type: 'enemyStep', uid });
    }
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
  return !!ta && !!tb && ta.kind !== 'enemy' && tb.kind !== 'enemy';
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
  const e = def.effect;
  if (e.type === 'block') p.block += e.amount;
  if (e.type === 'moves') ctx.s.movesLeft += e.amount;
  if (e.type === 'hit') ctx.s.pending.push({ type: 'hit', damage: e.damage, source: def.name });
  if (e.type === 'line') ctx.s.pending.push({ type: 'line', length: e.length, damage: e.damage, source: def.name });
  emit(ctx, { type: 'ability', id: ab.id });
  proceed(ctx);
  return finish(ctx);
}

/** The cells a placement would cover at `at` (its top-left for shapes and lines), or null if it doesn't fit. */
export function placementCells(s: BattleState, pl: Placement, at: Pos, orientation: 'h' | 'v' = 'h'): Pos[] | null {
  const b = s.board;
  let cells: Pos[];
  if (pl.type === 'shape') cells = pl.cells.map((o) => ({ x: at.x + o.x, y: at.y + o.y }));
  else if (pl.type === 'line') cells = Array.from({ length: pl.length }, (_, i) => (orientation === 'h' ? { x: at.x + i, y: at.y } : { x: at.x, y: at.y + i }));
  else cells = [at];
  if (!cells.every((p) => inBounds(b, p))) return null;
  if ((pl.type === 'hit' || pl.type === 'stone') && !tileAt(b, at.x, at.y)) return null;
  return cells;
}

/** Resolve the next pending placement at `at`. */
export function place(state: BattleState, at: Pos, c: Content, orientation: 'h' | 'v' = 'h'): BattleResult {
  const pl = state.pending[0];
  if (state.phase !== 'placing' || !pl) throw new Error('Nothing to place');
  const cells = placementCells(state, pl, at, orientation);
  if (!cells) throw new Error("It doesn't fit there");
  const ctx = begin(state, c);
  const s = ctx.s;
  s.pending.shift();
  if (pl.type === 'stone') {
    const gone = damageAt(ctx, cells, pl.damage);
    if (gone.length) {
      const st = stoneTile(ctx, pl.stoneHp);
      s.board.cells[idx(s.board, at.x, at.y)] = st;
      emit(ctx, { type: 'stone', uid: st.uid });
    }
  } else {
    damageAt(ctx, cells, pl.damage);
  }
  if (!checkVictory(ctx)) proceed(ctx);
  return finish(ctx);
}

// ---------------------------------------------------------------- pattern preview (enemy panel, prep, info)

/**
 * The next `depth` generated tiles for each column, as rows top → bottom: the bottom row is the next tile to
 * drop into each column. Each cell is an enemy tile id, or null for a normal tile. Columns advance
 * independently, so pass the battle's genPos (or all = board height before the battle).
 */
export function upcomingGrid(c: Content, enemyId: string, genPos: number[], depth = 8): (string | null)[][] {
  const gen = c.enemies[enemyId].generator;
  const cell = (x: number, d: number) => {
    const r = gen[genPos[x] + d];
    return r && r !== 'normal' ? r.tile : null;
  };
  return Array.from({ length: depth }, (_, i) => genPos.map((_, x) => cell(x, depth - 1 - i)));
}

/** The enemy tiles on the starting board, as rows top → bottom. */
export function startingGrid(c: Content, enemyId: string): (string | null)[][] {
  const { width, height } = c.config.board;
  return upcomingGrid(c, enemyId, Array.from({ length: width }, () => 0), height);
}

/** Total enemy tiles still to come (sum over columns), given the columns' positions. */
export const generatorTotal = (c: Content, enemyId: string) =>
  c.enemies[enemyId].generator.filter((r) => r !== 'normal').length * c.config.board.width;
