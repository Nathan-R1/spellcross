// Battle engine (spec §6, combat.md, doc 02). Every public function is pure: it clones the state,
// resolves the whole action to completion, and returns the new state plus an event list for the UI.

import type { Content } from '../content';
import {
  canSwap, clearTiles, collapse, createBoard, endTurnLocks, findSet, findSetsInColumns, groupForTrigger, idx,
  isAvailable, linkedNeighbours, swap, tileAt, visiblePositions, type SpellLookup,
} from './board';
import { createRng, type Rng } from './rng';
import { resolveInstance, resolveJunk } from './spells';
import {
  addStatus, applyHit, applyUnblockable, familyBonus, heal, onTurnEnd, onTurnStart, removeStatus, setStatus,
  statusValue, weakAdjust,
} from './status';
import type {
  BattleEvent, BattleResult, BattleState, EncounterDef, EnemyState, GenericIntent, Player, Pos, ResolvedIntent,
  ResolvedSpell, SpellId, Target, TimedEvent, ViewSnapshot,
} from './types';

// ---------------------------------------------------------------- setup

export interface BattleSetup {
  player: Player;
  encounter: EncounterDef;
  /** SpellInstance uids, in slot order. */
  loadout: string[];
  /** Junk SpellIds (≤ 2). */
  junk: SpellId[];
  seed: number;
}

export function buildPool(spells: Record<string, ResolvedSpell>, loadout: string[], duds: string[], novas: string[], c: Content) {
  const share = c.config.pool;
  const pool: { ref: string; weight: number }[] = [];
  const loadoutWeight = loadout.reduce((a, r) => a + spells[r].weight, 0);
  for (const r of loadout) pool.push({ ref: r, weight: (share.loadout * spells[r].weight) / loadoutWeight });
  for (const r of duds) pool.push({ ref: r, weight: share.duds / duds.length });
  for (const r of novas) pool.push({ ref: r, weight: share.novas / novas.length });
  return pool;
}

export function createBattle(setup: BattleSetup, c: Content): BattleResult {
  const rng = createRng(setup.seed);
  const player: Player = structuredClone(setup.player);
  const spells: Record<string, ResolvedSpell> = {};
  for (const uid of setup.loadout) {
    const inst = player.spells.find((s) => s.uid === uid);
    if (!inst) throw new Error(`Loadout spell ${uid} not owned`);
    spells[uid] = resolveInstance(inst, c.spells[inst.spellId], c.gems, c.assetExists);
  }
  const duds: string[] = ['ash', 'rubble', 'mist'];
  const novas: string[] = ['surge', 'critical'];
  for (const j of setup.junk) {
    const def = c.spells[j];
    if (!def) throw new Error(`Unknown junk ${j}`);
    if (def.spellClass === 'dud') duds.push(j);
    else novas.push(j);
  }
  for (const id of [...duds, ...novas]) spells[id] = resolveJunk(c.spells[id]);
  const pool = buildPool(spells, setup.loadout, duds, novas, c);
  const lookup: SpellLookup = (ref) => spells[ref];
  const board = createBoard(pool, lookup, rng, c.config.board);

  const enemies: EnemyState[] = setup.encounter.enemies.map((id, slot) => {
    const def = c.enemies[id];
    const cycle = c.enemyIntents[id];
    return {
      defId: id, name: def.name, slot, hp: def.hp, maxHp: def.hp, strengthStat: 1,
      weaknesses: def.weaknesses ?? [], resistances: def.resistances ?? [],
      statuses: (def.startingStatuses ?? []).map((s) => ({ ...s })),
      intentCursor: def.start === 'random' ? rng.int(0, cycle.length) : 0, alive: true, stolenGold: 0,
    };
  });

  const state: BattleState = {
    board, player, enemies, phase: 'player', movesLeft: player.movesPerTurn, extraMoveUsed: false,
    targetSlot: 0, round: 1, outcome: null, encounterId: setup.encounter.id, tier: setup.encounter.tier,
    spells, pool, rng: rng.state(),
  };
  const ctx = new Ctx(state, c);
  ctx.emit({ type: 'turnStart', round: 1 });
  return { state, events: ctx.events };
}

