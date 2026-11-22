// Tunable numbers (spec.md; values marked "tune" there). Spellford Constants.kt equivalents.

export const config = {
  player: { hp: 100, movesPerTurn: 3, maxAbilities: 5, startingGold: 0 },
  board: { width: 8, visibleRows: 6, bufferRows: 6 },
  /** Tile pool shares (combat §2.4). */
  pool: { loadout: 0.6, duds: 0.25, novas: 0.15, weightPerGem: 0.2 },
  junkSlots: 2,
  loadoutSlots: { normal: 3, elite: 4, boss: 4 },
  maxSpellLevel: 5,
  roadBattleAt: [0.3, 0.7] as [number, number],
  gemDrop: { normal: 0.25, elite: 1, boss: 0 },
  prices: { gem: 100, spellUpgrade: 100, ability: 200, unsocket: 50, salesmanAbility: 100, salesmanHeal: 50, alchemistFire: 100 },
  healPct: 0.5,
  /** Relative chance of rolling an ability of each rarity. */
  abilityRarityWeight: { common: 3, uncommon: 1, rare: 0.5, legendary: 0.2 },
  shopGemChoices: 3,
  travellerChoices: 3,
  worldHeight: 1080,
} as const;
