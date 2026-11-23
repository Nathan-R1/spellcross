// The run (spec §2, §4, §9, §10): travel, road battles, events, rewards, toolbox, boss, defeat.

import { content } from '../../src/content';
import { events as eventNodes } from '../../src/content/events';
import { endTurn } from '../../src/engine/combat';
import * as run from '../../src/engine/run';
import type { RunState } from '../../src/engine/run';
import type { BattleState } from '../../src/engine/types';
import { neighbours, type RoadType } from '../../src/engine/world';
import { createRng } from '../../src/engine/rng';

const c = content;
const fresh = (seed = 11) => run.newRun(seed, c);
const pastTraveller = (seed = 11) => run.chooseOption(fresh(seed), 0, c);

function findRoad(r: RunState, type: RoadType) {
  return neighbours(r.map, r.currentStopId).find((n) => n.road.type === type);
}
/** Find a seed whose Start has a neighbour reachable by the given road type. */
function runWithRoad(type: RoadType): { r: RunState; to: number } {
  for (let seed = 1; seed < 400; seed++) {
    const r = pastTraveller(seed);
    const n = findRoad(r, type);
    if (n) return { r, to: n.stop.id };
  }
  throw new Error(`no seed with a ${type} from Start`);
}
const loadoutOf = (r: RunState) => r.player.tools.slice(0, 3).map((t) => t.uid);
/** Turn every enemy tile into Space and end the turn: the board has no enemy tiles, so it's won. */
function clearEnemies(b: BattleState): BattleState {
  const battle = structuredClone(b);
  battle.genPos = battle.genPos.map(() => 999);
  battle.board.cells = battle.board.cells.map((t) => (t?.kind === 'enemy' ? { ...t, kind: 'junk', id: 'space' } : t));
  return battle;
}
function winBattle(r: RunState): RunState {
  let { run: s } = run.startBattle(r, loadoutOf(r), c);
  s = { ...s, battle: endTurn(clearEnemies(s.battle!), c).state };
  expect(s.battle!.outcome).toBe('victory');
  return run.finishBattle(s, c);
}

describe('new run', () => {
  it('starts at Start with the Traveller offering 3 different abilities', () => {
    const r = fresh();
    expect(r.screen).toBe('event');
    expect(r.event!.nodeId).toBe('traveller');
    expect(new Set(r.event!.offer).size).toBe(3);
    expect(r.player.abilities).toEqual([]);
    expect(r.player.tools.map((s) => s.toolId)).toEqual(['fasting', 'prayer', 'thanksgiving', 'word', 'prophecy']);
    expect(r.player.hp).toBe(20);
    expect(r.map.stops[r.currentStopId].type).toBe('start');
  });

  it('is deterministic for a seed', () => {
    const a = fresh(5);
    const b = fresh(5);
    expect({ ...a, createdAt: '', updatedAt: '' }).toEqual({ ...b, createdAt: '', updatedAt: '' });
  });

  it('picking a Traveller ability adds it with full uses and returns to the map', () => {
    const r = fresh();
    const picked = r.event!.offer[0];
    const after = run.chooseOption(r, 0, c);
    expect(after.screen).toBe('map');
    expect(after.player.abilities).toEqual([{ id: picked, uses: 3 }]);
  });

  it('the map is 2 screens wide at a 1080 logical height', () => {
    const r = run.newRun(1, c, 2);
    expect(r.map.height).toBe(1080);
    expect(r.map.width).toBe(4320);
  });
});

