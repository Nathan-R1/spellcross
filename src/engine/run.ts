// The run (spec §2, §4, §9, §10): travel, road battles, stop and random events, rewards, the Toolbox.
// Pure functions over a serialisable RunState. Randomness comes from streams forked off the run seed.

import type { Content } from '../content';
import { abilitySummary } from '../content/describe';
import { events as eventNodes, RANDOM_EVENTS, STOP_EVENTS, TAVERN_TEXT, type Effect, type EventOption, type Next } from '../content/events';
import { FRUIT_IDS } from '../content/fruits';
import { createBattle, type BattleSetup } from './combat';
import { createRng, forkSeed, withRng, type RngState } from './rng';
import type { BattleState, FruitId, Player, Tier, TimedEvent, ToolInstance } from './types';
import { generateMap, generateTerrain, neighbours, roadBetween, type WorldMap } from './world';

export type Screen = 'map' | 'event' | 'prep' | 'battle' | 'result' | 'victory' | 'defeat';

export interface EventState {
  nodeId: string;
  params: Record<string, number>;
  offer: string[];
  /** Indices of single-use options already taken this visit. */
  used: number[];
  pendingRecharges: number;
  fruitOffer: FruitId[] | null;
  fruitOfferPrice: number;
  /** Waiting for the player to pick a tool to level up (Campfire Reflect). */
  levelUpPick?: boolean;
  /** A battle the event started (Fight for Loot), run once the event closes. */
  battleAfter: Tier | null;
}

export interface PrepState {
  enemyId: string;
  source: 'road' | 'event' | 'boss' | 'debug';
}

export interface RunState {
  version: 2;
  seed: number;
  createdAt: string;
  updatedAt: string;
  rng: { events: RngState; run: RngState };
  battleCount: number;
  map: WorldMap;
  terrainSeed: number;
  currentStopId: number;
  travel: null | { from: number; to: number; roadId: number; battleAt: number | null; battleDone: boolean };
  player: Player;
  screen: Screen;
  event: EventState | null;
  prep: PrepState | null;
  battle: BattleState | null;
  result: null | { outcome: 'victory' | 'defeat'; gold: number; fruit: FruitId | null; boss: boolean };
  /** Tool uids from the last battle's loadout, preselected at the next battle prep. */
  lastLoadout?: string[];
  /** Message shown at defeat ("Your journey ends"), or run victory. */
  endMessage?: string;
}

// ---------------------------------------------------------------- creation

export function newToolInstance(p: Pick<Player, 'nextToolUid'>, toolId: string, c: Content): ToolInstance {
  return { uid: `t${p.nextToolUid++}`, toolId, pillar: c.tools[toolId].pillar, level: 1, sockets: [null, null, null] };
}

export function createPlayer(c: Content, seedUid = 1): Player {
  const p: Player = {
    hp: c.config.player.hp, maxHp: c.config.player.hp, movesPerTurn: c.config.player.movesPerTurn, tools: [],
    gold: c.config.player.startingGold, fruits: [], upgrades: 0, abilities: [], maxAbilities: c.config.player.maxAbilities,
    nextToolUid: seedUid,
  };
  for (const id of c.config.startingTools) p.tools.push(newToolInstance(p, id, c));
  return p;
}

export function newRun(seed: number, c: Content, viewportAspect = 844 / 390, now = new Date().toISOString()): RunState {
  const height = c.config.worldHeight;
  const width = Math.round(2 * height * viewportAspect);
  const map = generateMap(forkSeed(seed, 'map'), width, height);
  const start = map.stops.find((s) => s.type === 'start')!;
  const run: RunState = {
    version: 2, seed, createdAt: now, updatedAt: now,
    rng: { events: forkSeed(seed, 'events'), run: forkSeed(seed, 'run') },
    battleCount: 0, map, terrainSeed: forkSeed(seed, 'terrain'), currentStopId: start.id, travel: null,
    player: createPlayer(c), screen: 'map', event: null, prep: null, battle: null, result: null,
  };
  return openEvent(run, 'traveller', {}, c);
}

export const terrainFor = (run: RunState) => generateTerrain(run.terrainSeed, run.map.width, run.map.height);

const clone = <T>(x: T): T => structuredClone(x);

const fruitWeight = (c: Content) => (f: FruitId) => c.fruits[f].dropWeight;
export const abilityWeight = (c: Content, id: string) => c.config.abilityRarityWeight[c.abilities[id].rarity];

