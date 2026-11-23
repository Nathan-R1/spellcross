// Abilities (docs/tools.md §5): 3 uses each, cost no move.

import type { AbilityDef } from '../engine/types';

export const abilities: Record<string, AbilityDef> = {
  abstain: { id: 'abstain', name: 'Abstain', description: 'Deal 10 damage to 1 tile anywhere.', rarity: 'uncommon', icon: 'abilities/low-blow.png', maxUses: 3, effect: { type: 'hit', damage: 10 } },
  stand_firm: { id: 'stand_firm', name: 'Stand Firm', description: 'Gain 5 Block.', rarity: 'common', icon: 'abilities/crane-stance.png', maxUses: 3, effect: { type: 'block', amount: 5 } },
  many_fish: { id: 'many_fish', name: 'Many Fish', description: 'Deal 1 damage to 3 tiles in a line (horizontal or vertical).', rarity: 'common', icon: 'abilities/fuel-of-ice.png', maxUses: 3, effect: { type: 'line', length: 3, damage: 1 } },
  revival: { id: 'revival', name: 'Revival', description: '+3 moves this turn.', rarity: 'rare', icon: 'abilities/fuel-of-fire.png', maxUses: 3, effect: { type: 'moves', amount: 3 } },
};