// ---------------------------------------------------------------- context helpers

class Ctx {
  events: TimedEvent[] = [];
  rng: Rng;
  constructor(public s: BattleState, public c: Content) {
    this.rng = createRng(s.rng);
  }
  lookup: SpellLookup = (ref) => this.s.spells[ref];
  emit(event: BattleEvent) {
    this.s.rng = this.rng.state();
    this.events.push({ event, after: snapshot(this.s) });
  }
  combatant(t: Target) {
    return t === 'player' ? this.s.player : this.s.enemies[t];
  }
  /** Enemies still in the fight (an enemy at 0 HP is out even before the death sweep flags it). */
  living() {
    return this.s.enemies.filter((e) => e.alive && e.hp > 0);
  }
}

export function snapshot(s: BattleState): ViewSnapshot {
  return {
    board: structuredClone(s.board),
    player: { hp: s.player.hp, maxHp: s.player.maxHp, statuses: s.player.statuses.map((x) => ({ ...x })), gold: s.player.gold },
    enemies: s.enemies.map((e) => ({ slot: e.slot, hp: e.hp, maxHp: e.maxHp, statuses: e.statuses.map((x) => ({ ...x })), alive: e.alive, intentCursor: e.intentCursor })),
    movesLeft: s.movesLeft,
    targetSlot: s.targetSlot,
    phase: s.phase,
  };
}

function begin(state: BattleState, c: Content): Ctx {
  return new Ctx(structuredClone(state), c);
}

function checkDeaths(ctx: Ctx) {
  for (const e of ctx.s.enemies) {
    if (e.alive && e.hp <= 0) {
      e.alive = false;
      e.statuses = [];
      ctx.emit({ type: 'defeated', target: e.slot });
      if (e.stolenGold > 0) {
        ctx.s.player.gold += e.stolenGold;
        ctx.emit({ type: 'goldReturned', slot: e.slot, amount: e.stolenGold });
        e.stolenGold = 0;
      }
    }
  }
  if (!ctx.s.enemies[ctx.s.targetSlot]?.alive) {
    const next = ctx.living()[0];
    if (next && next.slot !== ctx.s.targetSlot) {
      ctx.s.targetSlot = next.slot;
      ctx.emit({ type: 'targetChanged', slot: next.slot });
    }
  }
}

/** Ends the battle if someone has won. Returns true when the battle is over. */
function checkOutcome(ctx: Ctx): boolean {
  if (ctx.s.outcome) return true;
  // Victory beats a simultaneous player death (spec §6.3).
  if (ctx.living().length === 0) {
    ctx.s.outcome = 'victory';
  } else if (ctx.s.player.hp <= 0) {
    ctx.s.outcome = 'defeat';
  } else return false;
  ctx.s.phase = 'over';
  ctx.emit({ type: 'battleEnd', outcome: ctx.s.outcome });
  return true;
}

// ---------------------------------------------------------------- casting

function elementMod(spell: ResolvedSpell, target: EnemyState) {
  if (spell.elements.some((e) => target.weaknesses.includes(e))) return 2;
  if (spell.elements.some((e) => target.resistances.includes(e))) return 0.5;
  return 1;
}

