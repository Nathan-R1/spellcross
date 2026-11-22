# Core Combat Loop

This is the design spec for Spellcross battles. It **replaces** Spellford's 1v1 shared-board battle
(decision **D14** in [features.md](features.md)). Spellford's board mechanics (swapping, matching,
cascades, linked tiles, locks, statuses) carry over. What changes is who plays on the board and how
enemies act.

**In one sentence:** the player makes 3 tap-tap swaps per turn on a match-3 board to cast spells at
1–4 enemies. Each enemy repeats a fixed cycle of intents, and the player can always see what each
enemy will do next.

Numbers marked *(tune)* are starting values for playtesting, not final balance.

---

## 1. Turn structure

```
battle start
  └─ each enemy's cycle position set (see §3.3)
  ┌▶ PLAYER TURN
  │    player statuses: onTurnStart (Block clears, Poisoned ticks, …)
  │    moves = movesPerTurn (3)
  │    player swaps / uses abilities / changes target, until moves = 0 or END TURN
  │    player statuses: onTurnEnd
  │    web locks free up (locked → free)
  │  ENEMY PHASE: for each living enemy, left to right:
  │    enemy statuses: onTurnStart (it may die here, e.g. from Poisoned)
  │    perform current intent
  │    advance the enemy's intent cursor (wraps around)
  │    enemy statuses: onTurnEnd
  │  ROUND START: all statuses onRoundStart
  └──┘
```

- **The player always goes first**, as in Spellford.
- **Win:** the battle ends **the moment the last enemy dies**, even mid-cascade or at an enemy's turn start
  (Poisoned). No later casts happen and the killing cast's self-damage doesn't apply. Remaining moves are lost.
  If the player dies at the same moment, **victory wins** (spec §6.3).
- **Loss:** player HP reaches 0 at any point. The battle stops immediately, even mid enemy phase.
- Then the ResultScreen (D9). Victory gold is the sum of each defeated enemy's reward roll, plus a possible gem
  drop (normal 25%, elite 100%; spells-and-gems §3.2).

## 2. The player's turn

### 2.1 Moves

- **3 moves per turn** (`movesPerTurn`, an entity stat; abilities and items can raise it later).
- **One move = one swap** of two orthogonally adjacent, available tiles (not locked, not hidden).
- A swap costs a move **even if it makes no match** (Spellford parity). Swapping to set up a later match
  is part of the skill.
- When moves reach 0, the turn **ends automatically** once the cascade animation finishes. An **End Turn**
  button ends it early.
- These are **free** (cost no moves): selecting a target, opening info popups, triggering abilities
  (abilities spend their own uses).

### 2.2 Input: tap to select, tap to swap

1. Tap a tile: it is selected (highlight ring).
2. Tap an orthogonally adjacent available tile: the two swap and the move resolves.
3. Tap the selected tile again: deselect. Tap any other tile: it becomes the selection.
4. Tapping a locked or hidden tile does nothing (brief shake).

There is no dragging and no path-drawing. Long-press on a tile opens its spell popup (Spellford's
"tap a tile's spell" info). A plain tap is reserved for selecting.

### 2.3 Targeting

- One enemy is always the **current target**, marked with a reticle. It defaults to the leftmost living enemy.
- **Tap an enemy** to make it the target. The choice stays until changed. If the target dies, the target
  moves to the leftmost living enemy.
- Each spell declares a `target`:
  - `single`: the current target (default for damage spells).
  - `all`: every living enemy, each taking the full formula.
  - `random`: one living enemy chosen from the battle RNG, per cast.
  - `self`: the player (Restore). A spell's *statuses* have their own self/target flag, so Shield is
    `single` (1 damage to the target) and also gives the player Block.
