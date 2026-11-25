// Statuses (docs/tools.md §6). Behaviour lives in engine/combat.ts.

import type { StatusDef } from '../engine/types';

export const statuses: Record<string, StatusDef> = {
  critical: { id: 'critical', name: 'Critical', description: 'Your next tool set is doubled. Each set uses 1.', icon: 'status/critical.png' },
  block: { id: 'block', name: 'Block', description: 'Each point absorbs 1 damage to you. At the start of your turn, what is left becomes Momentum.', icon: 'status/block.png' },
  momentum: { id: 'momentum', name: 'Momentum', description: 'From unspent Block. Every 3 Momentum gives your next damage set (a set whose Attack has Dmg above 0) +1 Dmg on every hit. That set spends all your Momentum. Sets that deal no damage leave it alone.', icon: 'status/charge-fire.png' },
  strengthen: { id: 'strengthen', name: 'Strengthen', description: 'On a tile, stacking: when it clears in a set, the set counts 1 tile bigger per point (a placed shape grows by 1 cell).', icon: 'status/strength.png' },
  locked: { id: 'locked', name: 'Locked', description: "On a tile: it doesn't move, activate or deal damage through the next enemy turn.", icon: 'tools/lockTile.png' },
  foresight: { id: 'foresight', name: 'Foresight', description: 'Every 3 Foresight gives Truth tools (the Word, Prophecy) +1 damage per hit.', icon: 'status/charge-lightning.png' },
};
