// The balance bot: a human-like player shared by the sims. It picks swaps by the sets they make right away (it
// can't see random refills) and doesn't plan ahead.
//
// Every swap is scored in one currency:
// - Damage: DMG_W per HP of damage actually dealt to enemy tiles. Overkill counts for nothing, so 9 damage on three
//   1 HP tiles is 3 HP, the same as one 3 HP tile. Shapes are tried at every spot they fit, so a horizontal set that
//   lines up with one enemy tile is worth less than a vertical one that lines up with three.
// - Defence: BLOCK_W per point of this enemy turn's damage that would get past your Block and is avoided, whether by
//   Block, Community, killing the tile that would hit or Locking it. Block beyond that becomes Momentum, which is only
//   worth something while your hits can't kill enemy tiles outright.
// - Junk clearing (Worship): JUNK_W per junk tile broken, less for tiles under an enemy (it drops closer).
// - Strengthen (Anoint): your tool tiles likely to clear soon, and Community in a line (+1 Block per point).
// - Community (Fellowship): only worth it when hits are coming on two or more turns; a swap that breaks a Community
//   line you needed this turn loses that Block.
// The same scores aim the placements, so the bot plays where it scored.
import { content, type Content } from '../../src/content';
import { endTurn, enemyTileSpeed, findSets, inLineCells, isLocked, pendingGroupSize, placeGroup, placementCells, playerMove, tileAt, turnEndFiring } from '../../src/engine/combat';
import type { BattleState, Board, Placement, Pos, Tile, TimedEvent } from '../../src/engine/types';

type FoundSet = ReturnType<typeof findSets>[number];

const W = 8, H = 8;
/** 1 HP of damage to an enemy tile. */
const DMG_W = 3;
/** 1 point of incoming damage avoided this enemy turn. */
const BLOCK_W = 4;
/** 1 junk tile broken. */
const JUNK_W = 1.5;
/** How many coming enemy turns Fellowship looks ahead. */
const LOOKAHEAD = 4;

type SetEffect = NonNullable<Content['tools'][string]['triggers']['setFormed']>[number];
/** Whether an Attack can hurt enemy tiles: no filter, or one that includes them (Worship's square is Junk only). */
export const hitsEnemies = (e: SetEffect) => e.type === 'attack' && (!('filter' in e.targets) || !e.targets.filter || e.targets.filter.includes('enemy'));

/** Damage an enemy tile deals you from the bottom row (its At bottom Attacks on You). */
function bottomDamage(c: Content, id: string): number {
  return (c.enemyTiles[id].triggers.atBottom ?? []).reduce((n, e) => n + (e.type === 'attack' && e.targets.type === 'you' ? e.dmg : 0), 0);
}

/**
 * Which coming enemy turn an enemy tile hits you on (1 = this one), or Infinity. It moves Speed steps a turn and a
 * step from the bottom row hits; Locked tiles wait a turn. Tiles in the way are ignored, so this is the worst case.
 */
function turnOfHit(s: BattleState, c: Content, t: Tile, y: number): number {
  if (bottomDamage(c, t.id) <= 0) return Infinity;
  const wait = isLocked(t, s.round) ? 1 : 0;
  if (y === H - 1) return 1 + wait;
  const speed = enemyTileSpeed(c, s.enemyId, t.id);
  return speed > 0 ? Math.ceil((H - y) / speed) + wait : Infinity;
}

/** Incoming damage per coming enemy turn: [this one, the next, …]. */
function incomingByTurn(s: BattleState, c: Content, turns = LOOKAHEAD): number[] {
  const out = Array<number>(turns).fill(0);
  s.board.cells.forEach((t, i) => {
    if (t?.kind !== 'enemy') return;
    const k = turnOfHit(s, c, t, Math.floor(i / W));
    if (k <= turns) out[k - 1] += bottomDamage(c, t.id);
  });
  return out;
}

/** Damage the coming enemy turn will deal you if nothing changes (worst case). */
export function incomingDamage(s: BattleState, c: Content = content): number {
  return incomingByTurn(s, c, 1)[0];
}

/** Block Community will give at the end of this turn on board `b` (the engine's own count). */
function communityBlock(s: BattleState, b: Board, c: Content): number {
  let v = 0;
  for (const [i, effects] of turnEndFiring(b, s.round, s, c)) {
    for (const e of effects) if (e.type === 'gain' && e.what === 'block' && typeof e.amount === 'number') v += e.amount * (e.inLine ? 1 + (b.cells[i]!.strength ?? 0) : 1);
  }
  return v;
}

