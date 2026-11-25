// The balance bot: a human-like player shared by the sims. It picks swaps by the sets they make right away (it
// can't see random refills), aims damage at the lowest enemy tiles, and doesn't plan ahead. Block: it saves its
// Block tiles (doesn't match them) while nothing will hit it this enemy turn, and fires them when something will.
import { content, type Content } from '../../src/content';
import { endTurn, enemyTileSpeed, findSets, isLocked, pendingGroupSize, placeGroup, placementCells, playerMove, tileAt } from '../../src/engine/combat';
import type { BattleState, Pos, TimedEvent } from '../../src/engine/types';

const W = 8, H = 8;

type SetEffect = NonNullable<Content['tools'][string]['triggers']['setFormed']>[number];
/** Whether an Attack can hurt enemy tiles: no filter, or one that includes them (Worship's square is Junk only). */
export const hitsEnemies = (e: SetEffect) => e.type === 'attack' && (!('filter' in e.targets) || !e.targets.filter || e.targets.filter.includes('enemy'));

/**
 * Clearing targets (a shape that can't hit enemy tiles, e.g. Worship: Junk only): the anchor that breaks the most
 * tiles, counting only those with no enemy tile above them in their column (clearing under an enemy drops it closer).
 */
function chooseClear(s: BattleState, n: number): Pos[] {
  const pl = s.pending[0];
  const enemyAbove = (x: number, y: number) => Array.from({ length: y }, (_, yy) => tileAt(s.board, x, yy)).some((t) => t?.kind === 'enemy');
  let best: Pos = { x: 0, y: 0 }, bestV = -Infinity;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const cells = placementCells(s, pl, { x, y });
    if (!cells) continue;
    let v = 0;
    for (const p of cells) {
      const t = tileAt(s.board, p.x, p.y);
      if (!t || (pl.target.filter && !pl.target.filter.includes(t.kind)) || pl.damage < t.hp) continue;
      v += enemyAbove(p.x, p.y) ? -1 : 1;
    }
    if (v > bestV) { bestV = v; best = { x, y }; }
  }
  return Array.from({ length: n }, () => best);
}

/**
 * Lock targets (Preaching): the enemy tile that would do the most this enemy turn — on the bottom row (it would hit
 * you), else the lowest one that moves, since everything above it in its column waits too. Never one already Locked.
 */
function chooseLocks(s: BattleState, n: number): Pos[] {
  const scored: { p: Pos; v: number }[] = [];
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const t = tileAt(s.board, x, y);
    if (t?.kind !== 'enemy') continue;
    const moves = enemyTileSpeed(content, s.enemyId, t.id) > 0;
    const below = tileAt(s.board, x, y + 1);
    const leadsColumn = below?.kind !== 'enemy'; // nothing of the enemy's own below it to stop it
    let v = (y + 2) ** 2 * (y === H - 1 ? 3 : moves ? 1 : 0.3) * (leadsColumn ? 2 : 0.2);
    if (isLocked(t, s.round)) v *= 0.05;
    scored.push({ p: { x, y }, v });
  }
  scored.sort((a, b) => b.v - a.v);
  const out = scored.slice(0, n).map((e) => e.p);
  while (out.length < n && out.length > 0) out.push(out[0]); // more locks than enemy tiles: repeat
  return out;
}

/**
 * Strengthen targets (Anoint): your own tool tiles that are likely to clear soon (next to a tile of the same tool),
 * damage tools first. Stacks on the best tile when there are few good ones.
 */
function chooseStrengthen(s: BattleState, n: number): Pos[] {
  const scored: { p: Pos; v: number }[] = [];
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const t = tileAt(s.board, x, y);
    if (t?.kind !== 'tool') continue;
    const effects = content.tools[s.tools[t.id].toolId].triggers.setFormed ?? [];
    const worth = effects.some((e) => e.type === 'attack' && e.dmg > 0 && hitsEnemies(e)) ? 3 : effects.some((e) => e.type === 'gain') ? 1.5 : 0.5;
    const pairs = [[1, 0], [-1, 0], [0, 1], [0, -1]].filter(([dx, dy]) => tileAt(s.board, x + dx, y + dy)?.id === t.id).length;
    scored.push({ p: { x, y }, v: worth * (1 + pairs) });
  }
  const pl = s.pending[0];
  if (pl.target.type !== 'anywhere') {
    // A shape (Anoint): the anchor whose cells cover the most worth, for each of the n shapes.
    const worth = new Map(scored.map((e) => [e.p.y * W + e.p.x, e.v]));
    let best: Pos = { x: 0, y: 7 }, bestV = -Infinity;
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const cells = placementCells(s, pl, { x, y });
      if (!cells) continue;
      const v = cells.reduce((sum, p) => sum + (worth.get(p.y * W + p.x) ?? 0), 0);
      if (v > bestV) { bestV = v; best = { x, y }; }
    }
    return Array.from({ length: n }, () => best);
  }
  scored.sort((a, b) => b.v - a.v);
  const out = scored.slice(0, n).map((e) => e.p);
  while (out.length < n && out.length > 0) out.push(out[0]);
  return out.length ? out : Array.from({ length: n }, () => ({ x: 0, y: 7 }));
}