function castSpell(ctx: Ctx, ref: string, power: number) {
  const s = ctx.s;
  const spell = s.spells[ref];
  const player = s.player;
  const defs = ctx.c.statuses;

  // Chaos: this cast's Chaos becomes damage, Block or healing.
  let chaos: 'damage' | 'block' | 'healing' | undefined;
  let damage = spell.damage;
  let healing = spell.healing;
  let chaosBlock = 0;
  if (spell.chaos > 0) {
    chaos = ctx.rng.pick(['damage', 'block', 'healing'] as const);
    if (chaos === 'damage') damage += spell.chaos;
    else if (chaos === 'healing') healing += spell.chaos;
    else chaosBlock = spell.chaos;
  }

  // onSpellActivated: Critical multiplier (consumed), Fortify gains Block.
  const critical = statusValue(player, 'critical') > 0;
  const mult = player.strengthStat * (critical ? 1.5 : 1);
  if (critical) removeStatus(player, 'critical');
  const fortify = familyBonus(player, defs, 'fortify', spell.elements);
  if (fortify > 0) addStatus(player, 'block', fortify * power);

  // Targets.
  let targets: EnemyState[] = [];
  const living = ctx.living();
  if (spell.target === 'single') targets = living.filter((e) => e.slot === s.targetSlot).slice(0, 1);
  else if (spell.target === 'all') targets = living;
  else if (spell.target === 'random' && living.length > 0) targets = [ctx.rng.pick(living)];
  if (spell.target === 'single' && targets.length === 0 && living.length > 0) targets = [living[0]];

  const hits: { target: Target; damage: number; blocked: number }[] = [];
  if (damage > 0) {
    const bonus = statusValue(player, 'strength') + familyBonus(player, defs, 'charge', spell.elements);
    for (const t of targets) {
      const perTile = Math.max(0, damage * mult * elementMod(spell, t) + bonus);
      const total = weakAdjust(player, Math.floor(perTile * power));
      const out = applyHit(t, total);
      hits.push({ target: t.slot, damage: out.dealt, blocked: out.blocked });
    }
  }

  const healed = healing > 0 ? heal(player, Math.floor(healing * mult * power)) : 0;
  if (chaosBlock > 0) addStatus(player, 'block', chaosBlock * power);

  for (const st of spell.statuses) {
    const value = st.perTile ? st.value * power : st.value;
    if (st.self) addStatus(player, st.status, value);
    else for (const t of targets.filter((e) => e.hp > 0)) addStatus(t, st.status, value);
  }

  ctx.emit({ type: 'cast', ref, power, chaos, hits, healing: healed });

  // If this cast killed the last enemy the battle is over: its self-damage and extra move don't apply.
  if (ctx.living().length === 0) {
    checkDeaths(ctx);
    return;
  }
  if (spell.selfDamage > 0) {
    const dealt = applyUnblockable(player, spell.selfDamage);
    ctx.emit({ type: 'damage', target: 'player', amount: dealt, blocked: 0, source: 'self' });
  }
  if (spell.extraMove && !s.extraMoveUsed) {
    s.extraMoveUsed = true;
    s.movesLeft += 1;
    ctx.emit({ type: 'extraMove' });
  }
  checkDeaths(ctx);
}

// ---------------------------------------------------------------- player actions

export class BattleError extends Error {}

/** Swap two tiles and resolve the whole cascade (doc 02 "Move resolution"). Ends the turn at 0 moves. */
export function playerMove(state: BattleState, a: Pos, b: Pos, c: Content): BattleResult {
  if (state.phase !== 'player') throw new BattleError('Not the player turn');
  if (state.movesLeft <= 0) throw new BattleError('No moves left');
  if (!canSwap(state.board, a, b)) throw new BattleError('Illegal swap');
  const ctx = begin(state, c);
  const s = ctx.s;
  s.movesLeft -= 1;
  swap(s.board, a, b);
  ctx.emit({ type: 'swapped', a, b });

  let matched = [...findSet(s.board, ctx.lookup, a.x, a.y), ...findSet(s.board, ctx.lookup, b.x, b.y)];
  matched = dedupe(s.board, matched);
  let step = 0;
  while (matched.length > 0) {
    const linked = linkedNeighbours(s.board, ctx.lookup, matched);
    const all = [...matched, ...linked];
    ctx.emit({ type: 'matched', step, uids: all.map((p) => tileAt(s.board, p.x, p.y).uid) });
    if (!s.outcome) {
      const groups = groupForTrigger(s.board, ctx.lookup, (r) => s.spells[r]?.linkBehaviour, matched, linked);
      for (const g of groups) {
        if (s.player.hp <= 0 || ctx.living().length === 0) break;
        castSpell(ctx, g.ref, g.tiles.length);
      }
      // The battle ends mid-cascade the moment someone wins; the board still settles.
      if (s.player.hp <= 0 || ctx.living().length === 0) checkOutcome(ctx);
    }
    const uids = clearTiles(s.board, all);
    ctx.emit({ type: 'cleared', uids });
    const columns = collapse(s.board, s.pool, ctx.rng);
    ctx.emit({ type: 'collapsed' });
    matched = findSetsInColumns(s.board, ctx.lookup, columns);
    step++;
    if (step > 50) break; // safety; cascades this long are practically impossible
  }

  if (!checkOutcome(ctx) && s.movesLeft <= 0) endPlayerTurnInPlace(ctx);
  return { state: s, events: ctx.events };
}