describe('travel and road battles (D17)', () => {
  it('only connected stops can be travelled to', () => {
    const r = pastTraveller();
    const far = r.map.stops.find((s) => s.type === 'finish')!;
    expect(run.canTravelTo(r, far.id)).toBe(false);
    expect(() => run.travelTo(r, far.id, c)).toThrow();
  });

  it('Highways are safe', () => {
    const { r, to } = runWithRoad('highway');
    const t = run.travelTo(r, to, c);
    expect(t.travel!.battleAt).toBeNull();
  });

  it('Roads schedule a normal battle at 30–70%', () => {
    const { r, to } = runWithRoad('road');
    const t = run.travelTo(r, to, c);
    expect(t.travel!.battleAt).toBeGreaterThanOrEqual(0.3);
    expect(t.travel!.battleAt).toBeLessThanOrEqual(0.7);
    const b = run.triggerRoadBattle(t, c);
    expect(b.screen).toBe('prep');
    expect(c.enemies[b.prep!.enemyId].tier).toBe('normal');
  });

  it('Trails draw an elite enemy (any enemy until elites exist)', () => {
    // Trails can't leave Start, so look one step further.
    for (let seed = 1; seed < 300; seed++) {
      let r = pastTraveller(seed);
      const first = neighbours(r.map, r.currentStopId).find((n) => n.road.type === 'highway');
      if (!first) continue;
      r = run.arrive(run.travelTo(r, first.stop.id, c), c);
      if (r.screen === 'event') r = { ...r, screen: 'map', event: null };
      const trail = findRoad(r, 'trail');
      if (!trail) continue;
      const b = run.triggerRoadBattle(run.travelTo(r, trail.stop.id, c), c);
      expect(c.enemies[b.prep!.enemyId]).toBeDefined();
      return;
    }
    throw new Error('no trail found');
  });

  it('arriving opens the stop event; Finish starts the boss', () => {
    const { r, to } = runWithRoad('highway');
    const arrived = run.arrive(run.travelTo(r, to, c), c);
    const type = arrived.map.stops[to].type;
    if (type === 'encounter') expect(Object.keys(eventNodes)).toContain(arrived.event!.nodeId);
    else if (type === 'start' || type === 'finish') expect(true).toBe(true);
    else expect(arrived.event!.nodeId).toBe(type);
    const atFinish = { ...r, currentStopId: r.map.stops.find((s) => s.type === 'finish')!.id };
    const back = neighbours(r.map, atFinish.currentStopId)[0];
    const boss = run.arrive({ ...atFinish, currentStopId: back.stop.id, travel: { from: back.stop.id, to: atFinish.currentStopId, roadId: back.road.id, battleAt: null, battleDone: false } }, c);
    expect(boss.screen).toBe('prep');
    expect(boss.prep).toMatchObject({ source: 'boss' });
  });
});

describe('battles in the run', () => {
  const prep = () => run.triggerRoadBattle(run.travelTo(runWithRoad('road').r, runWithRoad('road').to, c), c);

  it('startBattle needs exactly 3 distinct owned tools', () => {
    const p = prep();
    const uids = p.player.tools.map((s) => s.uid);
    expect(() => run.startBattle(p, uids.slice(0, 2), c)).toThrow();
    expect(() => run.startBattle(p, [uids[0], uids[0], uids[1]], c)).toThrow();
    expect(() => run.startBattle(p, [uids[0], uids[1], 'nope'], c)).toThrow();
    const started = run.startBattle(p, [uids[4], uids[1], uids[2]], c).run;
    expect(started.screen).toBe('battle');
    expect(Object.keys(started.battle!.tools).sort()).toEqual([uids[1], uids[2], uids[4]].sort());
  });

  it("victory pays Talents from the enemy's range, may drop a fruit, keeps Courage", () => {
    const p = prep();
    const e = c.enemies[p.prep!.enemyId];
    const done = winBattle(p);
    expect(done.screen).toBe('result');
    expect(done.result!.gold).toBeGreaterThanOrEqual(e.talents[0]);
    expect(done.result!.gold).toBeLessThanOrEqual(e.talents[1]);
    expect(done.player.gold).toBe(done.result!.gold);
    expect(done.player.fruits.length).toBe(done.result!.fruit ? 1 : 0);
    const back = run.continueAfterResult(done);
    expect(back.screen).toBe('map');
    expect(back.travel!.battleDone).toBe(true);
  });

  it('defeat ends the run', () => {
    const p = prep();
    let { run: s } = run.startBattle(p, loadoutOf(p), c);
    const battle = structuredClone(s.battle!);
    battle.player.hp = 1;
    battle.board.cells[63] = { uid: 9999, kind: 'enemy', id: 'worry', hp: 1, maxHp: 1 };
    s = { ...s, battle: endTurn(battle, c).state };
    expect(s.battle!.outcome).toBe('defeat');
    const out = run.finishBattle(s, c);
    expect(out.screen).toBe('defeat');
    expect(out.battle).toBeNull();
  });

  it('beating the boss wins the run', () => {
    const r = { ...pastTraveller(), screen: 'prep' as const, prep: { enemyId: 'hard_choices', source: 'boss' as const } };
    const done = winBattle(r);
    expect(done.result!.boss).toBe(true);
    expect(run.continueAfterResult(done).screen).toBe('victory');
  });

  it('Courage and ability uses carry back to the run', () => {
    const p = { ...prep(), player: { ...prep().player, abilities: [{ id: 'stand_firm', uses: 3 }] } };
    let { run: s } = run.startBattle(p, loadoutOf(p), c);
    const battle = clearEnemies(s.battle!);
    battle.player.hp = 13;
    battle.player.abilities[0].uses = 1;
    s = { ...s, battle: endTurn(battle, c).state };
    const out = run.finishBattle(s, c);
    expect(out.player.hp).toBe(13);
    expect(out.player.abilities[0].uses).toBe(1);
  });
});

