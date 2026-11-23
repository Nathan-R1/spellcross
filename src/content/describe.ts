// Player-facing descriptions generated from the data, so the text always matches what things do.

import type { AbilityDef } from '../engine/types';
import { abilities } from './abilities';

export interface AbilityDescription {
  /** One short line for offers and buttons. */
  summary: string;
  /** Full sentences for the hold popup. */
  lines: string[];
}

export function describeAbility(def: AbilityDef): AbilityDescription {
  const e = def.effect;
  const lines: string[] = [];
  let summary = '';
  switch (e.type) {
    case 'hit':
      summary = `${e.damage} damage to 1 tile`;
      lines.push(`Deal ${e.damage} damage to any 1 tile on the board. A tile is deleted when damage reaches its HP.`);
      break;
    case 'block':
      summary = `+${e.amount} Block`;
      lines.push(`Gain ${e.amount} Block: it absorbs the next ${e.amount} damage you take, until the start of your next turn.`);
      break;
    case 'line':
      summary = `${e.damage} damage to ${e.length} in a line`;
      lines.push(`Deal ${e.damage} damage to ${e.length} tiles in a straight line. Choose horizontal or vertical, then place it.`);
      break;
    case 'moves':
      summary = `+${e.amount} moves`;
      lines.push(`Gain ${e.amount} extra moves this turn.`);
      break;
  }
  lines.push(`Uses: ${def.maxUses} per run, refilled by Resting at a stop or praying at the Fallen Shrine. Using it costs no move.`);
  return { summary, lines };
}

export const abilitySummary = (id: string) => describeAbility(abilities[id]).summary;
