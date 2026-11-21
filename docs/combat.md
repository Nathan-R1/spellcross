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
  │    board locks advance (pending → locked → free)
  │  ENEMY PHASE: for each living enemy, left to right:
  │    enemy statuses: onTurnStart (it may die here, e.g. from Poisoned)
  │    perform current intent
  │    advance the enemy's intent cursor (wraps around)
  │    enemy statuses: onTurnEnd
  │  ROUND START: all statuses onRoundStart
  └──┘
```

- **The player always goes first**, as in Spellford.
- **Win:** every enemy is dead. This is checked after each player move has fully resolved (including the
  whole cascade) and after each enemy's turn start (Poisoned). The battle ends at once, and the remaining
  moves are lost.
- **Loss:** player HP reaches 0 at any point. The battle stops immediately, even mid enemy phase.
- Then the ResultScreen (D9). Victory gold is the sum of each defeated enemy's reward roll.

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
  - `self`: the player (Heal, Shield).
- Spell damage uses the formula in [features.md §5.4](features.md#54-damage-and-healing-formula-spellsspellkttriggerspell)
  separately for each target, including that target's weaknesses, resistances, Block and Fortify.

### 2.4 The board

The board is the player's alone. Enemies never swap on it.

- **Tile pool** = the player's loadout spells + Dud spells + Nova spells. There are no enemy spells and no
  team tint.
- **Pool weights must be retuned.** In Spellford, enemy spells made up part of the pool. With only the
  player's 3 loadout spells, Spellford's normalisation (duds total 3, novas total 3) would make only a
  third of tiles matchable. Starting split *(tune)*: **loadout spells 60%** (shared equally), **duds 25%**,
  **novas 15%**.
- **Loadout slots: 3** *(tune; 4 is the fallback if boards feel starved).*
- Matching, cascades, linked tiles, locks and initial no-match fill work exactly as described in features
  §5.2. Locks still matter: tiles you swap stay locked through your next turn, so you can't hammer the
  same spot.

## 3. Enemies and intents

### 3.1 Enemy model

```ts
interface EnemyDef {
  id: string; name: string; portrait: string;
  maxHp: number;
  tier: 'normal' | 'elite' | 'boss';
  intents: IntentDef[];               // the cycle, played in order, repeating forever
  start?: 'first' | 'random';         // where in the cycle it starts (default 'first')
  startingStatuses?: StatusInstance[];
  weaknesses?: Element[]; resistances?: Element[];
  reward: { goldMin: number; goldMax: number };
}

interface IntentDef {
  id: string; name: string; icon: string; description: string;
  effects: IntentEffect[];            // applied in order
}

type IntentEffect =
  | { type: 'damage'; amount: number; hits?: number }               // to the player
  | { type: 'heal'; amount: number; target: HealTarget }
  | { type: 'block'; amount: number; target: HealTarget }
  | { type: 'status'; status: StatusId; value: number; target: 'player' | HealTarget }
  | { type: 'lockTiles'; count: number }                            // board: elite/boss only
  | { type: 'addTiles'; spell: SpellId; count: number };            // board: elite/boss only

