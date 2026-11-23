// Enemies and enemy tiles (docs/enemies.md). An enemy is its generator: rows the board is built and refilled from.

import type { EnemyDef, EnemyTileDef, GeneratedRow } from '../engine/types';

export const enemyTiles: Record<string, EnemyTileDef> = {
  worry: {
    id: 'worry', name: 'Worry', icon: 'spells/dud/ash.png', color: '#4a4458', hp: 1, speed: 1, damage: 1,
    description: 'Each enemy turn it deals 1 damage to the tile below and moves in if it breaks. From the bottom row it hits you for 1.',
  },
};

const W = (tile: string): GeneratedRow => ({ tile });
const N: GeneratedRow = 'normal';

export const enemies: Record<string, EnemyDef> = {
  hard_choices: {
    id: 'hard_choices', name: 'Hard Choices', tier: 'normal', portrait: 'portraits/boar.png', talents: [20, 30],
    description: 'Rows of Worry with a normal row between each: 4 Worry rows, 32 Worries in all. The first row starts on the board.',
    generator: [N, N, N, N, N, N, N, W('worry'), N, W('worry'), N, W('worry'), N, W('worry')],
  },
};

/** Total enemy tiles a generator will ever produce (for the setup description check). */
export const generatorEnemyTiles = (e: EnemyDef, width = 8) => e.generator.filter((r) => r !== 'normal').length * width;
