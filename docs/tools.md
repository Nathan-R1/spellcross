# Tools, Junk and Statuses

Everything the player matches on the board, and what each set does. The rules for sets, placement and Critical
are in [combat.md](combat.md). All numbers are starting values *(tune)*.

Tools are the means God gives to His servants. Every tool belongs to a **pillar**: Faith, Truth, Love, Unity,
Spirit or Discipline. Pillars matter only for virtues and abilities, which are TBD (§5).

---

## 1. Starting tools

The player starts with exactly these four. They're always all in the tile pool, and there's no loadout to
choose.

| Tool | Pillar | Set effect | Scales with set size? |
|---|---|---|---|
| **Fasting** | Discipline | Gain **Critical 1** | No: 1 per set |
| **Prayer** | Faith | Gain one **removal shape**, the same shape as the set (3 in a line → remove 3 in a line) | Yes: the shape *is* the set |
| **Thanksgiving** | Spirit | Gain **1 Block per tile** | Yes |
| **The Word** | Truth | Create **1 Stone per tile**, each placed on any tile, including a Worry | Yes |

### Fasting

Match 3+ Fasting: gain **Critical**. The next tool set you complete is **doubled** ([combat § 3.3](combat.md#33-critical)):

- Fasting → Prayer (3): you place **two** horizontal-3 removal shapes. It's two separate shapes, not one
  line of 6.
- Fasting → The Word (3): **6** Stones.
- Fasting → Thanksgiving (4): **8** Block.

### Prayer

Match 3+ Prayer: you get a removal shape matching the set, and place it anywhere it fits with the same
orientation. Everything under it is removed: Worries, tools, junk, Stones. Prayer is the main way to defeat
enemy tiles. ([combat § 5.1](combat.md#51-removal-shapes-prayer))

### Thanksgiving

Match 3+ Thanksgiving: gain 1 **Block** per tile. Block absorbs Worry hits during the enemy turn and clears at
the start of your next turn.

### The Word

Match 3+ Word: create 1 **Stone** per tile, placed one at a time on any tile, even a Worry (which it replaces). Stones block Worries:
a Worry trying to move into a Stone cracks it and stays put for that turn.

## 2. Junk

Junk tiles fill the board alongside your tools. They replace all the old duds and novas (Ash, Rubble, Mist,
Slime, Orb, Surge, Critical, Charge, Wall, Wild), which are retired. Their art is reused.

| Junk | Set effect | Art (reused) |
|---|---|---|
| **Time** | 3+ Time: remove **1 tile anywhere** on the board, including an enemy tile | `spells/dud/orb.png` |
| **Space** | 3+ Space: **nothing**. They just clear | `spells/dud/mist.png` |

## 3. Stone

| | |
|---|---|
| Source | The Word only, never the tile pool |
| Gravity | Falls like any tile |
| Swappable | Yes |
| Matches | 3+ Stones clear, with no effect |
| Vs enemy tiles | Blocks a Worry's move. The Stone cracks (is destroyed) and the Worry stays put that turn |
| Art (reused) | `spells/dud/rubble.png` |

## 4. Statuses

Statuses clear after every battle.

| Status | Lasts | Effect |
|---|---|---|
| **Critical** | until used | The next tool set is doubled. Each set uses 1. Stacks as a count |
| **Block** | until the start of your next turn | Absorbs incoming damage point for point |

The old statuses (Anointed, Zeal, Discouraged, Kindled, Steadfast, Armour of God, Withering) are **retired**.
Critical replaces Anointed. The new rule is ×2 on the whole set, not ×1.5 damage.

## 5. TBD: kept, waiting for redesign

These systems stay in the game, but their numbers were built for the old damage-and-HP combat. They need
redesigning around the new tools once there are more enemies and events. Until then they're **TBD**.

- **More tools.** Healing, Serving, Fellowship and Worship are parked. They can come back with new effects that
  fit the board-defence game.
- **Tool levels and Upgrades.** Every tool has a level of 1–5, and an Upgrade raises it by 1 (Market, Campfire
  Reflect, Hermit). *TBD: what a level does to each tool.*
- **Virtues.** Each tool has 3 virtue sockets. The names stay (Courageous, Compassionate, Enduring, Temperate,
  Joyful, Devoted, Fervent, Persevering, Sacrificial, Gracious). *TBD: new effects. Most old ones (+damage,
  +healing, +Withering) refer to things that no longer exist.*
- **Abilities.** Powers outside the board, 3 uses each, hold at most 5. Names stay. *TBD: new effects.*
- **Pillars.** These drive Kindled/Steadfast-style bonuses and the Gracious virtue. *TBD.*

The old values for all of these are in git history (`docs/spells-and-gems.md` before the rework) for reference.