/** The board after `cleared` cells empty and everything above falls (refills unknown: left empty). */
function settled(b: Board, cleared: Set<number>, replace: Map<number, Tile>): Board {
  const cells: (Tile | null)[] = Array(W * H).fill(null);
  for (let x = 0; x < W; x++) {
    const col: Tile[] = [];
    for (let y = 0; y < H; y++) {
      const i = y * W + x;
      const t = replace.get(i) ?? (cleared.has(i) ? null : b.cells[i]);
      if (t) col.push(t);
    }
    col.forEach((t, k) => { cells[(H - col.length + k) * W + x] = t; });
  }
  return { ...b, cells };
}

/**
 * How useful Momentum is now (0 to 1): it only helps when an enemy tile has more HP than a hit deals. Over every
 * damage tool in the loadout (Junk-only hits like Worship's don't count), the share of enemy tiles that one hit
 * of it doesn't kill.
 */
export function momentumShare(s: BattleState, c: Content = content): number {
  const enemies = s.board.cells.filter((t) => t?.kind === 'enemy');
  const hits: number[] = [];
  for (const tool of Object.values(s.tools)) {
    for (const e of c.tools[tool.toolId].triggers.setFormed ?? []) {
      if (e.type !== 'attack' || e.dmg <= 0 || e.targets.type === 'you' || !hitsEnemies(e)) continue;
      const truth = tool.pillar === 'truth' ? Math.floor(s.player.foresight / c.config.foresightPerBonus) : 0;
      hits.push(e.dmg + tool.fruit.faithfulness + truth);
    }
  }
  if (!hits.length || !enemies.length) return 0;
  return hits.reduce((sum, dmg) => sum + enemies.filter((t) => t!.hp > dmg).length / enemies.length, 0) / hits.length;
}

/** What the bot knows about the turn: who hits this enemy turn, how much gets past Block, what Block is worth. */
interface Outlook {
  c: Content;
  /** Enemy tile uid → damage it deals you this enemy turn. */
  threat: Map<number, number>;
  /** Enemy tile uid → damage it deals you the turn after (Locking it now delays it). */
  soon: Map<number, number>;
  incoming: number;
  /** Block you'll have when the enemy turn starts: Block now plus Community's. */
  cover: number;
  /** Incoming damage not covered (≥ 0). */
  need: number;
  /** Value of 1 Block point beyond what's needed: it becomes Momentum. */
  momentumPoint: number;
}

function outlook(s: BattleState, c: Content): Outlook {
  const threat = new Map<number, number>(), soon = new Map<number, number>();
  s.board.cells.forEach((t, i) => {
    if (t?.kind !== 'enemy') return;
    const k = turnOfHit(s, c, t, Math.floor(i / W));
    if (k === 1) threat.set(t.uid, bottomDamage(c, t.id));
    if (k === 2) soon.set(t.uid, bottomDamage(c, t.id));
  });
  const incoming = [...threat.values()].reduce((a, b) => a + b, 0);
  const cover = s.player.block + communityBlock(s, s.board, c);
  const share = momentumShare(s, c);
  // Momentum: a damage set's DMG_W per point of bonus, scaled by how often the bonus matters. Worthless (a small cost
  // for spending the tiles) when every hit already kills.
  const momentumPoint = share > 0 ? (DMG_W / c.config.momentumPerBonus) * share : -0.5;
  return { c, threat, soon, incoming, cover, need: Math.max(0, incoming - cover), momentumPoint };
}

/** Value of gaining `n` Block when `need` of the coming hit isn't covered yet. */
const blockValue = (o: Outlook, n: number, need = o.need) => BLOCK_W * Math.min(n, need) + o.momentumPoint * Math.max(0, n - need);

/** Avoiding a tile's hit this enemy turn (killing or Locking it): only the part that would get past Block counts. */
const dangerValue = (o: Outlook, t: Tile) => BLOCK_W * Math.min(o.threat.get(t.uid) ?? 0, o.need);

/** Is there an enemy tile above (x, y) in its column? Clearing under it drops it closer. */
const enemyAbove = (b: Board, x: number, y: number) => Array.from({ length: y }, (_, yy) => tileAt(b, x, yy)).some((t) => t?.kind === 'enemy');

