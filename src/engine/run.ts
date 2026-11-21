// The run (spec §2, §4, §9, §10): travel, road battles, stop and random events, rewards, the Spellbook.
// Pure functions over a serialisable RunState. Randomness comes from streams forked off the run seed.

import type { Content } from '../content';
import { events as eventNodes, RANDOM_EVENTS, STOP_EVENTS, TAVERN_TEXT, type Effect, type EventOption, type Next } from '../content/events';
import { createBattle, type BattleSetup } from './battle';
import { createRng, forkSeed, withRng, type RngState } from './rng';
import { newSpellInstance, resolveInstance } from './spells';
import { heal } from './status';
import type { BattleState, Element, GemId, Player, ResolvedSpell, SpellId, Tier, TimedEvent } from './types';
import { generateMap, generateTerrain, neighbours, roadBetween, type WorldMap } from './world';

export type Screen = 'map' | 'event' | 'prep' | 'battle' | 'result' | 'victory' | 'defeat';

export interface EventState {
  nodeId: string;
  params: Record<string, number>;
  offer: string[];
  /** Indices of single-use options already taken this visit. */
  used: number[];
  pendingRecharges: number;
  gemOffer: GemId[] | null;
  gemOfferPrice: number;
  /** A battle the event started (Fight for Loot), run once the event closes. */
  battleAfter: Tier | null;
}

export interface PrepState {
  encounterId: string;
  slots: number;
  source: 'road' | 'event' | 'boss' | 'debug';
}

export interface RunState {
  version: 1;
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
  result: null | { outcome: 'victory' | 'defeat'; gold: number; gem: GemId | null; boss: boolean };
  /** Message shown at defeat ("Your journey ends"), or run victory. */
  endMessage?: string;
}

// ---------------------------------------------------------------- creation

export function createPlayer(c: Content, seedUid = 1): Player {
  const p: Player = {
    hp: c.config.player.hp, maxHp: c.config.player.hp, strengthStat: 1, weaknesses: [], resistances: [], statuses: [],
    movesPerTurn: c.config.player.movesPerTurn, spells: [], junkPool: ['orb', 'slime'], gold: c.config.player.startingGold,
    gems: [], spellUpgrades: 0, abilities: [], maxAbilities: c.config.player.maxAbilities, nextSpellUid: seedUid,
  };
  for (const id of ['scorch', 'restore', 'strike', 'ice_bolt', 'venom', 'shield']) p.spells.push(newSpellInstance(p, c.spells[id]));
  return p;
}

export function newRun(seed: number, c: Content, viewportAspect = 844 / 390, now = new Date().toISOString()): RunState {
  const height = c.config.worldHeight;
  const width = Math.round(2 * height * viewportAspect);
  const map = generateMap(forkSeed(seed, 'map'), width, height);
  const start = map.stops.find((s) => s.type === 'start')!;
  const run: RunState = {
    version: 1, seed, createdAt: now, updatedAt: now,
    rng: { events: forkSeed(seed, 'events'), run: forkSeed(seed, 'run') },
    battleCount: 0, map, terrainSeed: forkSeed(seed, 'terrain'), currentStopId: start.id, travel: null,
    player: createPlayer(c), screen: 'map', event: null, prep: null, battle: null, result: null,
  };
  return openEvent(run, 'traveller', {}, c);
}

export const terrainFor = (run: RunState) => generateTerrain(run.terrainSeed, run.map.width, run.map.height);

const clone = <T>(x: T): T => structuredClone(x);

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
  return touch(openPrep(run, pickEncounter(run, tier, c), tier === 'elite' ? c.config.loadoutSlots.elite : c.config.loadoutSlots.normal, 'road'));
}

/** The UI calls this when the token arrives. Opens the stop's event, the boss, or nothing. */
export function arrive(prev: RunState, c: Content): RunState {
  const run = clone(prev);
  if (!run.travel) return prev;
  run.currentStopId = run.travel.to;
  run.travel = null;
  const stop = run.map.stops[run.currentStopId];
  if (stop.type === 'finish') return touch(openPrep(run, 'boss', c.config.loadoutSlots.boss, 'boss'));
  if (stop.type === 'encounter') {
    const id = eventsRng(run, (r) => r.pick(RANDOM_EVENTS));
    return touch(openEvent(run, id, {}, c));
  }
  const ev = STOP_EVENTS[stop.type];
  return touch(ev ? openEvent(run, ev, {}, c) : run);
}

