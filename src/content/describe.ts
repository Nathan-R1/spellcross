// Player-facing ability descriptions, generated from the ability data so the text always matches what
// the ability does (the D12 lesson: Spellford's flavour text drifted from the code).

import type { AbilityDef, Element } from '../engine/types';
import { abilities } from './abilities';
import { ELEMENT_NAME, statuses } from './statuses';

/** Total damage Poisoned N deals over its life (N, N−1, … 1; D24). */
export const poisonTotal = (n: number) => (n * (n + 1)) / 2;

function statusLine(status: string, value: number, self: boolean): { long: string; short: string } {
  const def = statuses[status];
  const el = def?.element ? ELEMENT_NAME[def.element as Element] : '';
  switch (def?.family) {
    case 'block':
      return { long: `Gain ${value} Block: absorbs the next ${value} damage you take, until the start of your next turn.`, short: `+${value} Block` };
    case 'poisoned':
      return {
        long: `Poison your target for ${value}: it takes ${value} damage at the start of its turn, then 1 less each turn (${poisonTotal(value)} damage in total). Poison ignores Block.`,
        short: `Poison ${value} (${poisonTotal(value)} dmg over time)`,
      };
    case 'charge':
      return el
        ? { long: `Gain Charge ${el} ${value}: your ${el} spells deal +${value} damage per tile matched, for the rest of the battle.`, short: `+${value} dmg/tile on ${el} spells` }
        : { long: `Gain Charge ${value}: your damaging spells deal +${value} damage per tile matched, for the rest of the battle.`, short: `+${value} dmg/tile` };
    case 'fortify':
      return el
        ? { long: `Gain Fortify ${el} ${value}: every time you cast ${/^[AEIOU]/.test(el) ? 'an' : 'a'} ${el} spell, gain ${value} Block per tile matched, for the rest of the battle.`, short: `Block when casting ${el} spells` }
        : { long: `Gain Fortify ${value}: every time you cast a spell, gain ${value} Block per tile matched, for the rest of the battle.`, short: `Block on every cast` };
    default: {
      const name = def?.name ?? status;
      return { long: `${self ? 'Gain' : 'Apply'} ${name} ${value}${self ? '' : ' to your target'}: ${def?.description ?? ''}`, short: `${name} ${value}` };
    }
  }
}

export interface AbilityDescription {
  /** One short line for offers and buttons, e.g. "Poison 6 (21 dmg over time)". */
  summary: string;
  /** Full sentences for the hold popup. */
  lines: string[];
}

export function describeAbility(def: AbilityDef): AbilityDescription {
  const lines: string[] = [];
  const short: string[] = [];
  if (def.damage) {
    const el = def.damageElement ? `${ELEMENT_NAME[def.damageElement]} ` : '';
    lines.push(`Deal ${def.damage} ${el}damage to your target. Its Block absorbs damage first.`);
    short.push(`${def.damage} ${el}dmg`);
  }
  for (const st of def.statuses) {
    const t = statusLine(st.status, st.value, st.self);
    lines.push(t.long);
    short.push(t.short);
  }
  for (const e of def.effects) {
    if (e.type === 'triplePoison') {
      lines.push("Triple your target's Poisoned (for example 6 becomes 18, dealing 171 damage in total). Does nothing if it isn't poisoned.");
      short.push('Triple target\'s Poison');
    }
  }
  lines.push(`Uses: ${def.maxUses} per run, refilled by Resting at a stop or praying at the Shrine. Using it costs no move.`);
  return { summary: short.join(', '), lines };
}

export const abilitySummary = (id: string) => describeAbility(abilities[id]).summary;
