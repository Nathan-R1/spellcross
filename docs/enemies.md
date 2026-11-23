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
- **can't be swapped**,
- **falls with gravity** like any tile,
- **activates** once per enemy turn, bottom row first ([combat § 4.1](combat.md#41-activation)),
- **never destroys another enemy tile**. If its move is blocked by one, it stays put,
- enters the board from the enemy's **generator** (§2), or from an enemy action (§3),
- leaves the board only through **Prayer** removal shapes and **Time**, or by being **transformed** into a
  Stone by **the Word** ([combat § 5](combat.md#5-placement)).

Each tile type has an **HP** value. For now nothing deals partial damage (removal is outright), so HP is
recorded for future tools.

### Worry (base enemy tile)

| | |
|---|---|
| HP | 1 |
| On activate | On the bottom row: **1 damage** to the player, and it stays. Otherwise **move 1 down**. A tool or junk tile below is destroyed. A Stone below cracks, and the Worry stays. A Cracked Stone below breaks, and the Worry moves in. Another enemy tile below blocks it |
| Art | placeholder from the old junk art (e.g. `spells/dud/ash.png`) until drawn |

## 2. The generator

An enemy's main mechanic is its **generator**: the stack of rows the board is built from and refills from.

- The generator is an ordered list of **generated rows**, from the **bottom of the board upwards**. Each row
  is `normal` (8 tiles from the tile pool) or an **enemy row** (e.g. 8 Worries).
- The first 8 entries are the **initial board**: entry 1 is the bottom row and entry 8 is the top row.
- Entries 9 onwards sit **above the board**. Each column refills from its own position in the list: the next
  tile to drop into column *x* is column *x* of that column's next generated row
  ([combat § 1](combat.md#1-the-board)). Columns advance independently, so the rows break up as they come in.
- When the list runs out, it's `normal` rows forever.
- Generated rows can be written as a list or with repeats. For example, Hard Choices is "7 × normal, then
  3 × (Worry, normal), then Worry".

The enemy's **setup description** must spell out the pattern **and the totals**, so a long-press on the
enemy shows straight away how many enemy tiles are coming.

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
| Generator | 7 × normal (the bottom of the board), then **Worry, normal, Worry, normal, Worry, normal, Worry**, then normal forever |
| On the board at the start | The bottom 7 rows are normal, and the **top row is all Worries** |
| Total | **4 Worry rows = 32 Worries**: 8 on the board at the start and 24 still to come |
| Actions | None |
| Setup description (shown on hold) | "Rows of Worry with a normal row between each: 4 Worry rows, **32 Worries** in all. The first row starts on the board." |

You win the moment no Worries are on the board, even if more are still to come
([combat § 6](combat.md#6-winning-and-losing)).

## 5. Data files

```ts
// src/content/enemyTiles.ts
interface EnemyTileDef {
  id: string;              // 'worry'
  name: string;            // 'Worry'
  description: string;
  icon: string;            // asset path
  hp: number;
  onActivate: TileBehaviour; // 'stepDownOrHit' for Worry; more behaviours added as needed
  damage: number;          // damage when it hits from the bottom row (Worry: 1)
}

// src/content/enemies.ts
type GeneratedRow = 'normal' | { tile: string };       // an enemy row: 8 of that tile
type EnemyAction =
  | { type: 'spawnRow'; tile: string; row: number }
  | { type: 'spawn'; tile: string; cells: { x: number; y: number }[] }
  | { type: 'spawnRandom'; tile: string; count: number; rows?: number[] };

interface EnemyDef {
  id: string;              // 'hard_choices'
  name: string;            // 'Hard Choices'
  description: string;     // the setup description: pattern + totals (shown on hold and in the picker)
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
- Hard Choices portrait (placeholder until drawn).
