// Balance sim: a human-like bot plays every 3-tool loadout against each enemy and reports win rate, damage taken
// and turns. Not part of `pnpm test`. Run it with `pnpm sim` (options: SEEDS=20, ENEMY=financial_stress).
//
// The bot starts fresh (20 Courage, no fruit or abilities). It picks swaps by the sets they make right away (it
// can't see random refills), aims damage at the lowest enemy tiles, and doesn't plan ahead.
import { content as c } from '../../src/content';
import { createBattle, endTurn, findSets, pendingGroupSize, placeGroup, placementCells, playerMove, tileAt } from '../../src/engine/combat';
import { createPlayer } from '../../src/engine/run';
import type { BattleState, Pos } from '../../src/engine/types';

const SEEDS = Number(process.env.SEEDS ?? 12);
const W = 8, H = 8;


/** Greedy targets for the pending group: lowest enemy tiles first (shapes: best anchor by danger removed). */
function chooseTargets(s: BattleState): Pos[] {
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

function resolvePlacements(s: BattleState): BattleState {
  let st = s;
  for (let g = 0; g < 50 && st.phase === 'placing'; g++) {
    const t = chooseTargets(st);
    try { st = placeGroup(st, t, c).state; } catch (e) {
      throw new Error(`${e} pending=${JSON.stringify(st.pending.slice(0, 4))} targets=${JSON.stringify(t)}`, { cause: e });
    }
  }
  return st;
}

/**
 * A human-like move: judge each swap only by the sets it makes right away (no peeking at random refills), then
 * play the best one. Swapping a low enemy tile upward also counts.
 */
function botMove(s: BattleState, rnd: () => number): BattleState {
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
    return resolvePlacements(playerMove(s, best[0], best[1], c).state);
  } catch {
    return endTurn(s, c).state;
  }
}

export function play(enemyId: string, loadout: string[], seed: number, trace = false) {
  const p = createPlayer(c);
  let s = createBattle({ player: p, enemyId, loadout, seed }, c).state;
  let turns = 0;
  let r = seed;
  const rnd = () => ((r = (r * 1103515245 + 12345) % 2147483648) / 2147483648);
  while (!s.outcome && turns < 40) {
    if (s.phase === 'placing') s = resolvePlacements(s);
    else if (s.phase === 'player') {
      const round = s.round;
      const before = s.board.cells.filter((t) => t?.kind === 'enemy').length;
      s = botMove(s, rnd);
      if (trace) console.log(`round ${round} move: enemies ${before} -> ${s.board.cells.filter((t) => t?.kind === 'enemy').length}, hp ${s.player.hp}, crit ${s.player.critical}, foresight ${s.player.foresight}`);
      if (s.round !== round) turns++;
    }
  }
  return { outcome: s.outcome ?? 'timeout', taken: p.hp - s.player.hp, turns };
}

it.skipIf(!!process.env.TRACE)('balance', () => {
  const names: Record<string, string> = { t1: 'Fasting', t2: 'Prayer', t3: 'Thanksgiving', t4: 'Word', t5: 'Prophecy' };
  const uids = Object.keys(names);
  const combos: string[][] = [];
  for (let a = 0; a < 5; a++) for (let b = a + 1; b < 5; b++) for (let d = b + 1; d < 5; d++) combos.push([uids[a], uids[b], uids[d]]);
  const lines: string[] = [];
  for (const enemyId of Object.keys(c.enemies).filter((e) => !process.env.ENEMY || e === process.env.ENEMY)) {
    lines.push(`\n== ${c.enemies[enemyId].name} (${SEEDS} seeds) ==`);
    lines.push('loadout'.padEnd(36) + 'win%  avgDmg  maxDmg  avgTurns');
    for (const lo of combos) {
      const rs = Array.from({ length: SEEDS }, (_, i) => play(enemyId, lo, 1000 + i * 7919));
      const wins = rs.filter((r) => r.outcome === 'victory').length;
      const dmg = rs.map((r) => r.taken);
      lines.push(lo.map((u) => names[u]).join(' + ').padEnd(36)
        + `${String(Math.round((100 * wins) / SEEDS)).padStart(4)}  ${(dmg.reduce((a, b) => a + b, 0) / SEEDS).toFixed(1).padStart(6)}  ${String(Math.max(...dmg)).padStart(6)}  ${(rs.reduce((a, r) => a + r.turns, 0) / SEEDS).toFixed(1).padStart(8)}`);
    }
  }
  console.log(lines.join('\n'));
}, 3_600_000);

// TRACE=1 pnpm sim: play one Hard Choices fight and log every move.
it.runIf(!!process.env.TRACE)('trace', () => {
  console.log(JSON.stringify(play('hard_choices', ['t2', 't4', 't5'], 1000, true)));
});
