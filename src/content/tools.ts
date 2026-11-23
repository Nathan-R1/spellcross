// Tools and junk tiles (docs/tools.md §1, §4). Art is reused from the old spell icons until drawn.

import type { JunkDef, Pillar, ToolDef } from '../engine/types';

export const tools: Record<string, ToolDef> = {
  fasting: { id: 'fasting', name: 'Fasting', pillar: 'discipline', effect: 'critical', description: 'Gain Critical: your next tool set is doubled.', icon: 'spells/acid/poison-1.png', color: '#59ff4d' },
  prayer: { id: 'prayer', name: 'Prayer', pillar: 'faith', effect: 'damageShape', description: 'Place a damage shape the same shape as the set: 1 damage to every tile in it.', icon: 'spells/fire/dmg-2.png', color: '#ffb3b3' },
  thanksgiving: { id: 'thanksgiving', name: 'Thanksgiving', pillar: 'spirit', effect: 'block', description: 'Gain 1 Block per tile.', icon: 'spells/water/block-1.png', color: '#b366b3' },
  word: { id: 'word', name: 'The Word', pillar: 'truth', effect: 'stones', description: 'Place 1 Stone per tile: each is a 1-damage hit, and a tile it deletes becomes a Stone.', icon: 'spells/lightning/dmg-1.png', color: '#ffffb3' },
  prophecy: { id: 'prophecy', name: 'Prophecy', pillar: 'truth', effect: 'prophecy', description: 'Deal 1 damage to any tile per tile matched, then gain Foresight 1.', icon: 'spells/lightning/default.png', color: '#e6d27a' },
  // Parked (tools.md §1.2): no effect until redesigned.
  healing: { id: 'healing', name: 'Healing', pillar: 'love', effect: 'none', parked: true, description: 'Parked.', icon: 'spells/water/healing-1.png', color: '#b3d9ff' },
  serving: { id: 'serving', name: 'Serving', pillar: 'love', effect: 'none', parked: true, description: 'Parked.', icon: 'spells/water/dmg-1.png', color: '#b3d9ff' },
  fellowship: { id: 'fellowship', name: 'Fellowship', pillar: 'unity', effect: 'none', parked: true, description: 'Parked.', icon: 'spells/earth/dmg-block-1.png', color: '#bfa680' },
  worship: { id: 'worship', name: 'Worship', pillar: 'spirit', effect: 'none', parked: true, description: 'Parked.', icon: 'spells/earth/default.png', color: '#b366b3' },
};

export const junk: Record<string, JunkDef> = {
  time: { id: 'time', name: 'Time', description: '3+ Time: deal 1 damage to 1 tile anywhere.', icon: 'spells/dud/orb.png', color: '#a58fc9', hits: 1 },
  space: { id: 'space', name: 'Space', description: '3+ Space: nothing. They just clear.', icon: 'spells/dud/mist.png', color: '#9aa3ad', hits: 0 },
};

export const STONE = { id: 'stone', name: 'Stone', description: 'Blocks Worries. 2 HP: a Worry step cracks it, the next deletes it. 3+ Stones clear with no effect.', icon: 'spells/dud/rubble.png', color: '#7a6a55' };

export const PILLAR_NAME: Record<Pillar, string> = { faith: 'Faith', truth: 'Truth', love: 'Love', unity: 'Unity', spirit: 'Spirit', discipline: 'Discipline' };
