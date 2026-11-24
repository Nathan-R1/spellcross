# Tile Effects: Triggers and Effects

**Intent:** every tile's behaviour, and the text that describes it, is built from **one flexible, extensible
framework**. A tile is a handful of stats plus a list of **triggers**, and each trigger holds a list of
**effects**. New tiles are made by combining existing triggers and effects in data, not by writing a special case
for each tile. When a tile needs something genuinely new, add a new trigger or effect **type** to the framework
(§6), so every other tile can use it too.

Examples the framework allows in data alone:

- an enemy tile that, **at bottom**, deals 1 Dmg to you *and* gives you a status;
- an enemy tile that, **on activate**, attacks adjacent tiles *and* creates a tile;
- a tool whose set does two things one after the other (Prophecy: an Attack, then Gain Foresight);
- tool X whose Attack creates tool Y on destroy, while tool Y's creates tool X.

The rules themselves stay in [combat.md](combat.md), [tools.md](tools.md) and [enemies.md](enemies.md). This
doc defines the vocabulary they use. Code: types in `src/engine/types.ts` (`Effect`, `Targets`, `Triggers`,
`TileDef`), the runner in `src/engine/combat.ts`, text in `src/content/describe.ts`.

## 1. A tile

Every tile definition (tools, junk, the Stone, enemy tiles) is a `TileDef`:

| Part | What it is |
|---|---|
| **Name, icon, colour** | Identity |
| **HP** | Damage it takes before it breaks |
| **Speed** | Steps down per enemy turn. **0** for anything that doesn't move by itself (tools, junk, Stones, Depression); gravity still applies. A fight can override it (`EnemyDef.tileSpeed`) |
| **Triggers** | When something happens, each with its **effects** (§2, §3) |
| **Description** | Optional free text for anything the triggers don't say. Normally empty |

A tile **forms sets only if it has a Set formed trigger**. Space and enemy tiles have none.

Abilities have no tile, but use the same effects under the **On use** trigger.

## 2. Triggers

A trigger is a moment in the battle. Each trigger holds an **ordered list of effects**, which resolve one after
the other. A trigger with no effects is **hidden**: there is never an "N/A" or "-" line.

| Trigger | When it fires | Used by |
|---|---|---|
| **Set formed** | 3+ of this tile clear as a set (from your swap or a cascade) | Tools, Time, Stone |
| **Each step** | Each step down (Speed > 0). An Attack on *the tile below* is the **push**: the tile moves in if it breaks that tile, and stays if it doesn't | Worry, Greed, Grief |
| **On activate** | The end of every enemy turn, after every enemy tile has moved, while the tile is on the board (Locked tiles skip it) | Greed, Depression, Worship |
| **At bottom** | Each enemy turn the tile spends on the bottom row | Worry, Greed, Depression, Grief |
| **On use** | An ability is used | Abilities |