/** Draw `count` distinct items, each draw weighted (without replacement). */
export function weightedSample<T>(r: ReturnType<typeof createRng>, items: T[], weightOf: (t: T) => number, count: number): T[] {
  const pool = [...items];
  const out: T[] = [];
  while (out.length < count && pool.length > 0) {
    const pick = r.weighted(pool, weightOf);
    out.push(pick);
    pool.splice(pool.indexOf(pick), 1);
  }
  return out;
}

function eventsRng<T>(run: RunState, fn: (r: ReturnType<typeof createRng>) => T): T {
  const [out, st] = withRng(run.rng.events, fn);
  run.rng.events = st;
  return out;
}
function runRng<T>(run: RunState, fn: (r: ReturnType<typeof createRng>) => T): T {
  const [out, st] = withRng(run.rng.run, fn);
  run.rng.run = st;
  return out;
}

// ---------------------------------------------------------------- travel

export function canTravelTo(run: RunState, stopId: number): boolean {
  return run.screen === 'map' && !run.travel && neighbours(run.map, run.currentStopId).some((n) => n.stop.id === stopId);
}

/** Start travelling. Road and Trail trips schedule a battle at 30–70% of the way (D17). */
export function travelTo(prev: RunState, stopId: number, c: Content): RunState {
  if (!canTravelTo(prev, stopId)) throw new Error('Cannot travel there');
  const run = clone(prev);
  const road = roadBetween(run.map, run.currentStopId, stopId)!;
  const [lo, hi] = c.config.roadBattleAt;
  const battleAt = road.type === 'highway' ? null : runRng(run, (r) => lo + r.next() * (hi - lo));
  run.travel = { from: run.currentStopId, to: stopId, roadId: road.id, battleAt, battleDone: false };
  return touch(run);
}

/** The UI calls this when the token reaches the battle point. */
export function triggerRoadBattle(prev: RunState, c: Content): RunState {
  const run = clone(prev);
  if (!run.travel || run.travel.battleAt === null || run.travel.battleDone) return prev;
  run.travel.battleDone = true;
  const road = run.map.roads[run.travel.roadId];
  const tier: Tier = road.type === 'trail' ? 'elite' : 'normal';
  return touch(openPrep(run, pickEnemy(run, tier, c), 'road'));
}

/** The UI calls this when the token arrives. Opens the stop's event, the boss, or nothing. */
export function arrive(prev: RunState, c: Content): RunState {
  const run = clone(prev);
  if (!run.travel) return prev;
  run.currentStopId = run.travel.to;
  run.travel = null;
  const stop = run.map.stops[run.currentStopId];
  if (stop.type === 'finish') return touch(openPrep(run, pickEnemy(run, 'boss', c), 'boss'));
  if (stop.type === 'encounter') {
    const id = eventsRng(run, (r) => r.pick(RANDOM_EVENTS));
    return touch(openEvent(run, id, {}, c));
  }
  const ev = STOP_EVENTS[stop.type];
  return touch(ev ? openEvent(run, ev, {}, c) : run);
}

/** A random enemy of the tier. Until elites and a boss exist, any enemy stands in (spec §2, TBD). */
function pickEnemy(run: RunState, tier: Tier, c: Content): string {
  const all = Object.values(c.enemies);
  const pool = all.filter((e) => e.tier === tier);
  return runRng(run, (r) => r.pick(pool.length ? pool : all)).id;
}

// ---------------------------------------------------------------- events

export interface EventView {
  title: string;
  text: string;
  image: string;
  options: { label: string; cost?: string; reward?: string; enabled: boolean }[];
}

function openEvent(run: RunState, nodeId: string, params: Record<string, number>, c: Content): RunState {
  const node = eventNodes[nodeId];
  if (!node) throw new Error(`Unknown event ${nodeId}`);
  let offer: string[] = [];
  if (node.offer === 'abilities') offer = eventsRng(run, (r) => weightedSample(r, Object.keys(c.abilities), (id) => abilityWeight(c, id), c.config.travellerChoices));
  const battleAfter = run.event?.battleAfter ?? null;
  run.event = { nodeId, params, offer, used: [], pendingRecharges: 0, fruitOffer: null, fruitOfferPrice: 0, battleAfter };
  run.screen = 'event';
  return run;
}

function nodeOptions(ev: EventState): EventOption[] {
  return eventNodes[ev.nodeId].options(ev.params, ev.offer);
}

