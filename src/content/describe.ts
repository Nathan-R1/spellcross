// Player-facing descriptions generated from the data, so the text always matches what things do.
// Every tile and ability is described by its triggers and effects (docs/tile-effects.md): one renderer per effect
// type, none per tile.

import { fruitSetEffects, isLocked } from '../engine/combat';
import type {
  AbilityDef, Amount, BattleState, CreateWhat, Effect, FruitId, Gainable, Placement, Player, Targets, Tile, TileKind, TileRef, TileStatus, ToolInstance, TriggerId,
} from '../engine/types';
import { TRIGGERS } from '../engine/types';
import { abilities } from './abilities';
import { FRUIT_IDS } from './fruits';
import { content } from './index';
import { STONE } from './tools';

export type { TileRef } from '../engine/types';

/** A status shown as its icon (opens the status popup). `value` is the amount it stands for, when there is one. */
export interface StatusRef { status: string; value?: number }

/** One line of text, tile icons and status icons (each icon opens its popup). */
export type AttrPart = string | TileRef | StatusRef;

export const isStatusRef = (p: AttrPart): p is StatusRef => typeof p !== 'string' && 'status' in p;

/** One display line: depth 0 is a trigger, 1 an effect, 2 an effect's sub-property. */
export interface AttrRow {
  depth: number;
  label?: string;
  parts: AttrPart[];
}

export const TRIGGER_LABEL: Record<TriggerId, string> = {
  setFormed: 'Set formed', eachStep: 'Each step', onActivate: 'On activate', atBottom: 'At bottom', onUse: 'On use',
};

const GAIN_LABEL: Record<Gainable, string> = { block: 'Block', critical: 'Critical', foresight: 'Foresight', moves: 'Moves', courage: 'Courage' };
const KIND_WORD: Record<TileKind, string> = { tool: 'tool', junk: 'junk', stone: 'Stone', enemy: 'enemy tile' };

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;
const amountText = (a: Amount) => (typeof a === 'number' ? String(a) : `${a.perSetTile} per tile in the set`);

/** A tile's name from its content id (junk, enemy tile or Stone). */
const tileName = (id: string) => content.junk[id]?.name ?? content.enemyTiles[id]?.name ?? (id === 'stone' ? STONE.name : id);

const statusLabel = (a: TileStatus, amount = 1) => (a === 'locked' ? 'Locked' : `+${amount} Strengthen`);

/** A tile status an Apply puts on: [Locked], or +2 [Strengthen]. */
export const applyParts = (a: TileStatus, amount = 1): AttrPart[] => (a === 'strengthen' ? [`+${amount} `, { status: 'strengthen' }] : [{ status: a }]);

/** Gains that are statuses show as their icon. */
const GAIN_STATUS: Partial<Record<Gainable, string>> = { block: 'block', critical: 'critical', foresight: 'foresight' };

/** "Choose shape (the set's shape)", "Choose anywhere (1 tile per tile in the set)", "every adjacent tool", "You". */
export function targetsText(t: Targets): string {
  switch (t.type) {
    case 'chooseAnywhere': {
      const what = t.filter ? t.filter.map((k) => KIND_WORD[k]).join(' or ') : 'tile';
      return `Choose anywhere (${typeof t.count === 'number' ? plural(t.count, what) : `${t.count.perSetTile} ${what} per tile in the set`})`;
    }
    case 'chooseShape': return t.shape === 'set' ? "Choose shape (the set's shape)" : `Choose shape (line of ${t.length}, horizontal or vertical)`;
    case 'below': return 'The tile below';
    case 'adjacent': {
      const what = t.ids ? t.ids.map(tileName).join(' or ') : t.filter.map((k) => KIND_WORD[k]).join(' or ');
      return `${t.pick === 'every' ? 'every' : `${t.pick} random`} adjacent ${what}`;
    }
    case 'you': return 'You';
  }
}

/** A tile id from a target filter as a TileRef, so it shows as its icon. */
const refOf = (id: string): TileRef => (content.junk[id] ? { kind: 'junk', id } : content.enemyTiles[id] ? { kind: 'enemy', id } : { kind: 'stone', id });

/**
 * Targets as text and tile icons: "Every adjacent [Space]" when it names tiles, else the same words as targetsText.
 * `capital` starts it with a capital letter (the Targets line of an Attack).
 */
export function targetsParts(t: Targets, capital = false): AttrPart[] {
  const cap = (x: string) => (capital ? x.charAt(0).toUpperCase() + x.slice(1) : x);
  if (t.type === 'adjacent' && t.ids) {
    const lead = `${t.pick === 'every' ? 'every' : `${t.pick} random`} adjacent `;
    return [cap(lead), ...t.ids.flatMap((id, i): AttrPart[] => (i ? [' or ', refOf(id)] : [refOf(id)]))];
  }
  return [cap(targetsText(t))];
}

/** The tile(s) a Create makes, as icons: one tile, or "random junk ([Time] or [Space])" from the junk in play. */
function createdParts(w: CreateWhat): AttrPart[] {
  if (w.kind !== 'randomJunk') return [w];
  const refs: TileRef[] = content.config.junk.map((id) => ({ kind: 'junk', id }));
  return ['random junk (', ...refs.flatMap((r, i): AttrPart[] => (i ? [' or ', r] : [r])), ')'];
}