/** Strengthen worth of one tile (Anoint): per `amount` points. */
function strengthenWorth(o: Outlook, s: BattleState, t: Tile, x: number, y: number, amount: number, lines: Set<number>): number {
  if (t.kind === 'blessing' && t.id === 'community') {
    // +1 Block per point at end of turn while it's in a line.
    return lines.has(y * W + x) ? blockValue(o, amount) : 0;
  }
  if (t.kind !== 'tool') return 0;
  // Your tool tiles likely to clear soon (next to one of the same tool): damage tools first.
  const effects = o.c.tools[s.tools[t.id].toolId].triggers.setFormed ?? [];
  const worth = effects.some((e) => e.type === 'attack' && e.dmg > 0 && hitsEnemies(e)) ? 1 : effects.some((e) => e.type === 'gain') ? 0.5 : 0.2;
  const pairs = [[1, 0], [-1, 0], [0, 1], [0, -1]].filter(([dx, dy]) => tileAt(s.board, x + dx, y + dy)?.id === t.id).length;
  return worth * (1 + pairs);
}

/**
 * The best targets for `n` copies of placement `pl` on `s`'s board, and what they're worth. Damage counts HP dealt,
 * plus the hit avoided when it kills (or Locks) a tile that would hit you. Choose anywhere hits finish tiles off
 * when they can (stacking hits on one tile); shapes try every spot they fit, including hanging off the edge.
 */
function aim(o: Outlook, s: BattleState, pl: Placement, n: number): { targets: Pos[]; v: number } {
  const b = s.board;
  const hpLeft = new Map<number, number>();
  const hp = (t: Tile) => hpLeft.get(t.uid) ?? t.hp;
  const allowed = (t: Tile | null): t is Tile => !!t && (!pl.target.filter || pl.target.filter.includes(t.kind));
  const lines = inLineCells(b);
  const locked = new Set<number>();

  // One tile under one hit.
  const tileValue = (t: Tile, x: number, y: number, hits = 1): number => {
    if (pl.apply === 'strengthen' && pl.damage === 0) return strengthenWorth(o, s, t, x, y, (pl.applyAmount ?? 1) * hits, lines);
    if (hp(t) <= 0) return 0;
    const dmg = pl.damage * hits;
    if (t.kind === 'enemy') {
      let v = DMG_W * Math.min(dmg, hp(t));
      if (dmg >= hp(t)) v += dangerValue(o, t);
      else if (pl.apply === 'locked' && !locked.has(t.uid)) v += dangerValue(o, t) + 0.25 * BLOCK_W * (o.soon.get(t.uid) ?? 0);
      return v;
    }
    // Junk-only hits (Worship): each junk tile broken, unless it drops an enemy tile closer.
    if (t.kind === 'junk' && pl.target.filter && dmg >= hp(t)) return enemyAbove(b, x, y) ? -JUNK_W : JUNK_W;
    return 0;
  };
  const hitTile = (t: Tile, hits = 1) => {
    hpLeft.set(t.uid, hp(t) - pl.damage * hits);
    if (pl.apply === 'locked') locked.add(t.uid);
  };

  const targets: Pos[] = [];
  let total = 0;
  if (pl.target.type === 'anywhere') {
    let left = n;
    while (left > 0) {
      // Best value per hit: finish a tile off in k hits (if there are k left), or one hit on it.
      let best: { p: Pos; k: number; per: number } | null = null;
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
        const t = tileAt(b, x, y);
        if (!allowed(t)) continue;
        const options = [1];
        if (pl.damage > 0 && hp(t) > pl.damage) {
          const k = Math.ceil(hp(t) / pl.damage);
          if (k <= left) options.push(k);
        }
        for (const k of options) {
          const per = tileValue(t, x, y, k) / k;
          if (!best || per > best.per) best = { p: { x, y }, k, per };
        }
      }
      if (!best) break;
      const t = tileAt(b, best.p.x, best.p.y)!;
      hitTile(t, best.k);
      for (let i = 0; i < best.k; i++) targets.push(best.p);
      total += best.per * best.k;
      left -= best.k;
    }
    // Nothing it can hit: any valid tile, so the placement still resolves.
    const any = targets[0] ?? b.cells.map((t, i) => (allowed(t) ? { x: i % W, y: Math.floor(i / W) } : null)).find(Boolean) ?? { x: 0, y: H - 1 };
    while (targets.length < n) targets.push(any);
    return { targets, v: total };
  }

  // Shapes (and lines, laid horizontally): the best spot for each copy in turn.
  const offs = pl.target.type === 'shape' ? pl.target.cells : Array.from({ length: pl.target.length }, (_, i) => ({ x: i, y: 0 }));
  const spanX = Math.max(...offs.map((p) => p.x)), spanY = Math.max(...offs.map((p) => p.y));
  for (let k = 0; k < n; k++) {
    let best: Pos = { x: 0, y: 0 }, bestV = -Infinity;
    for (let y = -spanY; y < H; y++) for (let x = -spanX; x < W; x++) {
      const cells = placementCells(s, pl, { x, y });
      if (!cells) continue;
      let v = 0;
      for (const p of cells) {
        const t = tileAt(b, p.x, p.y);
        if (allowed(t)) v += tileValue(t, p.x, p.y);
      }
      if (v > bestV) { bestV = v; best = { x, y }; }
    }
    for (const p of placementCells(s, pl, best) ?? []) {
      const t = tileAt(b, p.x, p.y);
      if (allowed(t)) hitTile(t);
    }
    targets.push(best);
    total += Math.max(0, bestV);
  }
  return { targets, v: total };
}

