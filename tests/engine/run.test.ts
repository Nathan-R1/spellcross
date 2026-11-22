// The run (spec §2, §4, §9, §10): travel, road battles, events, rewards, spellbook, boss, defeat.

import { content } from '../../src/content';
import { events as eventNodes } from '../../src/content/events';
import { endTurn } from '../../src/engine/battle';
import * as run from '../../src/engine/run';
import type { RunState } from '../../src/engine/run';
import { neighbours, type RoadType } from '../../src/engine/world';
import { playBattle } from '../sim/bot';
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
function winBattle(r: RunState): RunState {
  const loadout = r.player.spells.slice(0, r.prep!.slots).map((s) => s.uid);
  let { run: s } = run.startBattle(r, loadout, [], c);
  const battle = structuredClone(s.battle!);
  for (const e of battle.enemies) e.hp = 1;
  battle.enemies.forEach((e) => (e.statuses = [{ id: 'poisoned', value: 5 }]));
  s = { ...s, battle: endTurn(battle, c).state };
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
    expect(r.player.spells.map((s) => s.spellId)).toEqual(['scorch', 'restore', 'strike', 'ice_bolt', 'venom', 'shield']);
    expect(r.player.hp).toBe(100);
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

  it('Roads schedule a normal battle at 30–70% with 3 slots', () => {
    const { r, to } = runWithRoad('road');
    const t = run.travelTo(r, to, c);
    expect(t.travel!.battleAt).toBeGreaterThanOrEqual(0.3);
    expect(t.travel!.battleAt).toBeLessThanOrEqual(0.7);
    const b = run.triggerRoadBattle(t, c);
    expect(b.screen).toBe('prep');
    expect(b.prep!.slots).toBe(3);
    expect(c.encounters[b.prep!.encounterId].tier).toBe('normal');
  });

  it('Trails draw an elite encounter, still with 3 slots', () => {
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
      expect(b.prep!.slots).toBe(3);
      expect(c.encounters[b.prep!.encounterId].tier).toBe('elite');
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
    expect(boss.prep).toMatchObject({ encounterId: 'boss', slots: 3, source: 'boss' });
  });
});

