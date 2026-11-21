import { content } from '../../src/content';
import { createBattle } from '../../src/engine/battle';
import { createPlayer } from '../../src/engine/run';
import { playBattle, stats } from './bot';

const SEEDS = Number(process.env.SIM_SEEDS ?? 30);

describe('combat sim (balance baseline)', () => {
  for (const enc of Object.values(content.encounters)) {
    it(`plays ${enc.id} to completion over ${SEEDS} seeds`, () => {
      let wins = 0, rounds = 0, hpLost = 0;
      stats.moves = 0; stats.starvedMoves = 0;
      for (let seed = 1; seed <= SEEDS; seed++) {
        const player = createPlayer(content);
        const slots = content.config.loadoutSlots[enc.tier];
        const loadout = player.spells.slice(0, slots).map((s) => s.uid);
        const { state } = createBattle({ player, encounter: enc, loadout, junk: ['orb', 'slime'], seed }, content);
        const out = playBattle(state);
        if (out.state.outcome === 'victory') wins++;
        rounds += out.rounds;
        hpLost += player.hp - out.state.player.hp;
        expect(out.state.outcome === null ? out.rounds > 60 : true).toBe(true);
      }
      console.log(`${enc.id.padEnd(14)} win ${(100 * wins / SEEDS).toFixed(0).padStart(3)}%  avg rounds ${(rounds / SEEDS).toFixed(1)}  avg HP lost ${(hpLost / SEEDS).toFixed(1)}  no-match moves ${(100 * stats.starvedMoves / Math.max(1, stats.moves)).toFixed(0)}%`);
    }, 120_000);
  }
});
