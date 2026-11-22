// Story and stop events (spec §4, features §4.2–4.3). Text is Spellford's EventLibrary, verbatim.
// Options are data except availability checks and parametric nodes (Chest, Tavern), which take params.

import type { AbilityId, Element, GemId, Player, SpellId } from '../engine/types';

export type Next =
  | 'end'
  /** Option is single-use and the event stays open (Spellford `nextEvent = null`). */
  | 'stay'
  | { node: string; params?: Record<string, number> }
  | { chance: number; pass: Next; fail: Next };

export type Effect =
  | { type: 'gold'; amount: number }
  | { type: 'damage'; amount: number }
  | { type: 'healPctMax'; pct: number }
  | { type: 'addAbility'; id?: AbilityId }
  | { type: 'gem'; id?: GemId }
  | { type: 'gemOffer'; price: number }
  | { type: 'spellUpgrade'; count: number }
  /** Pick a spell and raise its level now (Campfire Meditate). */
  | { type: 'levelUpSpell' }
  | { type: 'recharge'; count: number | 'perAbility' }
  | { type: 'addSpell'; id: SpellId }
  | { type: 'changeElement'; element: Element }
  | { type: 'removeLastAbility' }
  | { type: 'battle'; tier: 'normal' | 'elite' };

export interface EventOption {
  label: string;
  cost?: string;
  reward?: string;
  available?: (p: Player) => boolean;
  effects?: Effect[];
  next: Next;
  /** Options sharing a group are all used up once any one is chosen (e.g. one heal per visit). */
  group?: string;
}

export interface EventNode {
  id: string;
  title: string;
  text: string;
  image: string;
  /** Rolled on entry (D7: from the run RNG), e.g. the Traveller's three abilities. */
  offer?: 'abilities';
  options: (params: Record<string, number>, offer: string[]) => EventOption[];
}

const IMG = 'portraits/wolf.png'; // Spellford uses this as the placeholder for every random event.
const TOWN_IMG = 'town/town.jpg'; // Spellford references town.png; the asset is town.jpg.

/** Gambler win payout by wager: Small 201 (Spellford), Big 601. */
export const insistGold = (wager = 50) => (wager >= 200 ? 601 : 201);

const LEAVE: EventOption = { label: '[Leave]', next: 'end' };
const gold = (n: number) => (p: Player) => p.gold >= n;
const hasAbilities = (p: Player) => p.abilities.length > 0;

// One heal per visit (D25): a free +20% at Campfires, Villages and Towns, or a paid +50% at Villages and Towns.
// Spellford healed +50% for free at Campfires, Villages and Towns.
const PATCH_UP: EventOption = { label: '[Patch up]', reward: '+20% HP', effects: [{ type: 'healPctMax', pct: 0.2 }], next: 'stay', group: 'heal' };
const HEAL: EventOption = { label: '[Healer]', reward: '+50% HP', cost: '-50gp', available: gold(50), effects: [{ type: 'gold', amount: -50 }, { type: 'healPctMax', pct: 0.5 }], next: 'stay', group: 'heal' };
const REST: EventOption = { label: '[Resting]', reward: '+1 Recharge per ability', available: hasAbilities, effects: [{ type: 'recharge', count: 'perAbility' }], next: 'stay' };
const BUY_GEM: EventOption = { label: '[Purchase]', reward: '+Gem (pick 1 of 3)', cost: '-100gp', available: gold(100), effects: [{ type: 'gemOffer', price: 100 }], next: 'stay' };
const TRAIN_UPGRADE = (label: string): EventOption => ({ label, reward: '+Spell Upgrade', cost: '-100gp', available: gold(100), effects: [{ type: 'gold', amount: -100 }, { type: 'spellUpgrade', count: 1 }], next: 'stay' });

const node = (n: EventNode) => n;

