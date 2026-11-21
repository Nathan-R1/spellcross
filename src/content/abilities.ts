// Abilities (spec §8). Spellford AbilitiesLibrary with D4/D12 applied.

import type { AbilityDef } from '../engine/types';

export const abilities: Record<string, AbilityDef> = {
  low_blow: { id: 'low_blow', name: 'Low Blow', description: 'Poison the target', rarity: 'common', icon: 'abilities/low-blow.png', maxUses: 3, statuses: [{ status: 'poisoned', value: 6, self: false }], effects: [] },
  crane_stance: { id: 'crane_stance', name: 'Crane Stance', description: 'Enter a defensive stance', rarity: 'common', icon: 'abilities/crane-stance.png', maxUses: 3, statuses: [{ status: 'block', value: 20, self: true }], effects: [] },
  finisher: { id: 'finisher', name: 'Finisher', description: 'Deliver a finishing fire attack', rarity: 'common', icon: 'abilities/finisher-fire.png', maxUses: 3, damage: 15, damageElement: 'fire', statuses: [], effects: [] },
  fuel_of_fire: { id: 'fuel_of_fire', name: 'Fuel of Fire', description: 'Charge up fire power', rarity: 'common', icon: 'abilities/fuel-of-fire.png', maxUses: 3, statuses: [{ status: 'charge_fire', value: 2, self: true }], effects: [] },
  fuel_of_lightning: { id: 'fuel_of_lightning', name: 'Fuel of Lightning', description: 'Charge up lightning power', rarity: 'common', icon: 'abilities/fuel-of-lightning.png', maxUses: 3, statuses: [{ status: 'charge_lightning', value: 2, self: true }], effects: [] },
  fuel_of_stone: { id: 'fuel_of_stone', name: 'Fuel of Stone', description: 'Charge up stone power', rarity: 'common', icon: 'abilities/fuel-of-stone.png', maxUses: 3, statuses: [{ status: 'charge_earth', value: 2, self: true }], effects: [] },
  sicken: { id: 'sicken', name: 'Sicken', description: "Triple the target's Poisoned", rarity: 'uncommon', icon: 'abilities/sicken.png', maxUses: 3, statuses: [], effects: [{ type: 'triplePoison' }] },
  bulwark_of_ice: { id: 'bulwark_of_ice', name: 'Bulwark of Ice', description: 'Fortify against ice attacks', rarity: 'uncommon', icon: 'abilities/bulwark-of-ice.png', maxUses: 3, statuses: [{ status: 'fortify_water', value: 1, self: true }], effects: [] },
  bulwark_of_stone: { id: 'bulwark_of_stone', name: 'Bulwark of Stone', description: 'Fortify against stone attacks', rarity: 'uncommon', icon: 'abilities/bulwark-of-stone.png', maxUses: 3, statuses: [{ status: 'fortify_earth', value: 1, self: true }], effects: [] },
  bulwark_of_air: { id: 'bulwark_of_air', name: 'Bulwark of Air', description: 'Fortify against air attacks', rarity: 'uncommon', icon: 'abilities/bulwark-of-air.png', maxUses: 3, statuses: [{ status: 'fortify_air', value: 1, self: true }], effects: [] },
};
