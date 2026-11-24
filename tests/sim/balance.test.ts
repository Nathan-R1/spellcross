// Balance sim: a human-like bot plays every 3-tool loadout against each enemy and reports win rate, damage taken
// and turns. Not part of `pnpm test`. Run it with `pnpm sim` (options: SEEDS=20, ENEMY=financial_stress).
//
// The bot starts fresh (20 Courage, no fruit or abilities). It picks swaps by the sets they make right away (it
// can't see random refills), aims damage at the lowest enemy tiles, and doesn't plan ahead.
import { content as c } from '../../src/content';
import { createBattle } from '../../src/engine/combat';
import { botMove, resolvePlacements } from './bot';
import { createPlayer } from '../../src/engine/run';

const SEEDS = Number(process.env.SEEDS ?? 12);

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
  // Every 3 of the starting tools (createPlayer gives them uids t1, t2, … in order).
  const names: Record<string, string> = Object.fromEntries(c.config.startingTools.map((id, i) => [`t${i + 1}`, c.tools[id].name.replace(/^The /, '')]));
  const uids = Object.keys(names);
  const n = uids.length;
  const combos: string[][] = [];
  for (let a = 0; a < n; a++) for (let b = a + 1; b < n; b++) for (let d = b + 1; d < n; d++) combos.push([uids[a], uids[b], uids[d]]);
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