export const events: Record<string, EventNode> = {
  // ---------------------------------------------------------------- stop events
  traveller: node({
    id: 'traveller', title: 'A Fellow Traveller', image: 'portraits/player.png', offer: 'abilities',
    text: 'You meet a fellow traveller on the road. They offer to teach you one of their techniques.',
    options: (_p, offer) => offer.map((id) => ({ label: `[${id}]`, reward: id, effects: [{ type: 'addAbility', id }], next: 'end' as const })),
  }),
  campfire: node({
    id: 'campfire', title: 'Campfire', text: '', image: TOWN_IMG,
    // Campfire: choose one of Patch up, Rest or Meditate.
    options: () => [
      { ...PATCH_UP, group: 'campfire' },
      { ...REST, group: 'campfire' },
      {
        label: '[Meditate]', reward: 'Level up a spell', group: 'campfire', next: 'stay',
        available: (p) => p.spells.some((s) => s.level < 5), effects: [{ type: 'levelUpSpell' }],
      },
      LEAVE,
    ],
  }),
  village: node({ id: 'village', title: 'Village', text: '', image: TOWN_IMG, options: () => [PATCH_UP, HEAL, REST, BUY_GEM, LEAVE] }),
  town: node({ id: 'town', title: 'Town', text: '', image: TOWN_IMG, options: () => [PATCH_UP, HEAL, REST, BUY_GEM, TRAIN_UPGRADE('[Train]'), LEAVE] }),
  market: node({
    id: 'market', title: 'Market', text: '', image: TOWN_IMG,
    options: () => [
      { label: '[Train]', reward: '+1 ability', cost: '-200 gp', available: (p) => p.gold >= 200 && p.abilities.length < p.maxAbilities, effects: [{ type: 'gold', amount: -200 }, { type: 'addAbility' }], next: 'stay' },
      BUY_GEM,
      TRAIN_UPGRADE('[Study]'),
      LEAVE,
    ],
  }),

  // ---------------------------------------------------------------- random events
  gambler: node({
    id: 'gambler', title: 'Gambling in the Wilderness', image: IMG,
    text: "Hey there young man. How about a game of chance? Got anything you'd like to wager?",
    options: () => [
      { label: '[Gamble Small]', cost: '-50gp', available: gold(50), effects: [{ type: 'gold', amount: -50 }], next: { chance: 0.5, pass: { node: 'gambler_win', params: { wager: 50 } }, fail: { node: 'gambler_lose' } } },
      { label: '[Gamble Big]', cost: '-200gp', available: gold(200), effects: [{ type: 'gold', amount: -200 }], next: { chance: 0.5, pass: { node: 'gambler_win', params: { wager: 200 } }, fail: { node: 'gambler_lose' } } },
      LEAVE,
    ],
  }),
  gambler_win: node({
    id: 'gambler_win', title: 'Gambling in the Wilderness', image: IMG,
    text: "Rats! I'm so unlucky I lose my house, my wagon, my job... and now I'm losing in the wilderness! This is my last gold, surely I have something else I can give you instead?",
    options: (p) => [
      // Spellford pays a flat 201, which made Gamble Big a trap. Big now pays 601 (tune); Small keeps 201.
      { label: '[Insist]', reward: `+${insistGold(p.wager)} Gold`, effects: [{ type: 'gold', amount: insistGold(p.wager) }], next: 'end' },
      { label: '[Take some junk]', reward: '+Gem', effects: [{ type: 'gem' }], next: 'end' },
    ],
  }),
  gambler_lose: node({
    id: 'gambler_lose', title: 'Gambling in the Wilderness', image: IMG,
    text: 'Yes! My lucky break! I new the day would finally come... You better watch out for strangers kiddo.',
    options: () => [LEAVE],
  }),
  salesman: node({
    id: 'salesman', title: 'A Salesman of Sorts', image: IMG,
    text: 'Times are changing good friend. There is word of havoc and death. The watchmen have been called off to war. The roads are no longer safe for the likes of you and I. Who will defend us when thugs and robbers attack?',
    options: () => [
      { label: '[Pay for a Weapon]', reward: '+Ability', cost: '-100gp', available: (p) => p.gold >= 100 && p.abilities.length < p.maxAbilities, effects: [{ type: 'gold', amount: -100 }, { type: 'addAbility' }], next: 'stay' },
      { label: '[Pay for Healing]', reward: '+50% HP', cost: '-50gp', available: gold(50), effects: [{ type: 'gold', amount: -50 }, { type: 'healPctMax', pct: 0.5 }], next: 'stay' },
      LEAVE,
    ],
  }),
  warlock: node({
    id: 'warlock', title: 'Wandering Warlock', image: IMG, text: 'Leave me be. I have business in these parts.',
    options: () => [LEAVE, { label: '[Harass]', next: { node: 'warlock_harass' } }],
  }),
  warlock_harass: node({
    id: 'warlock_harass', title: 'Wandering Warlock', image: IMG,
    text: 'What do you want?! Never seen a Warlock before! I am on sacred business.',
    options: () => [
      { label: '[Ask for Wisdom]', next: { node: 'warlock_wisdom' } },
      { label: '[Ask for Stuff]', next: { node: 'warlock_stuff' } },
    ],
  }),
  warlock_wisdom: node({
    id: 'warlock_wisdom', title: 'Wandering Warlock', image: IMG,
    text: 'Hmmmmph. Well fine then. ... I shall tell you about the most useful wisdom of all, the wisdom of the power. The wisdom of death. The wisdom of how to shoot your enemies while they sleep.',
    options: () => [{ label: '[Listen]', reward: '+Spell Upgrade', effects: [{ type: 'spellUpgrade', count: 1 }], next: 'end' }],
  }),
  warlock_stuff: node({
    id: 'warlock_stuff', title: 'Wandering Warlock', image: IMG,
    text: 'Greedy fool, see a man better off than you and think you can get something from him. Well fine... but only because I am on a religious journey of kindness you jerk.',
    options: () => [{ label: '[Take]', reward: '+Weight Gem', effects: [{ type: 'gem', id: 'weight' }], next: 'end' }], // D5
  }),
  shrine: node({
    id: 'shrine', title: 'Fallen Shrine', image: IMG, text: "You discover a cracked old stone that must once have served as someone's god. ",
    // Spellford's Ignore is single-use and leaves you stuck on the event; Spellcross ends it.
    options: () => [{ label: '[Ignore]', next: 'end' }, { label: '[Scorn]', next: { node: 'shrine_scorn' } }, { label: '[Pray]', next: { node: 'shrine_pray' } }],
  }),
  shrine_scorn: node({
    id: 'shrine_scorn', title: 'Fallen Shrine', image: IMG,
    text: "The shrine looks up at you as if to say: 'You scorn me? You are one without memory, without purpose, you barely even have a grasp on life itself'",
    options: () => [{ label: '[Stalk Away]', cost: '-5 HP', available: (p) => p.hp >= 5, effects: [{ type: 'damage', amount: 5 }], next: 'end' }],
  }),
  shrine_pray: node({
    id: 'shrine_pray', title: 'Fallen Shrine', image: IMG,
    text: 'As you pray you see the face of your father for a moment. He looks old. How long have you been at this journey... nevertheless it gives you courage.',
    options: () => [LEAVE, { label: '[Courage]', reward: '3 Ability Recharges', available: hasAbilities, effects: [{ type: 'recharge', count: 3 }], next: 'end' }],
  }),
  chest: node({
    id: 'chest', title: 'Mysterious Chest', image: IMG, text: 'A mysterious chest sits before you...',
    options: (p) => {
      const n = p.attempt ?? 1;
      const guaranteed = n >= 10;
      const cost = 3 + n;
      const chance = guaranteed ? 1 : Math.min(1, (25 + n * 10) / 100);
      return [
        {
          label: '[Reach Inside]', reward: guaranteed ? '100% Relic' : `${Math.round(chance * 100)}% Relic`, cost: `Lose ${cost} HP`,
          available: (pl) => pl.hp >= cost, effects: [{ type: 'damage', amount: cost }],
          next: { chance, pass: { node: 'chest_success' }, fail: { node: 'chest', params: { attempt: n + 1 } } },
        },
        LEAVE,
      ];
    },
  }),
  chest_success: node({
    id: 'chest_success', title: 'Mysterious Chest', image: IMG, text: 'Finally at long last you pry open the chest and find your rewards.',
    options: () => [{ label: '[Continue]', reward: '+Ability', effects: [{ type: 'addAbility' }], next: 'end' }],
  }),
  tavern: node({
    id: 'tavern', title: 'Abandoned Tavern', image: IMG, text: 'You come across an abandoned tavern. The door creaks in the wind...',
    options: () => [LEAVE, { label: '[Go Inside]', next: { node: 'tavern_inside', params: { take: 0 } } }],
  }),
  tavern_inside: node({
    id: 'tavern_inside', title: 'Inside the Tavern', image: IMG, text: '',
    options: (p) => {
      const take = p.take ?? 0;
      const amount = 50 - take * 10;
      const last = take >= 4;
      const options: EventOption[] = [
        {
          label: '[Take Stuff]', reward: `+${amount} Gold`, effects: [{ type: 'gold', amount }],
          // 1% ambush per take, rolled when chosen (D7).
          next: { chance: 0.01, pass: { node: 'tavern_ambush' }, fail: last ? { node: 'tavern_inside', params: { take: 5 } } : { node: 'tavern_inside', params: { take: take + 1 } } },
        },
        LEAVE,
      ];
      return options.filter((o) => take < 5 || o.label === '[Leave]');
    },
  }),
  tavern_ambush: node({
    id: 'tavern_ambush', title: 'Something Awakens!', image: IMG, text: 'Something attacks you from the shadows!',
    options: () => [{ label: '[Continue]', cost: '-50 HP', effects: [{ type: 'damage', amount: 50 }], next: 'end' }],
  }),
  fight_for_loot: node({
    id: 'fight_for_loot', title: 'A Dangerous Situation', image: IMG,
    text: 'Behold before you a crooked path leading off into the mountains. The path has the markings of some great beast. ',
    options: () => [LEAVE, { label: '[Explore]', reward: '+Spell', cost: 'Fight', effects: [{ type: 'addSpell', id: 'wind_wall' }, { type: 'battle', tier: 'normal' }], next: 'end' }],
  }),
  alchemist: node({
    id: 'alchemist', title: 'Alchemical Shop', image: IMG, text: 'A wisened woman looks over at you. She says nothing but the options are clear.',
    options: () => [
      LEAVE,
      { label: '[Pay for Fire]', cost: '-100gp', available: (p) => p.gold >= 100 && p.spells.some((s) => s.element !== 'fire'), effects: [{ type: 'gold', amount: -100 }, { type: 'changeElement', element: 'fire' }], next: 'end' },
      { label: '[Sacrifice for Lightning]', cost: '-Ability', available: (p) => hasAbilities(p) && p.spells.some((s) => s.element !== 'lightning'), effects: [{ type: 'removeLastAbility' }, { type: 'changeElement', element: 'lightning' }], next: 'end' },
      { label: '[Sacrifice for Earth]', cost: '-Ability', available: (p) => hasAbilities(p) && p.spells.some((s) => s.element !== 'earth'), effects: [{ type: 'removeLastAbility' }, { type: 'changeElement', element: 'earth' }], next: 'end' },
    ],
  }),
};

/** Tavern text by take number (Spellford's escalating ominous lines). */
export const TAVERN_TEXT = [
  "The tavern looks abandoned but there's still stuff inside...",
  'You take the items. The shadows seem to move...',
  'You grab more. Something watches from the darkness...',
  'Your hands tremble as you take more. The air grows cold...',
  'The darkness presses in. You grab the last items...',
  'You flee with your loot!',
];

export const RANDOM_EVENTS = ['gambler', 'salesman', 'warlock', 'shrine', 'chest', 'tavern', 'fight_for_loot', 'alchemist'] as const;

export const STOP_EVENTS: Record<string, string | undefined> = {
  start: 'traveller', campfire: 'campfire', village: 'village', town: 'town', market: 'market',
};