type HealTarget = 'self' | 'lowestAlly' | 'allAllies';
```

### 3.2 What intents can do

| Category | Effects | Who uses it |
|---|---|---|
| **Attack** | `damage` to the player, optionally multi-hit | anyone |
| **Debuff** | `status` on the player (Weak, Poisoned, …) | anyone |
| **Buff** | `status` / `block` on self or allies (Strength, Block, …) | anyone |
| **Heal** | `heal` self, lowest ally, or all allies | anyone |
| **Board** | lock random free visible tiles, or add junk tiles (e.g. Rubble) | **elite and boss only** |

Intents can combine effects (Disable = damage + debuff).

- **Ally targets:** "allies" are the living enemies, **including** the one acting. `lowestAlly` picks the
  living ally with the lowest HP fraction (ties go to the leftmost) and may pick itself. Heals can't exceed
  max HP and can't revive.
- **Board effects:** `lockTiles` locks `count` random **free, visible** tiles (as if swapped last turn,
  so they're freed after the player's next turn). `addTiles` replaces `count` random visible tiles with
  the given spell, without triggering matches. Both use the battle RNG.
- **The board rule is enforced by content validation:** an enemy with `tier: 'normal'` that has a board
  effect fails the build.

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
- the **final number** after Strength, Weak and the player's Fortify, e.g. "⚔ 6", or "⚔ 4×2" for
  multi-hit. The player does arithmetic on board state, not on modifiers.

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

## 5. Starting roster *(tune)*

Spellford has the Wolf and Dark Mage, plus unused portraits for the bear, boar and harbinger. Enemy spells
become intents.

| Enemy | Tier | HP | Cycle | Start | Reward |
|---|---|---|---|---|---|
| **Wolf** | normal | 60 | Fangs (⚔5) → Disable (⚔5, Weak 1 → player) → Rage (Strength +1 self) | random | 25–40 |
| **Boar** | normal | 70 | Charge (⚔8) → Snort (Block 6 self) → Gore (⚔4×2) | first | 30–45 |
| **Harbinger** | normal | 45 | Mend (heal 10, lowest ally) → Hex (Poisoned 3 → player) → Bless (Block 5, all allies) | first | 35–50 |
| **Dark Mage** | elite | 80 | Dark Bolt (⚔8) → Life Drain (⚔6, heal 6 self) → Curse (Weak 2 → player, lock 3 tiles) → Inferno (⚔12) | first | 40–60 |
| **Bear** | elite | 110 | Maul (⚔10) → Roar (Strength +2 self, add 3 Rubble) → Swipe (⚔6×2) | first | 50–70 |

Wolf no longer starts with Charge 1 (Charge only affects spells). Spellford's other enemy spells (Frost
Nova, Vampiric Touch, Bite, Howl, Frenzy) are retired or folded into the cycles above.

### Encounters

Battles are drawn from encounter definitions, not single enemies:

```ts
interface EncounterDef { id: string; tier: 'normal' | 'elite' | 'boss'; enemies: EnemyId[] /* 1–4, left to right */ }
```

Starting set *(tune)*: `[wolf]`, `[wolf, wolf]`, `[boar]`, `[wolf, harbinger, wolf]`, `[wolf, wolf, wolf, wolf]`;
elites `[dark_mage]`, `[bear]`, `[harbinger, bear]`. How world travel picks encounters (by stop, road type
and distance) is part of M6.

## 6. Screen layout (phone landscape)

```
┌ Exit │ abilities ···························································┐ 40px
│ ┌──────────────────┐ ┌─ ⚔6 ──────── ⚔5 ⬇ ───── ♥10 ──────── ⚔12 ─┐    │
│ │                  │ │  [wolf]      [wolf]◎    [harb.]    [bear]   │    │ enemy zone
│ │   board 8×8      │ │  ▓▓▓▓ 60     ▓▓░░ 34    ▓▓▓ 45     ▓▓▓▓ 110 │    │
│ │   square,        │ │  ☠2          W1         🛡5        STR2      │    │
│ │   full height    │ ├─────────────────────────────────────────────┤    │
│ │                  │ │ [you] ▓▓▓▓▓▓░ 72/100 🛡6 STR1 │ ●●○ END TURN │    │ player strip ~84px
│ └──────────────────┘ └─────────────────────────────────────────────┘    │
```

- **Left:** the board, a square filling the height below the top bar.
- **Right:** the **enemy zone**, which is the whole remaining width above the player strip. It has 1–4
  enemy slots with equal widths. Each slot holds the intent badge (top), portrait, HP bar and status row.
  With fewer enemies, slots get wider and portraits bigger, up to a cap. Dead enemies fade out but their
  slot stays, so nothing jumps around mid-fight.
- **Player strip** (bottom of the right side): portrait, HP, Block, statuses, the **moves pips** (●●○) and
  a 44px-tall **End Turn** button. This replaces Spellford's "tap your energy circle".
- Gold is hidden in battle. The top bar holds Exit and the ability bar.

Space check at the 844×390 reference: after safe areas (~47px each side on notched iPhones) and a ~342px
board, the right side is ~400px wide, so 4 enemies get ~100px each. At the 667px minimum, 4 enemies get
~70px each. Intent badges and HP bars still fit, but portraits shrink. Status rows show up to 3 icons
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

- Whether 3 loadout slots is enough with a player-only pool, or whether it should be 4 (decide after the
  M2 sim).
- Whether permanent Strength makes long fights against Wolf packs too punishing. Fallback: Spellford's
  3-turn duration.
- Should intents ever be hidden ("?") for bosses? Not in v1.