/** Greedy targets for the pending group: lowest enemy tiles first (shapes: best anchor by danger removed). */
export function chooseTargets(s: BattleState): Pos[] {
  const n = pendingGroupSize(s);
  const pl = s.pending[0];
  if (pl.apply === 'locked') return chooseLocks(s, n);
  if (pl.apply === 'strengthen' && pl.damage === 0) return chooseStrengthen(s, n);
  if (pl.target.filter && !pl.target.filter.includes('enemy')) return chooseClear(s, n);
  const targets: Pos[] = [];
  const used = new Set<number>();
  for (let k = 0; k < n; k++) {
    let best: Pos | null = null, bestV = -Infinity;
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const cells = placementCells(s, pl, { x, y });
      if (!cells) continue;
      let v = 0;
      for (const p of cells) {
        const t = tileAt(s.board, p.x, p.y);
        if (!t) continue;
        if (t.kind === 'enemy' && !used.has(p.y * W + p.x)) v += (p.y + 2) ** 2 * (pl.damage >= t.hp ? 3 : 1);
      }
      if (v > bestV) { bestV = v; best = { x, y }; }
    }
    const pick = best ?? { x: 0, y: 0 };
    if (pl.target.type === 'anywhere') used.add(pick.y * W + pick.x);
    targets.push(pick);
  }
  return targets;
}

/** The bot's targeting. Sims can swap in another (e.g. one that stacks hits) with setTargeting. */
let targeting: (s: BattleState) => Pos[] = chooseTargets;
export function setTargeting(fn: ((s: BattleState) => Pos[]) | null) {
  targeting = fn ?? chooseTargets;
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

/** Damage an enemy tile deals you from the bottom row (its At bottom Attacks on You). */
function bottomDamage(c: Content, id: string): number {
  return (c.enemyTiles[id].triggers.atBottom ?? []).reduce((n, e) => n + (e.type === 'attack' && e.targets.type === 'you' ? e.dmg : 0), 0);
}

/**
 * Damage the coming enemy turn will deal you if nothing changes: every unlocked enemy tile that is on the bottom row,
 * or close enough to reach it and still have a step left (it moves Speed steps; a step from the bottom row hits).
 * Tiles in the way are ignored, so this is the worst case.
 */
export function incomingDamage(s: BattleState, c: Content = content): number {
  let dmg = 0;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const t = tileAt(s.board, x, y);
    if (t?.kind !== 'enemy' || isLocked(t, s.round)) continue;
    const speed = enemyTileSpeed(c, s.enemyId, t.id);
    if (y === H - 1 || H - 1 - y < speed) dmg += bottomDamage(c, t.id);
  }
  return dmg;
}

/**
 * A human-like move: judge each swap only by the sets it makes right away (no peeking at random refills), then
 * play the best one. Swapping a low enemy tile upward also counts.
 */
export function botMove(s: BattleState, rnd: () => number, c: Content = content, events?: TimedEvent[]): BattleState {
  const lowest = Math.max(-1, ...s.board.cells.map((t, i) => (t?.kind === 'enemy' ? Math.floor(i / W) : -1)));
  const urgency = lowest >= 6 ? 3 : lowest >= 4 ? 1.5 : 0.6; // Locks matter more when enemies are near the bottom
  // Block lasts only until your next turn, so it's worth gaining only to cover a hit coming this enemy turn.
  // In danger (more incoming than Block): fire Block, ahead of damage, for the points that cover the hit.
  // Not in danger: save the Block tiles for a turn when it is, so a set of them is a small cost.
  const need = incomingDamage(s, c) - s.player.block;
  const blockValue = (n: number) => (need > 0 ? 4 * Math.min(n, need) + 0.5 * Math.max(0, n - need) : -0.5 * n);
  let best: [Pos, Pos] | null = null, bestV = 0;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) for (const [dx, dy] of [[1, 0], [0, 1]]) {
    if (x + dx >= W || y + dy >= H) continue;
    const a = tileAt(s.board, x, y), b = tileAt(s.board, x + dx, y + dy);
    if (!a || !b) continue;
    const t = structuredClone(s);
    const ia = y * W + x, ib = (y + dy) * W + x + dx;
    [t.board.cells[ia], t.board.cells[ib]] = [t.board.cells[ib], t.board.cells[ia]];
    let v = 0;
    for (const set of findSets(t)) {
      const n = set.cells.length + set.bonus;
      if (set.key.startsWith('tool:')) {
        // Value a tool set by what its Set formed effects do: damage first, then Locks and Block (more when enemy
        // tiles are near the bottom), then Critical.
        const effects = c.tools[s.tools[set.key.slice(5)].toolId].triggers.setFormed ?? [];
        const gains = (what: string) => effects.some((e) => e.type === 'gain' && e.what === what);
        // An Attack whose filter leaves out enemy tiles (Worship: Junk only) clears the board but can't hurt enemies.
        const damages = effects.some((e) => e.type === 'attack' && e.dmg > 0 && hitsEnemies(e));
        const clears = effects.some((e) => e.type === 'attack' && e.dmg > 0 && !hitsEnemies(e));
        const locks = effects.some((e) => e.type === 'attack' && e.apply === 'locked');
        const strengthens = effects.some((e) => e.type === 'attack' && e.apply === 'strengthen');
        // How much of something the set gives (e.g. Block 1 per 3 tiles, rounded up).
        const gained = (what: string) => effects.reduce((sum, e) => sum + (e.type !== 'gain' || e.what !== what ? 0
          : typeof e.amount === 'number' ? e.amount : 'perTiles' in e.amount ? Math.ceil(n / e.amount.perTiles) : e.amount.perSetTile * n), 0);
        // Fellowship: its tiles become Community (Block at end of turn while 3+ are in a line), so worth a little.
        const becomes = effects.some((e) => e.type === 'becomes');
        v += damages ? 3 * n : locks ? urgency * n : strengthens ? 2 * n : gains('block') ? blockValue(gained('block')) : gains('critical') ? 4 : becomes || clears ? n : 0;
        v += 2.5 * gained('moves'); // a free swap: about one more set
      } else if (set.key === 'junk:time') v += 2;
      else v += 0.2;
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