function dedupe(b: BattleState['board'], ps: Pos[]): Pos[] {
  const m = new Map<number, Pos>();
  for (const p of ps) m.set(idx(b, p.x, p.y), p);
  return [...m.values()];
}

export function setTarget(state: BattleState, slot: number): BattleState {
  if (!state.enemies[slot]?.alive) return state;
  return { ...state, targetSlot: slot };
}

export function useAbility(state: BattleState, index: number, c: Content): BattleResult {
  if (state.phase !== 'player') throw new BattleError('Not the player turn');
  const ability = state.player.abilities[index];
  if (!ability || ability.uses <= 0) throw new BattleError('Ability unavailable');
  const def = c.abilities[ability.id];
  const ctx = begin(state, c);
  const s = ctx.s;
  s.player.abilities[index].uses -= 1;
  const target = s.enemies[s.targetSlot]?.alive ? s.enemies[s.targetSlot] : ctx.living()[0];
  ctx.emit({ type: 'ability', id: def.id });
  if (def.damage && target) {
    const mod = def.damageElement && target.weaknesses.includes(def.damageElement) ? 2 : def.damageElement && target.resistances.includes(def.damageElement) ? 0.5 : 1;
    const out = applyHit(target, Math.floor(def.damage * s.player.strengthStat * mod));
    ctx.emit({ type: 'damage', target: target.slot, amount: out.dealt, blocked: out.blocked, source: 'ability' });
  }
  for (const st of def.statuses) {
    if (st.self) addStatus(s.player, st.status, st.value);
    else if (target) addStatus(target, st.status, st.value);
    ctx.emit({ type: 'status', target: st.self ? 'player' : (target?.slot ?? 'player'), status: st.status, value: st.value });
  }
  for (const effect of def.effects) {
    if (effect.type === 'triplePoison' && target) {
      const p = statusValue(target, 'poisoned');
      if (p > 0) setStatus(target, 'poisoned', p * 3);
    }
  }
  checkDeaths(ctx);
  checkOutcome(ctx);
  return { state: s, events: ctx.events };
}

export function endTurn(state: BattleState, c: Content): BattleResult {
  if (state.phase !== 'player') throw new BattleError('Not the player turn');
  const ctx = begin(state, c);
  endPlayerTurnInPlace(ctx);
  return { state: ctx.s, events: ctx.events };
}

// ---------------------------------------------------------------- enemy phase

