// Core engine types (doc 02, spec.md). Everything here is plain serialisable data.

import type { RngState } from './rng';

export type Element = 'fire' | 'lightning' | 'water' | 'earth' | 'air' | 'acid';
export const ELEMENTS: readonly Element[] = ['fire', 'lightning', 'water', 'earth', 'air', 'acid'];

export type SpellId = string;
export type StatusId = string;
export type AbilityId = string;
export type GemId =
  | 'strikecut' | 'lifelink' | 'walled' | 'toxicut' | 'cracked' | 'weight'
  | 'chargestone' | 'stormstone' | 'darkstone' | 'sunstone';
export type EnemyId = string;
export type EncounterId = string;
/** A SpellInstance uid (player spells) or a SpellId (dud/nova tiles). */
export type SpellRef = string;

// ---------------------------------------------------------------- content definitions

export type SpellClass = 'player' | 'enemy' | 'dud' | 'nova' | 'both';
export type SpellTarget = 'single' | 'all' | 'random' | 'self';

export interface SpellStatus {
  status: StatusId;
  value: number;
  self: boolean;
  /** Spellford `multipliedByTiles`: applied at value × tiles, else flat value. */
  perTile: boolean;
}

export interface SpellDef {
  id: SpellId;
  name: string;
  description: string;
  /** Fixed icon (dud/nova/enemy). Player spells derive theirs from stats. */
  icon?: string;
  element: Element;
  damage: number;
  healing: number;
  weight: number;
  spellClass: SpellClass;
  linked: boolean;
  linkBehaviour?: 'mimicNeighbour';
  target: SpellTarget;
  statuses: SpellStatus[];
  color: string;
  upgradable: boolean;
}

export type StatusFamily =
  | 'critical' | 'strength' | 'weak' | 'charge' | 'fortify' | 'block' | 'permaBlock' | 'poisoned';

export interface StatusDef {
  id: StatusId;
  name: string;
  description: string;
  icon: string;
  family: StatusFamily;
  /** Element-scoped Charge / Fortify. */
  element?: Element;
}

export interface StatusInstance {
  id: StatusId;
  value: number;
}

export type Rarity = 'common' | 'uncommon' | 'rare' | 'legendary';

export interface AbilityDef {
  id: AbilityId;
  name: string;
  description: string;
  rarity: Rarity;
  icon: string;
  maxUses: number;
  damage?: number;
  damageElement?: Element;
  statuses: { status: StatusId; value: number; self: boolean }[];
  effects: { type: 'triplePoison' }[];
}

export interface AbilityInstance {
  id: AbilityId;
  uses: number;
}

export interface GemDef {
  id: GemId;
  name: string;
  /** "Lvl" column of the design list. Reference only (G11). */
  tier: 1 | 2 | 3;
  description: string;
  /** Value by spell level 1–5. */
  values?: [number, number, number, number, number];
  color: string;
}

// ---------------------------------------------------------------- intents & enemies

export type GenericIntent =
  | { type: 'attack'; amount: number }
  | { type: 'defend' | 'defendAllies'; amount: number }
  | { type: 'heal' | 'healAlly' | 'healAllies'; amount: number }
  | { type: 'buff' | 'buffAllies' | 'debuff'; status: StatusId; value: number }
  | { type: 'steal'; amount: number }
  | { type: 'lock'; count: number }
  | { type: 'addTiles'; spell: SpellId; count: number };

export type IntentRef = string | GenericIntent;

export interface NamedIntentDef {
  id: string;
  name: string;
  icon?: string;
  description: string;
  do: IntentRef[];
}

/** A named or generic intent, flattened to generic parts at content load. */
export interface ResolvedIntent {
  name: string;
  description: string;
  parts: GenericIntent[];
}

export type Tier = 'normal' | 'elite' | 'boss';

export interface EnemyDef {
  id: EnemyId;
  name: string;
  tier: Tier;
  hp: number;
  portrait?: string;
  start?: 'first' | 'random';
  gold: [number, number];
  intents: IntentRef[];
  weaknesses?: Element[];
  resistances?: Element[];
  startingStatuses?: StatusInstance[];
}

export interface EncounterDef {
  id: EncounterId;
  tier: Tier;
  enemies: EnemyId[];
}

// ---------------------------------------------------------------- player state

export interface GemSocket {
  gem: GemId;
  secondElement?: Element;
}

export interface SpellInstance {
  uid: string;
  spellId: SpellId;
  element: Element;
  level: 1 | 2 | 3 | 4 | 5;
  sockets: [GemSocket | null, GemSocket | null, GemSocket | null];
}

