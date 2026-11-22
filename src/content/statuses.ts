// Status content (spec §6.6). Behaviour lives in engine/status.ts, keyed by family.

import { ELEMENTS, type Element, type StatusDef } from '../engine/types';

const ELEMENT_NAME: Record<Element, string> = { fire: 'Fire', lightning: 'Lightning', water: 'Water', earth: 'Earth', air: 'Air', acid: 'Acid' };

// Spellford's icons; element variants without art fall back to the generic charge/fortify icon.
const CHARGE_ICON: Partial<Record<Element, string>> = {
  fire: 'status/charge-fire.png', lightning: 'status/charge-lightning.png', earth: 'status/charge-stone.png',
  air: 'status/charge-air.png', water: 'status/charge-ice.png',
};
const FORTIFY_ICON: Partial<Record<Element, string>> = {
  water: 'status/fortify-ice.png', earth: 'status/fortify-stone.png', fire: 'status/fortify-fire.png',
};

const base: StatusDef[] = [
  { id: 'critical', name: 'Critical', description: 'The next spell you play gets a 1.5x multiplier', icon: 'status/critical.png', family: 'critical' },
  { id: 'strength', name: 'Strength', description: 'Increases damage dealt (per tile for spells, per hit for attacks)', icon: 'status/strength.png', family: 'strength' },
  { id: 'weakness', name: 'Weak', description: 'Deal 25% less damage. Lasts one turn per point', icon: 'status/weakness.png', family: 'weak' },
  { id: 'charge', name: 'Charge', description: 'Building up power: +damage per tile on damaging spells', icon: 'status/charge.png', family: 'charge' },
  { id: 'fortify', name: 'Fortify', description: 'Gain Block per tile whenever you cast', icon: 'status/fortify.png', family: 'fortify' },
  { id: 'block', name: 'Block', description: 'Temporary damage reduction. Clears at the start of your turn', icon: 'status/block.png', family: 'block' },
  { id: 'perma_block', name: 'Perma Block', description: 'Permanent damage reduction per hit', icon: 'status/perma-block.png', family: 'permaBlock' },
  { id: 'poisoned', name: 'Poisoned', description: 'Takes damage at the start of each turn, then goes down by 1', icon: 'status/poisoned.png', family: 'poisoned' },
];

const elemental: StatusDef[] = ELEMENTS.flatMap((e) => [
  {
    id: `charge_${e}`, name: `Charge ${ELEMENT_NAME[e]}`, description: `+damage per tile on ${ELEMENT_NAME[e]} spells`,
    icon: CHARGE_ICON[e] ?? 'status/charge.png', family: 'charge' as const, element: e,
  },
  {
    id: `fortify_${e}`, name: `Fortify ${ELEMENT_NAME[e]}`, description: `Gain Block per tile when you cast ${ELEMENT_NAME[e]} spells`,
    icon: FORTIFY_ICON[e] ?? 'status/fortify.png', family: 'fortify' as const, element: e,
  },
]);

export const statuses: Record<string, StatusDef> = Object.fromEntries([...base, ...elemental].map((s) => [s.id, s]));
export { ELEMENT_NAME };
