// Core engine types (docs/combat.md, docs/tools.md, docs/enemies.md). Everything here is plain serialisable data.

import type { RngState } from './rng';

export type Pillar = 'faith' | 'truth' | 'love' | 'unity' | 'spirit' | 'discipline';
export const PILLARS: readonly Pillar[] = ['faith', 'truth', 'love', 'unity', 'spirit', 'discipline'];

export type ToolId = string;
export type AbilityId = string;
export type EnemyId = string;
export type FruitId =
  | 'love' | 'joy' | 'peace' | 'patience' | 'kindness' | 'goodness' | 'faithfulness' | 'gentleness' | 'self_control';
export type Rarity = 'common' | 'uncommon' | 'rare' | 'legendary';
export type Tier = 'normal' | 'elite' | 'boss';

// ---------------------------------------------------------------- content definitions

// ---------------------------------------------------------------- triggers and effects (docs/tile-effects.md)
// Every tile is stats plus triggers; each trigger holds an ordered list of effects. New tiles combine these in
// data. Something genuinely new is a new trigger or effect type here, usable by every tile.

/** Any tile, by kind and content id (a tool's id is its ToolId, e.g. 'word'; `uid` picks an instance when known). */
export interface TileRef {
  kind: TileKind;
  id: string;
  uid?: string;
}

/** A number, or "N per tile in the set" (Set formed only). */
export type Amount = number | { perSetTile: number };

/** Which tiles an effect hits. Chosen by you (anywhere, shape), or by the game (below, adjacent, you). */
export type Targets =
  /** You pick `count` single tiles anywhere (only tiles of the `filter` kinds, when given). */
  | { type: 'chooseAnywhere'; count: Amount; filter?: TileKind[] }
  /** You place a shape: the set's own shape, or a straight line (you choose horizontal or vertical). */
  | { type: 'chooseShape'; shape: 'set' }
  | { type: 'chooseShape'; shape: 'line'; length: number }
  /** The tile directly below this one (Each step). */
  | { type: 'below' }
  /** Orthogonally adjacent tiles of these kinds (and only these ids, when given): every one, or `pick` at random. */
  | { type: 'adjacent'; pick: 'every' | number; filter: TileKind[]; ids?: string[] }
  /** The player. */
  | { type: 'you' };

/** A status or resource the player gains. */
export type Gainable = 'block' | 'critical' | 'foresight' | 'moves' | 'courage';

/**
 * A status put on a tile. Locked: it doesn't move, activate or deal damage through the next enemy turn.
 * Strengthen: +1 per point, stacking; when the tile clears in a set, the set counts 1 tile bigger per point.
 */
export type TileStatus = 'locked' | 'strengthen';

/** The tile an effect creates: a specific tile, or a random one of the junk in play. */
export type CreateWhat = TileRef | { kind: 'randomJunk' };

export type Effect =
  /**
   * Damage to the targets. A target this breaks is replaced by `onDestroy` in place (so nothing falls). Targets that
   * survive get the `apply` status.
   */
  | { type: 'attack'; targets: Targets; dmg: number; onDestroy?: TileRef; apply?: TileStatus }
  /** Turn the targets into a new tile. */
  | { type: 'create'; what: CreateWhat; targets: Targets }
  /** The player gains an amount of something. `oncePerTurn`: only the first time this source fires each turn. */
  | { type: 'gain'; what: Gainable; amount: Amount; oncePerTurn?: boolean; source?: string }
  /** Nothing else happens: the set just clears. */
  | { type: 'clearsSelf' }
  /** The tile leaves the board (not damage, so nothing breaks it): Grief after it hits you. Game-picked triggers only. */
  | { type: 'removeSelf' };

export type TriggerId = 'setFormed' | 'eachStep' | 'onActivate' | 'atBottom' | 'onUse';
/** Display and resolve order. */
export const TRIGGERS: readonly TriggerId[] = ['setFormed', 'eachStep', 'onActivate', 'atBottom', 'onUse'];

/**
 * When something happens, and what it does. A tile forms sets only if it has `setFormed`.
 *   setFormed:  3+ of it clear as a set
 *   eachStep:   each step down (Speed > 0); an Attack on 'below' is the push, and it moves in if that breaks the tile
 *   onActivate: end of every enemy turn, while on the board
 *   atBottom:   each enemy turn on the bottom row
 *   onUse:      an ability is used
 */
export type Triggers = Partial<Record<TriggerId, Effect[]>>;

/** What every tile definition has (tools, junk, Stone, enemy tiles). */
export interface TileDef {
  id: string;
  name: string;
  /** Free text for anything the triggers don't say. Normally empty. */
  description: string;
  icon: string;
  color: string;
  /** Base HP (tools: 1, plus Gentleness). */
  hp: number;
  /** Steps down per enemy turn; 0 for anything that doesn't move by itself. */
  speed: number;
  triggers: Triggers;
}

export interface ToolDef extends TileDef {
  pillar: Pillar;
  /** Parked tools exist as data but can't be owned yet. */
  parked?: boolean;
}

export type JunkDef = TileDef;

export interface FruitDef {
  id: FruitId;
  name: string;
  keyword: string;
  description: string;
  icon: string;
  dropWeight: number;
}

export interface AbilityDef {
  id: AbilityId;
  name: string;
  description: string;
  rarity: Rarity;
  icon: string;
  maxUses: number;
  /** Its effects (the onUse trigger). */
  onUse: Effect[];
}

export interface AbilityInstance {
  id: AbilityId;
  uses: number;
}

export interface StatusDef {
  id: string;
  name: string;
  description: string;
  icon: string;
}

/** An enemy tile type (enemies.md §1). */
export type EnemyTileDef = TileDef;

