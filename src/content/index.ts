// The content registry passed to the engine (doc 04). Named intents are flattened to generic parts here.

import manifest from './assets.manifest.json';
import { abilities } from './abilities';
import { config } from './config';
import { encounters, enemies, intents } from './enemies';
import { gems } from './gems';
import { spells } from './spells';
import { statuses } from './statuses';
import type { EnemyDef, GenericIntent, IntentRef, NamedIntentDef, ResolvedIntent } from '../engine/types';

export function describeGeneric(g: GenericIntent): string {
  switch (g.type) {
    case 'attack': return `Attack ${g.amount}`;
    case 'defend': return `Defend ${g.amount}`;
    case 'defendAllies': return `Defend allies ${g.amount}`;
    case 'heal': return `Heal ${g.amount}`;
    case 'healAlly': return `Heal ally ${g.amount}`;
    case 'healAllies': return `Heal allies ${g.amount}`;
    case 'buff': return `Gain ${g.status} ${g.value}`;
    case 'buffAllies': return `Allies gain ${g.status} ${g.value}`;
    case 'debuff': return `Apply ${g.status} ${g.value}`;
    case 'steal': return `Steal ${g.amount} gold`;
    case 'lock': return `Lock ${g.count} tiles`;
    case 'addTiles': return `Add ${g.count} ${g.spell}`;
  }
}

export function flattenIntent(ref: IntentRef, named: Record<string, NamedIntentDef>, seen: string[] = []): GenericIntent[] {
  if (typeof ref !== 'string') return [ref];
  if (seen.includes(ref)) throw new Error(`Intent cycle: ${[...seen, ref].join(' → ')}`);
  const def = named[ref];
  if (!def) throw new Error(`Unknown intent: ${ref}`);
  return def.do.flatMap((r) => flattenIntent(r, named, [...seen, ref]));
}

export function resolveIntent(ref: IntentRef, named: Record<string, NamedIntentDef>): ResolvedIntent {
  if (typeof ref === 'string') {
    const def = named[ref];
    return { name: def.name, description: def.description, parts: flattenIntent(ref, named) };
  }
  const label = describeGeneric(ref);
  return { name: label, description: `${label}.`, parts: [ref] };
}

const manifestPaths = new Set(Object.keys(manifest as Record<string, unknown>));
export const assetExists = (path: string) => manifestPaths.has(path);

export function buildContent() {
  const enemyIntents: Record<string, ResolvedIntent[]> = Object.fromEntries(
    Object.values(enemies).map((e: EnemyDef) => [e.id, e.intents.map((r) => resolveIntent(r, intents))]),
  );
  return { spells, statuses, abilities, gems, intents, enemies, encounters, enemyIntents, config, assetExists };
}

export type Content = ReturnType<typeof buildContent>;
export const content: Content = buildContent();