export function eventView(run: RunState, c: Content): EventView | null {
  const ev = run.event;
  if (!ev) return null;
  const node = eventNodes[ev.nodeId];
  const text = ev.nodeId === 'tavern_inside' ? TAVERN_TEXT[Math.min(5, ev.params.take ?? 0)] : node.text;
  return {
    title: node.title,
    text,
    image: node.image,
    options: nodeOptions(ev).map((o, i) => {
      const abilityId = o.effects?.find((e): e is Extract<Effect, { type: 'addAbility' }> => e.type === 'addAbility' && !!e.id)?.id;
      const ability = abilityId ? c.abilities[abilityId] : undefined;
      return {
        label: ability ? `[${ability.name}]` : o.label,
        cost: o.cost,
        reward: ability ? abilitySummary(ability.id) : o.reward,
        enabled: !ev.used.includes(i) && (o.available ? o.available(run.player) : true) && ev.pendingRecharges === 0 && !ev.fruitOffer && !ev.levelUpPick,
      };
    }),
  };
}

function applyEffect(run: RunState, e: Effect, c: Content) {
  const p = run.player;
  switch (e.type) {
    case 'gold': p.gold = Math.max(0, p.gold + e.amount); break;
    case 'damage': p.hp = Math.max(0, p.hp - e.amount); break;
    case 'healPctMax': p.hp = Math.min(p.maxHp, p.hp + Math.max(1, Math.floor(p.maxHp * e.pct))); break;
    case 'addAbility': {
      if (p.abilities.length >= p.maxAbilities) break;
      const id = e.id ?? eventsRng(run, (r) => r.weighted(Object.keys(c.abilities), (a) => abilityWeight(c, a)));
      p.abilities.push({ id, uses: c.abilities[id].maxUses });
      break;
    }
    case 'fruit': p.fruits.push(e.id ?? eventsRng(run, (r) => r.weighted(FRUIT_IDS, fruitWeight(c)))); break;
    case 'fruitOffer':
      run.event!.fruitOffer = eventsRng(run, (r) => weightedSample(r, [...FRUIT_IDS], fruitWeight(c), c.config.shopFruitChoices));
      run.event!.fruitOfferPrice = e.price;
      break;
    case 'upgrade': p.upgrades += e.count; break;
    case 'levelUpTool': run.event!.levelUpPick = true; break;
    case 'recharge': run.event!.pendingRecharges += e.count === 'perAbility' ? p.abilities.length : e.count; break;
    case 'changePillar': {
      const t = p.tools.find((x) => x.pillar !== e.pillar);
      if (t) t.pillar = e.pillar;
      break;
    }
    case 'removeLastAbility': p.abilities.pop(); break;
    case 'battle': run.event!.battleAfter = e.tier; break;
  }
}

function resolveNext(run: RunState, next: Next): Next {
  let n = next;
  while (typeof n === 'object' && 'chance' in n) {
    const chance = n.chance;
    const pass = eventsRng(run, (r) => r.next() < chance);
    n = pass ? n.pass : n.fail;
  }
  return n;
}

export function chooseOption(prev: RunState, index: number, c: Content): RunState {
  const view = eventView(prev, c);
  if (!view || !view.options[index]?.enabled) throw new Error('Option unavailable');
  const run = clone(prev);
  const ev = run.event!;
  const option = nodeOptions(ev)[index];
  for (const e of option.effects ?? []) applyEffect(run, e, c);
  if (run.player.hp <= 0) return touch(defeat(run));
  const next = resolveNext(run, option.next);
  if (next === 'stay') {
    ev.used.push(index);
    // Options in the same group (e.g. the two heals) are used up together.
    if (option.group) nodeOptions(ev).forEach((o, i) => o.group === option.group && !ev.used.includes(i) && ev.used.push(i));
    return touch(run);
  }
  if (next === 'end') {
    // Wait for pending popups (recharge, fruit offer) before closing.
    if (ev.pendingRecharges > 0 || ev.fruitOffer || ev.levelUpPick) {
      ev.used = nodeOptions(ev).map((_, i) => i);
      ev.params = { ...ev.params, closeAfterPopup: 1 };
      return touch(run);
    }
    return touch(closeEvent(run, c));
  }
  if ('node' in next) return touch(openEvent(run, next.node, next.params ?? {}, c));
  return touch(run);
}

function closeEvent(run: RunState, c: Content): RunState {
  const battleTier = run.event?.battleAfter ?? null;
  run.event = null;
  run.screen = 'map';
  if (battleTier) return openPrep(run, pickEnemy(run, battleTier, c), 'event');
  return run;
}