/** Lines for one effect, at `depth`. `bonusDmg` is added to Attack damage (Faithfulness). */
export function effectRows(e: Effect, depth: number, bonusDmg = 0): AttrRow[] {
  switch (e.type) {
    case 'attack': {
      const rows: AttrRow[] = [
        { depth, parts: ['Attack'] },
        { depth: depth + 1, label: 'Targets', parts: targetsParts(e.targets, true) },
        { depth: depth + 1, label: 'Dmg', parts: [e.dmgPerTiles ? `${e.dmg}/${e.dmgPerTiles} tiles (rounded up)${bonusDmg ? ` +${bonusDmg}` : ''}` : String(e.dmg + bonusDmg)] },
      ];
      if (e.onDestroy) rows.push({ depth: depth + 1, label: 'On destroy', parts: ['Create ', e.onDestroy] });
      if (e.apply) rows.push({ depth: depth + 1, label: 'Apply', parts: applyParts(e.apply, e.applyAmount) });
      return rows;
    }
    case 'create':
      return [{ depth, parts: ['Create ', ...createdParts(e.what), ' on ', ...targetsParts(e.targets)] }];
    case 'gain': {
      // "Gain: [Block], 1/tile"; Moves and Courage aren't statuses, so they stay words.
      const status = GAIN_STATUS[e.what];
      const amount = typeof e.amount === 'number' ? String(e.amount) : `${e.amount.perSetTile}/tile`;
      const rest = `${amount}${e.oncePerTurn ? ', once per turn' : ''}${e.source ? ` (${e.source})` : ''}`;
      return [{ depth, label: 'Gain', parts: status ? [{ status }, `, ${rest}`] : [`${GAIN_LABEL[e.what]}, ${rest}`] }];
    }
    case 'clearsSelf':
      return [{ depth, parts: ['Clears self'] }];
    case 'removeSelf':
      return [{ depth, parts: ['Remove self'] }];
  }
}

/** Every trigger that has effects, in display order; triggers without effects are hidden. */
export function triggerRows(triggers: Partial<Record<TriggerId, Effect[]>>, bonusDmg = 0): AttrRow[] {
  const rows: AttrRow[] = [];
  for (const id of TRIGGERS) {
    const effects = triggers[id];
    if (!effects?.length) continue;
    rows.push({ depth: 0, label: TRIGGER_LABEL[id], parts: id === 'eachStep' ? ['moves in if the tile below breaks'] : [] });
    for (const e of effects) rows.push(...effectRows(e, 1, bonusDmg));
  }
  return rows;
}

/** A placement in progress, for the placing banner: Targets, Dmg, and On destroy when it creates a tile. */
export interface PlacementStats {
  targets: string;
  dmg: number;
  onDestroy: TileRef | null;
  apply: AttrPart[] | null;
}

export function placementStats(p: Placement, n: number): PlacementStats {
  const t = p.target;
  const targets = t.type === 'shape' ? `Choose shape (${n > 1 ? `${n} × ` : ''}${t.cells.length} tiles)`
    : t.type === 'line' ? `Choose shape (line of ${t.length})`
    : `Choose anywhere (${plural(n, t.filter ? t.filter.map((k) => KIND_WORD[k]).join(' or ') : 'tile')})`;
  return { targets, dmg: p.damage, onDestroy: p.onDestroy ?? null, apply: p.apply ? applyParts(p.apply, p.applyAmount) : null };
}

/** Where a tile popup is opened from, so tools show your own fruit and enemy tiles this fight's speed. */
export interface TileCtx {
  battle?: BattleState | null;
  player?: Player | null;
  /** A specific owned tool (toolbox, battle prep): its own fruit. */
  instance?: ToolInstance | null;
  enemyId?: string | null;
}

/** Everything a tile popup shows. */
export interface TileDescription {
  ref: TileRef;
  name: string;
  icon: string;
  /** A frame around the icon (tools with a glyph). */
  frame?: string;
  color: string;
  hp: number;
  maxHp: number;
  /** Steps down per enemy turn (this fight's speed for enemy tiles); 0 for anything that doesn't move. */
  speed: number;
  description: string;
  /** The trigger and effect lines. */
  attrs: AttrRow[];
  /** Tools: fruit on this instance, with counts. */
  fruits: [FruitId, number][];
}

/** The tile behind a board cell, as a TileRef (board tool tiles store the tool's uid). */
export function tileRef(t: Tile, battle?: BattleState | null): TileRef {
  if (t.kind === 'tool') return { kind: 'tool', id: battle?.tools[t.id]?.toolId ?? t.id, uid: t.id };
  return { kind: t.kind, id: t.id };
}

