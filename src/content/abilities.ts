// Abilities (spec §8). Spellford AbilitiesLibrary with D4/D12 applied.

import type { AbilityDef } from '../engine/types';

export const abilities: Record<string, AbilityDef> = {
  low_blow: { id: 'low_blow', name: 'Abstain', description: 'Make the target wither', rarity: 'common', icon: 'abilities/low-blow.png', maxUses: 3, statuses: [{ status: 'poisoned', value: 6, self: false }], effects: [] },
  crane_stance: { id: 'crane_stance', name: 'Stand Firm', description: 'Stand firm against attack', rarity: 'common', icon: 'abilities/crane-stance.png', maxUses: 3, statuses: [{ status: 'block', value: 20, self: true }], effects: [] },
  finisher: { id: 'finisher', name: 'Amen', description: 'A final word of Faith', rarity: 'common', icon: 'abilities/finisher-fire.png', maxUses: 3, damage: 15, damageElement: 'fire', statuses: [], effects: [] },
  fuel_of_fire: { id: 'fuel_of_fire', name: 'Kindle Faith', description: 'Kindle your Faith', rarity: 'common', icon: 'abilities/fuel-of-fire.png', maxUses: 3, statuses: [{ status: 'charge_fire', value: 2, self: true }], effects: [] },
  fuel_of_lightning: { id: 'fuel_of_lightning', name: 'Kindle Truth', description: 'Kindle your Truth', rarity: 'common', icon: 'abilities/fuel-of-lightning.png', maxUses: 3, statuses: [{ status: 'charge_lightning', value: 2, self: true }], effects: [] },
  fuel_of_stone: { id: 'fuel_of_stone', name: 'Kindle Unity', description: 'Kindle your Unity', rarity: 'common', icon: 'abilities/fuel-of-stone.png', maxUses: 3, statuses: [{ status: 'charge_earth', value: 2, self: true }], effects: [] },
  sicken: { id: 'sicken', name: 'Extended Fast', description: "Triple the target's Withering", rarity: 'uncommon', icon: 'abilities/sicken.png', maxUses: 3, statuses: [], effects: [{ type: 'triplePoison' }] },
  bulwark_of_ice: { id: 'bulwark_of_ice', name: 'Rooted in Love', description: 'Stand steadfast in Love', rarity: 'uncommon', icon: 'abilities/bulwark-of-ice.png', maxUses: 3, statuses: [{ status: 'fortify_water', value: 1, self: true }], effects: [] },
  bulwark_of_stone: { id: 'bulwark_of_stone', name: 'Rooted in Unity', description: 'Stand steadfast in Unity', rarity: 'uncommon', icon: 'abilities/bulwark-of-stone.png', maxUses: 3, statuses: [{ status: 'fortify_earth', value: 1, self: true }], effects: [] },
  bulwark_of_air: { id: 'bulwark_of_air', name: 'Rooted in Spirit', description: 'Stand steadfast in the Spirit', rarity: 'uncommon', icon: 'abilities/bulwark-of-air.png', maxUses: 3, statuses: [{ status: 'fortify_air', value: 1, self: true }], effects: [] },
};
