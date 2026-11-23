// Statuses (docs/tools.md §6). Behaviour lives in engine/combat.ts.

import type { StatusDef } from '../engine/types';

export const statuses: Record<string, StatusDef> = {
  critical: { id: 'critical', name: 'Critical', description: 'Your next tool set is doubled. Each set uses 1.', icon: 'status/critical.png' },
  block: { id: 'block', name: 'Block', description: 'On the enemy turn, Block first absorbs hits from the bottom row, then each point left stops one enemy step (lowest first). Clears at the start of your turn.', icon: 'status/block.png' },
  foresight: { id: 'foresight', name: 'Foresight', description: 'Every 3 Foresight gives Truth tools (the Word, Prophecy) +1 damage per hit.', icon: 'status/charge-lightning.png' },
};
