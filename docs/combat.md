# Combat

**The authoritative rules for battles** after the November 2026 combat rework. This doc replaces the
old "1–4 enemies with intent cycles" design (D14). Where [spec.md](spec.md) and this doc disagree on
combat, this doc wins.

- Enemy and enemy-tile content: [enemies.md](enemies.md).
- Tuning goals (set density, cascades, damage) and sim results: [combat-tuning.md](combat-tuning.md).
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
  four Worry rows (rows 5 to 8 from the bottom, the top half), all on the board from the start
  ([enemies.md § 2](enemies.md#2-the-generator)).
- **Gravity and refill:** every tile falls straight down into empty cells below it. That includes tools,
  junk, Stones and **enemy tiles**. Each column refills from **its own position in the generator**: the k-th
  tile to enter a column is that column's cell in the k-th generated row above the board. Columns advance
  independently. When the generator runs out, it's normal rows forever.
- **Tile pool** *(tune)*: your **3 chosen tools** (§2.1) at **70%**, shared by tile weight (Love fruit adds weight), and the 2 junk tiles (Time, Space) at
  **30%**, shared equally. Normal cells draw from it. Stones never come from it: they come only from the Word.
- **Initial fill:** normal cells are rolled with no ready-made matches (re-roll until there are none).

### 1.1 Tile kinds

| Kind | Examples | Matches? | Notes |
|---|---|---|---|
| **Tool** | Prayer, Thanksgiving, The Word, Prophecy, Worship, Preaching, Anoint | Yes: 3+ of the same tool | The effect triggers when the set clears ([tools.md](tools.md)) |
| **Junk** | Time, Space | Time: 3+ Time. **Space never matches** | Time has a small effect. Space is inert: only damage clears it, and it breaks lines like an enemy tile |
| **Stone** | Stone | Yes: 3+ Stones clear (damaged or not), with no effect | 2 HP. Blocks enemy tiles (§4.2) |
| **Enemy** | Worry | **Never** | Blocks lines. Destroyed by damage, or transformed into a Stone by the Word (§5) |

Different kinds never match each other. An enemy tile or a Space in the middle of a line breaks the line.

### 1.2 HP and damage

There's no "remove" effect, only **damage**:

- **Every tile has HP.** Tools, junk and Worries have **1 HP**. Stones have **2 HP**. Later enemy tiles will
  have more.
- **Damage ≥ remaining HP → the tile is deleted.** Otherwise it loses that much HP and stays where it is.
  Deleted tiles never trigger their own effects. Damage doesn't heal back.
- Damage only comes from **effects**: Prayer, the Word, Prophecy, Time, abilities, Shining, and Worries
  stepping down.
  Matching a set isn't damage. The set just clears.
- **Enemy tile badges:**
  - **HP** is a red number in the **top-right** corner.
  - **Move speed** is shown as arrows at the **bottom-middle**: ↓ = 1 step per activation, ↓↓ = 2, and so on.
    A Worry shows a red **1** and one arrow.
- A Stone that has taken 1 damage shows a crack.

## 2. Turn structure

```
battle start: choose 3 tools (§2.1) → build the board from the enemy's generator → Block 0, no statuses
┌▶ PLAYER TURN
│    Block clears
│    moves = 3
│    swap … resolve sets, placements, cascades … until moves = 0 or END TURN
│    END OF PLAYER TURN: your tiles activate (Shining tiles damage adjacent enemy tiles)
│  ENEMY TURN
│    1. enemy actions, if it has any (default: none; Hard Choices has none)
│    2. enemy tiles activate, bottom row first (Worry: move down 1, or hit you from the bottom row)
│       then end-of-enemy-turn effects (Greed turns adjacent tool tiles into junk)
│    3. the board settles: gravity, refill from the generator, cascades (§3.4)
└──┘
```

- **Moves:** one move = one swap of two orthogonally adjacent tiles. A swap costs a move **even without a
  match**. Any two tiles can be swapped, **enemy tiles included**, so you can pull a Worry back up or push it into place.
- **When the third move resolves**, the turn ends by itself. **End Turn** ends it early, and any moves left
  are lost.
- **Abilities** can be used any time during your turn, outside a placement. They cost no move
  ([tools.md § 5](tools.md#5-abilities)).
- **"Your tiles activate"** is the end-of-turn step. Right now only **Shining** uses it: each tile of a tool
  with Joy deals 1 damage per Shining to every **enemy** tile orthogonally next to it, in reading order. Then
  the board settles. Tool sets themselves trigger the moment they clear, not here.

### 2.1 Choosing tools

Before every battle (run or quick fight), you pick **3** of your owned tools. The screen shows the enemy (with
its setup description) and your tools with their fruit. FIGHT is enabled once 3 are picked. Your last pick is
preselected.

## 3. Matching and tool effects

### 3.1 Sets

After a swap, the board looks for **sets**: 3+ tiles of the same kind in a straight row or column. L and T
shapes merge at the shared tile into one set. Each set has a **size** (number of tiles) and a **shape** (which
cells it covered).

### 3.2 Resolving a set

1. The set's tiles clear.
2. Its effect triggers:
   - a **tool** set → the tool's effect ([tools.md](tools.md)),
   - **Time** → you deal 1 damage to 1 tile,
   - **Stone** → nothing. (Space never forms sets.)
3. If the effect needs **placement** (Prayer's or Prophecy's shape, the Word's or Time's picks), the board first **falls and refills**, then you place it (§5). The board waits until you finish.

**Supportive** tiles (Kindness fruit) orthogonally next to a set of a different tool are pulled into it before
it clears ([tools.md § 2.1](tools.md#21-supportive-linked-tiles)).

Sets are resolved in **reading order of their top-left tile**: top row first, then left to right. This order
decides which set uses up a Critical.

### 3.3 Critical

**Critical** doubles the **next tool set**, then expires. Its only source, Fasting, is parked, so it doesn't come up
right now. See [tools.md § Fasting](tools.md#fasting-parked).

- Prayer → you place the set's shape **twice**.
- The Word → you pick twice as many tiles.
- Prophecy → you place the set's shape **twice**, and gain twice the Foresight.
- Thanksgiving → twice the Block.
- Fasting → Critical 2: the next **two** tool sets are doubled.

Junk and Stone sets don't use up Critical.

### 3.4 Cascades

After the sets resolve, gravity drops every tile and the top refills from the enemy's generator (§1). Then
any placements are made, the board falls again, and any new sets resolve the same way. This repeats until the
board is stable.

**Refill damping** *(tune)*: a new tile dropping in from above the board that would complete a set is redrawn
(chance `refillNoMatchChance`, currently **1**: always). Tiles already on the board are never changed, so
cascades you set up on purpose (clear a set so the tiles above fall into another) still go off. Only the sets
you couldn't see coming are removed. Goals and measurements: [combat-tuning.md](combat-tuning.md).

Sets that form **during the enemy turn**, from gravity after a Worry moves, also resolve, and their
placements are asked for then. You get the effect, and it costs no move.

## 4. Enemy tiles

### 4.1 Activation

At step 2 of the enemy turn, every enemy tile **activates** once. Tiles are processed from the **bottom row
up**, left to right within a row. What a tile does is defined by its type ([enemies.md](enemies.md)). The
base enemy tile, **Worry**, does this:

- **Speed 1** (one arrow): it takes one **step** per activation.
- **On the bottom row:** the step deals **1 damage** to you. It stays where it is and hits again next turn.
- **Otherwise:** the step deals **1 damage** to the tile below it:
  - if that tile is **deleted** (a tool, junk, or a Stone already at 1 HP), the Worry moves into its cell,
  - if it **survives** (a full-HP Stone drops to 1 HP), the Worry **stays put** this turn,
  - if it's **another enemy tile**, there's no damage and the Worry **stays put**. Enemy tiles never damage
    each other.

Tiles faster than speed 1 take that many steps, one after another. Exactly how they behave is decided when
the first one is designed.

Because tiles are processed bottom-up, a column of Worries moves down together when the lowest one can move.
Every move leaves a gap at the top of the column, which refills from the generator, so each Worry step pulls
the next generated tile into that column.

### 4.2 Stones

Stones have **2 HP**. They fall with gravity and can be swapped. 3+ Stones in a line match and clear with no
effect, whether they're damaged or not.

Against a Worry, the first step leaves the Stone at 1 HP and stops the Worry for that turn. The second step
deletes it, and the Worry moves into its cell. So a Stone holds a Worry back for one turn and protects the tile
below it for two. The same 2 HP means a Time hit or a Word pick (1 damage) only cracks a Stone, while Prayer (3 damage) breaks it.

### 4.3 Damage and Block

- Damage to **you** works like this. Each Worry hit is **1 damage**. **Block** absorbs damage first, point for point, and the rest comes off
  **Courage**.
- Block **only absorbs damage**. It doesn't stop enemy tiles moving. (Until 2026-11-24 leftover Block also stopped
  enemy steps.)
- Block is gained on your turn (Thanksgiving, Worship, Peace, Stand Firm), lasts through the enemy turn, and **clears
  at the start of your next turn**.

### 4.4 Locked

Preaching **Locks** enemy tiles ([tools.md](tools.md#preaching)). Through the next enemy turn a Locked tile:

- **doesn't move**: no steps, so it doesn't damage the tile below. Enemy tiles above it in its column stop behind it
  as usual, so locking the lowest one holds the column;
- **doesn't activate**: no On activate (Greed's junking, Depression's spread);
- **deals no damage**: no At bottom hit on you.

A lock made on your turn lasts through that round's enemy turn. One made after the enemy turn (a set that cascades
while the board settles) lasts through the next one. It wears off at the start of the following turn; locking a
Locked tile again only refreshes it. Gravity still applies: a Locked tile falls into gaps below it. It shows a
padlock.

## 5. Placement

Some effects ask you to pick tiles on the board. The board has already fallen and refilled, so there are no
holes to aim at.

- **Tap where it goes.** The tiles it will hit light up (the rest of the board dims). Each shows the damage it
  will take ("−1"), tiles that will break get a ✕, and for the Word a faint Stone shows where one will appear.
  Tapping elsewhere moves the choice.
- **Several placements are chosen together.** The Word's picks and a doubled Prayer's or Prophecy's two shapes are
  picked one tap each, with a counter ("2 / 3 chosen"), then applied together.
- **Tapping a chosen tile again unselects it** (for shapes and lines, any tile inside it). So each tile can be
  chosen once per group.
- Then **Continue** or **Select again**.
- Shapes and lines are centred on the tile you tap and kept on the board. Placements are **mandatory** and can't be saved for later.

Every placement is described by the three damage attributes **Targets** (*Choose shape* or *Choose anywhere*),
**Dmg** and **On destroy** ([tools § 1.1](tools.md#11-owned-tools-and-the-battle-loadout)). The placing banner
shows them, e.g. *"Prayer: Targets: Choose shape (3 tiles) · Dmg: 3"*; On destroy appears only when a broken
tile becomes another tile, shown as that tile's icon (tap it for its popup).

### 5.1 Choose shape (Prayer, Prophecy)

- A Prayer or Prophecy set gives one copy of **the set's shape**: a horizontal 3 gives a horizontal line of 3, a
  vertical 4 gives a vertical line of 4, and an L of 5 gives that same L.
- You choose where it goes. It can sit anywhere it fits entirely on the board, the **same way round** (no
  rotating).
- **Every tile under it takes damage** (§1.2): enemy tiles, tools, junk and Stones alike. Prayer deals **3**
  *(tune)*; Prophecy deals **1**, and a tile Prophecy breaks becomes **Space** in place (nothing falls).

### 5.2 Choose anywhere (Time)

A Time set: **pick 1 tile** anywhere, including an enemy tile. It takes **1 damage**.

### 5.3 Choose anywhere, On destroy: Create Stone (The Word)

**Pick tiles**, 1 per tile in the set, **anywhere** on the board. They don't need to be adjacent. Each takes
**1 damage** (more with Faithfulness, or with every 3 Foresight):

- If the hit **deletes** the tile, a full-HP **Stone** takes its place. It's a transformation, so nothing falls.
  On an **enemy tile**, the Worry becomes a Stone, which counts towards victory.
- If the tile **survives** (e.g. a Stone, which has 2 HP), it just takes the damage, and no Stone appears.

### 5.4 Abilities

Abstain: **pick 1 tile**. Many Fish: place a **line of 3** (you choose horizontal or vertical first), and every
tile under it takes damage. All of them are damage (§1.2).

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
| **Courage** max | 20 | Goodness fruit heals up to this |
| **Statuses** | none | Critical, Foresight. Full list: [tools.md § 6](tools.md#6-statuses) |

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
│ ♥ Courage 17 │ ▫▫▫▫▫▫▫▫ next │
│ ◈ Block 2    │ ■■■■■■■■ 8×8  │
│ Critical ×1  │ On 11 · To 16 │
│ ●●○ moves    │ (hold: info)  │
│ [END TURN]   │               │
└──────────────┴───────────────┘
```

- **Board:** full screen width minus the gutters. Tile size = `min((width − 16) / 8, …)`, so the two panels
  still fit below. Tiles stay square.
- **Player panel (left):** Courage, Block, statuses, move pips and End Turn. **Hold (or tap) a status chip**
  (Block, Critical, Foresight) to see what it does. Abilities go here too once they're
  redesigned (TBD).
- **Enemy panel (right):** name, a **picture of what's coming**: a small 8×8 grid of the next 8 tiles in each
  column, nearest at the bottom, with enemy squares marked ([enemies.md § 2](enemies.md#2-the-generator)). Below
  it, its tiles **on the board** and **to come**. Long-press shows the same picture larger, then each enemy tile type as
  its **icon with "× 18 of 20 left"** (on the board + still to come, out of the total). Hold or tap an icon for
  that tile's details, as when holding it on the board. Any enemy actions are shown as "Next: …".
- **Long-press** any tile for its info popup.
- **Danger cue:** every enemy tile that will hit you in the coming enemy turn pulses red, from any row: a Speed 2
  or 3 tile higher up with a clear path counts. The game runs the real end of turn on a copy (Shining, then each
  enemy tile's steps, bottom first; Stones, Locks and enemy tiles in the way all count) to find them
  (`incomingHits` in `src/engine/combat.ts`). Block doesn't change it. Shown on your turn once the board settles.

## 9. Quick fight from the main menu

The main menu gets a **Fight** button. It opens an **enemy picker** listing every enemy (name, portrait, short
description). Picking one goes to the tool choice (§2.1) with a fresh player (20 Courage, the 5 starting tools,
no fruit or abilities). Win or lose, the result screen returns to the main menu. A quick fight never touches
the run save.

## 10. Feedback and animation

- Swaps, clears, falls and refills animate as before. During playback, input is locked, and a tap
  fast-forwards.
- Enemy turn: enemy actions play (if any), then the Worries step down one at a time, bottom row first, and new
  tiles slide in from the generator. A tile destroyed by a Worry shatters. A damaged Stone shows a crack. A hit flashes the player
  panel, with a "−1" floater.
- Placement mode dims the board outside valid targets.
