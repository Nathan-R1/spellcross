# 02: Game Engine (pure TypeScript)

`src/engine/` holds all game rules. It has **no React, DOM or timers**. Every public function is
`(state, input, ctx) → { state, events }`, where `ctx` carries the content registry and RNG.

Combat rules come from [combat.md](../combat.md) (D14). This doc covers how the engine implements them.

## Core types

```ts
type SpellId = string;   // "scorch"
type StatusId = string;  // "poisoned"

type SpellClass = 'player' | 'enemy' | 'dud' | 'nova' | 'both';
type Element = 'fire' | 'lightning' | 'water' | 'earth' | 'air' | 'acid';
type TileLock = 'free' | 'locked';   // only intents lock tiles (D23)

interface SpellDef {             // content (immutable)
  id: SpellId; name: string; description: string;
  icon?: string;                 // enemy/dud/nova only. Player spells derive it (spells-and-gems §2)
  upgradable: boolean;           // true for player spells (D16)
  element: Element; damage: number; healing: number;
  weight: number; spellClass: SpellClass; linked: boolean;
  target: 'single' | 'all' | 'random' | 'self';
  statuses: { status: StatusId; value: number; self: boolean; perTile: boolean }[];   // perTile = Spellford multipliedByTiles
  color: string;
}

type SpellRef = string;          // a SpellInstance uid (player spells) or a SpellId (dud/nova)
interface Tile { uid: number; spell: SpellRef | null; lock: TileLock; hidden: boolean }   // no owner: player-only board

interface Board { width: number; height: number; visibleFrom: number; cells: Tile[] /* row-major */ }
// D15: width 8, height 12, visibleFrom 6 (bottom 6 rows visible, top 6 are the refill buffer).
// Sizes come from one BOARD_SIZE constant. Nothing in the engine hardcodes 8 or 6.

interface StatusInstance { id: StatusId; value: number; duration: number | null }

interface Combatant {               // shared by player and enemies
  hp: number; maxHp: number; strength: number;
  weaknesses: Element[]; resistances: Element[];
  statuses: StatusInstance[];
}

interface Player extends Combatant {
  movesPerTurn: number;              // 3
  spells: SpellInstance[];           // owned spells, customised (spells-and-gems §5). From M2, so no save migration
  loadout: string[];                 // SpellInstance uids, 3 or 4 per battle
  junkPool: SpellId[]; junk: SpellId[];   // owned dud/nova junk, up to 2 selected (features 5.1.6)
  inventory: {
    gold: number;
    gems: GemId[];                   // gems have no rank; values come from the spell's level (D16)
    spellUpgrades: number;
    items: ItemId[];                 // other items (none with effects yet)
    abilities: AbilityInstance[]; maxAbilities: number;
  };
}

interface EnemyState extends Combatant {
  defId: EnemyId;                    // → EnemyDef (combat.md §3.1): name, portrait, tier, intents
  slot: 0 | 1 | 2 | 3;               // fixed screen position, left to right
  intentCursor: number;              // index into def.intents
  alive: boolean;                    // dead enemies keep their slot
}

interface BattleState {
  board: Board;
  player: Player;
  enemies: EnemyState[];             // 1–4
  phase: 'player' | 'enemies' | 'over';
  movesLeft: number;
  targetSlot: number;                // current player target (living enemy)
  round: number;
  outcome: null | 'victory' | 'defeat';
  encounterId: EncounterId;
  rng: RngState;
}
```

Spellford's `Spell` object carries both content and per-cast scratch values (`tempMultiplier`,
`tempAdditive*`). Spellcross keeps them separate. `SpellDef` is immutable content, and scratch values
live in a per-cast `CastContext` (below).

## Board module (`engine/board/`)

| Function | Ports | Notes |
|---|---|---|
| `createBoard(pool, rng)` | `Board.init`, `populateBoard`, `hideBoard` | Pool = resolved loadout spells (by instance uid) + duds + selected junk + novas, weighted 60/25/15 (combat §2.4; Spellford normalised duds and novas to 3 each). Re-rolls each tile until it forms no set. Top `visibleFrom` rows (6) hidden |
| `canSwap(board, a, b)` | `canSwapTiles` | Orthogonal neighbours, both available (not locked, not hidden) |
| `findSet(board, pos)` | `getSetTiles` | ≥3 horizontally or vertically. Dud and nova never match and block lines |
| `linkedNeighbours(board, tiles)` | `getLinkedAdjacentTiles` | |
| `groupForTrigger(board, tiles)` | `triggerSpells` grouping | Groups by `SpellRef`, so differently gemmed copies of a spell never merge. Linked Surge converts to its neighbour's spell (behaviour table in content) |
| `collapse(board, cleared, rng)` | `resolveTiles`, `shiftDownTiles` | Gravity, then refill the top row from weighted RNG |
| `validMoves(board)` | `getAllValidMoves` | |
| `endTurnLocks(board)` | `Board.endTurn` | locked→free (swaps no longer lock, D23) |
| `lockRandom(board, n, rng)` | *(new)* | Board intent: lock n random free, visible tiles |
| `replaceRandom(board, spell, n, rng)` | *(new)* | Board intent: replace n random visible tiles without triggering matches |

