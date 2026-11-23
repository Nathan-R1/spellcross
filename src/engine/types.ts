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

/** What a tool's set does (tools.md §1). 'none' = parked tool. */
export type ToolEffect = 'critical' | 'damageShape' | 'block' | 'stones' | 'prophecy' | 'none';

export interface ToolDef {
  id: ToolId;
  name: string;
  description: string;
  pillar: Pillar;
  effect: ToolEffect;
  icon: string;
  color: string;
  /** Parked tools exist as data but can't be owned yet. */
  parked?: boolean;
}

export interface JunkDef {
  id: string;
  name: string;
  description: string;
  icon: string;
  color: string;
  /** Damage hits granted when 3+ clear (Time: 1). */
  hits: number;
}

export interface FruitDef {
  id: FruitId;
  name: string;
  keyword: string;
  description: string;
  icon: string;
  dropWeight: number;
}

export type AbilityEffect =
  | { type: 'hit'; damage: number }
  | { type: 'block'; amount: number }
  | { type: 'line'; length: number; damage: number }
  | { type: 'moves'; amount: number };

export interface AbilityDef {
  id: AbilityId;
  name: string;
  description: string;
  rarity: Rarity;
  icon: string;
  maxUses: number;
  effect: AbilityEffect;
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
export interface EnemyTileDef {
  id: string;
  name: string;
  description: string;
  icon: string;
  color: string;
  hp: number;
  speed: number;
  /** Damage dealt to the player when it steps from the bottom row. */
  damage: number;
  /** Effect at the end of each enemy turn, after every enemy tile has moved. */
  onEnemyTurnEnd?: 'junkAdjacentTools';
}

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
  effect: ToolEffect;
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

export type Placement =
  /** Prayer: 1 damage to every cell of this shape (offsets from its top-left). */
  | { type: 'shape'; cells: Pos[]; damage: number; source: string }
  /** Prophecy, Time, Abstain: damage one tile. */
  | { type: 'hit'; damage: number; source: string }
  /** The Word: damage one tile; if deleted, a Stone takes its place. */
  | { type: 'stone'; damage: number; stoneHp: number; source: string }
  /** Prophecy: damage one tile; if deleted, a Space junk tile takes its place. */
  | { type: 'space'; damage: number; source: string }
  /** Many Fish: a straight line, orientation chosen when placing. */
  | { type: 'line'; length: number; damage: number; source: string };

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
  | { type: 'stone'; uid: number }
  | { type: 'collapsed' }
  | { type: 'shining'; uids: number[] }
  | { type: 'enemyStep'; uid: number }
  | { type: 'playerHit'; amount: number; blocked: number }
  /** Greed turned these tool tiles into junk. */
  | { type: 'junked'; uids: number[] }
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
