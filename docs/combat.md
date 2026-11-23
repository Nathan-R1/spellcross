# Combat

**The authoritative rules for battles** after the November 2026 combat rework. This doc replaces the
old "1–4 enemies with intent cycles" design (D14). Where [spec.md](spec.md) and this doc disagree on
combat, this doc wins.

- Enemy and enemy-tile content: [enemies.md](enemies.md).
- Tools, junk tiles and statuses: [tools.md](tools.md).
- Design decisions for this rework are logged in
  [open-questions.md § Combat rework](open-questions.md#combat-rework-2026-11).

**In one sentence:** you face **one enemy** whose **tiles** march down an **8×8 board**. You get **3 swaps** a
turn to match your **tools**. You win when every enemy tile is gone, and you lose when your **Courage** runs
out.

Numbers marked *(tune)* are starting values for playtesting.

---

## 1. The board

- **8 columns × 8 rows**, always, and every row is visible.
- **The enemy's generator:** above the board, the enemy defines a stack of **generated rows**. Each one is
  either a **normal** row (tiles drawn from the tile pool) or an **enemy** row (e.g. 8 Worries). The board's
  own 8 rows are the bottom of that stack, so the generator also decides the initial board. Hard Choices:
  7 normal rows, the top row all Worries, then above the board normal, Worry, normal, Worry, …
  ([enemies.md § 2](enemies.md#2-the-generator)).
- **Gravity and refill:** every tile falls straight down into empty cells below it. That includes tools,
  junk, Stones and **enemy tiles**. Each column refills from **its own position in the generator**: the k-th
  tile to enter a column is that column's cell in the k-th generated row above the board. Columns advance
  independently. When the generator runs out, it's normal rows forever.
- **Tile pool** *(tune)*: the 4 tools at **70%**, shared equally, and the 2 junk tiles (Time, Space) at
  **30%**, shared equally. Normal cells draw from it. Stones never come from it: they come only from the Word.
- **Initial fill:** normal cells are rolled with no ready-made matches (re-roll until there are none).

### 1.1 Tile kinds

| Kind | Examples | Matches? | Notes |
|---|---|---|---|
| **Tool** | Fasting, Prayer, Thanksgiving, The Word | Yes: 3+ of the same tool | The effect triggers when the set clears ([tools.md](tools.md)) |
| **Junk** | Time, Space | Yes: 3+ of the same junk | Time has a small effect and Space has none |
| **Stone** | Stone, Cracked Stone | Yes: 3+ Stones clear (cracked or not), with no effect | Blocks enemy tiles (§4.2) |
| **Enemy** | Worry | **Never** | Blocks lines. Removed by Prayer and Time, or transformed into a Stone by the Word (§5) |

Different kinds never match each other. An enemy tile in the middle of a line breaks the line.

## 2. Turn structure

```
battle start: build the board from the enemy's generator → Courage 20, Block 0, no statuses
┌▶ PLAYER TURN
│    Block clears
│    moves = 3
│    swap … resolve sets, placements, cascades … until moves = 0 or END TURN
│    END OF PLAYER TURN: your tiles activate (none of the starting tiles do anything here yet)
│  ENEMY TURN
│    1. enemy actions, if it has any (default: none; Hard Choices has none)
│    2. enemy tiles activate, bottom row first (Worry: move down 1, or hit you from the bottom row)
│    3. the board settles: gravity, refill from the generator, cascades (§3.4)
└──┘
```

- **Moves:** one move = one swap of two orthogonally adjacent tiles. A swap costs a move **even without a
  match**. Enemy tiles **can't** be swapped. Stones and junk can.
- **When the third move resolves**, the turn ends by itself. **End Turn** ends it early, and any moves left
  are lost.
- **"Your tiles activate"** is a hook at the end of your turn, for future tiles with an end-of-turn effect.
  No tile has an end-of-turn effect yet. Tool effects trigger the moment their set clears.

## 3. Matching and tool effects

### 3.1 Sets

After a swap, the board looks for **sets**: 3+ tiles of the same kind in a straight row or column. L and T
shapes merge at the shared tile into one set. Each set has a **size** (number of tiles) and a **shape** (which
cells it covered).

### 3.2 Resolving a set

1. The set's tiles clear.
2. Its effect triggers:
   - a **tool** set → the tool's effect ([tools.md](tools.md)),
   - **Time** → you remove 1 tile,
   - **Space** or **Stone** → nothing.
3. If the effect needs **placement** (Prayer's removal shape, the Word's Stones, Time's single tile), you
   place it now (§5). The board is paused until you finish.

Sets are resolved in **reading order of their top-left tile**: top row first, then left to right. This order
decides which set uses up a Critical.

### 3.3 Critical

**Critical** doubles the **next tool set**, then expires. See [tools.md § Fasting](tools.md#fasting).

- Prayer → you place its removal shape **twice**.
- The Word → twice as many Stones.
- Thanksgiving → twice the Block.
- Fasting → Critical 2: the next **two** tool sets are doubled.

Junk and Stone sets don't use up Critical.

### 3.4 Cascades

After the sets resolve and their placements are done, gravity drops every tile, the top refills from the
enemy's generator (§1), and any new sets resolve the same way. This repeats until the board is stable.

Sets that form **during the enemy turn**, from gravity after a Worry moves, also resolve, and their
placements are asked for then. You get the effect, and it costs no move.

## 4. Enemy tiles

### 4.1 Activation

At step 2 of the enemy turn, every enemy tile **activates** once. Tiles are processed from the **bottom row
up**, left to right within a row. What a tile does is defined by its type ([enemies.md](enemies.md)). The
base enemy tile, **Worry**, does this:

- **On the bottom row:** deals **1 damage** to you. It stays where it is and hits again next turn.
- **Otherwise:** it tries to move **1 cell down**:
  - into an **empty** cell → it moves,
  - onto a **tool or junk** tile → that tile is **destroyed**, with no effect, and the Worry moves into its cell,
  - onto a **Stone** → the Stone becomes a **Cracked Stone**, and the Worry **stays put** this turn,
  - onto a **Cracked Stone** → it **breaks** (is destroyed) and the Worry **moves** into its cell,
  - onto **another enemy tile** → it **stays put**. Enemy tiles never destroy each other.

Because tiles are processed bottom-up, a column of Worries moves down together when the lowest one can move.
Every move leaves a gap at the top of the column, which refills from the generator, so each Worry step pulls
the next generated tile into that column.

### 4.2 Stones

Stones fall with gravity and can be swapped. 3+ Stones in a line match and clear with no effect. Cracked and
uncracked Stones match each other.

A Stone takes **2 hits** from a Worry. The first hit cracks it, and the Worry is stopped for that turn. The
second hit breaks it, and the Worry moves into its cell. So a Stone holds a Worry back for one turn and protects
the tile below it for two.

### 4.3 Damage and Block

- Each hit is **1 damage**. **Block** absorbs damage first, point for point, and the rest comes off
  **Courage**.
- Block is gained on your turn (Thanksgiving), lasts through the enemy turn, and **clears at the start of
  your next turn**.

## 5. Placement

Some effects ask you to pick tiles on the board. While placing, the board shows a highlight preview and a
banner ("Place 3 removes", "Place 2 Stones", …). Placements are **mandatory** and can't be saved for later.

### 5.1 Removal shapes (Prayer)

- A Prayer set gives one **removal shape**: the **same shape as the completed set**. A horizontal 3 gives a
  horizontal line of 3, a vertical 4 gives a vertical line of 4, and an L of 5 gives that same L.
- You choose where the shape goes. It can sit anywhere it fits entirely on the board, with the **same
  orientation** (no rotating).
- **Every tile under the shape is removed**: enemy tiles, tools, junk, Stones. Removed tiles don't trigger
  their effects.

### 5.2 Single removes (Time)

A Time set lets you remove **1 tile anywhere**, including an enemy tile.

### 5.3 Stone placement (The Word)

Place the Stones **one at a time** on **any tile** on the board. The tile **transforms** into a Stone. It
isn't removed, so nothing falls. Stones don't need to be adjacent. That includes an **enemy tile**: a Worry
transformed into a Stone is no longer an enemy tile, so it counts towards victory. Placing on a Stone or Cracked
Stone is allowed but does nothing (it doesn't repair a crack).

## 6. Winning and losing

- **Victory:** the moment the enemy has **no tiles left on the board**, even mid-cascade, and even if its
  generator still has enemy rows to come.
- **Defeat:** Courage reaches 0.
- **Both at once:** victory wins.
- After either one, the result screen shows and you return to where the battle started from: the map in a
  run, or the main menu after a quick fight.

## 7. Player stats

| Stat | Start | Notes |
|---|---|---|
| **Courage** | 20 *(tune)* | Replaces HP. Carries over between battles in a run (TBD with the run) |
| **Moves** | 3 per turn | |
| **Block** | 0 | Clears at the start of your turn |
| **Statuses** | none | Critical. Full list: [tools.md § Statuses](tools.md#statuses) |

## 8. Screen layout (portrait)

The battle screen is **portrait**: the board is on top, with two panels side by side below it.

```
┌──────────────────────────────┐
│ ←Exit        Turn 3   ⚙      │  top bar
├──────────────────────────────┤
│ ▢▢▢▢▢▢▢▢                     │
│ ▢▢▢▢▢▢▢▢                     │
│ ▢▢▢▢▢▢▢▢     8 × 8 board     │
│ ▢▢▢▢▢▢▢▢     square tiles,   │
│ ▢▢▢▢▢▢▢▢     full width      │
│ ▢▢▢▢▢▢▢▢                     │
│ ▢▢▢▢▢▢▢▢                     │
│ ▢▢▢▢▢▢▢▢                     │
├──────────────┬───────────────┤
│ YOU          │ HARD CHOICES  │
│ ♥ Courage 17 │ portrait      │
│ ◈ Block 2    │ On board: 11  │
│ Critical ×1  │ To come: 16   │
│ ●●○ moves    │ (hold: info)  │
│ [END TURN]   │               │
└──────────────┴───────────────┘
```

- **Board:** full screen width minus the gutters. Tile size = `min((width − 16) / 8, …)`, so the two panels
  still fit below. Tiles stay square.
- **Player panel (left):** Courage, Block, statuses, move pips and End Turn. Abilities go here too once they're
  redesigned (TBD).
- **Enemy panel (right):** name, portrait, its tiles **on the board**, and how many are still **to come** from
  its generator. Long-press shows its setup description, which spells out the generation pattern and totals
  (e.g. "Worry row, normal row, … 4 Worry rows, 32 Worries"), plus each tile type's description. Any enemy
  actions are shown as "Next: …".
- **Long-press** any tile for its info popup.
- **Danger cue:** Worries on the bottom row (about to hit you) pulse red. *(nice-to-have)*

## 9. Quick fight from the main menu

The main menu gets a **Fight** button. It opens an **enemy picker** listing every enemy (name, portrait, short
description). Picking one starts a battle straight away with a fresh player (20 Courage, the 4 starting tools,
no virtues or abilities). Win or lose, the result screen returns to the main menu. A quick fight never touches
the run save.

## 10. Feedback and animation

- Swaps, clears, falls and refills animate as before. During playback, input is locked, and a tap
  fast-forwards.
- Enemy turn: enemy actions play (if any), then the Worries step down one at a time, bottom row first, and new
  tiles slide in from the generator. A tile destroyed by a Worry shatters. A Stone that cracks shows a crack. A hit flashes the player
  panel, with a "−1" floater.
- Placement mode dims the board outside valid targets.