describe('events', () => {
  const at = (nodeId: string, gold = 0, mutate?: (r: RunState) => void) => {
    const r = run.debugEvent(pastTraveller(), nodeId, c);
    r.player.gold = gold;
    mutate?.(r);
    return r;
  };
  const optionIndex = (r: RunState, label: string) => run.eventView(r, c)!.options.findIndex((o) => o.label === label);

  it('unaffordable options are disabled (D6)', () => {
    const r = at('village', 50);
    expect(run.eventView(r, c)!.options[optionIndex(r, '[Purchase]')].enabled).toBe(false);
    expect(() => run.chooseOption(r, optionIndex(r, '[Purchase]'), c)).toThrow();
  });

  it('one heal per visit: free +20% at Campfires, Villages and Towns, or +50% for 50 Talents at Villages and Towns (D25)', () => {
    for (const stop of ['campfire', 'village', 'town']) {
      let r = at(stop, 0, (x) => (x.player.hp = 8));
      r = run.chooseOption(r, optionIndex(r, '[Patch up]'), c);
      expect(r.player.hp).toBe(12);
      const healer = optionIndex(r, '[Healer]');
      if (healer >= 0) expect(run.eventView(r, c)!.options[healer].enabled).toBe(false); // already healed
    }
    expect(optionIndex(at('campfire', 500), '[Healer]')).toBe(-1);
    expect(optionIndex(at('market', 500), '[Healer]')).toBe(-1);
    expect(optionIndex(at('market', 500), '[Patch up]')).toBe(-1);
    let r = at('town', 100, (x) => (x.player.hp = 8));
    r = run.chooseOption(r, optionIndex(r, '[Healer]'), c);
    expect(r.player.hp).toBe(18);
    expect(r.player.gold).toBe(50);
    expect(run.eventView(r, c)!.options[optionIndex(r, '[Patch up]')].enabled).toBe(false);
    const broke = at('village', 0);
    expect(run.eventView(broke, c)!.options[optionIndex(broke, '[Healer]')].enabled).toBe(false);
  });

  it('stop options are single-use per visit; Leave ends the event', () => {
    let r = at('village', 100, (x) => (x.player.hp = 8));
    r = run.chooseOption(r, optionIndex(r, '[Healer]'), c);
    expect(r.player.hp).toBe(18); // +50% of max
    expect(r.player.gold).toBe(50);
    expect(run.eventView(r, c)!.options[optionIndex(r, '[Healer]')].enabled).toBe(false);
    r = run.chooseOption(r, optionIndex(r, '[Leave]'), c);
    expect(r.screen).toBe('map');
  });

  it('buying a fruit offers 3; picking one costs 100; cancelling refunds the option', () => {
    let r = at('market', 250);
    r = run.chooseOption(r, optionIndex(r, '[Purchase]'), c);
    expect(r.event!.fruitOffer).toHaveLength(3);
    const cancelled = run.pickFruitOffer(r, null, c);
    expect(cancelled.player.gold).toBe(250);
    expect(run.eventView(cancelled, c)!.options[optionIndex(cancelled, '[Purchase]')].enabled).toBe(true);
    const fruit = r.event!.fruitOffer![1];
    const bought = run.pickFruitOffer(r, fruit, c);
    expect(bought.player.gold).toBe(150);
    expect(bought.player.fruits).toEqual([fruit]);
  });

  it('Villages, Towns and Markets sell a random ability for 200 Talents; only the Market sells Upgrades', () => {
    for (const stop of ['village', 'town', 'market']) {
      let r = at(stop, 200);
      r = run.chooseOption(r, optionIndex(r, '[Discipleship]'), c);
      expect(r.player.abilities).toHaveLength(2); // Traveller's pick + the new one
      expect(r.player.gold).toBe(0);
      expect(r.player.upgrades).toBe(0);
    }
    expect(optionIndex(at('town', 500), '[Study]')).toBe(-1);
    expect(optionIndex(at('village', 500), '[Study]')).toBe(-1);
    let m = at('market', 100);
    m = run.chooseOption(m, optionIndex(m, '[Study]'), c);
    expect(m.player.upgrades).toBe(1);
  });

  it('Rest gives 1 recharge per ability, assigned one at a time, capped at max uses', () => {
    let r = at('campfire', 0, (x) => (x.player.abilities = [{ id: 'stand_firm', uses: 0 }, { id: 'abstain', uses: 3 }]));
    r = run.chooseOption(r, optionIndex(r, '[Resting]'), c);
    expect(r.event!.pendingRecharges).toBe(2);
    r = run.assignRecharge(r, 0, c);
    r = run.assignRecharge(r, 0, c);
    expect(r.player.abilities[0].uses).toBe(2);
    expect(r.screen).toBe('event'); // the Campfire stays open: you can still Patch up, then Leave
    expect(run.eventView(r, c)!.options[optionIndex(r, '[Resting]')].enabled).toBe(false);
  });

  it('Gambler deducts the wager and rolls 50/50 when chosen (D5, D7)', () => {
    let wins = 0;
    for (let seed = 1; seed <= 60; seed++) {
      const r = run.debugEvent(run.chooseOption(fresh(seed), 0, c), 'gambler', c);
      r.player.gold = 60;
      const after = run.chooseOption(r, 0, c);
      expect(after.player.gold).toBe(10);
      if (after.event!.nodeId === 'gambler_win') wins++;
    }
    expect(wins).toBeGreaterThan(15);
    expect(wins).toBeLessThan(45);
  });

  it("Hermit's 'Take' gives a Love fruit (D5)", () => {
    let r = at('warlock');
    r = run.chooseOption(r, 1, c); // Harass
    r = run.chooseOption(r, 1, c); // Ask for Stuff
    r = run.chooseOption(r, 0, c); // Take
    expect(r.player.fruits).toEqual(['love']);
  });

  it('Peddler heals 50% of max Courage (D6)', () => {
    let r = at('salesman', 50, (x) => (x.player.hp = 4));
    r = run.chooseOption(r, optionIndex(r, '[Pay for Healing]'), c);
    expect(r.player.hp).toBe(14);
  });

  it('Mysterious Chest: success is guaranteed at attempt 10', () => {
    const r = run.debugEvent(pastTraveller(), 'chest', c);
    r.event!.params = { attempt: 10 };
    const after = run.chooseOption(r, 0, c);
    expect(after.player.hp).toBe(20 - 3); // costs scaled to 20 Courage
    expect(after.event!.nodeId).toBe('chest_success');
  });

  it('Tavern takes give 50, 40, 30, 20, 10 gold unless ambushed', () => {
    let r = at('tavern');
    r = run.chooseOption(r, 1, c); // Go Inside
    const golds: number[] = [];
    for (let i = 0; i < 5 && r.event?.nodeId === 'tavern_inside'; i++) {
      const before = r.player.gold;
      r = run.chooseOption(r, 0, c);
      golds.push(r.player.gold - before);
    }
    if (r.event?.nodeId !== 'tavern_ambush') expect(golds).toEqual([50, 40, 30, 20, 10]);
  });

  it('dying to an event option ends the run', () => {
    const r = at('shrine', 0, (x) => (x.player.hp = 1));
    const scorn = run.chooseOption(r, 1, c);
    expect(run.chooseOption(scorn, 0, c).screen).toBe('defeat');
  });

  it('the Mentor changes the pillar of the first tool not already that pillar', () => {
    let r = at('alchemist', 100);
    r = run.chooseOption(r, 1, c); // Pay to grow in Faith
    expect(r.player.tools[0].pillar).toBe('faith'); // Fasting (Discipline) changes
    expect(r.player.gold).toBe(0);
  });

  it('Fight for Loot: no tool yet (a dud), then a normal battle', () => {
    let r = at('fight_for_loot');
    const tools = r.player.tools.length;
    r = run.chooseOption(r, 1, c);
    expect(r.player.tools).toHaveLength(tools);
    expect(r.screen).toBe('prep');
  });

  it('Shrine Ignore ends the event', () => {
    expect(run.chooseOption(at('shrine'), 0, c).screen).toBe('map');
  });

  it('every event option leads somewhere that exists', () => {
    const check = (next: unknown) => {
      if (next === 'end' || next === 'stay') return;
      const n = next as { node?: string; pass?: unknown; fail?: unknown };
      if (n.node) expect(eventNodes[n.node]).toBeDefined();
      else { check(n.pass); check(n.fail); }
    };
    for (const node of Object.values(eventNodes)) {
      for (const params of [{}, { attempt: 3 }, { take: 2 }, { take: 5 }] as Record<string, number>[]) {
        for (const o of node.options(params, ['abstain', 'stand_firm', 'many_fish'])) check(o.next);
      }
    }
  });
});

