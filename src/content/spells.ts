// Spell content (spec §7, features §5.5). Player spells are Spellford 3f7b1a0 values, with D3
// (Restore → Water). Dud and nova tiles keep Spellford's fixed icons.

import type { SpellDef } from '../engine/types';

const player = (d: Omit<SpellDef, 'spellClass' | 'linked' | 'weight' | 'upgradable'>): SpellDef => ({
  ...d,
  spellClass: 'player',
  linked: false,
  weight: 1,
  upgradable: true,
});

const junk = (d: Omit<SpellDef, 'damage' | 'healing' | 'weight' | 'upgradable' | 'target' | 'statuses' | 'element'> & Partial<SpellDef>): SpellDef => ({
  damage: 0,
  healing: 0,
  weight: 1,
  upgradable: false,
  target: 'self',
  statuses: [],
  element: 'earth',
  ...d,
});

export const spells: Record<string, SpellDef> = {
  scorch: player({ id: 'scorch', name: 'Prayer', description: 'Pray against the enemy', element: 'fire', damage: 4, healing: 0, target: 'single', statuses: [], color: '#ffb3b3' }),
  restore: player({ id: 'restore', name: 'Healing', description: 'Restore your health', element: 'water', damage: 0, healing: 2, target: 'self', statuses: [], color: '#b3d9ff' }),
  strike: player({
    id: 'strike', name: 'Bible Reading', description: 'Strike with the Word, growing stronger each time', element: 'lightning', damage: 2, healing: 0, target: 'single',
    statuses: [{ status: 'charge_lightning', value: 1, self: true, perTile: false }], color: '#ffffb3',
  }),
  ice_bolt: player({ id: 'ice_bolt', name: 'Serving', description: 'Deal 3 DMG per tile', element: 'water', damage: 3, healing: 0, target: 'single', statuses: [], color: '#b3d9ff' }),
  venom: player({
    id: 'venom', name: 'Fasting', description: 'Make the enemy wither over time', element: 'acid', damage: 0, healing: 0, target: 'single',
    statuses: [{ status: 'poisoned', value: 1, self: false, perTile: true }], color: '#59ff4d',
  }),
  shield: player({
    id: 'shield', name: 'Fellowship', description: 'Strike the enemy and guard yourself', element: 'earth', damage: 1, healing: 0, target: 'single',
    statuses: [{ status: 'block', value: 2, self: true, perTile: true }], color: '#bfa680',
  }),
  wind_wall: player({
    id: 'wind_wall', name: 'Worship', description: 'Raise a protective barrier of praise', element: 'air', damage: 0, healing: 0, target: 'self',
    statuses: [{ status: 'fortify_air', value: 1, self: true, perTile: false }], color: '#b366b3',
  }),

  // Duds: 3+ of the same type clear as a set with no effect (D22); they block other lines. Ash, Slime and Orb are linked (pulled into adjacent sets and cleared).
  ash: junk({ id: 'ash', name: 'Regret', description: 'A lingering regret', icon: 'spells/dud/ash.png', spellClass: 'dud', linked: true, color: '#8a8580' }),
  rubble: junk({ id: 'rubble', name: 'Clutter', description: 'A pile of clutter', icon: 'spells/dud/rubble.png', spellClass: 'dud', linked: false, color: '#7a6a55' }),
  mist: junk({ id: 'mist', name: 'Doubt', description: 'A fog of doubt', icon: 'spells/dud/mist.png', spellClass: 'dud', linked: false, color: '#9aa3ad' }),
  slime: junk({ id: 'slime', name: 'Gossip', description: 'A bit of gossip', icon: 'spells/dud/slime.png', spellClass: 'dud', linked: true, color: '#7f9f5a' }),
  orb: junk({ id: 'orb', name: 'Idol', description: 'A shiny idol', icon: 'spells/dud/orb.png', spellClass: 'dud', linked: true, color: '#a58fc9' }),

  // Novas: never match. Surge mimics an adjacent spell when pulled in. Critical can match (class 'both').
  surge: junk({ id: 'surge', name: 'Overflow', description: 'My cup overflows. Joins an adjacent set as that tool', icon: 'spells/nova/surge.png', spellClass: 'nova', linked: true, linkBehaviour: 'mimicNeighbour', color: '#808080' }),
  critical: junk({
    id: 'critical', name: 'Breakthrough', description: 'When completed as a set become Anointed', icon: 'spells/nova/critical.png', spellClass: 'both', linked: false,
    statuses: [{ status: 'critical', value: 1, self: true, perTile: false }], color: '#808080',
  }),
  charge: junk({ id: 'charge', name: 'Memorise', description: 'Hide the Word in your heart', icon: 'spells/nova/charge.png', spellClass: 'nova', linked: true, color: '#808080' }),
  wall: junk({ id: 'wall', name: 'Bond', description: 'Bind together in unity', icon: 'spells/nova/wall.png', spellClass: 'nova', linked: true, color: '#808080' }),
  wild: junk({ id: 'wild', name: 'Rushing Wind', description: 'The Spirit moves like the wind', icon: 'spells/nova/wild.png', spellClass: 'nova', linked: false, color: '#808080' }),
};

export const STARTING_SPELLS = ['scorch', 'strike', 'ice_bolt', 'venom', 'shield'] as const;
export const BASE_DUDS = ['ash', 'rubble', 'mist'] as const;
export const BASE_NOVAS = ['surge', 'critical'] as const;
export const STARTING_JUNK = ['orb', 'slime'] as const;
