// Named intents, enemies and encounters (enemies.md). Data only; generic intents are built with helpers.

import type { EncounterDef, EnemyDef, GenericIntent, NamedIntentDef } from '../engine/types';

export const attack = (amount: number): GenericIntent => ({ type: 'attack', amount });
export const defend = (amount: number): GenericIntent => ({ type: 'defend', amount });
export const defendAllies = (amount: number): GenericIntent => ({ type: 'defendAllies', amount });
export const heal = (amount: number): GenericIntent => ({ type: 'heal', amount });
export const healAlly = (amount: number): GenericIntent => ({ type: 'healAlly', amount });
export const healAllies = (amount: number): GenericIntent => ({ type: 'healAllies', amount });
export const buff = (status: string, value: number): GenericIntent => ({ type: 'buff', status, value });
export const buffAllies = (status: string, value: number): GenericIntent => ({ type: 'buffAllies', status, value });
export const debuff = (status: string, value: number): GenericIntent => ({ type: 'debuff', status, value });
export const steal = (amount: number): GenericIntent => ({ type: 'steal', amount });
export const lock = (count: number): GenericIntent => ({ type: 'lock', count });
export const attackScaled = (max: number): GenericIntent => ({ type: 'attackScaled', max });
export const addTiles = (spell: string, count: number): GenericIntent => ({ type: 'addTiles', spell, count });
export const weaken = (value: number) => debuff('weakness', value);
export const poison = (value: number) => debuff('poisoned', value);
export const enrage = (value: number) => buff('strength', value);

const named = (d: NamedIntentDef) => d;

export const intents: Record<string, NamedIntentDef> = {
  fangs: named({ id: 'fangs', name: 'Fangs', description: 'Bites for 5.', do: [attack(5)] }),
  disable: named({ id: 'disable', name: 'Disable', description: 'Hits for 5 and leaves you Weak.', do: [attack(5), weaken(1)] }),
  rage: named({ id: 'rage', name: 'Rage', description: 'Gains 1 Strength.', do: [enrage(1)] }),

  swipe: named({ id: 'swipe', name: 'Swipe', description: 'Hits for 6.', do: [attack(6)] }),
  maul: named({ id: 'maul', name: 'Maul', description: 'Hits for 12.', do: [attack(12)] }),
  roar: named({ id: 'roar', name: 'Roar', description: 'Gains 1 Strength and leaves you Weak.', do: [enrage(1), weaken(1)] }),

  venom_bite: named({ id: 'venom_bite', name: 'Venom Bite', description: 'Hits for 4 and poisons you.', do: [attack(4), poison(3)] }),
  spin_web: named({ id: 'spin_web', name: 'Spin Web', description: 'Webs 8 of your tiles and gains 6 Block.', do: [lock(8), defend(6)] }),
  lunge: named({ id: 'lunge', name: 'Lunge', description: 'Hits twice for 4.', do: [attack(4), attack(4)] }),
  feed: named({ id: 'feed', name: 'Feed', description: 'Hits for 6 and heals 6.', do: [attack(6), heal(6)] }),

  dark_bolt: named({ id: 'dark_bolt', name: 'Dark Bolt', description: 'Hits for 12.', do: [attack(12)] }),
  rally: named({ id: 'rally', name: 'Rally', description: 'Heals all allies 10 and gives them 2 Strength.', do: [healAllies(10), buffAllies('strength', 2)] }),

  crush: named({ id: 'crush', name: 'Crush', description: 'Hits for 30 at full health, less the more it is hurt.', do: [attackScaled(30)] }),
  corrupt: named({ id: 'corrupt', name: 'Corrupt', description: 'Turns 4 tiles to Rubble and leaves you Weak.', do: [addTiles('rubble', 4), weaken(2)] }),
  ward: named({ id: 'ward', name: 'Ward', description: 'Gains 15 Block and heals 10.', do: [defend(15), heal(10)] }),
  doom: named({ id: 'doom', name: 'Doom', description: 'Hits three times for 6.', do: [attack(6), attack(6), attack(6)] }),
};

export const enemies: Record<string, EnemyDef> = {
  wolf: { id: 'wolf', name: 'Wolf', tier: 'normal', hp: 30, portrait: 'portraits/wolf.png', start: 'random', gold: [25, 40], intents: ['fangs', 'disable', 'rage'] },
  bear: { id: 'bear', name: 'Bear', tier: 'normal', hp: 45, portrait: 'portraits/bear.png', gold: [35, 50], intents: ['swipe', defend(10), 'maul', 'roar'] },
  // No Spellford spider art (U5): the UI draws a placeholder portrait.
  // Elites and the boss have double the normal-enemy halving (2026-11-22). The Spider opens with Spin Web.
  spider: { id: 'spider', name: 'Spider', tier: 'elite', hp: 76, gold: [45, 65], intents: ['spin_web', 'lunge', 'feed', 'venom_bite'] },
  // No Spellford art: placeholder portrait. One move, no allies.
  stone_giant: { id: 'stone_giant', name: 'Stone Giant', tier: 'elite', hp: 100, gold: [50, 70], intents: ['crush'] },
  // Opens with Rally so its pack scales from turn 1.
  harbinger: { id: 'harbinger', name: 'Harbinger', tier: 'boss', hp: 180, portrait: 'portraits/harbinger.png', gold: [100, 150], intents: ['rally', 'corrupt', 'ward', 'doom', 'dark_bolt'] },
};

export const encounters: Record<string, EncounterDef> = {
  wolf: { id: 'wolf', tier: 'normal', enemies: ['wolf'] },
  wolf_pair: { id: 'wolf_pair', tier: 'normal', enemies: ['wolf', 'wolf'] },
  bear: { id: 'bear', tier: 'normal', enemies: ['bear'] },
  wilds: { id: 'wilds', tier: 'normal', enemies: ['wolf', 'bear'] },
  hunting_party: { id: 'hunting_party', tier: 'normal', enemies: ['wolf', 'bear', 'wolf'] },
  pack: { id: 'pack', tier: 'normal', enemies: ['wolf', 'wolf', 'wolf', 'wolf'] },
  spider: { id: 'spider', tier: 'elite', enemies: ['spider'] },
  stone_giant: { id: 'stone_giant', tier: 'elite', enemies: ['stone_giant'] },
  nest: { id: 'nest', tier: 'elite', enemies: ['wolf', 'spider'] },
  boss: { id: 'boss', tier: 'boss', enemies: ['wolf', 'harbinger', 'bear'] },
};
