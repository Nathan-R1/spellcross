// Greedy sim bot (doc 02 "Combat sim"): each move, try every matching swap and keep the one that deals the
// most damage (ties: most healing); otherwise make any legal swap.
import { content } from '../../src/content';
import { endTurn, playerMove } from '../../src/engine/battle';
import { matchingMoves, validMoves } from '../../src/engine/board';
import type { BattleState } from '../../src/engine/types';

export const stats = { turnsChecked: 0, starvedMoves: 0, moves: 0 };

function score(before: BattleState, after: BattleState): number {
  const dmg = before.enemies.reduce((a, e) => a + e.hp, 0) - after.enemies.reduce((a, e) => a + e.hp, 0);
  const heal = after.player.hp - before.player.hp;
  return dmg * 10 + heal + (after.outcome === 'victory' ? 10000 : 0);
}

export function botTurn(state: BattleState): BattleState {
  let s = state;
  let guard = 0;
  while (s.phase === 'player' && guard++ < 10) {
    const lookup = (r: string) => s.spells[r];
    const moves = matchingMoves(s.board, lookup);
    stats.moves++;
    if (moves.length === 0) {
      stats.starvedMoves++;
      const any = validMoves(s.board);
      if (any.length === 0) return endTurn(s, content).state;
      // Setup swap: the legal swap that leaves the most matching moves for next time.
      let best = any[0];
      let bestCount = -1;
      for (const [a, b] of any) {
        const next = playerMove(s, a, b, content).state;
        if (next.phase !== 'player') continue;
        const n = matchingMoves(next.board, (r: string) => next.spells[r]).length;
        if (n > bestCount) { bestCount = n; best = [a, b]; }
      }
      s = playerMove(s, best[0], best[1], content).state;
      continue;
    }
    let best = moves[0];
    let bestScore = -Infinity;
    for (const [a, b] of moves.slice(0, 40)) {
      const sc = score(s, playerMove(s, a, b, content).state);
      if (sc > bestScore) { bestScore = sc; best = [a, b]; }
    }
    s = playerMove(s, best[0], best[1], content).state;
  }
  return s;
}

export function playBattle(state: BattleState, maxRounds = 60): { state: BattleState; rounds: number } {
  let s = state;
  while (!s.outcome && s.round <= maxRounds) s = botTurn(s);
  return { state: s, rounds: s.round };
}