/** Targets for the pending group: the same scoring the bot used to pick its swap. */
export function chooseTargets(s: BattleState, c: Content = content): Pos[] {
  return aim(outlook(s, c), s, s.pending[0], pendingGroupSize(s)).targets;
}

/** The bot's targeting. Sims can swap in another (e.g. one that stacks hits) with setTargeting. */
let targeting: (s: BattleState) => Pos[] = (s) => chooseTargets(s);
export function setTargeting(fn: ((s: BattleState) => Pos[]) | null) {
  targeting = fn ?? ((s) => chooseTargets(s));
}

export function resolvePlacements(s: BattleState, c: Content = content, events?: TimedEvent[]): BattleState {
  let st = s;
  for (let g = 0; g < 50 && st.phase === 'placing'; g++) {
    const t = targeting(st);
    try { const r = placeGroup(st, t, c); events?.push(...r.events); st = r.state; } catch (e) {
      throw new Error(`${e} pending=${JSON.stringify(st.pending.slice(0, 4))} targets=${JSON.stringify(t)}`, { cause: e });
    }
  }
  return st;
}

/** A set's shape as offsets from its top-left. */
const shapeOf = (cells: Pos[]) => {
  const x0 = Math.min(...cells.map((p) => p.x)), y0 = Math.min(...cells.map((p) => p.y));
  return cells.map((p) => ({ x: p.x - x0, y: p.y - y0 }));
};

/**
 * What one set would do on board `t` (after the swap): damage, junk cleared and Strengthen via its Attacks (aimed as
 * the bot would aim them), plus the Block it gains and the tiles it turns into Community. Momentum is spent by the
 * first damaging set (`spend.momentum`).
 */
function setValue(o: Outlook, t: BattleState, set: FoundSet, spend: { momentum: number }): { v: number; block: number; community: number } {
  const c = o.c;
  const n = set.cells.length + set.bonus;
  const tool = set.key.startsWith('tool:') ? t.tools[set.key.slice(5)] : null;
  const effects: SetEffect[] = tool ? (c.tools[tool.toolId].triggers.setFormed ?? []) : set.key.startsWith('junk:') ? (c.junk[set.key.slice(5)].triggers.setFormed ?? []) : [];
  let v = 0, block = 0, community = 0;
  const bonus = effects.some((e) => e.type === 'attack' && e.dmg > 0 && hitsEnemies(e)) ? spend.momentum : 0;
  if (bonus) spend.momentum = 0;
  for (const e of effects) {
    if (e.type === 'gain') {
      const amount = typeof e.amount === 'number' ? e.amount : 'perTiles' in e.amount ? Math.ceil(n / e.amount.perTiles) : e.amount.perSetTile * n;
      if (e.what === 'block') block += amount;
      if (e.what === 'moves') v += 2.5 * amount; // a free swap: about one more set
      continue;
    }
    if (e.type === 'becomes') { community += set.cells.length; continue; }
    if (e.type !== 'attack' || e.targets.type === 'you') continue;
    const truth = tool?.pillar === 'truth' ? Math.floor(t.player.foresight / c.config.foresightPerBonus) : 0;
    const base = e.dmgPerTiles ? e.dmg * Math.ceil(n / e.dmgPerTiles) : e.dmg;
    const damage = base + (tool && e.dmg > 0 ? tool.fruit.faithfulness + truth : 0) + (e.dmg > 0 ? bonus : 0);
    const filter = 'filter' in e.targets ? e.targets.filter : undefined;
    let target: Placement['target'];
    let count = 1;
    if (e.targets.type === 'chooseAnywhere') {
      target = { type: 'anywhere', ...(filter && { filter }) };
      const a = e.targets.count;
      count = typeof a === 'number' ? a : 'perTiles' in a ? Math.ceil(n / a.perTiles) : a.perSetTile * n;
    } else if (e.targets.type === 'chooseShape') {
      const cells = e.targets.shape === 'set' ? shapeOf(set.cells)
        : e.targets.shape === 'square' ? Array.from({ length: Math.min(n, W) ** 2 }, (_, i) => ({ x: i % Math.min(n, W), y: Math.floor(i / Math.min(n, W)) }))
          : Array.from({ length: e.targets.length }, (_, i) => ({ x: i, y: 0 }));
      target = { type: 'shape', cells, ...(filter && { filter }) };
    } else continue;
    v += aim(o, t, { target, damage, source: '', apply: e.apply, applyAmount: e.applyAmount }, count).v;
  }
  return { v, block, community };
}

