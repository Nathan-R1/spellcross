// Gems (spec §9.3, spells-and-gems §3.2). Values are indexed by the level of the spell (1–5).

import type { GemDef, GemId } from '../engine/types';

export const gems: Record<GemId, GemDef> = {
  strikecut: { id: 'strikecut', name: 'Strikecut', tier: 1, description: '+Damage per tile', values: [2, 2, 3, 4, 5], color: '#e0503c' },
  lifelink: { id: 'lifelink', name: 'Lifelink', tier: 1, description: '+Healing per tile', values: [1, 1, 2, 3, 4], color: '#58c46a' },
  walled: { id: 'walled', name: 'Walled', tier: 1, description: '+Block per tile', values: [2, 2, 3, 3, 4], color: '#8a9bb0' },
  toxicut: { id: 'toxicut', name: 'Toxicut', tier: 1, description: '+Poisoned per tile', values: [1, 1, 1, 2, 3], color: '#8fd13f' },
  cracked: { id: 'cracked', name: 'Cracked', tier: 1, description: '+Chaos per tile: each cast becomes damage, Block or healing', values: [2, 2, 2, 4, 4], color: '#c86ee0' },
  weight: { id: 'weight', name: 'Weight', tier: 1, description: '+20% chance for this spell to appear', color: '#c9a24a' },
  chargestone: { id: 'chargestone', name: 'Chargestone', tier: 2, description: "Each cast: Charge of the spell's element", values: [1, 1, 1, 2, 3], color: '#f2d64b' },
  stormstone: { id: 'stormstone', name: 'Stormstone', tier: 2, description: "Each cast: Fortify of the spell's element", values: [1, 1, 1, 2, 3], color: '#5bb7e6' },
  darkstone: { id: 'darkstone', name: 'Darkstone', tier: 3, description: 'Each cast: take self-damage. +1 move (once per turn)', values: [3, 3, 4, 4, 5], color: '#4a3a5c' },
  sunstone: { id: 'sunstone', name: 'Sunstone', tier: 3, description: 'The spell gains a second element', color: '#ffb340' },
};

export const GEM_IDS = Object.keys(gems) as GemId[];