function endPlayerTurnInPlace(ctx: Ctx) {
  const s = ctx.s;
  onTurnEnd(s.player);
  endTurnLocks(s.board);
  s.phase = 'enemies';

  for (const enemy of s.enemies) {
    if (!enemy.alive) continue;
    const poison = onTurnStart(enemy);
    if (poison > 0) ctx.emit({ type: 'damage', target: enemy.slot, amount: poison, blocked: 0, source: 'poison' });
    checkDeaths(ctx);
    if (checkOutcome(ctx)) return;
    if (!enemy.alive) continue;
    const cycle = ctx.c.enemyIntents[enemy.defId];
    const intent = cycle[enemy.intentCursor % cycle.length];
    ctx.emit({ type: 'enemyTurn', slot: enemy.slot, intent: intent.name });
    for (const part of intent.parts) {
      resolvePart(ctx, enemy, part);
      if (s.player.hp <= 0) break;
    }
    enemy.intentCursor = (enemy.intentCursor + 1) % cycle.length;
    onTurnEnd(enemy);
    checkDeaths(ctx);
    if (checkOutcome(ctx)) return;
  }

  // Round start (no round-start statuses in v1), then the player's turn.
  s.round += 1;
  s.phase = 'player';
  s.movesLeft = s.player.movesPerTurn;
  s.extraMoveUsed = false;
  const poison = onTurnStart(s.player);
  if (poison > 0) ctx.emit({ type: 'damage', target: 'player', amount: poison, blocked: 0, source: 'poison' });
  if (checkOutcome(ctx)) return;
  ctx.emit({ type: 'turnStart', round: s.round });
}

function lowestAlly(ctx: Ctx): EnemyState {
  return [...ctx.living()].sort((a, b) => a.hp / a.maxHp - b.hp / b.maxHp || a.slot - b.slot)[0];
}

function resolvePart(ctx: Ctx, enemy: EnemyState, part: GenericIntent) {
  const s = ctx.s;
  switch (part.type) {
    case 'attack': {
      const amount = weakAdjust(enemy, part.amount + statusValue(enemy, 'strength'));
      const out = applyHit(s.player, amount);
      ctx.emit({ type: 'damage', target: 'player', amount: out.dealt, blocked: out.blocked, source: 'intent' });
      break;
    }
    case 'defend':
      addStatus(enemy, 'block', part.amount);
      ctx.emit({ type: 'status', target: enemy.slot, status: 'block', value: part.amount });
      break;
    case 'defendAllies':
      for (const e of ctx.living()) {
        addStatus(e, 'block', part.amount);
        ctx.emit({ type: 'status', target: e.slot, status: 'block', value: part.amount });
      }
      break;
    case 'heal':
      ctx.emit({ type: 'healed', target: enemy.slot, amount: heal(enemy, part.amount) });
      break;
    case 'healAlly': {
      const ally = lowestAlly(ctx);
      ctx.emit({ type: 'healed', target: ally.slot, amount: heal(ally, part.amount) });
      break;
    }
    case 'healAllies':
      for (const e of ctx.living()) ctx.emit({ type: 'healed', target: e.slot, amount: heal(e, part.amount) });
      break;
    case 'buff':
      addStatus(enemy, part.status, part.value);
      ctx.emit({ type: 'status', target: enemy.slot, status: part.status, value: part.value });
      break;
    case 'buffAllies':
      for (const e of ctx.living()) {
        addStatus(e, part.status, part.value);
        ctx.emit({ type: 'status', target: e.slot, status: part.status, value: part.value });
      }
      break;
    case 'debuff':
      addStatus(s.player, part.status, part.value);
      ctx.emit({ type: 'status', target: 'player', status: part.status, value: part.value });
      break;
    case 'steal': {
      const amount = Math.min(s.player.gold, part.amount);
      s.player.gold -= amount;
      enemy.stolenGold += amount;
      ctx.emit({ type: 'goldStolen', slot: enemy.slot, amount });
      break;
    }
    case 'lock': {
      const free = visiblePositions(s.board).filter((p) => isAvailable(s.board, p.x, p.y) && tileAt(s.board, p.x, p.y).lock === 'free');
      const picks = ctx.rng.shuffle(free).slice(0, part.count);
      for (const p of picks) tileAt(s.board, p.x, p.y).lock = 'locked';
      ctx.emit({ type: 'tilesLocked', uids: picks.map((p) => tileAt(s.board, p.x, p.y).uid) });
      break;
    }
    case 'addTiles': {
      if (!s.spells[part.spell]) s.spells[part.spell] = resolveJunk(ctx.c.spells[part.spell]);
      // Never touches locked tiles (so it can't undo a web), and keeps pending locks. Replacements are
      // junk (validated), so they can't form sets.
      const open = visiblePositions(s.board).filter((p) => tileAt(s.board, p.x, p.y).lock !== 'locked');
      const picks = ctx.rng.shuffle(open).slice(0, part.count);
      for (const p of picks) tileAt(s.board, p.x, p.y).spell = part.spell;
      ctx.emit({ type: 'tilesReplaced', uids: picks.map((p) => tileAt(s.board, p.x, p.y).uid), spell: part.spell });
      break;
    }
  }
}

