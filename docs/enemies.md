# Enemies and Enemy Tiles

Enemy content for the combat rules in [combat.md](combat.md). An enemy doesn't attack directly. Its
**generator** feeds **enemy tiles** onto the board in a **predictable pattern**, and those tiles do the damage. All numbers are
starting values *(tune)*.

The old roster (Strife, Greed, Lust, Sloth, Pride) and the intent system are **retired**. Those names are free
to reuse for new tile-based enemies later.

---

## 1. Enemy tiles

An enemy tile is a board tile owned by the enemy. Every enemy tile:

- **never matches** and breaks lines of other tiles,
- **can be swapped** like any tile,
- **falls with gravity** like any tile,
- **moves** once per enemy turn, bottom row first ([combat § 4.1](combat.md#41-activation)),
- **never destroys another enemy tile**. If its move is blocked by one, it stays put,
- enters the board from the enemy's **generator** (§2), or from an enemy action (§3),
- leaves the board when **damage** reaches its HP, or by being **transformed** into a Stone by **the Word**
  ([combat § 1.2](combat.md#12-hp-and-damage), [§ 5](combat.md#5-placement)),
- shows its **HP** as a red number in the top-right corner and its **move speed** as arrows at the bottom-middle.

Each tile type has an **HP** value and a **speed** (steps per enemy turn). Damage below its HP leaves it on
the board with less HP.

**Framework.** Enemy tiles use the same triggers and effects as every other tile ([tile-effects.md](tile-effects.md)).

**Enemy tile triggers.** Each enemy tile's behaviour is its triggers in `src/content/enemies.ts`. Its **Speed**
(steps down per enemy turn in this fight; 0 if it doesn't move itself) is shown next to its HP at the top of the
popup, as for every tile. Then, in this order, each trigger that has effects (others are hidden):

| Trigger | When | Current effects |
|---|---|---|
| **Each step** | Each step down | Attack: The tile below · Dmg 1. The push: the tile **moves in if this breaks the tile below** |
| **On activate** | The **end of every enemy turn**, after every enemy tile has moved, while it's on the board | Create [tile] on adjacent tiles |
| **At bottom** | Each enemy turn on the bottom row | Attack: You · Dmg 1 |

In player-facing text, "On activate" always means this end-of-turn effect; moving is **Speed** and **Each step**.
Claims and clashes for On activate are in [tile-effects § 3.3](tile-effects.md#33-on-activate-claims).

### Worry (base enemy tile)

| | |
|---|---|
| HP | 1 |
| Speed | 1 (2 in Hard Choices) |
| Each step | Dmg 1 to the tile below, and moves in if it breaks. If the tile survives (a full-HP Stone), the Worry stays. Another enemy tile below blocks it, with no damage |
| On activate | (none) |
| At bottom | Dmg 1 to you, and it stays |
| Art | placeholder from the old junk art (e.g. `spells/dud/ash.png`) until drawn |

### Greed

| | |
|---|---|
| HP | 3 |
| Speed | 2. It stops as soon as a step doesn't break the tile |
| Each step | Dmg 1 to the tile below, and moves in if it breaks |
| On activate | Create random junk ([Time] or [Space], from the junk in play) on **every adjacent tool**. Junk, Stones and enemy tiles are untouched |
| At bottom | Dmg 1 to you (once per enemy turn) |
| Art | placeholder: the gold coin icon (`icons/gold.png`) |

### Depression

| | |
|---|---|
| HP | 3 |
| Speed | 0: it never moves itself (but falls with gravity like any tile) |
| Each step | (hidden) |
| On activate | Create [Depression] on **1 random adjacent tool or junk**. Depressions pick in reading order (top-left first), and a tile already picked this turn isn't available, so each one converts a different tile. Stones and enemy tiles are never picked. A tile that changed this turn doesn't spread until next turn. On a tile both a Greed and a Depression pick, Depression wins |
| At bottom | Dmg 1 to you (once per enemy turn) |
| Art | `spells/dud/depression.png`: a grey-white puddle (the slime art recoloured) |

A fight can override a tile's speed with `tileSpeed` (e.g. Hard Choices' Worries take 2 steps). The board and
the tile details show the speed for the current fight.

## 2. The generator

An enemy's main mechanic is its **generator**: the stack of rows the board is built from and refills from.

- The generator is an ordered list of **generated rows**, from the **bottom of the board upwards**. Each row
  is `normal` (8 tiles from the tile pool), a full **enemy row** (e.g. 8 Worries), or a row given **cell by cell**
  (each cell an enemy tile or normal), e.g. Worry in the two edge columns only.
- The first 8 entries are the **initial board**: entry 1 is the bottom row and entry 8 is the top row.
- Entries 9 onwards sit **above the board**. Each column refills from its own position in the list: the next
  tile to drop into column *x* is column *x* of that column's next generated row
  ([combat § 1](combat.md#1-the-board)). Columns advance independently, so the rows break up as they come in.
- When the list runs out, it's `normal` rows forever.
- Generated rows can be written as a list or with repeats. For example, Financial Stress is "6 × normal, then
  10 rows with Worry in the edge columns", with Greed added to three of them.

The game **draws the pattern as a picture** instead of describing it: an 8×8 grid of the next 8 generated tiles
in each column, with the nearest at the bottom, enemy squares marked, plus the totals (on board, to come, in all).
Before a battle (prep screen, Fight picker) it's one smaller 16×8 picture: the next 8 rows on top, the starting board below, with a line marking the top of the board. In battle the picture is live:
columns advance independently, so it follows each column's own position. The text `description` stays in the
data for screen readers and must still state the total.

## 3. Enemy actions

On top of its generator, an enemy can take an **action** at the start of each enemy turn. **The default is
none.** No current enemy has actions. Planned action types, for later enemies:

| Action | Effect |
|---|---|
| `spawnRow(tile, row)` | Fills a board row with that tile. Tools, junk and Stones there are destroyed with no effect. Cells holding enemy tiles are skipped |
| `spawn(tile, cells)` | The same, for specific cells |
| `spawnRandom(tile, count, rows?)` | Places `count` tiles in random non-enemy cells (battle RNG) |

Actions repeat in a fixed cycle and must be visible ahead of time ("Next: …" on the enemy panel).

## 4. Roster

### Hard Choices (the base enemy)

| | |
|---|---|
| Generator | **Rows 5 to 8** (counting from the bottom of the board) are Worry rows; everything else is normal |
| On the board at the start | All 32 Worries: the top 4 rows of the board |
| Speed | **Worries here take 2 steps** per enemy turn (`tileSpeed: { worry: 2 }`) |
| Total | **4 Worry rows = 32 Worries**, all on the board from the start; nothing more comes |
| Actions | None |
| Reward *(tune)* | 20–30 Talents, 25% chance of a fruit (normal tier) |
| Description (data; the picture is shown instead) | "Four Worry rows filling the top half of the board (rows 5 to 8 from the bottom): **32 Worries** in all, all on the board from the start. Nothing more comes. Worries here take 2 steps per enemy turn." |

You win the moment no Worries are on the board, even if more are still to come
([combat § 6](combat.md#6-winning-and-losing)).

### Financial Stress

| | |
|---|---|
| Generator | Rows 1–6 normal. Rows **7–16**: **Worry in the far-left and far-right columns**. Rows **8–10**: **Greed** in the middle four columns, a **4×3 block** whose bottom row starts on the board's top row. Then normal forever |
| On the board at the start | 4 Worries (the edge columns of rows 7 and 8) and 4 Greed (row 8, the middle four) |
| Total | **32**: 20 Worries (4 on the board, 16 to come) and 12 Greed (4 on the board, 8 to come) |
| Actions | None |
| Reward *(tune)* | 25–40 Talents, 25% chance of a fruit |

### All Quiet (elite)

| | |
|---|---|
| Generator | Rows 1–4 normal. Rows **5–8**: a **Depression zigzag** in both edge pairs of columns, mirrored: from the top, (0,0) and (7,0), (1,1) and (6,1), (0,2) and (7,2), (1,3) and (6,3). Then normal forever |
| On the board at the start | All 8 Depressions |
| Total | **8** Depressions, nothing to come. Depression spreads, so more appear during the fight |
| Actions | None |
| Reward *(tune)* | 40–60 Talents, a fruit (elite tier) |

**Under review:** spreading to one neighbour per Depression still compounds, because new Depressions spread too. With
no Worries the bot averages about 9.5 damage and wins about half the time, but it depends on the loadout:
loadouts with Prophecy win 58–100%, and loadouts without it win 0–17%. See
[combat-tuning.md § 5](combat-tuning.md#5-measurements).

## 5. Data files

```ts
// src/content/enemyTiles.ts
interface EnemyTileDef {
  id: string;              // 'worry'
  name: string;            // 'Worry'
  description: string;
  icon: string;            // asset path
  hp: number;
  speed: number;           // steps per enemy turn (Greed: 2)
  onEnemyTurnEnd?: 'junkAdjacentTools' | 'spreadToAdjacent'; // Greed, Depression
  damage: number;          // damage when it hits from the bottom row (Worry: 1)
}

// src/content/enemies.ts
type GeneratedRow =
  | 'normal'
  | { tile: string }                 // a full row of that tile
  | { cells: (string | null)[] };   // 8 cells: an enemy tile id, or null for normal
type EnemyAction =
  | { type: 'spawnRow'; tile: string; row: number }
  | { type: 'spawn'; tile: string; cells: { x: number; y: number }[] }
  | { type: 'spawnRandom'; tile: string; count: number; rows?: number[] };

interface EnemyDef {
  id: string;              // 'hard_choices'
  name: string;            // 'Hard Choices'
  description: string;     // pattern + totals as text (screen readers); the UI draws the picture instead
  portrait: string;
  generator: GeneratedRow[]; // bottom of the board upwards; normal forever after the end
  actions: EnemyAction[];    // default []
}
```

**Validation** (content tests):
- every tile id exists,
- at least one enemy tile is in the first 8 rows, so the enemy isn't defeated at the start,
- the description's totals match the generator (a test counts the enemy tiles).

## 6. Assets needed

- Worry tile art (placeholder until drawn).
- Hard Choices portrait: `portraits/hard_choices.svg` (a crossroads signpost).
- Financial Stress portrait: `portraits/financial_stress.svg` (a pile of overdue bills).
- Greed tile art (placeholder: the gold coin icon).
- All Quiet portrait: `portraits/all_quiet.svg` (an empty chair by a rainy window).
- Depression tile art: `spells/dud/depression.png` (grey-white puddle).