/** Fruit counts for a tool: the battle's instance, else the player's owned one, else none. */
function toolFruit(ref: TileRef, ctx: TileCtx): Record<FruitId, number> {
  const out = Object.fromEntries(FRUIT_IDS.map((f) => [f, 0])) as Record<FruitId, number>;
  const inBattle = ctx.battle ? (ref.uid && ctx.battle.tools[ref.uid]) || Object.values(ctx.battle.tools).find((t) => t.toolId === ref.id) : undefined;
  if (inBattle) return { ...out, ...inBattle.fruit };
  const owned = ctx.instance ?? ctx.player?.tools.find((t) => t.uid === ref.uid) ?? ctx.player?.tools.find((t) => t.toolId === ref.id);
  for (const f of owned?.sockets ?? []) if (f) out[f] += 1;
  return out;
}

/** A board tile's statuses as a line: "Status: [Locked] +2 [Strengthen]", or none. */
function statusRows(live: Tile | null | undefined, ctx: TileCtx): AttrRow[] {
  if (!live) return [];
  const parts: AttrPart[] = [];
  if (ctx.battle && isLocked(live, ctx.battle.round)) parts.push({ status: 'locked' });
  if (live.strength) parts.push(`${parts.length ? ' ' : ''}+${live.strength} `, { status: 'strengthen', value: live.strength });
  return parts.length ? [{ depth: 0, label: 'Status', parts }] : [];
}

/** Describe any tile. `live` is the actual tile on the board, for its current HP and statuses. */
export function describeTile(ref: TileRef, ctx: TileCtx = {}, live?: Tile | null): TileDescription {
  const d = describeTileDef(ref, ctx, live);
  return { ...d, attrs: [...statusRows(live, ctx), ...d.attrs] };
}

function describeTileDef(ref: TileRef, ctx: TileCtx, live?: Tile | null): TileDescription {
  const hp = (max: number) => ({ hp: live?.hp ?? max, maxHp: live?.maxHp ?? max });
  switch (ref.kind) {
    case 'tool': {
      const def = content.tools[ref.id];
      const fruit = toolFruit(ref, ctx);
      // The same Set formed list the engine runs: the tool's own effects, then its fruit's.
      const setFormed = [...(def?.triggers.setFormed ?? []), ...fruitSetEffects(fruit)];
      return {
        ref, name: def?.name ?? '?', icon: def?.icon ?? '', frame: def?.frame, color: def?.color ?? '#555', ...hp((def?.hp ?? 1) + fruit.gentleness), speed: def?.speed ?? 0,
        description: def?.description ?? '', attrs: triggerRows({ ...def?.triggers, setFormed }, fruit.faithfulness),
        fruits: (Object.entries(fruit) as [FruitId, number][]).filter(([, n]) => n > 0),
      };
    }
    case 'junk': {
      const j = content.junk[ref.id];
      return { ref, name: j?.name ?? ref.id, icon: j?.icon ?? '', color: j?.color ?? '#555', ...hp(j?.hp ?? 1), speed: j?.speed ?? 0, description: j?.description ?? '', attrs: j ? triggerRows(j.triggers) : [], fruits: [] };
    }
    case 'stone':
      return { ref, name: STONE.name, icon: STONE.icon, color: STONE.color, ...hp(STONE.hp), speed: STONE.speed, description: STONE.description, attrs: triggerRows(STONE.triggers), fruits: [] };
    case 'enemy': {
      const e = content.enemyTiles[ref.id];
      const speed = (ctx.enemyId ? content.enemies[ctx.enemyId]?.tileSpeed?.[ref.id] : undefined) ?? e.speed;
      return { ref, name: e.name, icon: e.icon, color: e.color, ...hp(e.hp), speed, description: e.description, attrs: triggerRows(e.triggers), fruits: [] };
    }
  }
}

export interface AbilityDescription {
  /** One short line for offers and buttons. */
  summary: string;
  /** The On use lines. */
  rows: AttrRow[];
  /** Rules that aren't effects (uses, refills). */
  lines: string[];
}

/** A short summary of one effect, for offers and buttons. */
function effectSummary(e: Effect): string {
  switch (e.type) {
    case 'attack': {
      const t = e.targets;
      const what = t.type === 'chooseShape' && t.shape === 'line' ? `${t.length} in a line` : t.type === 'chooseAnywhere' && typeof t.count === 'number' ? plural(t.count, 'tile') : targetsText(t);
      return e.apply && e.dmg === 0 ? `${statusLabel(e.apply, e.applyAmount)}: ${what}` : `${e.dmg} damage to ${what}`;
    }
    case 'gain': return `+${amountText(e.amount)} ${e.what === 'moves' ? 'moves' : GAIN_LABEL[e.what]}`;
    case 'create': return 'Create a tile';
    case 'clearsSelf': return 'Nothing';
    case 'removeSelf': return 'Leaves the board';
  }
}

export function describeAbility(def: AbilityDef): AbilityDescription {
  return {
    summary: def.onUse.map(effectSummary).join(', '),
    rows: triggerRows({ onUse: def.onUse }),
    lines: [`Uses: ${def.maxUses} per run, refilled by Resting at a stop or praying at the Fallen Shrine. Using it costs no move.`],
  };
}

export const abilitySummary = (id: string) => describeAbility(abilities[id]).summary;