export interface Combatant {
  hp: number;
  maxHp: number;
  /** Spellford's entity strength stat (a multiplier, always 1 in v1). Not the Strength status. */
  strengthStat: number;
  weaknesses: Element[];
  resistances: Element[];
  statuses: StatusInstance[];
}

export interface Player extends Combatant {
  movesPerTurn: number;
  spells: SpellInstance[];
  junkPool: SpellId[];
  gold: number;
  gems: GemId[];
  spellUpgrades: number;
  abilities: AbilityInstance[];
  maxAbilities: number;
  nextSpellUid: number;
}

/** A spell with all customisation applied. Battles store these so they are self-contained. */
export interface ResolvedSpell {
  ref: SpellRef;
  spellId: SpellId;
  name: string;
  description: string;
  elements: Element[];
  level: number;
  damage: number;
  healing: number;
  chaos: number;
  statuses: SpellStatus[];
  selfDamage: number;
  extraMove: boolean;
  weight: number;
  spellClass: SpellClass;
  linked: boolean;
  linkBehaviour?: 'mimicNeighbour';
  target: SpellTarget;
  color: string;
  icon: string;
  /** Effect categories the icon can't show (the "+n" pip). */
  hiddenCategories: number;
  gems: GemId[];
}

// ---------------------------------------------------------------- board & battle

export type TileLock = 'free' | 'pending' | 'locked';

export interface Tile {
  uid: number;
  spell: SpellRef | null;
  lock: TileLock;
}

export interface Board {
  width: number;
  height: number;
  /** Rows above this index are the hidden refill buffer. */
  visibleFrom: number;
  cells: Tile[];
  nextUid: number;
}

export interface Pos {
  x: number;
  y: number;
}

export interface EnemyState extends Combatant {
  defId: EnemyId;
  name: string;
  slot: number;
  intentCursor: number;
  alive: boolean;
  stolenGold: number;
}

export type Phase = 'player' | 'enemies' | 'over';

export interface BattleState {
  board: Board;
  player: Player;
  enemies: EnemyState[];
  phase: Phase;
  movesLeft: number;
  extraMoveUsed: boolean;
  targetSlot: number;
  round: number;
  outcome: null | 'victory' | 'defeat';
  encounterId: EncounterId;
  tier: Tier;
  /** Resolved spells keyed by SpellRef: loadout instances plus dud/nova tiles. */
  spells: Record<SpellRef, ResolvedSpell>;
  /** Weighted tile pool used for refills. */
  pool: { ref: SpellRef; weight: number }[];
  rng: RngState;
}

// ---------------------------------------------------------------- battle events (UI playback)

export type Target = 'player' | number; // enemy slot

export interface ViewSnapshot {
  board: Board;
  player: { hp: number; maxHp: number; statuses: StatusInstance[]; gold: number };
  enemies: { slot: number; hp: number; maxHp: number; statuses: StatusInstance[]; alive: boolean; intentCursor: number }[];
  movesLeft: number;
  targetSlot: number;
  phase: Phase;
}

export type BattleEvent =
  | { type: 'swapped'; a: Pos; b: Pos }
  | { type: 'matched'; step: number; uids: number[] }
  | { type: 'cast'; ref: SpellRef; power: number; chaos?: 'damage' | 'block' | 'healing'; hits: { target: Target; damage: number; blocked: number }[]; healing: number }
  | { type: 'cleared'; uids: number[] }
  | { type: 'collapsed' }
  | { type: 'enemyTurn'; slot: number; intent: string }
  | { type: 'damage'; target: Target; amount: number; blocked: number; source: 'intent' | 'poison' | 'self' | 'ability' }
  | { type: 'healed'; target: Target; amount: number }
  | { type: 'status'; target: Target; status: StatusId; value: number }
  | { type: 'goldStolen'; slot: number; amount: number }
  | { type: 'goldReturned'; slot: number; amount: number }
  | { type: 'tilesLocked'; uids: number[] }
  | { type: 'tilesReplaced'; uids: number[]; spell: SpellRef }
  | { type: 'defeated'; target: Target }
  | { type: 'ability'; id: AbilityId }
  | { type: 'targetChanged'; slot: number }
  | { type: 'extraMove' }
  | { type: 'turnStart'; round: number }
  | { type: 'battleEnd'; outcome: 'victory' | 'defeat' };

export interface TimedEvent {
  event: BattleEvent;
  /** State to show once this event has played. */
  after: ViewSnapshot;
}

export interface BattleResult {
  state: BattleState;
  events: TimedEvent[];
}
