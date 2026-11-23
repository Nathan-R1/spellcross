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
- **activates** once per enemy turn, bottom row first ([combat § 4.1](combat.md#41-activation)),
- **never destroys another enemy tile**. If its move is blocked by one, it stays put,
- enters the board from the enemy's **generator** (§2), or from an enemy action (§3),
- leaves the board when **damage** reaches its HP, or by being **transformed** into a Stone by **the Word**
  ([combat § 1.2](combat.md#12-hp-and-damage), [§ 5](combat.md#5-placement)),
- shows its **HP** as a red number in the top-right corner and its **move speed** as arrows at the bottom-middle.

Each tile type has an **HP** value and a **speed** (steps per activation). Damage below its HP leaves it on
the board with less HP.

### Worry (base enemy tile)

| | |
|---|---|
| HP | 1 |
| Speed | 1 (↓) |
| On activate | On the bottom row: **1 damage** to the player, and it stays. Otherwise it deals **1 damage** to the tile below. If that tile is deleted, the Worry moves in. If it survives (a full-HP Stone), the Worry stays. Another enemy tile below blocks it, with no damage |
| Art | placeholder from the old junk art (e.g. `spells/dud/ash.png`) until drawn |

### Greed

| | |
|---|---|
| HP | 3 |
| Speed | 2 (↓↓): two steps per enemy turn, each dealing 1 damage to the tile below and moving in if it breaks. It stops as soon as a step doesn't break the tile |
| On the bottom row | Hits the player for 1 (once per enemy turn) |
| End of the enemy turn | After every enemy tile has moved, each **tool tile** orthogonally next to a Greed turns into a **random junk tile** from the junk in play (Time or Space). Junk, Stones and enemy tiles are untouched |
| Art | placeholder: the gold coin icon (`icons/gold.png`) |

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
- Generated rows can be written as a list or with repeats. For example, Hard Choices is "4 × (3 × normal,
  Worry)".

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
| Generator | A Worry row every 4th row: **rows 4, 8, 12 and 16** counting from the bottom of the board (3 normal rows between each), then normal forever |
| On the board at the start | **Row 4** (the middle) and **row 8** (the top) are all Worries; the rest are normal |
| Total | **4 Worry rows = 32 Worries**: 16 on the board at the start and 16 still to come |
| Actions | None |
| Reward *(tune)* | 20–30 Talents, 25% chance of a fruit (normal tier) |
| Description (data; the picture is shown instead) | "Rows of Worry with a normal row between each: 4 Worry rows, **32 Worries** in all. The first row starts on the board." |

You win the moment no Worries are on the board, even if more are still to come
([combat § 6](combat.md#6-winning-and-losing)).

### Financial Stress

| | |
|---|---|
| Generator | Rows 1–6 normal. Rows **7–16**: **Worry in the far-left and far-right columns**. Rows **9–11** (just above the board): **Greed** in the middle four columns, a **4×3 block**. Then normal forever |
| On the board at the start | 4 Worries: the edge columns of rows 7 and 8 |
| Total | **32**: 20 Worries (4 on the board, 16 to come) and 12 Greed (all to come) |
| Actions | None |
| Reward *(tune)* | 25–40 Talents, 25% chance of a fruit |

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
  onEnemyTurnEnd?: 'junkAdjacentTools'; // Greed
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