describe('toolbox', () => {
  const withFruit = () => {
    const r = pastTraveller();
    r.player.fruits = ['peace', 'joy', 'love'];
    r.player.upgrades = 2;
    r.player.gold = 100;
    return r;
  };

  it('adding a fruit moves it from your fruit into the tool', () => {
    const r = run.socketFruit(withFruit(), 't3', 0, 0);
    expect(r.player.tools[2].sockets[0]).toBe('peace');
    expect(r.player.fruits).toEqual(['joy', 'love']);
  });

  it('cannot add into a full socket', () => {
    const r = run.socketFruit(withFruit(), 't3', 0, 0);
    expect(() => run.socketFruit(r, 't3', 0, 0)).toThrow();
  });

  it('upgrading raises the level, using an Upgrade', () => {
    let r = run.upgradeTool(run.upgradeTool(withFruit(), 't2', c), 't2', c);
    expect(r.player.tools[1].level).toBe(3);
    expect(() => (r = run.upgradeTool(r, 't2', c))).toThrow(); // no upgrades left
  });

  it('removing a fruit only works in a Town and costs 50', () => {
    const r = run.socketFruit(withFruit(), 't1', 0, 0);
    expect(() => run.unsocketFruit(r, 't1', 0, c)).toThrow();
    const town = r.map.stops.find((s) => s.type === 'town')!;
    const out = run.unsocketFruit({ ...r, currentStopId: town.id }, 't1', 0, c);
    expect(out.player.gold).toBe(50);
    expect(out.player.tools[0].sockets[0]).toBeNull();
    expect(out.player.fruits).toContain('peace');
  });
});

