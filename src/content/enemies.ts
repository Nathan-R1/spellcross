// Enemies and enemy tiles (docs/enemies.md). An enemy is its generator: rows the board is built and refilled from.

import type { EnemyDef, EnemyTileDef, GeneratedRow } from '../engine/types';

/** The enemy tile id generated row `row` puts in column `x`, or null for a normal cell. */
export function genCell(row: GeneratedRow | undefined, x: number): string | null {
  if (!row || row === 'normal') return null;
  return 'tile' in row ? row.tile : row.cells[x] ?? null;
}

export const enemyTiles: Record<string, EnemyTileDef> = {
  worry: {
    id: 'worry', name: 'Worry', icon: 'spells/dud/ash.png', color: '#4a4458', hp: 1, speed: 1, damage: 1,
    description: 'Each enemy turn it deals 1 damage to the tile below and moves in if it breaks. From the bottom row it hits you for 1.',
  },
  greed: {
    id: 'greed', name: 'Greed', icon: 'icons/gold.png', color: '#b8891c', hp: 3, speed: 2, damage: 1, onEnemyTurnEnd: 'junkAdjacentTools',
    description: '3 HP. Each enemy turn it takes 2 steps down (1 damage to the tile below each step). At the end of the enemy turn, every tool tile next to it turns into random junk. From the bottom row it hits you for 1.',
  },
};

const W = (tile: string): GeneratedRow => ({ tile });
const N: GeneratedRow = 'normal';
/** A row with Worry in the two edge columns, and `middle` (or normal) in the middle four. */
const edges = (middle: string | null = null): GeneratedRow => ({ cells: ['worry', null, middle, middle, middle, middle, null, 'worry'] });

export const enemies: Record<string, EnemyDef> = {
  hard_choices: {
    id: 'hard_choices', name: 'Hard Choices', tier: 'normal', portrait: 'portraits/hard_choices.svg', talents: [20, 30],
    description: 'A row of Worry every 4th row (rows 4, 8, 12 and 16 from the bottom): 4 Worry rows, 32 Worries in all. Rows 4 and 8 start on the board.',
    // Row 1 is the bottom of the board.
    generator: [N, N, N, W('worry'), N, N, N, W('worry'), N, N, N, W('worry'), N, N, N, W('worry')],
  },
  financial_stress: {
    id: 'financial_stress', name: 'Financial Stress', tier: 'normal', portrait: 'portraits/financial_stress.svg', talents: [25, 40],
    description: 'Worry down both edge columns from row 7 to row 16 (20 Worries; 4 start on the board) and 12 Greed in a 4×3 block just above the board (rows 9 to 11): 32 enemy tiles in all.',
    // Rows 1–6 normal; rows 7–16 Worry in the edge columns; rows 9–11 Greed in the middle four (4×3).
    generator: [N, N, N, N, N, N, edges(), edges(), edges('greed'), edges('greed'), edges('greed'), edges(), edges(), edges(), edges(), edges()],
  },
};

/** Total enemy tiles a generator will ever produce (for the setup description check). */
export const generatorEnemyTiles = (e: EnemyDef, width = 8) =>
  e.generator.reduce((n, r) => n + Array.from({ length: width }, (_, x) => genCell(r, x)).filter(Boolean).length, 0);
