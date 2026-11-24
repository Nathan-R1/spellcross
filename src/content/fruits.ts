// The fruit of the Spirit (docs/tools.md §2). Flat bonuses to the tool they're in; copies stack.

import type { FruitDef, FruitId } from '../engine/types';

export const fruits: Record<FruitId, FruitDef> = {
  love: { id: 'love', name: 'Love', keyword: '+20% Appear', description: 'This tool shows up more often (+0.2 tile weight).', icon: 'fruits/love.svg', dropWeight: 4 },
  joy: { id: 'joy', name: 'Joy', keyword: '+1 Shining', description: "End of your turn: each of this tool's tiles deals 1 damage to every enemy tile next to it.", icon: 'fruits/joy.svg', dropWeight: 3 },
  peace: { id: 'peace', name: 'Peace', keyword: '+1 Block', description: '+1 Block per tile when its set clears.', icon: 'fruits/peace.svg', dropWeight: 4 },
  patience: { id: 'patience', name: 'Patience', keyword: '+1 HP', description: 'Tiles this tool creates get +1 HP (the Word’s Stones, Prophecy’s Space).', icon: 'fruits/patience.svg', dropWeight: 3 },
  kindness: { id: 'kindness', name: 'Kindness', keyword: '+1 Supportive', description: "This tool's tiles join adjacent sets of other tools, counting +1 each.", icon: 'fruits/kindness.svg', dropWeight: 3 },
  goodness: { id: 'goodness', name: 'Goodness', keyword: '+1 Restore', description: 'Heal 1 Courage each time its set clears.', icon: 'fruits/goodness.svg', dropWeight: 3 },
  faithfulness: { id: 'faithfulness', name: 'Faithfulness', keyword: '+1 Damage', description: '+1 damage per hit (Prayer, the Word, Prophecy).', icon: 'fruits/faithfulness.svg', dropWeight: 3 },
  gentleness: { id: 'gentleness', name: 'Gentleness', keyword: '+1 Sturdy', description: "This tool's tiles on the board have +1 HP.", icon: 'fruits/gentleness.svg', dropWeight: 3 },
  self_control: { id: 'self_control', name: 'Self-Control', keyword: '+1 Focus', description: 'The first time its set clears each turn, gain 1 move.', icon: 'fruits/self_control.svg', dropWeight: 2 },
};

export const FRUIT_IDS = Object.keys(fruits) as FruitId[];
