// Tunable numbers (docs/combat.md and docs/spec.md; values marked "tune" there).

export const config = {
  player: { hp: 20, movesPerTurn: 3, maxAbilities: 5, startingGold: 0 },
  board: { width: 8, height: 8 },
  /** Tile pool shares (combat §1): the chosen tools vs the junk tiles. */
  pool: { tools: 0.7, junk: 0.3, weightPerLove: 0.2 },
  /**
   * Chance that a new tile from above the board is redrawn when it would complete a set (combat § 3.4). Cuts luck
   * cascades; sets made only of tiles already on the board always go off. Goals: docs/combat-tuning.md.
   */
  refillNoMatchChance: 1 as number,
  /** Tools taken into each battle (combat §2.1). */
  loadoutSize: 3,
  startingTools: ['anoint', 'prayer', 'thanksgiving', 'word', 'prophecy', 'worship', 'preaching', 'fellowship'],
  junk: ['time', 'space'],
  stoneHp: 2,
  /** Foresight needed per +1 damage (and +1 Stone HP) on Truth tools. */
  foresightPerBonus: 3,
  /** Momentum per +1 Dmg on your next damage set (combat § 4.3). */
  momentumPerBonus: 3,
  maxToolLevel: 5,
  roadBattleAt: [0.3, 0.7] as [number, number],
  fruitDrop: { normal: 0.25, elite: 1, boss: 0 },
  prices: { villageHeal: 50, fruit: 100, upgrade: 100, ability: 200, unsocket: 50, salesmanAbility: 100, salesmanHeal: 50, alchemistFire: 100 },
  healPct: 0.5,
  /** Relative chance of rolling an ability of each rarity. */
  abilityRarityWeight: { common: 3, uncommon: 1, rare: 0.5, legendary: 0.2 },
  shopFruitChoices: 3,
  travellerChoices: 3,
  worldHeight: 1080,
} as const;