// ---------------------------------------------------------------- previews

export interface IntentPreviewPart {
  kind: 'attack' | 'defend' | 'heal' | 'buff' | 'debuff' | 'steal' | 'board';
  amount: number;
  label: string;
  hits?: number;
}

/** Current intent with numbers after the enemy's own Strength and Weak (not the player's Block). */
export function previewIntent(state: BattleState, slot: number, c: Content): { intent: ResolvedIntent; parts: IntentPreviewPart[] } | null {
  const enemy = state.enemies[slot];
  if (!enemy?.alive) return null;
  const cycle = c.enemyIntents[enemy.defId];
  const intent = cycle[enemy.intentCursor % cycle.length];
  return { intent, parts: previewParts(intent.parts, enemy, pendingAllyStrength(state.enemies, slot, c)) };
}

/**
 * Strength an enemy will have gained from allies acting before it this enemy phase (they act left to
 * right), e.g. the Harbinger's Rally before the Bear's Maul. Keeps the badge truthful (spec §6.7).
 */
export function pendingAllyStrength(enemies: Pick<EnemyState, 'slot' | 'alive' | 'defId' | 'intentCursor'>[], slot: number, c: Content): number {
  let total = 0;
  for (const e of enemies) {
    if (e.slot >= slot || !e.alive) continue;
    const cycle = c.enemyIntents[e.defId];
    for (const p of cycle[e.intentCursor % cycle.length].parts) if (p.type === 'buffAllies' && p.status === 'strength') total += p.value;
  }
  return total;
}

export function previewParts(parts: GenericIntent[], enemy: Pick<EnemyState, 'statuses'>, allyStrength = 0): IntentPreviewPart[] {
  const out: IntentPreviewPart[] = [];
  let strength = statusValue(enemy as EnemyState, 'strength') + allyStrength;
  for (const p of parts) {
    switch (p.type) {
      case 'attack': {
        const amount = weakAdjust(enemy as EnemyState, p.amount + strength);
        const last = out[out.length - 1];
        if (last && last.kind === 'attack' && last.amount === amount) last.hits = (last.hits ?? 1) + 1;
        else out.push({ kind: 'attack', amount, label: `${amount}` });
        break;
      }
      case 'defend': case 'defendAllies': out.push({ kind: 'defend', amount: p.amount, label: `${p.amount}${p.type === 'defendAllies' ? ' all' : ''}` }); break;
      case 'heal': case 'healAlly': case 'healAllies': out.push({ kind: 'heal', amount: p.amount, label: `${p.amount}${p.type === 'healAllies' ? ' all' : p.type === 'healAlly' ? ' ally' : ''}` }); break;
      case 'buff': case 'buffAllies':
        if (p.status === 'strength') strength += p.value; // buffAllies includes itself
        out.push({ kind: 'buff', amount: p.value, label: '' });
        break;
      case 'debuff': out.push({ kind: 'debuff', amount: p.value, label: '' }); break;
      case 'steal': out.push({ kind: 'steal', amount: p.amount, label: `${p.amount}` }); break;
      case 'lock': out.push({ kind: 'board', amount: p.count, label: `${p.count}` }); break;
      case 'addTiles': out.push({ kind: 'board', amount: p.count, label: `${p.count}` }); break;
    }
  }
  for (const o of out) if (o.kind === 'attack' && o.hits) o.label = `${o.amount}×${o.hits}`;
  return out;
}

export function livingEnemies(state: BattleState) {
  return state.enemies.filter((e) => e.alive);
}
