// The balance bot: a human-like player shared by the sims. It picks swaps by the sets they make right away (it
// can't see random refills), aims damage at the lowest enemy tiles, and doesn't plan ahead.
import { content, type Content } from '../../src/content';
import { endTurn, findSets, pendingGroupSize, placeGroup, placementCells, playerMove, tileAt } from '../../src/engine/combat';
import type { BattleState, Pos, TimedEvent } from '../../src/engine/types';

const W = 8, H = 8;

/** Greedy targets for the pending group: lowest enemy tiles first (shapes: best anchor by danger removed). */
export function chooseTargets(s: BattleState): Pos[] {
  const n = pendingGroupSize(s);
  const pl = s.pending[0];
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
    if (pl.type !== 'shape' && pl.type !== 'line') used.add(pick.y * W + pick.x);
    targets.push(pick);
  }
  return targets;
}

export function resolvePlacements(s: BattleState, c: Content = content, events?: TimedEvent[]): BattleState {
  let st = s;
  for (let g = 0; g < 50 && st.phase === 'placing'; g++) {
    const t = chooseTargets(st);
    try { const r = placeGroup(st, t, c); events?.push(...r.events); st = r.state; } catch (e) {
      throw new Error(`${e} pending=${JSON.stringify(st.pending.slice(0, 4))} targets=${JSON.stringify(t)}`, { cause: e });
    }
  }
  return st;
}

/**
 * A human-like move: judge each swap only by the sets it makes right away (no peeking at random refills), then
 * play the best one. Swapping a low enemy tile upward also counts.
 */
export function botMove(s: BattleState, rnd: () => number, c: Content = content, events?: TimedEvent[]): BattleState {
  const lowest = Math.max(-1, ...s.board.cells.map((t, i) => (t?.kind === 'enemy' ? Math.floor(i / W) : -1)));
  const urgency = lowest >= 6 ? 3 : lowest >= 4 ? 1.5 : 0.6; // Block matters more when enemies are near the bottom
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
        const eff = s.tools[set.key.slice(5)].effect;
        v += eff === 'damageShape' || eff === 'stones' || eff === 'prophecy' ? 3 * n : eff === 'block' ? urgency * n : eff === 'critical' ? 4 : 0;
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