### Move resolution

```
playerMove(battle, a, b):
  assert phase == 'player' && canSwap && movesLeft > 0
  movesLeft -= 1
  swap a,b                                               → event Swapped
  fire status hook onTileMove(player)
  matched = findSet(a) ∪ findSet(b) ∪ linkedNeighbours(...)
  loop while matched not empty:                           (cascade step k)
     for each group in groupForTrigger(matched):
        castSpell(group)                                   → SpellTriggered
     clear matched                                         → TilesCleared
     collapse                                              → TilesDropped, TilesSpawned
     matched = sets in affected columns ∪ linked neighbours
  if all enemies dead → outcome 'victory'                 → BattleEnded
  else if movesLeft == 0 → endPlayerTurn (below), same call
```

`castSpell(group)` resolves the spell's `target` (`single` → `targetSlot`, `all` → each living enemy,
`random` → battle RNG, `self` → player) and runs the pipeline below once per target. Healing applies
once. If the target dies mid-cascade, later casts in the same move retarget to the leftmost living
enemy (`TargetChanged` event).

This is the same algorithm as Spellford's `playMove` + repeated `progressMove`, just run to completion
in one call. Each loop iteration gets a `step` index so the UI can pace the animation (Spellford uses 1s per step).

## Spell resolution (`engine/battle/castSpell.ts`)

Replaces `Spell.triggerSpell`. Statuses no longer mutate the spell. They receive and return a context:

```ts
interface CastContext {
  spell: ResolvedSpell; power: number;       // final stats (resolveSpell); power = tiles in group
  actor: Combatant; target: Combatant;
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
6. apply the spell's statuses: `value × power` if `perTile`, else `value` (merge by id via `combine`)
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
type StatusResult = { status?: StatusInstance | null /* null = expire */; ctx?: CastContext; entity?: Partial<Combatant> };
```