function pickEncounter(run: RunState, tier: Tier, c: Content): string {
  const pool = Object.values(c.encounters).filter((e) => e.tier === tier);
  return runRng(run, (r) => r.pick(pool)).id;
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
  if (node.offer === 'abilities') offer = eventsRng(run, (r) => r.shuffle(Object.keys(c.abilities)).slice(0, c.config.travellerChoices));
  const battleAfter = run.event?.battleAfter ?? null;
  run.event = { nodeId, params, offer, used: [], pendingRecharges: 0, gemOffer: null, gemOfferPrice: 0, battleAfter };
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
        reward: ability ? ability.description : o.reward,
        enabled: !ev.used.includes(i) && (o.available ? o.available(run.player) : true) && ev.pendingRecharges === 0 && !ev.gemOffer,
      };
    }),
  };
}

function applyEffect(run: RunState, e: Effect, c: Content) {
  const p = run.player;
  switch (e.type) {
    case 'gold': p.gold = Math.max(0, p.gold + e.amount); break;
    case 'damage': p.hp = Math.max(0, p.hp - e.amount); break;
    case 'healPctMax': heal(p, Math.floor(p.maxHp * e.pct)); break;
    case 'addAbility': {
      if (p.abilities.length >= p.maxAbilities) break;
      const id = e.id ?? eventsRng(run, (r) => r.pick(Object.keys(c.abilities)));
      p.abilities.push({ id, uses: c.abilities[id].maxUses });
      break;
    }
    case 'gem': p.gems.push(e.id ?? eventsRng(run, (r) => r.pick(Object.keys(c.gems) as GemId[]))); break;
    case 'gemOffer':
      run.event!.gemOffer = eventsRng(run, (r) => r.shuffle(Object.keys(c.gems) as GemId[]).slice(0, c.config.shopGemChoices));
      run.event!.gemOfferPrice = e.price;
      break;
    case 'spellUpgrade': p.spellUpgrades += e.count; break;
    case 'recharge': run.event!.pendingRecharges += e.count === 'perAbility' ? p.abilities.length : e.count; break;
    case 'addSpell': p.spells.push(newSpellInstance(p, c.spells[e.id])); break;
    case 'changeElement': {
      const s = p.spells.find((x) => x.element !== e.element);
      if (s) s.element = e.element as Element;
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
    return touch(run);
  }
  if (next === 'end') {
    // Wait for pending popups (recharge, gem offer) before closing.
    if (ev.pendingRecharges > 0 || ev.gemOffer) {
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
  if (battleTier) return openPrep(run, pickEncounter(run, battleTier, c), c.config.loadoutSlots[battleTier], 'event');
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

/** Pick one of the shop's gem offers (or null to cancel and keep the gold). */
export function pickGemOffer(prev: RunState, gem: GemId | null, c: Content): RunState {
  const run = clone(prev);
  const ev = run.event;
  if (!ev?.gemOffer) return prev;
  if (gem && ev.gemOffer.includes(gem) && run.player.gold >= ev.gemOfferPrice) {
    run.player.gold -= ev.gemOfferPrice;
    run.player.gems.push(gem);
  } else {
    // Cancelled: the single-use purchase option is given back.
    const idx = nodeOptions(ev).findIndex((o) => o.effects?.some((x) => x.type === 'gemOffer'));
    ev.used = ev.used.filter((i) => i !== idx);
  }
  ev.gemOffer = null;
  return touch(afterPopup(run, c));
}

function afterPopup(run: RunState, c: Content): RunState {
  const ev = run.event;
  if (ev && ev.params.closeAfterPopup && ev.pendingRecharges === 0 && !ev.gemOffer) return closeEvent(run, c);
  return run;
}

// ---------------------------------------------------------------- battles

function openPrep(run: RunState, encounterId: string, slots: number, source: PrepState['source']): RunState {
  run.prep = { encounterId, slots, source };
  run.screen = 'prep';
  return run;
}

export function startBattle(prev: RunState, loadout: string[], junk: SpellId[], c: Content): { run: RunState; events: TimedEvent[] } {
  const run = clone(prev);
  const prep = run.prep;
  if (!prep) throw new Error('No battle to start');
  if (loadout.length !== Math.min(prep.slots, run.player.spells.length)) throw new Error('Fill every loadout slot');
  if (new Set(loadout).size !== loadout.length) throw new Error('Duplicate loadout spell');
  if (junk.length > c.config.junkSlots || junk.some((j) => !run.player.junkPool.includes(j))) throw new Error('Invalid junk');
  run.battleCount += 1;
  const setup: BattleSetup = { player: run.player, encounter: c.encounters[prep.encounterId], loadout, junk, seed: forkSeed(run.seed, `battle:${run.battleCount}`) };
  const { state, events } = createBattle(setup, c);
  run.battle = state;
  run.screen = 'battle';
  return { run: touch(run), events };
}

/** Called by the UI once the battle's outcome has played. Applies rewards or the defeat. */
export function finishBattle(prev: RunState, c: Content): RunState {
  const run = clone(prev);
  const battle = run.battle;
  if (!battle?.outcome) return prev;
  const prep = run.prep!;
  // Carry HP and gold (Steal) back; statuses always clear after a battle; ability uses persist.
  run.player.hp = battle.player.hp;
  run.player.gold = battle.player.gold;
  run.player.abilities = battle.player.abilities;
  run.player.statuses = [];
  run.battle = null;
  if (battle.outcome === 'defeat') return touch(defeat(run));
  let gold = 0;
  for (const e of battle.enemies) {
    const [lo, hi] = c.enemies[e.defId].gold;
    gold += runRng(run, (r) => r.int(lo, hi + 1));
  }
  const dropChance = c.config.gemDrop[battle.tier];
  const gem = runRng(run, (r) => (r.next() < dropChance ? r.pick(Object.keys(c.gems) as GemId[]) : null));
  run.player.gold += gold;
  if (gem) run.player.gems.push(gem);
  run.result = { outcome: 'victory', gold, gem, boss: prep.source === 'boss' };
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
    run.endMessage = 'The Harbinger falls. Your journey is complete.';
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

// ---------------------------------------------------------------- spellbook

export function resolvedPlayerSpells(player: Player, c: Content): ResolvedSpell[] {
  return player.spells.map((s) => resolveInstance(s, c.spells[s.spellId], c.gems, c.assetExists));
}

export function atTown(run: RunState): boolean {
  return !run.travel && run.map.stops[run.currentStopId]?.type === 'town';
}

export function socketGem(prev: RunState, spellUid: string, socket: number, gemIndex: number, secondElement: Element | undefined, c: Content): RunState {
  const run = clone(prev);
  const p = run.player;
  const inst = p.spells.find((s) => s.uid === spellUid);
  const gem = p.gems[gemIndex];
  if (!inst || gem === undefined || socket < 0 || socket > 2 || inst.sockets[socket]) throw new Error('Cannot socket there');
  if (gem === 'sunstone') {
    if (!secondElement || secondElement === inst.element) throw new Error('Sunstone needs a different second element');
  }
  inst.sockets[socket] = gem === 'sunstone' ? { gem, secondElement } : { gem };
  p.gems.splice(gemIndex, 1);
  void c;
  return touch(run);
}

export function unsocketGem(prev: RunState, spellUid: string, socket: number, c: Content): RunState {
  if (!atTown(prev)) throw new Error('Unsocketing is only possible in a Town');
  const run = clone(prev);
  const p = run.player;
  const inst = p.spells.find((s) => s.uid === spellUid);
  const sock = inst?.sockets[socket];
  if (!inst || !sock) throw new Error('Nothing to unsocket');
  if (p.gold < c.config.prices.unsocket) throw new Error('Not enough gold');
  p.gold -= c.config.prices.unsocket;
  p.gems.push(sock.gem);
  inst.sockets[socket] = null;
  return touch(run);
}

export function upgradeSpell(prev: RunState, spellUid: string, c: Content): RunState {
  const run = clone(prev);
  const p = run.player;
  const inst = p.spells.find((s) => s.uid === spellUid);
  if (!inst || p.spellUpgrades <= 0 || inst.level >= c.config.maxSpellLevel) throw new Error('Cannot upgrade');
  inst.level = (inst.level + 1) as 1 | 2 | 3 | 4 | 5;
  p.spellUpgrades -= 1;
  return touch(run);
}

function touch(run: RunState): RunState {
  run.updatedAt = new Date().toISOString();
  return run;
}

// ---------------------------------------------------------------- debug

export function debugBattle(prev: RunState, encounterId: string, c: Content): RunState {
  const run = clone(prev);
  return touch(openPrep(run, encounterId, c.config.loadoutSlots[c.encounters[encounterId].tier], 'debug'));
}

export function debugEvent(prev: RunState, eventId: string, c: Content): RunState {
  return touch(openEvent(clone(prev), eventId, {}, c));
}
