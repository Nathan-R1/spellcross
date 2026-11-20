# 02: Game Engine (pure TypeScript)

`src/engine/` holds all game rules. It has **no React, DOM or timers**. Every public function is
`(state, input, ctx) → { state, events }`, where `ctx` carries the content registry and RNG.

## Core types

```ts
type SpellId = string;   // "fireball"
type StatusId = string;  // "poisoned"

type SpellClass = 'player' | 'enemy' | 'dud' | 'nova' | 'both';
type Element = 'fire' | 'lightning' | 'water' | 'earth' | 'air' | 'acid';
type TileLock = 'free' | 'pending' | 'locked';

interface SpellDef {             // content (immutable)
  id: SpellId; name: string; description: string; icon: string;
  element: Element; damage: number; healing: number;
  weight: number; spellClass: SpellClass; linked: boolean;
  statuses: { status: StatusId; value: number; self: boolean }[];
  color: string;
}

interface Tile { spell: SpellId | null; owner?: EntityId; lock: TileLock; hidden: boolean }

interface Board { width: 8; height: 16; visibleFrom: 8; cells: Tile[] /* row-major */ }

interface StatusInstance { id: StatusId; value: number; duration: number | null }

interface Entity {
  id: EntityId; name: string; portrait: string; teamColor: string;
  hp: number; maxHp: number; energy: number; maxEnergy: number; strength: number;
  weaknesses: SpellId[]; resistances: SpellId[];
  spellPool: SpellId[]; loadout: SpellId[];
  statuses: StatusInstance[];
  inventory: { gold: number; items: ItemId[]; abilities: AbilityInstance[]; maxAbilities: number };
  ai?: BehaviourTreeDef;
}

interface BattleState {
  board: Board; entities: [Entity, Entity];   // [player, enemy]
  activeIndex: 0 | 1; round: number; turn: number;
  outcome: null | { winner: EntityId };
  rng: RngState;
}
```

Spellford's `Spell` object carries both content and per-cast scratch values (`tempMultiplier`,
`tempAdditive*`). Spellcross keeps them separate. `SpellDef` is immutable content, and scratch values
live in a per-cast `CastContext` (below).

## Board module (`engine/board/`)

| Function | Ports | Notes |
|---|---|---|
| `createBoard(pool, rng)` | `Board.init`, `populateBoard`, `hideBoard` | Normalises dud and nova weights to a total of 3 each. Re-rolls each tile until it forms no set. Top 8 rows hidden |
| `canSwap(board, a, b)` | `canSwapTiles` | Orthogonal neighbours, both available (not locked, not hidden) |
| `findSet(board, pos)` | `getSetTiles` | ≥3 horizontally or vertically. Dud and nova never match and block lines |
| `linkedNeighbours(board, tiles)` | `getLinkedAdjacentTiles` | |
| `groupForTrigger(board, tiles)` | `triggerSpells` grouping | Groups by spell. Linked Surge converts to its neighbour's spell (behaviour table in content) |
| `collapse(board, cleared, rng)` | `resolveTiles`, `shiftDownTiles` | Gravity, then refill the top row from weighted RNG |
| `validMoves(board)` | `getAllValidMoves` | |
| `endTurnLocks(board)` | `Board.endTurn` | pending→locked, locked→free |

### Move resolution

```
resolveMove(battle, a, b):
  assert canSwap && actor.energy > 0
  energy -= 1
  swap a,b ; mark both 'pending'                         → event Swapped
  fire status hook onTileMove(actor)
  matched = findSet(a) ∪ findSet(b) ∪ linkedNeighbours(...)
  loop while matched not empty:                           (cascade step k)
     for each group in groupForTrigger(matched):
        castSpell(group)                                   → SpellTriggered
     clear matched                                         → TilesCleared
     collapse                                              → TilesDropped, TilesSpawned
     matched = sets in affected columns ∪ linked neighbours
  if actor is AI and energy == 0 → endTurn
```

This is the same algorithm as Spellford's `playMove` + repeated `progressMove`, just run to completion
in one call. Each loop iteration gets a `step` index so the UI can pace the animation (Spellford uses 1s per step).

## Spell resolution (`engine/battle/castSpell.ts`)

Replaces `Spell.triggerSpell`. Statuses no longer mutate the spell. They receive and return a context:

```ts
interface CastContext {
  spell: SpellDef; power: number;            // tiles in group
  actor: Entity; target: Entity;
  multiplier: number;                        // tempMultiplier
  addSelf: number; addOther: number;         // flat
  addSelfPerTile: number; addOtherPerTile: number;
}
```

Pipeline (same order as Spellford):

1. `ctx = baseContext(group)`
2. target statuses `onSpellActivated(ctx, {isCaster:false})`, then actor statuses `(…, {isCaster:true})`
3. compute `healing` and `damage` using the formula in features.md §5.4
4. target `onSpellApplied`, then actor `onSpellApplied` (Block and Perma Block reduce `addOther` here)
5. heal actor, damage target (clamped to `[0,maxHp]`)
6. apply the spell's statuses with `value × power` (merge by id via `combine`)
7. remove expired statuses
8. emit `SpellTriggered { spell, actor, target, damage, healing, statuses, sourceTiles }`

## Status system (`engine/status/`)

Status *behaviour* is code, and status *parameters* are data:

