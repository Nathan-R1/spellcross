// Statuses (docs/tools.md §6). Behaviour lives in engine/combat.ts.

import type { StatusDef } from '../engine/types';

export const statuses: Record<string, StatusDef> = {
  critical: { id: 'critical', name: 'Critical', description: 'Your next tool set is doubled. Each set uses 1.', icon: 'status/critical.png' },
  block: { id: 'block', name: 'Block', description: 'Absorbs incoming damage. Clears at the start of your turn.', icon: 'status/block.png' },
  foresight: { id: 'foresight', name: 'Foresight', description: "Truth tools deal +1 damage per hit, and the Word's Stones get +1 HP.", icon: 'status/charge-lightning.png' },
};