- `combine`: stacking → add values. Duration → add values and keep the max duration (Spellford `DurationStatus.combine`).
- Expiry is collected and flushed after each hook phase (Spellford's `expireStatus`/`flushExpired`).
- One behaviour module per status: Critical, Strength, Weakness, Charge, Fortify, Block, PermaBlock,
  Poisoned, plus element-scoped Charge (Fire, Lightning, Earth) and Fortify (Water, Earth, Air), ported as
  Spellford implements them (D4: Replicate).

Turn hooks follow combat.md §1: player `onTurnStart` → moves → player `onTurnEnd` → board locks → each
living enemy left to right (`onTurnStart` → intent → cursor advances → `onTurnEnd`) → everyone
`onRoundStart` → player `onTurnStart`. Win and loss checks happen as described in combat §1.

Status changes from D14 (combat §4): Strength adds per hit to intent damage and per tile to spells, and is
permanent. Weak is ×0.75 on damage dealt and ticks at the owner's turn end.

## Abilities (`engine/ability/`)

`useAbility(battle, abilityIdx)`: free (no move cost). Checks uses > 0, decrements, applies damage to the current target (× strength × weakness mod),
applies statuses, runs named **effect handlers** from a registry (e.g. `doublePoison` for Sicken).
Spellford's lambdas become `effects: [{ type: 'doublePoison' }]` so abilities stay serialisable for saves.

## Enemy intents (`engine/intents/`)

Replaces Spellford's behaviour-tree AI (`ai/*`). Enemies never touch the board through moves. They play a
fixed cycle (combat §3).

| Function | Does |
|---|---|
| `currentIntent(enemy, defs)` | `def.intents[enemy.intentCursor]` |
| `previewIntent(battle, slot)` | The intent with **final numbers** after the enemy's Strength and Weak, for the intent badge. It does **not** subtract the player's Block (shown separately on the player strip), so the badge only changes when the enemy's modifiers do |
| `resolveIntent(battle, slot, rng)` | Runs the intent's parts in order (named intents are flattened to generic parts at content load), emitting `IntentPerformed` plus per-part events (`DamageDealt`, `BlockGained`, `Healed`, `StatusApplied`, `GoldStolen`, `TilesLocked`, `TilesReplaced`). Gold stolen is tracked per enemy and returned when it dies (`GoldReturned`) |
| `endPlayerTurn(battle, rng)` | Player `onTurnEnd` → locks → the whole enemy phase (each living enemy: `onTurnStart`, `resolveIntent`, advance cursor, `onTurnEnd`, stop at once if the player dies) → `onRoundStart` → player `onTurnStart` → reset `movesLeft`. Returns one event list for the UI to play back |
| `pickHealTarget(battle, slot, target)` | `self`, `lowestAlly` (lowest HP fraction, ties leftmost, may be self), `allAllies` |

- `createBattle(encounter, player, rng)` places enemies in slots 0..n−1 and sets each `intentCursor` to 0,
  or to a random position from the battle RNG when the def says `start: 'random'`.
- Intents are data, so `EnemyState` stays serialisable and battle snapshots and replays still work.
- Content validation rejects board effects on `tier: 'normal'` enemies.

## World (`engine/world/`)

- `generateMap(seed, size, tables) → WorldMap`: a direct port of `WorldMap.generateMap`. `size` is the logical
  world (1080 units tall, 2 viewport-aspect screens wide; 03-frontend), fixed per run. Three paths,
  stop/road chance tables, link/block boosts, connectors, minimum requirements, curve directions, texture
  variants and rotations. Output is plain data (`stops[]`, `roads[]` with curve info), which the UI renders as SVG.
- `generateTerrain(seed, size)`: port of the terrain and river generation in `WorldMapRenderer` (only the
  *geometry generation*, not the drawing).
- `neighbours(map, stopId)`, `travel(session, toStopId)`.
- `planTravel(session, toStopId, rng)`: if the road is a **Road** or **Trail**, schedules a road battle at a
  random 30–70% of the way (run RNG, D7): a random normal encounter with 3 loadout slots on Roads, and a random
  elite encounter with 4 on Trails (D17). Highways are safe
  (features 3.3.7). Travel pauses for the battle and resumes after it.
- `onArrive(session, stop)`: opens the stop type's set event (Start → Traveller, Campfire, Village, Town,
  Market, Encounter → random event; features §4.3). Finish → the Harbinger boss encounter, then victory (D17).

## Story events (`engine/events/`)

Events become a **graph of nodes** instead of nested objects built eagerly:

```ts
interface EventNode { id; image; title; text; type: 'normal' | 'battlePrep'; options: EventOption[] }
interface EventOption {
  label; costText?; rewardText?;
  effects?: Effect[];                    // { type:'gold', amount }, { type:'damage', amount }, { type:'item', id },
                                         // { type:'healPctMax', pct }, { type:'addAbility', from?: AbilityId[] },
                                         // { type:'recharge', count | 'perAbility' }, { type:'addSpell', id },
                                         // { type:'changeElement', element, pay?: 'lastAbility' }, { type:'battle', slots } ...
  available?: Condition;                 // { gold: '>=', 100 } | { hp: '>=', n } | { hasAbilities } ... (features 4.1.9)
  stay?: boolean;                        // option keeps the event open (set events)
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
rng.fork(label): Rng               // independent streams: 'map', 'terrain', 'events', 'board', 'battle'
```

RNG state is stored in game state, so saves and replays are exact.

## Testing strategy for the engine

- **Port** `BoardSetTest` (7) and `BoardFullTest` (5) first, using a helper that builds a board from an ASCII grid like Spellford's `BoardTestUtils`.
- Formula tests: one per status hook interaction (Critical ×1.5, Block absorbing, Poison halving, Fortify→Block, …).
- Cascade tests: fixed seed → golden `events[]` snapshot.
- Map generation tests: invariants (3 paths, start/finish connected, minimums met, no duplicate roads) across 1,000 seeds.
- Event tests: every option in every event reaches a terminal node, and no option leaves HP < 0.
- Intent tests: cycles wrap, `start: 'random'` is seeded, `lowestAlly` picks correctly and never revives,
  previews match what resolution actually does (property test over random states), and the enemy phase
  stops the moment the player dies.
- Targeting tests: `single`, `all` and `random` spells, and retargeting when the target dies mid-cascade.
- Combat sim: a greedy bot (best immediate damage, 3 moves) plays every starter encounter over 500 seeds.
  This gives the balance baseline (features.md, after D14) and catches match-starved pools.
- Target: 90%+ line coverage on `src/engine`.