/** Assign one recharge to an ability (uses never exceed max). */
export function assignRecharge(prev: RunState, abilityIndex: number, c: Content): RunState {
  const run = clone(prev);
  const ev = run.event;
  if (!ev || ev.pendingRecharges <= 0) return prev;
  const a = run.player.abilities[abilityIndex];
  if (a) a.uses = Math.min(c.abilities[a.id].maxUses, a.uses + 1);
  ev.pendingRecharges -= 1;
  if (run.player.abilities.every((x) => x.uses >= c.abilities[x.id].maxUses)) ev.pendingRecharges = 0;
  return touch(afterPopup(run, c));
}

export function skipRecharges(prev: RunState, c: Content): RunState {
  const run = clone(prev);
  if (run.event) run.event.pendingRecharges = 0;
  return touch(afterPopup(run, c));
}

/** Pick one of the shop's fruit offers (or null to cancel and keep the Talents). */
export function pickFruitOffer(prev: RunState, fruit: FruitId | null, c: Content): RunState {
  const run = clone(prev);
  const ev = run.event;
  if (!ev?.fruitOffer) return prev;
  if (fruit && ev.fruitOffer.includes(fruit) && run.player.gold >= ev.fruitOfferPrice) {
    run.player.gold -= ev.fruitOfferPrice;
    run.player.fruits.push(fruit);
  } else {
    // Cancelled: the single-use purchase option is given back.
    const idx = nodeOptions(ev).findIndex((o) => o.effects?.some((x) => x.type === 'fruitOffer'));
    ev.used = ev.used.filter((i) => i !== idx);
  }
  ev.fruitOffer = null;
  return touch(afterPopup(run, c));
}

/**
 * Campfire Reflect: raise one tool's level by 1 (max 5), or cancel (null) to get the option, and the
 * rest of its either/or group, back.
 */
export function pickLevelUp(prev: RunState, toolUid: string | null, c: Content): RunState {
  const run = clone(prev);
  const ev = run.event;
  if (!ev?.levelUpPick) return prev;
  const inst = toolUid ? run.player.tools.find((s) => s.uid === toolUid) : undefined;
  if (inst && inst.level < c.config.maxToolLevel) {
    inst.level = (inst.level + 1) as 1 | 2 | 3 | 4 | 5;
  } else {
    const opts = nodeOptions(ev);
    const idx = opts.findIndex((o) => o.effects?.some((x) => x.type === 'levelUpTool'));
    const group = opts[idx]?.group;
    ev.used = ev.used.filter((i) => i !== idx && !(group && opts[i]?.group === group));
  }
  ev.levelUpPick = false;
  return touch(afterPopup(run, c));
}

function afterPopup(run: RunState, c: Content): RunState {
  const ev = run.event;
  if (ev && ev.params.closeAfterPopup && ev.pendingRecharges === 0 && !ev.fruitOffer && !ev.levelUpPick) return closeEvent(run, c);
  return run;
}

// ---------------------------------------------------------------- battles

function openPrep(run: RunState, enemyId: string, source: PrepState['source']): RunState {
  run.prep = { enemyId, source };
  run.screen = 'prep';
  return run;
}

/** Check a loadout: the configured number of distinct owned tools (fewer if you own fewer). */
export function validateLoadout(player: Player, loadout: string[], c: Content) {
  const need = Math.min(c.config.loadoutSize, player.tools.length);
  if (loadout.length !== need) throw new Error(`Choose ${need} tools`);
  if (new Set(loadout).size !== loadout.length) throw new Error('Duplicate tool');
  if (loadout.some((uid) => !player.tools.some((t) => t.uid === uid))) throw new Error('Unknown tool');
}

export function startBattle(prev: RunState, loadout: string[], c: Content): { run: RunState; events: TimedEvent[] } {
  const run = clone(prev);
  const prep = run.prep;
  if (!prep) throw new Error('No battle to start');
  validateLoadout(run.player, loadout, c);
  run.battleCount += 1;
  run.lastLoadout = [...loadout];
  const setup: BattleSetup = { player: run.player, enemyId: prep.enemyId, loadout, seed: forkSeed(run.seed, `battle:${run.battleCount}`) };
  const { state, events } = createBattle(setup, c);
  run.battle = state;
  run.screen = 'battle';
  return { run: touch(run), events };
}

/** Rewards for beating an enemy: Talents from its range, and maybe a fruit (by tier). */
export function rollRewards(r: ReturnType<typeof createRng>, enemyId: string, c: Content): { gold: number; fruit: FruitId | null } {
  const e = c.enemies[enemyId];
  const gold = r.int(e.talents[0], e.talents[1] + 1);
  const fruit = r.next() < c.config.fruitDrop[e.tier] ? r.weighted(FRUIT_IDS, fruitWeight(c)) : null;
  return { gold, fruit };
}

