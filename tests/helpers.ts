// Test helpers: battles on hand-drawn boards so outcomes are exact.

import { content, type Content } from '../src/content';
import { createBattle } from '../src/engine/combat';
import { createPlayer } from '../src/engine/run';
import type { BattleState, Player, Tile } from '../src/engine/types';

/**
 * Test content: an inert junk tile ('mud') so refills never trigger effects.
 * Refills draw only Mud and Space, and the filler rows alternate them, so new tiles can only match each other
 * (harmlessly, near the top).
 */
export const tc: Content = {
  ...content,
  junk: { ...content.junk, mud: { id: 'mud', name: 'Mud', description: 'test filler', icon: '', color: '#555', hits: 0 } },
};

/**
 * Board letters. Tools use createPlayer()'s uids in starting order:
 *   F Fasting (t1)  P Prayer (t2)  T Thanksgiving (t3)  W The Word (t4)  R Prophecy (t5)
 *   i Time  s Space  m Mud  O Stone  X Worry  G Greed (3 HP)
 */
const LETTER: Record<string, { kind: Tile['kind']; id: string; hp?: number }> = {
  F: { kind: 'tool', id: 't1' }, P: { kind: 'tool', id: 't2' }, T: { kind: 'tool', id: 't3' }, W: { kind: 'tool', id: 't4' }, R: { kind: 'tool', id: 't5' },
  i: { kind: 'junk', id: 'time' }, s: { kind: 'junk', id: 'space' }, m: { kind: 'junk', id: 'mud' },
  O: { kind: 'stone', id: 'stone', hp: 2 }, X: { kind: 'enemy', id: 'worry' }, G: { kind: 'enemy', id: 'greed', hp: 3 },
};

/** Neutral filler rows: no two equal neighbours, so nothing ever lines up with them. */
export const F1 = 'msmsmsms';
export const F2 = 'smsmsmsm';

export interface MakeBattle {
  rows: string[]; // 8 rows of 8, top first
  player?: (p: Player) => void;
  state?: (s: BattleState) => void;
}

export function makeBattle({ rows, player, state }: MakeBattle): BattleState {
  const p = createPlayer(tc);
  player?.(p);
  const { state: s } = createBattle({ player: p, enemyId: 'hard_choices', loadout: p.tools.map((t) => t.uid), seed: 1 }, tc);
  s.pool = [{ kind: 'junk', id: 'mud', weight: 1 }, { kind: 'junk', id: 'space', weight: 1 }];
  s.genPos = s.genPos.map(() => 999); // generator exhausted: refills are normal
  let uid = 1000;
  s.board.cells = rows.flatMap((row) => [...row].map((ch) => {
    const l = LETTER[ch];
    if (!l) throw new Error(`Unknown board letter ${ch}`);
    const hp = l.hp ?? (l.kind === 'tool' ? 1 + s.tools[l.id].fruit.gentleness : 1);
    return { uid: uid++, kind: l.kind, id: l.id, hp, maxHp: hp };
  }));
  s.nextUid = 5000;
  state?.(s);
  return s;
}

/** Board as letters (top first), for assertions. */
export function ascii(s: BattleState): string[] {
  const rev: Record<string, string> = {};
  for (const [k, v] of Object.entries(LETTER)) rev[`${v.kind}:${v.id}`] = k;
  const rows: string[] = [];
  for (let y = 0; y < s.board.height; y++) {
    let r = '';
    for (let x = 0; x < s.board.width; x++) {
      const t = s.board.cells[y * s.board.width + x];
      r += t ? rev[`${t.kind}:${t.id}`] ?? '?' : '.';
    }
    rows.push(r);
  }
  return rows;
}

export const at = (b: BattleState, x: number, y: number) => b.board.cells[y * b.board.width + x];