```ts
interface StatusBehaviour {
  kind: 'stacking' | 'duration';
  onSpellActivated?(s, ctx, role): StatusResult;
  onSpellApplied?(s, ctx, amount, role): StatusResult;
  onTurnStart?(s, owner, other): StatusResult;
  onTurnEnd?(s, owner, other): StatusResult;
  onRoundStart?(s, owner, other): StatusResult;
  onTileMove?(s, owner, board): StatusResult;
}
type StatusResult = { status?: StatusInstance | null /* null = expire */; ctx?: CastContext; entity?: Partial<Entity> };
```

- `combine`: stacking → add values. Duration → add values and keep the max duration (Spellford `DurationStatus.combine`).
- Expiry is collected and flushed after each hook phase (Spellford's `expireStatus`/`flushExpired`).
- One behaviour module per status: Critical, Strength, Weakness, Charge, Fortify, Block, PermaBlock,
  Poisoned, plus element-scoped Charge* and Fortify* (D4).

Turn hooks run in the same places as `BattleScreen`:
battle start → active `onTurnStart` · end turn → actor `onTurnEnd` → board locks → win check → swap active →
reset energy → if back to the player: both `onRoundStart` → new actor `onTurnStart`.

## Abilities (`engine/ability/`)

`useAbility(battle, abilityIdx)`: checks uses > 0, decrements, applies damage (× strength × weakness mod),
applies statuses, runs named **effect handlers** from a registry (e.g. `doublePoison` for Sicken).
Spellford's lambdas become `effects: [{ type: 'doublePoison' }]` so abilities stay serialisable for saves.

## AI (`engine/ai/`)

Port of Spellford's behaviour tree, made pure and data-driven:

```ts
type BTNode =
  | { type: 'selector'; children: BTNode[] }           // Spellford Move
  | { type: 'sequence'; children: BTNode[] }           // Spellford Moveset (round-robin; needs cursor in state)
  | { type: 'leaf'; action: AIAction; when?: AICondition };

type AIAction = { type: 'castSpell'; spell: SpellId } | { type: 'anySet' } | { type: 'random' };
type AICondition =
  | { type: 'stat'; stat: 'hp' | 'energy'; op: Cmp; value: number | `${number}%` }
  | { type: 'spellAvailable'; spell: SpellId }
  | { type: 'board'; metric: string; op: Cmp; value: number };
```

`chooseMove(battle, tree, rng) → Move | null`. It reads state and never mutates it, and simulates swaps on
board copies. Spellford's `AIUtils` globals go away.

> Resolved (D2): Spellford never evaluates `Leaf.validate()`. Spellcross evaluates `when`, and a selector
> skips a leaf whose condition is false.

The Wolf tree as data: `selector[ leaf(cast frenzy, when hp<50%), leaf(cast howl), leaf(cast bite), leaf(cast frenzy), leaf(anySet), leaf(random) ]`.

## World (`engine/world/`)

- `generateMap(seed, size, tables) → WorldMap`: a direct port of `WorldMap.generateMap`. Three paths,
  stop/road chance tables, link/block boosts, connectors, minimum requirements, curve directions, texture
  variants and rotations. Output is plain data (`stops[]`, `roads[]` with curve info), which the UI renders as SVG.
- `generateTerrain(seed, size)`: port of the terrain and river generation in `WorldMapRenderer` (only the
  *geometry generation*, not the drawing).
- `neighbours(map, stopId)`, `travel(session, toStopId)`.
- `rollEncounter(session, rng)`: implements the stubbed `EncounterManager` (15% per travel step, per Constants).
- `onArrive(session, stop)`: maps stop type → event or battle or rest (fills the Spellford stub; details in the migration plan).

## Story events (`engine/events/`)

Events become a **graph of nodes** instead of nested objects built eagerly:

```ts
interface EventNode { id; image; title; text; type: 'normal' | 'battlePrep'; options: EventOption[] }
interface EventOption {
  label; costText?; rewardText?;
  effects?: Effect[];                    // { type:'gold', amount }, { type:'damage', amount }, { type:'item', id }, { type:'healPctCurrent', pct } ...
  next?: string | { random: { node: string; weight: number }[] } | { chance: Formula; pass: string; fail: string };
}
```

`chooseOption(session, nodeId, optionIdx, rng)` applies effects, checks for death, and resolves the next
node. Randomness is rolled **when the option is chosen**, from the run's event RNG stream. Spellford rolls
while building the event, using a fixed-seed `Random` per call (fixed per D7).

Parametric events (Chest attempt *n*, Tavern take *n*) use node params: `{ node: 'chest', params: { attempt: n+1 } }`.

## RNG (`engine/rng.ts`)

```ts
createRng(seed: number): Rng       // mulberry32
rng.next(): number                 // [0,1)
rng.int(min, maxExclusive)
rng.weighted<T>(items, weightOf)
rng.fork(label): Rng               // independent streams: 'map', 'terrain', 'events', 'board', 'ai'
```

RNG state is stored in game state, so saves and replays are exact.

## Testing strategy for the engine

- **Port** `BoardSetTest` (7) and `BoardFullTest` (5) first, using a helper that builds a board from an ASCII grid like Spellford's `BoardTestUtils`.
- Formula tests: one per status hook interaction (Critical ×1.5, Block absorbing, Poison halving, Fortify→Block, …).
- Cascade tests: fixed seed → golden `events[]` snapshot.
- Map generation tests: invariants (3 paths, start/finish connected, minimums met, no duplicate roads) across 1,000 seeds.
- Event tests: every option in every event reaches a terminal node, and no option leaves HP < 0.
- AI tests: the Wolf picks Howl when available, falls back to anySet, then random.
- Target: 90%+ line coverage on `src/engine`.
