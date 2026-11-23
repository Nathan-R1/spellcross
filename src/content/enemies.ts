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
  depression: {
    id: 'depression', name: 'Depression', icon: 'spells/dud/slime.png', color: '#3b4a5c', hp: 3, speed: 0, damage: 1, onEnemyTurnEnd: 'spreadToAdjacent',
    description: "3 HP. It doesn't move. From the bottom row it hits you for 1. At the end of the enemy turn, every tool or junk tile next to it turns into Depression.",
  },
};

const W = (tile: string): GeneratedRow => ({ tile });
const N: GeneratedRow = 'normal';
/** A row with Worry in the two edge columns, and `middle` (or normal) in the middle four. */
const edges = (middle: string | null = null): GeneratedRow => ({ cells: ['worry', null, middle, middle, middle, middle, null, 'worry'] });

/** A Depression row: column `x` and its mirror, plus (optionally) Worry in the middle two columns. */
function zig(x: number, worry = false): GeneratedRow {
  const cells: (string | null)[] = Array(8).fill(null);
  cells[x] = cells[7 - x] = 'depression';
  if (worry) cells[3] = cells[4] = 'worry';
  return { cells };
}
const midWorry: GeneratedRow = { cells: [null, null, null, 'worry', 'worry', null, null, null] };

export const enemies: Record<string, EnemyDef> = {
  hard_choices: {
    id: 'hard_choices', name: 'Hard Choices', tier: 'normal', portrait: 'portraits/hard_choices.svg', talents: [20, 30],
    description: 'Three Worry rows across the middle of the board (rows 4, 5 and 6 from the bottom): 24 Worries in all, all on the board from the start. Nothing more comes. Worries here take 2 steps per enemy turn.',
    // Row 1 is the bottom of the board.
    generator: [N, N, N, W('worry'), W('worry'), W('worry')],
    tileSpeed: { worry: 2 },
  },
  financial_stress: {
    id: 'financial_stress', name: 'Financial Stress', tier: 'normal', portrait: 'portraits/financial_stress.svg', talents: [25, 40],
    description: 'Worry down both edge columns from row 7 to row 16 (20 Worries; 4 start on the board) and 12 Greed in a 4×3 block on rows 8 to 10 (4 start on the top row of the board): 32 enemy tiles in all.',
    // Rows 1–6 normal; rows 7–16 Worry in the edge columns; rows 8–10 Greed in the middle four (4×3).
    generator: [N, N, N, N, N, N, edges(), edges('greed'), edges('greed'), edges('greed'), edges(), edges(), edges(), edges(), edges(), edges()],
  },
  all_quiet: {
    id: 'all_quiet', name: 'All Quiet', tier: 'elite', portrait: 'portraits/all_quiet.svg', talents: [40, 60],
    description: 'A stream of Worry down the middle two columns: 16 Worries, one at the top of each column to start, the rest following. '
      + 'Depression zigzags down both edge pairs of columns over the top 4 rows of the board: 8 Depressions, all on the board. '
      + '24 enemy tiles in all, but Depression spreads to the tiles next to it every enemy turn.',
    // Rows 1–4 normal. Rows 5–8: the Depression zigzag (mirrored: outer column on rows 6 and 8, inner on 5 and 7).
    // Rows 8–15: Worry in columns 4 and 5 (8 each).
    generator: [N, N, N, N, zig(1), zig(0), zig(1), zig(0, true), ...Array.from({ length: 7 }, () => midWorry)],
  },
};

/** Total enemy tiles a generator will ever produce (for the setup description check). */
export const generatorEnemyTiles = (e: EnemyDef, width = 8) =>
  e.generator.reduce((n, r) => n + Array.from({ length: width }, (_, x) => genCell(r, x)).filter(Boolean).length, 0);