/** Called by the UI once the battle's outcome has played. Applies rewards or the defeat. */
export function finishBattle(prev: RunState, c: Content): RunState {
  const run = clone(prev);
  const battle = run.battle;
  if (!battle?.outcome) return prev;
  const prep = run.prep!;
  // Courage and ability uses carry over; statuses always clear after a battle.
  run.player.hp = battle.player.hp;
  run.player.abilities = battle.player.abilities;
  run.battle = null;
  if (battle.outcome === 'defeat') return touch(defeat(run));
  const { gold, fruit } = runRng(run, (r) => rollRewards(r, battle.enemyId, c));
  run.player.gold += gold;
  if (fruit) run.player.fruits.push(fruit);
  run.result = { outcome: 'victory', gold, fruit, boss: prep.source === 'boss' };
  run.screen = 'result';
  return touch(run);
}

/** Leave the result screen: back to travel, or run victory after the boss. */
export function continueAfterResult(prev: RunState): RunState {
  const run = clone(prev);
  const boss = run.result?.boss;
  run.result = null;
  run.prep = null;
  if (boss) {
    run.screen = 'victory';
    run.endMessage = 'Pride falls. Your journey is complete.';
    return touch(run);
  }
  run.screen = 'map';
  return touch(run);
}

function defeat(run: RunState): RunState {
  run.screen = 'defeat';
  run.battle = null;
  run.event = null;
  run.prep = null;
  run.endMessage = 'Your journey ends.';
  return run;
}

// ---------------------------------------------------------------- toolbox

/**
 * The loadout to preselect: the last battle's tools (still owned), topped up from the tool list in order,
 * trimmed to the loadout size.
 */
export function suggestedLoadout(player: Player, last: string[] | undefined, size: number): string[] {
  const owned = player.tools.map((s) => s.uid);
  const picked = (last ?? []).filter((uid) => owned.includes(uid)).slice(0, size);
  for (const uid of owned) if (picked.length < Math.min(size, owned.length) && !picked.includes(uid)) picked.push(uid);
  return picked;
}

export function atTown(run: RunState): boolean {
  return !run.travel && run.map.stops[run.currentStopId]?.type === 'town';
}

export function socketFruit(prev: RunState, toolUid: string, socket: number, fruitIndex: number): RunState {
  const run = clone(prev);
  const p = run.player;
  const inst = p.tools.find((s) => s.uid === toolUid);
  const fruit = p.fruits[fruitIndex];
  if (!inst || fruit === undefined || socket < 0 || socket > 2 || inst.sockets[socket]) throw new Error('Cannot add a fruit there');
  inst.sockets[socket] = fruit;
  p.fruits.splice(fruitIndex, 1);
  return touch(run);
}

export function unsocketFruit(prev: RunState, toolUid: string, socket: number, c: Content): RunState {
  if (!atTown(prev)) throw new Error('Fruit can only be removed in a Town');
  const run = clone(prev);
  const p = run.player;
  const inst = p.tools.find((s) => s.uid === toolUid);
  const fruit = inst?.sockets[socket];
  if (!inst || !fruit) throw new Error('Nothing to remove');
  if (p.gold < c.config.prices.unsocket) throw new Error('Not enough Talents');
  p.gold -= c.config.prices.unsocket;
  p.fruits.push(fruit);
  inst.sockets[socket] = null;
  return touch(run);
}

export function upgradeTool(prev: RunState, toolUid: string, c: Content): RunState {
  const run = clone(prev);
  const p = run.player;
  const inst = p.tools.find((s) => s.uid === toolUid);
  if (!inst || p.upgrades <= 0 || inst.level >= c.config.maxToolLevel) throw new Error('Cannot upgrade');
  inst.level = (inst.level + 1) as 1 | 2 | 3 | 4 | 5;
  p.upgrades -= 1;
  return touch(run);
}

function touch(run: RunState): RunState {
  run.updatedAt = new Date().toISOString();
  return run;
}

// ---------------------------------------------------------------- debug

export function debugBattle(prev: RunState, enemyId: string, c: Content): RunState {
  if (!c.enemies[enemyId]) throw new Error(`Unknown enemy ${enemyId}`);
  return touch(openPrep(clone(prev), enemyId, 'debug'));
}

export function debugEvent(prev: RunState, eventId: string, c: Content): RunState {
  return touch(openEvent(clone(prev), eventId, {}, c));
}
