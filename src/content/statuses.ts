// Statuses (docs/tools.md §6). Behaviour lives in engine/combat.ts.

import type { StatusDef } from '../engine/types';

export const statuses: Record<string, StatusDef> = {
  critical: { id: 'critical', name: 'Critical', description: 'Your next tool set is doubled. Each set uses 1.', icon: 'status/critical.png' },
  block: { id: 'block', name: 'Block', description: 'Each point absorbs 1 damage to you. Clears at the start of your turn.', icon: 'status/block.png' },
  strengthen: { id: 'strengthen', name: 'Strengthen', description: 'On a tile, stacking: when it clears in a set, the set counts 1 tile bigger per point (a placed shape grows by 1 cell).', icon: 'status/strength.png' },
  locked: { id: 'locked', name: 'Locked', description: "On a tile: it doesn't move, activate or deal damage through the next enemy turn.", icon: 'tools/lockTile.png' },
  foresight: { id: 'foresight', name: 'Foresight', description: 'Every 3 Foresight gives Truth tools (the Word, Prophecy) +1 damage per hit.', icon: 'status/charge-lightning.png' },
};