/**
 * One generated row (enemies.md §2): normal (from the tile pool), a full row of one enemy tile, or a row given cell
 * by cell (an enemy tile id, or null for a normal cell).
 */
export type GeneratedRow = 'normal' | { tile: string } | { cells: (string | null)[] };

export interface EnemyDef {
  id: EnemyId;
  name: string;
  tier: Tier;
  /** Setup description: the generation pattern and its totals. */
  description: string;
  portrait?: string;
  /** From the bottom row of the board upwards; normal forever after the end. */
  generator: GeneratedRow[];
  /** Speed overrides for this fight's enemy tiles (steps per enemy turn), e.g. faster Worries. */
  tileSpeed?: Partial<Record<string, number>>;
  talents: [number, number];
}

// ---------------------------------------------------------------- player state

export type Socket = FruitId | null;

export interface ToolInstance {
  uid: string;
  toolId: ToolId;
  pillar: Pillar;
  level: 1 | 2 | 3 | 4 | 5;
  sockets: [Socket, Socket, Socket];
}

export interface Player {
  /** Courage. */
  hp: number;
  maxHp: number;
  movesPerTurn: number;
  tools: ToolInstance[];
  /** Talents. */
  gold: number;
  fruits: FruitId[];
  upgrades: number;
  abilities: AbilityInstance[];
  maxAbilities: number;
  nextToolUid: number;
}

/** A tool instance with its fruit counted, as a battle uses it. */
export interface BattleTool {
  uid: string;
  toolId: ToolId;
  name: string;
  pillar: Pillar;
  icon: string;
  color: string;
  weight: number;
  fruit: Record<FruitId, number>;
}

// ---------------------------------------------------------------- board & battle

export type TileKind = 'tool' | 'junk' | 'stone' | 'enemy';

export interface Tile {
  uid: number;
  kind: TileKind;
  /** Tool instance uid, junk id ('time' | 'space'), 'stone', or enemy tile id ('worry'). */
  id: string;
  hp: number;
  maxHp: number;
  /** Locked through the enemy turn of this round (combat § 4.4). */
  lockedUntil?: number;
  /** Strengthen points (Anoint): the set this tile clears in counts this many tiles bigger. */
  strength?: number;
}

export interface Board {
  width: number;
  height: number;
  /** Row-major, y = 0 is the top row. null = empty (only mid-resolution). */
  cells: (Tile | null)[];
}

export interface Pos {
  x: number;
  y: number;
}

/** Where a placed Attack lands: one tile, a shape (offsets from its top-left), or a line (orientation chosen). */
export type PlacementTarget = { type: 'anywhere'; filter?: TileKind[] } | { type: 'shape'; cells: Pos[] } | { type: 'line'; length: number };

/**
 * One Attack waiting for you to choose where (Choose anywhere / Choose shape). Every tile under it takes `damage`;
 * a tile it breaks becomes `onDestroy` in place (with `onDestroyHp` HP when given, e.g. Patience's sturdier Stones).
 */
export interface Placement {
  target: PlacementTarget;
  damage: number;
  source: string;
  onDestroy?: TileRef;
  onDestroyHp?: number;
  /** A status put on every tile under it that survives (Preaching: Locked; Anoint: +1 Strengthen). */
  apply?: TileStatus;
}

export type Stage = 'player' | 'endTurn' | 'enemy' | 'newTurn';
export type Phase = 'player' | 'placing' | 'over';

export interface BattlePlayer {
  hp: number;
  maxHp: number;
  block: number;
  critical: number;
  foresight: number;
  movesPerTurn: number;
  abilities: AbilityInstance[];
}

export interface BattleState {
  board: Board;
  enemyId: EnemyId;
  /** Next generated-row index for each column (starts at the board height). */
  genPos: number[];
  tools: Record<string, BattleTool>;
  /** Weighted pool for normal cells. */
  pool: { kind: 'tool' | 'junk'; id: string; weight: number }[];
  player: BattlePlayer;
  movesLeft: number;
  round: number;
  phase: Phase;
  stage: Stage;
  pending: Placement[];
  /** Tool uids whose Focus fired this turn. */
  focusUsed: string[];
  outcome: null | 'victory' | 'defeat';
  nextUid: number;
  rng: RngState;
}

// ---------------------------------------------------------------- battle events (UI playback)

export interface ViewSnapshot {
  board: Board;
  player: { hp: number; maxHp: number; block: number; critical: number; foresight: number };
  movesLeft: number;
  round: number;
  phase: Phase;
  pending: Placement | null;
  enemyOnBoard: number;
  enemyToCome: number;
  /** Each column's next generated-row index (for the pattern picture). */
  genPos: number[];
}

export type BattleEvent =
  | { type: 'swapped'; a: Pos; b: Pos }
  | { type: 'matched'; uids: number[] }
  | { type: 'effect'; source: string; text: string }
  | { type: 'damaged'; uids: number[]; deleted: number[] }
  /** These tiles left the board by Remove self (Grief after it hits you). */
  | { type: 'removed'; uids: number[] }
  | { type: 'collapsed' }
  | { type: 'shining'; uids: number[] }
  /** The enemy turn begins (before any enemy tile acts). */
  | { type: 'enemyTurn' }
  | { type: 'enemyStep'; uid: number }
  /** These tiles were Locked. */
  | { type: 'locked'; uids: number[] }
  /** These tiles gained 1 Strengthen. */
  | { type: 'strengthened'; uids: number[] }
  | { type: 'playerHit'; amount: number; blocked: number }
  /** A Create effect turned tiles into these new tiles (Greed's junk, Depression's spread). */
  | { type: 'created'; uids: number[] }
  | { type: 'ability'; id: AbilityId }
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