/**
 * A human-like move: judge each swap only by the sets it makes right away (no peeking at random refills), then
 * play the best one. Swapping a low enemy tile upward also counts.
 */
export function botMove(s: BattleState, rnd: () => number, c: Content = content, events?: TimedEvent[]): BattleState {
  const o = outlook(s, c);
  const byTurn = incomingByTurn(s, c);
  // Fellowship: Community gives Block every turn its line holds, so it's only worth the board space when hits are
  // coming on two or more turns.
  const longHaul = byTurn.filter((d) => d > 0).length >= 2;
  const communityNow = communityBlock(s, s.board, c);
  let best: [Pos, Pos] | null = null, bestV = 0;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) for (const [dx, dy] of [[1, 0], [0, 1]]) {
    if (x + dx >= W || y + dy >= H) continue;
    const a = tileAt(s.board, x, y), b = tileAt(s.board, x + dx, y + dy);
    if (!a || !b) continue;
    const t = structuredClone(s);
    const ia = y * W + x, ib = (y + dy) * W + x + dx;
    [t.board.cells[ia], t.board.cells[ib]] = [t.board.cells[ib], t.board.cells[ia]];
    const sets = findSets(t);
    let v = 0, block = 0, newCommunity = 0;
    const spend = { momentum: Math.floor(s.player.momentum / c.config.momentumPerBonus) };
    const cleared = new Set<number>(), replace = new Map<number, Tile>();
    for (const set of sets) {
      const r = setValue(o, t, set, spend);
      v += r.v;
      block += r.block;
      newCommunity += r.community;
      for (const p of [...set.cells, ...set.support]) cleared.add(p.y * W + p.x);
      if (r.community) for (const p of set.cells) replace.set(p.y * W + p.x, { uid: -1 - replace.size, kind: 'blessing', id: 'community', hp: 1, maxHp: 1 });
    }
    // Defence this enemy turn: Block gained, and Community gained or lost (a set clearing under a Community line can
    // break it). Only the part of the hit that gets past Block counts; extra Block becomes Momentum.
    const community = sets.length ? communityBlock(s, settled(t.board, cleared, replace), c) : communityNow;
    const needAfter = Math.max(0, o.incoming - (o.cover - communityNow + community));
    v += BLOCK_W * (o.need - needAfter) + blockValue(o, block, needAfter);
    // Community's later turns: worth Block each turn hits come, less the further off; clutter otherwise.
    if (newCommunity) {
      v += longHaul ? byTurn.slice(1).reduce((sum, d, k) => sum + BLOCK_W * Math.min(newCommunity, d) * 0.7 ** (k + 1), 0) : -0.5 * newCommunity;
    }
    // Pushing an enemy tile up (it was below its partner) buys time.
    if (dy === 1 && b.kind === 'enemy' && a.kind !== 'enemy') v += (y + 2) / 3;
    v += rnd() * 0.01;
    if (v > bestV) { bestV = v; best = [{ x, y }, { x: x + dx, y: y + dy }]; }
  }
  if (!best) {
    // Nothing useful: a random legal swap.
    const x = Math.floor(rnd() * 7), y = Math.floor(rnd() * H);
    best = [{ x, y }, { x: x + 1, y }];
  }
  try {
    const r = playerMove(s, best[0], best[1], c);
    events?.push(...r.events);
    return resolvePlacements(r.state, c, events);
  } catch {
    const r = endTurn(s, c);
    events?.push(...r.events);
    return r.state;
  }
}