describe('review fixes (events)', () => {
  it('N6: the Chest caps at 100% (guaranteed from attempt 8)', () => {
    const opts = eventNodes.chest.options({ attempt: 8 }, []);
    expect(opts[0].reward).toBe('100% Relic');
  });
});

describe('gambler payout and rarity-weighted rolls', () => {
  it('Gamble Big pays 601 on a win, Small keeps 201', () => {
    const { insistGold } = { insistGold: (w: number) => eventNodes.gambler_win.options({ wager: w }, [])[0].effects![0] };
    expect(insistGold(50)).toEqual({ type: 'gold', amount: 201 });
    expect(insistGold(200)).toEqual({ type: 'gold', amount: 601 });
  });

  it('a Gamble Big win nets +401 gold after the wager', () => {
    for (let seed = 1; seed <= 40; seed++) {
      let r = run.debugEvent(run.chooseOption(fresh(seed), 0, c), 'gambler', c);
      r.player.gold = 200;
      r = run.chooseOption(r, 1, c);
      if (r.event!.nodeId !== 'gambler_win') continue;
      expect(run.chooseOption(r, 0, c).player.gold).toBe(601);
      return;
    }
    throw new Error('no win in 40 seeds');
  });

  it('fruit rolls follow drop weights: Love and Peace most common, Self-Control rarest', () => {
    const r = createRng(9);
    const ids = Object.keys(c.fruits) as (keyof typeof c.fruits)[];
    const counts: Record<string, number> = {};
    for (let i = 0; i < 20000; i++) { const g = r.weighted(ids, (x) => c.fruits[x].dropWeight); counts[g] = (counts[g] ?? 0) + 1; }
    const top = Object.entries(counts).sort((x, y) => y[1] - x[1]).slice(0, 2).map(([g]) => g).sort();
    expect(top).toEqual(['love', 'peace']);
    expect(counts.self_control).toBeLessThan(counts.joy);
    // Integration: the Gambler's junk really rolls a fruit.
    const won = run.chooseOption(run.debugEvent(pastTraveller(3), 'gambler_win', c), 1, c);
    expect(won.player.fruits).toHaveLength(1);
  });

  it('shop offers are 3 distinct fruit', () => {
    for (let seed = 1; seed <= 30; seed++) {
      let r = run.debugEvent(pastTraveller(seed), 'market', c);
      r.player.gold = 100;
      r = run.chooseOption(r, 1, c);
      expect(new Set(r.event!.fruitOffer).size).toBe(3);
    }
  });

  it('ability rolls follow rarity: rare Revival shows up less than uncommon Abstain', () => {
    const tally: Record<string, number> = {};
    for (let seed = 1; seed <= 300; seed++) for (const id of fresh(seed).event!.offer) tally[id] = (tally[id] ?? 0) + 1;
    expect(tally.revival).toBeLessThan(tally.abstain);
    expect(tally.abstain).toBeLessThan(tally.stand_firm);
  });
});