describe('battles in the run', () => {
  const prep = () => run.triggerRoadBattle(run.travelTo(runWithRoad('road').r, runWithRoad('road').to, c), c);

  it('startBattle validates the loadout and junk', () => {
    const p = prep();
    const uids = p.player.spells.map((s) => s.uid);
    expect(() => run.startBattle(p, uids.slice(0, 2), [], c)).toThrow();
    expect(() => run.startBattle(p, [uids[0], uids[0], uids[1]], [], c)).toThrow();
    expect(() => run.startBattle(p, uids.slice(0, 3), ['ash'], c)).toThrow();
    expect(() => run.startBattle(p, uids.slice(0, 3), ['orb', 'slime', 'orb'], c)).toThrow();
    expect(run.startBattle(p, uids.slice(0, 3), ['orb', 'slime'], c).run.screen).toBe('battle');
  });

  it('victory pays the sum of enemy gold rolls, may drop a gem, clears statuses, keeps HP', () => {
    const p = prep();
    const enc = c.encounters[p.prep!.encounterId];
    const done = winBattle(p);
    const lo = enc.enemies.reduce((a, id) => a + c.enemies[id].gold[0], 0);
    const hi = enc.enemies.reduce((a, id) => a + c.enemies[id].gold[1], 0);
    expect(done.screen).toBe('result');
    expect(done.result!.gold).toBeGreaterThanOrEqual(lo);
    expect(done.result!.gold).toBeLessThanOrEqual(hi);
    expect(done.player.gold).toBe(done.result!.gold);
    expect(done.player.statuses).toEqual([]);
    expect(done.player.gems.length).toBe(done.result!.gem ? 1 : 0);
    const back = run.continueAfterResult(done);
    expect(back.screen).toBe('map');
    expect(back.travel!.battleDone).toBe(true);
  });

  it('defeat ends the run', () => {
    const p = prep();
    let { run: s } = run.startBattle(p, p.player.spells.slice(0, 3).map((x) => x.uid), [], c);
    const battle = structuredClone(s.battle!);
    battle.player.hp = 1;
    s = { ...s, battle: endTurn(battle, c).state };
    const out = run.finishBattle(s, c);
    expect(out.screen).toBe('defeat');
    expect(out.battle).toBeNull();
  });

  it('beating the boss wins the run', () => {
    const r = { ...pastTraveller(), screen: 'prep' as const, prep: { encounterId: 'boss', slots: 3, source: 'boss' as const } };
    const done = winBattle(r);
    expect(done.result!.boss).toBe(true);
    expect(run.continueAfterResult(done).screen).toBe('victory');
  });

  it('a real (bot-played) road battle completes and returns to the run', () => {
    const p = prep();
    const { run: s } = run.startBattle(p, p.player.spells.slice(0, 3).map((x) => x.uid), ['orb'], c);
    const played = playBattle(s.battle!);
    const out = run.finishBattle({ ...s, battle: played.state }, c);
    expect(['result', 'defeat']).toContain(out.screen);
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

  it('one heal per visit: free +20% at Campfires, Villages and Towns, or +50% for 50gp at Villages and Towns (D25)', () => {
    for (const stop of ['campfire', 'village', 'town']) {
      let r = at(stop, 0, (x) => (x.player.hp = 40));
      r = run.chooseOption(r, optionIndex(r, '[Patch up]'), c);
      expect(r.player.hp).toBe(60);
      const healer = optionIndex(r, '[Healer]');
      if (healer >= 0) expect(run.eventView(r, c)!.options[healer].enabled).toBe(false); // already healed
    }
    expect(optionIndex(at('campfire', 500), '[Healer]')).toBe(-1);
    expect(optionIndex(at('market', 500), '[Healer]')).toBe(-1);
    expect(optionIndex(at('market', 500), '[Patch up]')).toBe(-1);
    let r = at('town', 100, (x) => (x.player.hp = 40));
    r = run.chooseOption(r, optionIndex(r, '[Healer]'), c);
    expect(r.player.hp).toBe(90);
    expect(r.player.gold).toBe(50);
    expect(run.eventView(r, c)!.options[optionIndex(r, '[Patch up]')].enabled).toBe(false);
    const broke = at('village', 0);
    expect(run.eventView(broke, c)!.options[optionIndex(broke, '[Healer]')].enabled).toBe(false);
  });

  it('stop options are single-use per visit; Leave ends the event', () => {
    let r = at('village', 100, (x) => (x.player.hp = 40));
    r = run.chooseOption(r, optionIndex(r, '[Healer]'), c);
    expect(r.player.hp).toBe(90); // +50% of max
    expect(r.player.gold).toBe(50);
    expect(run.eventView(r, c)!.options[optionIndex(r, '[Healer]')].enabled).toBe(false);
    r = run.chooseOption(r, optionIndex(r, '[Leave]'), c);
    expect(r.screen).toBe('map');
  });

  it('buying a gem offers 3; picking one costs 100; cancelling refunds the option', () => {
    let r = at('market', 250);
    r = run.chooseOption(r, optionIndex(r, '[Purchase]'), c);
    expect(r.event!.gemOffer).toHaveLength(3);
    const cancelled = run.pickGemOffer(r, null, c);
    expect(cancelled.player.gold).toBe(250);
    expect(run.eventView(cancelled, c)!.options[optionIndex(cancelled, '[Purchase]')].enabled).toBe(true);
    const gem = r.event!.gemOffer![1];
    const bought = run.pickGemOffer(r, gem, c);
    expect(bought.player.gold).toBe(150);
    expect(bought.player.gems).toEqual([gem]);
  });

  it('Train adds a Spell Upgrade for 100gp', () => {
    let r = at('town', 100);
    r = run.chooseOption(r, optionIndex(r, '[Train]'), c);
    expect(r.player.spellUpgrades).toBe(1);
    expect(r.player.gold).toBe(0);
  });

  it('Rest gives 1 recharge per ability, assigned one at a time, capped at max uses', () => {
    let r = at('campfire', 0, (x) => (x.player.abilities = [{ id: 'finisher', uses: 0 }, { id: 'low_blow', uses: 3 }]));
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

  it("Warlock's 'Take' gives a Weight gem (D5)", () => {
    let r = at('warlock');
    r = run.chooseOption(r, 1, c); // Harass
    r = run.chooseOption(r, 1, c); // Ask for Stuff
    r = run.chooseOption(r, 0, c); // Take
    expect(r.player.gems).toEqual(['weight']);
  });

  it('Salesman heals 50% of max HP (D6)', () => {
    let r = at('salesman', 50, (x) => (x.player.hp = 20));
    r = run.chooseOption(r, optionIndex(r, '[Pay for Healing]'), c);
    expect(r.player.hp).toBe(70);
  });

  it('Mysterious Chest: success is guaranteed at attempt 10', () => {
    const r = run.debugEvent(pastTraveller(), 'chest', c);
    r.event!.params = { attempt: 10 };
    const after = run.chooseOption(r, 0, c);
    expect(after.player.hp).toBe(100 - 13);
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
    const r = at('shrine', 0, (x) => (x.player.hp = 5));
    const scorn = run.chooseOption(r, 1, c);
    expect(run.chooseOption(scorn, 0, c).screen).toBe('defeat');
  });

  it('Alchemist changes the element of the first spell not already that element', () => {
    let r = at('alchemist', 100);
    r = run.chooseOption(r, 1, c); // Pay for Fire
    expect(r.player.spells[1].element).toBe('fire'); // Scorch is already fire; Restore changes
    expect(r.player.gold).toBe(0);
  });

  it('Fight for Loot grants Wind Wall, then a normal battle', () => {
    let r = at('fight_for_loot');
    r = run.chooseOption(r, 1, c);
    expect(r.player.spells.at(-1)!.spellId).toBe('wind_wall');
    expect(r.screen).toBe('prep');
    expect(r.prep!.slots).toBe(3);
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
        for (const o of node.options(params, ['finisher', 'sicken', 'low_blow'])) check(o.next);
      }
    }
  });
});

describe('spellbook (D16)', () => {
  const withGems = () => {
    const r = pastTraveller();
    r.player.gems = ['strikecut', 'sunstone', 'walled'];
    r.player.spellUpgrades = 2;
    r.player.gold = 100;
    return r;
  };

  it('socketing moves a gem from inventory into the spell', () => {
    const r = run.socketGem(withGems(), 's1', 0, 0, undefined, c);
    expect(r.player.spells[0].sockets[0]).toEqual({ gem: 'strikecut' });
    expect(r.player.gems).toEqual(['sunstone', 'walled']);
    expect(run.resolvedPlayerSpells(r.player, c)[0].damage).toBe(6);
  });

  it('cannot socket into a full socket; Sunstone needs a different element', () => {
    const r = run.socketGem(withGems(), 's1', 0, 0, undefined, c);
    expect(() => run.socketGem(r, 's1', 0, 1, 'water', c)).toThrow();
    expect(() => run.socketGem(r, 's1', 1, 0, 'fire', c)).toThrow();
    expect(run.socketGem(r, 's1', 1, 0, 'water', c).player.spells[0].sockets[1]).toEqual({ gem: 'sunstone', secondElement: 'water' });
  });

  it('upgrading raises the level (max 5) and gem values with it', () => {
    let r = run.socketGem(withGems(), 's3', 0, 0, undefined, c); // Strike + Strikecut
    r = run.upgradeSpell(run.upgradeSpell(r, 's3', c), 's3', c);
    expect(r.player.spells[2].level).toBe(3);
    expect(run.resolvedPlayerSpells(r.player, c)[2].damage).toBe(5);
    expect(() => run.upgradeSpell(r, 's3', c)).toThrow(); // no upgrades left
  });

  it('unsocketing only works in a Town and costs 50', () => {
    const r = run.socketGem(withGems(), 's1', 0, 0, undefined, c);
    expect(() => run.unsocketGem(r, 's1', 0, c)).toThrow();
    const town = r.map.stops.find((s) => s.type === 'town')!;
    const inTown = { ...r, currentStopId: town.id };
    const out = run.unsocketGem(inTown, 's1', 0, c);
    expect(out.player.gold).toBe(50);
    expect(out.player.spells[0].sockets[0]).toBeNull();
    expect(out.player.gems).toContain('strikecut');
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

  it('gem rolls follow drop weights: Weight and Cracked most common, Darkstone and Sunstone rarest', () => {
    const r = createRng(9);
    const ids = Object.keys(c.gems) as (keyof typeof c.gems)[];
    const counts: Record<string, number> = {};
    for (let i = 0; i < 20000; i++) { const g = r.weighted(ids, (x) => c.gems[x].dropWeight); counts[g] = (counts[g] ?? 0) + 1; }
    const top = Object.entries(counts).sort((x, y) => y[1] - x[1]).slice(0, 2).map(([g]) => g).sort();
    expect(top).toEqual(['cracked', 'weight']);
    expect(counts.sunstone).toBeLessThan(counts.strikecut / 2);
    expect(counts.darkstone).toBeLessThan(counts.chargestone);
    // Integration: the Gambler's junk really rolls a gem.
    const won = run.chooseOption(run.debugEvent(pastTraveller(3), 'gambler_win', c), 1, c);
    expect(won.player.gems).toHaveLength(1);
  });

  it('shop offers are 3 distinct gems', () => {
    for (let seed = 1; seed <= 30; seed++) {
      let r = run.debugEvent(pastTraveller(seed), 'market', c);
      r.player.gold = 100;
      r = run.chooseOption(r, 1, c);
      expect(new Set(r.event!.gemOffer).size).toBe(3);
    }
  });

  it('ability rolls favour commons (3:1 over uncommons)', () => {
    const tally = { common: 0, uncommon: 0 };
    for (let seed = 1; seed <= 300; seed++) for (const id of fresh(seed).event!.offer) tally[c.abilities[id].rarity as 'common' | 'uncommon']++;
    // 6 commons × 3 vs 4 uncommons × 1 → commons ≈ 82% of single draws; slightly less without replacement.
    expect(tally.common / (tally.common + tally.uncommon)).toBeGreaterThan(0.7);
  });
});

describe('first battle', () => {
  it('the first battle of a run is always a single enemy', () => {
    for (let seed = 1; seed <= 60; seed++) {
      const r = pastTraveller(seed);
      const n = neighbours(r.map, r.currentStopId).find((x) => x.road.type !== 'highway');
      if (!n) continue;
      const b = run.triggerRoadBattle(run.travelTo(r, n.stop.id, c), c);
      expect(c.encounters[b.prep!.encounterId].enemies).toHaveLength(1);
    }
  });

  it('later battles can be groups', () => {
    const sizes = new Set<number>();
    for (let seed = 1; seed <= 60; seed++) {
      const r = { ...pastTraveller(seed), battleCount: 1 };
      const n = neighbours(r.map, r.currentStopId).find((x) => x.road.type !== 'highway');
      if (!n) continue;
      const b = run.triggerRoadBattle(run.travelTo(r, n.stop.id, c), c);
      sizes.add(c.encounters[b.prep!.encounterId].enemies.length);
    }
    expect(Math.max(...sizes)).toBeGreaterThan(1);
  });
});

describe('remembered loadout', () => {
  it('preselects the last battle\'s spells, topping up from the list when needed', () => {
    const r = pastTraveller();
    expect(run.suggestedLoadout(r, 3)).toEqual(['s1', 's2', 's3']); // first battle: first three spells
    const prepped = { ...r, screen: 'prep' as const, prep: { encounterId: 'wolf', slots: 3, source: 'debug' as const } };
    const { run: inBattle } = run.startBattle(prepped, ['s5', 's2', 's6'], [], c);
    expect(inBattle.lastLoadout).toEqual(['s5', 's2', 's6']);
    expect(run.suggestedLoadout(inBattle, 3)).toEqual(['s5', 's2', 's6']);
    // A spell no longer owned is dropped and the gap is filled in list order.
    const fewer = { ...inBattle, player: { ...inBattle.player, spells: inBattle.player.spells.filter((x) => x.uid !== 's5') } };
    expect(run.suggestedLoadout(fewer, 3)).toEqual(['s2', 's6', 's1']);
  });
});

describe('Campfire Meditate', () => {
  const camp = (mutate?: (r: RunState) => void) => {
    const r = run.debugEvent(pastTraveller(), 'campfire', c);
    r.player.abilities = [{ id: 'finisher', uses: 1 }];
    r.player.hp = 50;
    mutate?.(r);
    return r;
  };
  const idx = (r: RunState, label: string) => run.eventView(r, c)!.options.findIndex((o) => o.label === label);

  it('levels up the chosen spell, and Patch up and Rest are then unavailable (either/or)', () => {
    let r = camp();
    r = run.chooseOption(r, idx(r, '[Meditate]'), c);
    expect(r.event!.levelUpPick).toBe(true);
    r = run.pickLevelUp(r, 's3', c);
    expect(r.player.spells[2].level).toBe(2);
    const view = run.eventView(r, c)!;
    expect(view.options[idx(r, '[Patch up]')].enabled).toBe(false);
    expect(view.options[idx(r, '[Resting]')].enabled).toBe(false);
    expect(view.options[idx(r, '[Meditate]')].enabled).toBe(false);
    expect(view.options[idx(r, '[Leave]')].enabled).toBe(true);
  });

  it('Patch up or Rest also rules out Meditate', () => {
    let r = camp();
    r = run.chooseOption(r, idx(r, '[Patch up]'), c);
    expect(run.eventView(r, c)!.options[idx(r, '[Meditate]')].enabled).toBe(false);
  });

  it('cancelling the pick gives all three choices back', () => {
    let r = camp();
    r = run.chooseOption(r, idx(r, '[Meditate]'), c);
    r = run.pickLevelUp(r, null, c);
    const view = run.eventView(r, c)!;
    for (const label of ['[Patch up]', '[Resting]', '[Meditate]']) expect(view.options[idx(r, label)].enabled).toBe(true);
    expect(r.player.spells.every((s) => s.level === 1)).toBe(true);
  });

  it('is disabled when every spell is level 5', () => {
    const r = camp((x) => x.player.spells.forEach((s) => (s.level = 5)));
    expect(run.eventView(r, c)!.options[idx(r, '[Meditate]')].enabled).toBe(false);
  });
});
