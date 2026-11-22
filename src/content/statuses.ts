// Status content (spec §6.6). Behaviour lives in engine/status.ts, keyed by family.

import { ELEMENTS, type Element, type StatusDef } from '../engine/types';

const ELEMENT_NAME: Record<Element, string> = { fire: 'Faith', lightning: 'Truth', water: 'Love', earth: 'Unity', air: 'Spirit', acid: 'Discipline' };

// Spellford's icons; element variants without art fall back to the generic charge/fortify icon.
const CHARGE_ICON: Partial<Record<Element, string>> = {
  fire: 'status/charge-fire.png', lightning: 'status/charge-lightning.png', earth: 'status/charge-stone.png',
  air: 'status/charge-air.png', water: 'status/charge-ice.png',
};
const FORTIFY_ICON: Partial<Record<Element, string>> = {
  water: 'status/fortify-ice.png', earth: 'status/fortify-stone.png', fire: 'status/fortify-fire.png',
};

const base: StatusDef[] = [
  { id: 'critical', name: 'Anointed', description: 'The next tool you use gets a 1.5x multiplier', icon: 'status/critical.png', family: 'critical' },
  { id: 'strength', name: 'Zeal', description: 'Increases damage dealt (per tile for tools, per hit for attacks)', icon: 'status/strength.png', family: 'strength' },
  { id: 'weakness', name: 'Discouraged', description: 'Deal 25% less damage. Lasts one turn per point', icon: 'status/weakness.png', family: 'weak' },
  { id: 'charge', name: 'Kindled', description: 'Building up power: +damage per tile on damaging tools', icon: 'status/charge.png', family: 'charge' },
  { id: 'fortify', name: 'Steadfast', description: 'Gain Shield of Faith per tile whenever you use a tool', icon: 'status/fortify.png', family: 'fortify' },
  { id: 'block', name: 'Shield of Faith', description: 'Temporary damage reduction. Clears at the start of your turn', icon: 'status/block.png', family: 'block' },
  { id: 'perma_block', name: 'Armour of God', description: 'Permanent damage reduction per hit', icon: 'status/perma-block.png', family: 'permaBlock' },
  { id: 'poisoned', name: 'Withering', description: 'Takes damage at the start of each turn, then goes down by 1', icon: 'status/poisoned.png', family: 'poisoned' },
];

const elemental: StatusDef[] = ELEMENTS.flatMap((e) => [
  {
    id: `charge_${e}`, name: `Kindled ${ELEMENT_NAME[e]}`, description: `+damage per tile on ${ELEMENT_NAME[e]} tools`,
    icon: CHARGE_ICON[e] ?? 'status/charge.png', family: 'charge' as const, element: e,
  },
  {
    id: `fortify_${e}`, name: `Steadfast in ${ELEMENT_NAME[e]}`, description: `Gain Shield of Faith per tile when you use ${ELEMENT_NAME[e]} tools`,
    icon: FORTIFY_ICON[e] ?? 'status/fortify.png', family: 'fortify' as const, element: e,
  },
]);

export const statuses: Record<string, StatusDef> = Object.fromEntries([...base, ...elemental].map((s) => [s.id, s]));
export { ELEMENT_NAME };