describe('remembered loadout', () => {
  it("preselects the last battle's tools, topping up from the list when needed", () => {
    const r = pastTraveller();
    expect(run.suggestedLoadout(r.player, r.lastLoadout, 3)).toEqual(['t1', 't2', 't3']); // first battle: first three tools
    const prepped = { ...r, screen: 'prep' as const, prep: { enemyId: 'hard_choices', source: 'debug' as const } };
    const { run: inBattle } = run.startBattle(prepped, ['t5', 't2', 't4'], c);
    expect(inBattle.lastLoadout).toEqual(['t5', 't2', 't4']);
    expect(run.suggestedLoadout(inBattle.player, inBattle.lastLoadout, 3)).toEqual(['t5', 't2', 't4']);
    // A tool no longer owned is dropped and the gap is filled in list order.
    const fewer = { ...inBattle.player, tools: inBattle.player.tools.filter((x) => x.uid !== 't5') };
    expect(run.suggestedLoadout(fewer, inBattle.lastLoadout, 3)).toEqual(['t2', 't4', 't1']);
  });
});

describe('Campfire Reflect', () => {
  const camp = (mutate?: (r: RunState) => void) => {
    const r = run.debugEvent(pastTraveller(), 'campfire', c);
    r.player.abilities = [{ id: 'stand_firm', uses: 1 }];
    r.player.hp = 10;
    mutate?.(r);
    return r;
  };
  const idx = (r: RunState, label: string) => run.eventView(r, c)!.options.findIndex((o) => o.label === label);

  it('levels up the chosen tool, and Patch up and Rest are then unavailable (either/or)', () => {
    let r = camp();
    r = run.chooseOption(r, idx(r, '[Reflect]'), c);
    expect(r.event!.levelUpPick).toBe(true);
    r = run.pickLevelUp(r, 't2', c);
    expect(r.player.tools[1].level).toBe(2);
    const view = run.eventView(r, c)!;
    expect(view.options[idx(r, '[Patch up]')].enabled).toBe(false);
    expect(view.options[idx(r, '[Resting]')].enabled).toBe(false);
    expect(view.options[idx(r, '[Reflect]')].enabled).toBe(false);
    expect(view.options[idx(r, '[Leave]')].enabled).toBe(true);
  });

  it('Patch up or Rest also rules out Reflect', () => {
    let r = camp();
    r = run.chooseOption(r, idx(r, '[Patch up]'), c);
    expect(run.eventView(r, c)!.options[idx(r, '[Reflect]')].enabled).toBe(false);
  });

  it('cancelling the pick gives all three choices back', () => {
    let r = camp();
    r = run.chooseOption(r, idx(r, '[Reflect]'), c);
    r = run.pickLevelUp(r, null, c);
    const view = run.eventView(r, c)!;
    for (const label of ['[Patch up]', '[Resting]', '[Reflect]']) expect(view.options[idx(r, label)].enabled).toBe(true);
    expect(r.player.tools.every((s) => s.level === 1)).toBe(true);
  });

  it('is disabled when every tool is level 5', () => {
    const r = camp((x) => x.player.tools.forEach((s) => (s.level = 5)));
    expect(run.eventView(r, c)!.options[idx(r, '[Reflect]')].enabled).toBe(false);
  });
});