- Spell damage uses the formula in [features.md §5.4](features.md#54-damage-and-healing-formula-spellsspellkttriggerspell)
  separately for each target, including that target's weaknesses, resistances, Block and Perma Block.

### 2.4 The board

The board is the player's alone. Enemies never swap on it.

- **Tile pool** = the player's loadout spells + the base Dud spells (Ash, Rubble, Mist) + the base Nova
  spells (Surge, Critical) + the player's **selected junk**. There are no enemy spells or enemy junk, and no
  team tint (Spellford now tints by spell colour too).
- **Junk selection** (Spellford 5.1.6): in battle prep the player fills **2 junk slots** from their junk pool
  (starting pool: Orb, Slime). Selected junk joins the dud or nova share by its class. It's a real choice,
  because linked junk like Orb and Slime gets pulled into adjacent sets and clears space. Empty junk slots
  are allowed.
- **Pool weights must be retuned.** In Spellford, enemy spells made up part of the pool. With only the
  player's 3 loadout spells, Spellford's normalisation (duds total 3, novas total 3) would make only a
  third of tiles matchable. Starting split *(tune)*: **loadout spells 60%** (shared by each spell's weight: base 1, +0.2 per Weight gem, within the 60%; spells-and-gems §3.2), **duds 25%**
  (base duds and selected dud junk, shared equally), **novas 15%** (same rule).
- **Size: 8 columns × 6 visible rows** (D15), so 48 tiles. The hidden refill buffer above it is also 6
  rows.
- **Loadout slots: 3 for Road battles, 4 for Trail battles** (Spellford 3.3.7). FIGHT needs every slot
  filled (Spellford requires ≥3).
- **No reshuffle** (C4). Any swap of two adjacent available tiles is legal even without a match, so the
  player is never stuck. A board with no matching move just means setup swaps.
- Matching, cascades, linked tiles, locks and initial no-match fill work exactly as described in features
  §5.2, except that swapping **doesn't lock tiles** (D23). Spellford's swap locks stopped two players fighting
  over the same tiles; with one player on the board they only got in the way. Only Spin Web locks tiles.

## 3. Enemies and intents

### 3.1 Enemy model and intents

Enemies, generic and named intents, and the data-file format are specified in
**[enemies.md](enemies.md)**. In short:

- An enemy has a tier (`normal`, `elite` or `boss`), HP, a gold reward, and an **ordered list of
  intents** that it cycles through.
- An intent is either **generic** (Attack X, Defend X, Heal X, Heal Ally X, Heal Allies X, Buff, Debuff,
  Steal X, Lock N, Add Tiles) or **named**: a name and icon around any number of other intents, run in
  order (*Disable* = Attack 5 + Weaken 1).
- Intents can damage or debuff the player, heal or buff the enemy itself, heal or buff its allies, steal
  gold, or alter the board.

### 3.2 Targets and board effects

- **Ally targets:** "allies" are the living enemies, **including** the one acting. Heal Ally picks the
  living ally with the lowest HP fraction (ties go to the leftmost) and may pick itself. Heals can't
  exceed max HP and can't revive.
- **Board effects** (Lock, Add Tiles) are **elite and boss only**, enforced by content validation. They
  use the battle RNG.

### 3.3 The cycle

- Each enemy has an **intent cursor** into its `intents` array. It performs `intents[cursor]` on its turn,
  then the cursor advances and wraps.
- The cycle is **fixed and deterministic**. There's no AI, no conditions and no randomness in *which*
  intent comes next. (This replaces Spellford's behaviour tree. D2 no longer applies.)
- `start: 'random'` picks a random starting position from the battle RNG. Use it for enemies that often
  appear in groups, so two Wolves don't Fang on the same turn.
- An enemy that is stunned or skipped (future statuses) still advances its cursor.

### 3.4 Showing intents

Each enemy shows its **current intent** above its portrait at all times during the player's turn:

- an icon per category (sword = attack, down arrow = debuff, up arrow = buff, heart = heal, grid =
  board), with
- the **final number** after the enemy's Strength and Weak, e.g. "⚔ 6", or "⚔ 4×2" for multi-hit.
  It doesn't subtract the player's Block, which is shown on the player strip. It does include Strength from
  allies acting earlier in the same enemy phase (Rally before Maul), so the badge always matches the hit.

Tap an enemy to target it. **Long-press an enemy** to open its popup: name, HP, statuses, and the
**full cycle** with the current step highlighted and each intent's description.

## 4. Statuses in the new loop

Spellford's statuses carry over (features §5.6, with D1 and D4), with these changes for flat-damage intents:

| Status | Rule in Spellcross |
|---|---|
| **Strength** | *Player spells:* +value damage per tile (D1). *Enemy intents:* +value damage per hit. **Permanent for the battle and stacks.** Repeating buffs like the Wolf's Rage give each fight a clock. |
| **Weak** (was Weakness) | Damage dealt ×0.75, rounded down, after all additions. Applies to player spells and enemy intents. Value = turns remaining. Stacking adds turns. Ticks down at the owner's turn end. |
| **Block** | Unchanged (absorbs damage, clears at owner's turn start, D8). An enemy's Block clears at the start of *its* turn, so it protects through the player's turn. |
| **Poisoned** | Unchanged. Ticks at the owner's turn start, so enemy poison ticks during the enemy phase. |
| others | Unchanged. Each enemy's statuses are tracked and ticked independently. |

D14 amends D1: Weak becomes a ×0.75 multiplier instead of −value per tile, and Strength and Weak no longer
tick per cast.

## 5. Roster and encounters

See [enemies.md](enemies.md): **Wolf** and **Bear** (normal), **Spider** (elite), and the **Harbinger** (boss), plus
the starter encounters. Road battles draw normal encounters, Trail battles draw elite ones, and the boss is fought at
Finish (D17). Battles are drawn from encounter definitions (1–4 enemies, left to right), not
single enemies.

Spellford's enemy spells (Dark Bolt, Life Drain, Bite, Howl, Frenzy, …) don't go on the board. Some live
on as intent names. Wolf no longer starts with Charge 1 (Charge only affects spells).

## 6. Screen layout (phone landscape)

```
┌ Exit │ abilities ···························································┐ 40px
│ ┌──────────────────┐ ┌─ ⚔6 ──────── ⚔5 ▼ ───── ▦4 ──────── ⚔12 ─┐    │
│ │                  │ │  [wolf]      [wolf]◎    [spider]   [boss]   │    │ enemy zone
│ │   board 8×6      │ │  ▓▓▓▓ 60     ▓▓░░ 34    ▓▓▓ 75     ▓▓▓▓ 180 │    │
│ │   8 cols×6 rows, │ │  ☠2          W1         🛡5        STR2      │    │
│ │   tiles ≤48px    │ ├─────────────────────────────────────────────┤    │
│ │                  │ │ [you] ▓▓▓▓▓▓░ 72/100 🛡6 STR1 │ ●●○ END TURN │    │ player strip ~84px
│ └──────────────────┘ └─────────────────────────────────────────────┘    │
```

- **Left:** the board, **8 columns × 6 rows** (D15). Tile size is `(100dvh − top bar − 8px) / 6`, capped at
  **48px**, so tiles are ~45px on the 667×320 minimum and 48px from the reference size up. The cap stops
  the board from eating the enemy zone on larger phones. If the board is shorter than the space, it is
  centred vertically.
- **Right:** the **enemy zone**, which is the whole remaining width above the player strip. It has 1–4
  enemy slots with equal widths. Each slot holds the intent badge (top), portrait, HP bar and status row.
  With fewer enemies, slots get wider and portraits bigger, up to a cap. Dead enemies fade out but their
  slot stays, so nothing jumps around mid-fight.
- **Player strip** (bottom of the right side): portrait, HP, Block, statuses, the **moves pips** (●●○) and
  a 44px-tall **End Turn** button. This replaces Spellford's "tap your energy circle".
- Gold is hidden in battle. The top bar holds Exit and the ability bar.

Space check at the 844×390 reference: after safe areas (~47px each side on notched iPhones) and a 384px
wide board, the right side is ~366px wide, so 4 enemies get ~90px each. At the 667px minimum (no notch) the
board is ~363px wide, leaving ~300px, so 4 enemies get ~75px each. Intent badges and HP bars still fit, but portraits shrink. Status rows show up to 3 icons
plus "+n".

## 7. Feedback and animation

- **Player spell:** lightning bolt from the player portrait to each target, plus a floating damage number
  on each target (Spellford §5.10.6). `all` spells strike every enemy at once.
- **Enemy turn:** enemies act one after another, ~600ms each *(tune)*. The acting enemy lunges and its
  intent badge pulses. Damage flies to the player strip. Heals and buffs glow on their targets. Board
  effects animate lock overlays or tiles morphing on the board. After acting, the new intent fades in.
- The engine resolves the whole enemy phase at once and returns an event list. The UI plays it back, the
  same model as player moves (see [02-game-engine.md](architecture/02-game-engine.md)).
- Input is locked during playback. Tapping anywhere fast-forwards the remaining animation.

## 8. Open questions

Tracked in [open-questions.md](open-questions.md): the player's Strength value (C2). Decided: Strength and Charge
stay permanent (C1, watched in the M2 sim), junk selection is fine as is (C3), there's no reshuffle (C4), and
abilities cost no moves (C5). Hidden ("?") boss intents are not in v1.