Planned, not built yet: **Start of your turn**, **End of your turn** (Joy's Shining fits here), **When broken**
(the tile's own death).

## 3. Effects

An effect is a verb with its own sub-properties. Sub-properties that don't apply are hidden.

| Effect | Sub-properties | Example |
|---|---|---|
| **Attack** | **Targets**, **Dmg**, **On destroy**, **Apply** (a tile status for each target that survives) | Prayer: Choose shape (the set's shape) · Dmg 3. Preaching: … Dmg 0 · Apply: Locked. Anoint: … Dmg 0 · Apply: +1 Strengthen |
| **Create** | the tile (an icon, or random junk) and **where** (targets) | Depression: Create [Depression] on 1 random adjacent tool or junk |
| **Gain** | what (**Block, Critical, Foresight, Moves, Courage**) and **how much** | Thanksgiving: Gain: Block, 1 per tile in the set |
| **Clears self** | none: the set just clears | Stone |
| **Remove self** | none: the tile leaves the board. Not damage, so nothing breaks it and no On destroy | Grief, At bottom (after its hit) |

### 3.1 Targets

| Targets | Who picks | Meaning |
|---|---|---|
| **Choose anywhere** (N tiles) | You | Single tiles anywhere on the board, optionally only of some kinds. The same tile can be picked more than once |
| **Choose shape** (the set's shape / a line of N) | You | A shape placed where it fits, the same way round; a line can be horizontal or vertical |
| **The tile below** | The game | The tile directly under this one |
| **Every / N random adjacent** *kinds* | The game | Orthogonally adjacent tiles of the listed kinds (tool, junk, Stone, enemy tile), optionally only some tiles by id (Worship: Space) |
| **You** | The game | The player |

Targets you choose only make sense when you act: **Set formed** and **On use**. Enemy triggers use game-picked
targets. (A content test enforces this.)

**Amounts** are a number or **"N per tile in the set"** (Set formed only).

**On destroy** is a tile (shown as its icon) that each target this Attack breaks turns into, in place, so nothing
falls. A tool tile can only be created if that tool is in the battle; otherwise the target just breaks.

### 3.2 Modifiers

Fruit, statuses and Foresight change effects instead of adding special cases:

| Modifier | Effect |
|---|---|
| **Critical** | The next tool set's effects all happen **twice** (Attacks queue twice, Gains double). Effects marked *once per turn* still happen once |
| **Faithfulness** | +1 Dmg per fruit on the tool's Attacks |
| **Foresight** | +1 Dmg per 3 Foresight on **Truth** tools' Attacks, read when the Attack runs (so Prophecy's own Foresight Gain, after its Attack, boosts later sets only) |
| **Patience** | +1 HP per fruit on tiles the tool's Attacks create (the Word's Stones, Prophecy's Space) |
| **Peace, Goodness, Self-Control** | Add their own effects to the end of the tool's Set formed list: Gain Block (1 per tile in the set, per fruit), Gain Courage, Gain Moves (once per turn) |
| **Gentleness, Love, Kindness, Joy** | Stats, not effects: tile HP, pool weight, Supportive, Shining |
| **Strengthen** (a tile status, from Anoint) | +1 set size per point on a tile in the set, so every "per tile in the set" amount grows; a set's shape grows by 1 cell per point, along its longest straight line |

### 3.3 On activate: claims

All On activate effects resolve together at the end of the enemy turn:

1. Tiles with On activate (enemy tiles and Worship), except Locked ones, are visited in **reading order** (top-left first). Each one's Create targets are **claimed** from the
   board as it is before anything changes, so a tile created this turn doesn't act until next turn.
2. **A cell can be claimed once per turn: the first claim wins.** "Every adjacent" skips claimed cells, and "N
   random" picks only from unclaimed ones.
3. All Creates then apply in reading order of their cells. A random junk tile is drawn from the junk in play.
4. Other On activate effects (Attacks, Gains) then apply in the order the tiles were visited.

## 4. Text

All player-facing text is **generated from the data** (`src/content/describe.ts`, one renderer per effect type),
never written by hand, so it can't disagree with what the engine does. A tool's popup shows the same Set formed
list the engine runs, fruit effects included. The format:

```
Prophecy                       HP 1/1 · Speed: 0
Set formed:
  Attack
    Targets: Choose shape (the set's shape)
    Dmg: 1
    On destroy: Create [Space]
  Gain: Foresight, 1 per tile in the set
```

```
Depression                     HP 3/3 · Speed: 0
On activate:
  Create [Depression] on 1 random adjacent tool or junk
At bottom:
  Attack
    Targets: You
    Dmg: 1
```

Every tile icon opens that tile's popup (tap or hold), stacked with Back, so references can be followed forever.

## 5. Current tiles

| Tile | Speed | Triggers |
|---|---|---|
| Prayer | 0 | Set formed: Attack (Choose shape: the set's shape · Dmg 3) |
| The Word | 0 | Set formed: Attack (Choose anywhere: 1 tile per tile in the set · Dmg 1 · On destroy: Create [Stone]) |
| Prophecy | 0 | Set formed: Attack (Choose shape: the set's shape · Dmg 1 · On destroy: Create [Space]); Gain Foresight, 1 per tile in the set |
| Anoint | 0 | Set formed: Attack (Choose anywhere: 1 tile per tile in the set · Dmg 0 · Apply: +1 Strengthen) |
| Fasting (parked) | 0 | Set formed: Gain Critical, 1 |
| Thanksgiving | 0 | Set formed: Gain Block, 1 per tile in the set |
| Worship | 0 | Set formed: Gain Block, 1 per tile in the set. On activate: Attack (Every adjacent [Space] · Dmg 1) |
| Preaching | 0 | Set formed: Attack (Choose anywhere: 1 tile per tile in the set · Dmg 0 · Apply: Locked) |
| Parked tools | 0 | Set formed: Clears self |
| Time | 0 | Set formed: Attack (Choose anywhere: 1 tile · Dmg 1) |
| Space | 0 | none (never forms sets) |
| Stone | 0 | Set formed: Clears self |
| Worry | 1 (2 in Hard Choices) | Each step: Attack (the tile below · Dmg 1). At bottom: Attack (You · Dmg 1) |
| Greed | 2 | Each step: as Worry. On activate: Create random junk on every adjacent tool. At bottom: Attack (You · Dmg 1) |
| Depression | 0 | On activate: Create [Depression] on 1 random adjacent tool or junk. At bottom: Attack (You · Dmg 1) |
| Grief | 2 | Each step: as Worry. At bottom: Attack (You · Dmg 3), Remove self |

## 6. Adding something new

- **A new tile** from existing pieces: data only (`src/content`). The content test checks its references and that
  every effect has text.
- **A new effect type or target type:** add it to `Effect` / `Targets` in `types.ts`; handle it in the runner in
  `combat.ts` (`runSetEffects` for Set formed and On use, `applyNow` and `onActivate` for game-picked targets); give
  it a renderer in `describe.ts` (`effectRows`, `targetsText`). TypeScript's exhaustive switches flag every place
  that needs it.
- **A new trigger:** add it to `TriggerId` and `TRIGGERS`, fire it from the battle loop in `combat.ts`, and give it
  a label in `TRIGGER_LABEL`.
