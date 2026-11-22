// Test helpers: build battles with hand-drawn boards so outcomes are exact.

import { content, type Content } from '../src/content';
import { createBattle } from '../src/engine/battle';
import { boardFromAscii } from '../src/engine/board';
import { createPlayer } from '../src/engine/run';
import { newSpellInstance, resolveJunk } from '../src/engine/spells';
import type { BattleState, Player } from '../src/engine/types';

/**
 * Board letters. Player tools use createPlayer()'s instance uids (s1..s5 in starting order),
 * plus Healing (not a starting tool) added by makeBattle as s6.
 *   S Prayer  R Healing  T Bible Reading  I Serving  V Fasting  H Fellowship
 *   a Ash  r Rubble  m Mist  o Orb  l Slime  u Surge  c Critical
 */
export const REF: Record<string, string> = {
  S: 's1', T: 's2', I: 's3', V: 's4', H: 's5', R: 's6',
  a: 'ash', r: 'rubble', m: 'mist', o: 'orb', l: 'slime', u: 'surge', c: 'critical',
};

/** 6 buffer rows of duds so refills never match. */
export const BUFFER = ['mrmrmrmr', 'rmrmrmrm', 'mrmrmrmr', 'rmrmrmrm', 'mrmrmrmr', 'rmrmrmrm'];

export interface MakeBattle {
  rows: string[]; // 6 visible rows of 8
  encounter?: string;
  player?: (p: Player) => void;
  state?: (s: BattleState) => void;
  c?: Content;
}

export function makeBattle({ rows, encounter = 'wolf', player, state, c = content }: MakeBattle): BattleState {
  const p = createPlayer(c);
  p.spells.push(newSpellInstance(p, c.spells.restore));
  player?.(p);
  const { state: s } = createBattle({ player: p, encounter: c.encounters[encounter], loadout: p.spells.map((x) => x.uid), junk: ['orb', 'slime'], seed: 1 }, c);
  s.board = boardFromAscii([...BUFFER, ...rows], (ch) => {
    const ref = REF[ch];
    if (!ref) throw new Error(`Unknown board letter ${ch}`);
    return ref;
  }, 6);
  // Refills are pure Wild (a nova: never matches, not linked), so tests see exactly the cascades they draw.
  // Duds can match since D22, so a single-dud refill would form sets.
  s.spells.wild = resolveJunk(c.spells.wild);
  s.pool = [{ ref: 'wild', weight: 1 }];
  // Battle tests pin enemy HP so they test rules, not balance numbers.
  for (const e of s.enemies) {
    e.intentCursor = 0;
    e.hp = e.maxHp = TEST_HP[e.defId] ?? e.maxHp;
  }
  state?.(s);
  return s;
}

/** Fixed enemy HP for battle tests (independent of content tuning). */
export const TEST_HP: Record<string, number> = { wolf: 60, bear: 90, spider: 75, harbinger: 180 };

/** Visible-row coordinates: (x, row) where row 0 is the top visible row. */
export const at = (x: number, row: number) => ({ x, y: 6 + row });

/** A neutral filler row with no matches. */
export const FILL = 'mrmrmrmr';
export const FILL2 = 'rmrmrmrm';

/** Cycle position of a named intent, so tests survive cycle reordering. */
export function cursorOf(enemyId: string, intentName: string, c: Content = content): number {
  const i = c.enemyIntents[enemyId].findIndex((x) => x.name === intentName);
  if (i < 0) throw new Error(`${enemyId} has no intent ${intentName}`);
  return i;
}
