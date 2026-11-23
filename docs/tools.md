# Tools, Fruit, Abilities, Junk and Statuses

Everything the player brings into battle and matches on the board. The rules for sets, damage, placement and
Critical are in [combat.md](combat.md). All numbers are starting values *(tune)*.

Tools are the means God gives to His servants. Every tool belongs to a **pillar**: Faith, Truth, Love, Unity,
Spirit or Discipline. Right now pillars matter for **Foresight** (Prophecy) and the Mentor event.

---

## 1. Tools

### 1.1 Owned tools and the battle loadout

The player starts owning **five** tools. **At the start of every battle** (quick fights too) you **choose 3** of
them. Only those 3 are in the tile pool for that battle ([combat § 1](combat.md#1-the-board)).

| Tool | Pillar | Set effect | Scales with set size? |
|---|---|---|---|
| **Fasting** | Discipline | Gain **Critical 1** | No: 1 per set |
| **Prayer** | Faith | Gain one **damage shape**, the same shape as the set: 1 damage to every tile in it | Yes: the shape *is* the set |
| **Thanksgiving** | Spirit | Gain **1 Block per tile** | Yes |
| **The Word** | Truth | **1 Stone per tile**: each one is a 1-damage hit on any tile, which becomes a Stone if the hit deletes it | Yes |
| **Prophecy** | Truth | **Target 1 tile per tile matched** for 1 damage each; a tile it breaks **turns into Space**. Then gain **1 Foresight per tile** | Yes, both |

### Fasting

Match 3+ Fasting: gain **Critical**. The next tool set you complete is **doubled** ([combat § 3.3](combat.md#33-critical)):

- Fasting → Prayer (3): you place **two** horizontal-3 damage shapes. It's two separate shapes, not one
  line of 6.
- Fasting → The Word (3): **6** Stone hits.
- Fasting → Thanksgiving (4): **8** Block.
- Fasting → Prophecy (3): **6** hits and **6 Foresight**.

### Prayer

Match 3+ Prayer: you get a damage shape matching the set, and place it anywhere it fits with the same
orientation. Every tile under it takes 1 damage. That deletes Worries, tools and junk (1 HP) and cracks Stones
(2 HP). Prayer is the main way to defeat enemy tiles. ([combat § 5.1](combat.md#51-damage-shapes-prayer))

### Thanksgiving

Match 3+ Thanksgiving: gain 1 **Block** per tile. Block absorbs Worry hits during the enemy turn and clears at
the start of your next turn.

### The Word

Match 3+ Word: you get 1 **Stone** per tile. Each Stone is placed on **any tile** as a **1-damage hit**
([combat § 5.3](combat.md#53-stone-placement-the-word)):

- If the hit **deletes** the tile (a tool, junk or a 1-HP Worry), a **Stone** takes its place. It's a
  transformation, so nothing falls.
- If the tile **survives** (a Stone, or a tougher enemy tile later), it just takes the damage, and no Stone
  appears.

Stones block Worries ([§ 3](#3-stone)).

### Prophecy

Match X Prophecy (3+): you target **X tiles** (one per tile matched), each taking **1 damage**. A tile that
breaks **turns into a Space** junk tile in place, so nothing falls; a Worry broken this way is gone. Then you gain
**X Foresight**. That's after the hits, so it boosts *later* sets, not this one.

**Foresight** (stacks, whole battle) counts at a third of its value: **every 3 Foresight** gives every **Truth**
tool (the Word, Prophecy) **+1 damage per hit**. It doesn't change Stone HP.

### 1.2 Parked tools

Healing (Love), Serving (Love), Fellowship (Unity) and Worship (Spirit) are parked. They'll come back with new
effects that fit the board-defence game. Fight for Loot's tool reward is a dud until then.

### 1.3 Levels and Upgrades: TBD

Every tool has a level of 1–5, and an Upgrade raises it by 1 (Market Study, Campfire Reflect, the Hermit).
*TBD: what a level does.* Fruit don't scale with level (§2).

## 2. Fruit

The **fruit of the Spirit** (Galatians 5:22–23) replace virtues. Each tool has **3 fruit sockets**. A fruit
gives a **flat** bonus to that tool. It doesn't scale with tool level. **Copies stack**: two Peace = +2 Block per
tile. Sources and prices are the same as virtues had: Purchase at Villages, Towns and Markets, battle drops, the
Gambler and the Hermit. Removing a fruit at a Town costs 50 Talents.

| Fruit | Icon | Keyword | Effect on the tool it's in |
|---|---|---|---|
| **Love** | apple | +20% Appear | Tile weight +0.2: this tool shows up more often |
| **Joy** | orange | +1 **Shining** | End of your turn: each of this tool's tiles deals 1 damage to every **enemy** tile orthogonally next to it |
| **Peace** | olive | +1 Block | +1 Block per tile when its set clears |
| **Patience** | fig | +1 HP | Tiles this tool **places** get +1 HP (the Word's Stones: 3 HP). No effect on tools that place nothing |
| **Kindness** | pear | +1 **Supportive** | This tool's tiles are **linked** (§2.1) |
| **Goodness** | pomegranate | +1 **Restore** | Heal 1 Courage each time its set clears (up to max) |
| **Faithfulness** | grapes | +1 Damage | +1 damage per hit (Prayer, the Word, Prophecy). This is how you damage tougher enemy tiles. No effect on tools that deal no damage |
| **Gentleness** | peach | +1 **Sturdy** | This tool's tiles on the board have +1 HP. A Worry needs an extra step to break through them, and your own 1-damage hits don't delete them |
| **Self-Control** | dates | +1 **Focus** | The first time its set clears each turn, gain 1 move |

Icons: `public/assets/fruits/<id>.svg` (`love`, `joy`, `peace`, `patience`, `kindness`, `goodness`,
`faithfulness`, `gentleness`, `self_control`). Placeholders until drawn properly.

### 2.1 Supportive (linked tiles)

A Supportive tile that is orthogonally next to a set of a **different tool** is pulled into that set when it
clears:

- It counts **+1 per Supportive point** towards that set's size (Thanksgiving 3 + one Supportive tile = 4 Block).
- For **Prayer**, its cell joins the damage shape.
- Its own tool's effect does **not** trigger.
- It never joins **junk** or **Stone** sets. It still matches normally with its own tool.

### 2.2 Retired virtues

Courageous, Compassionate, Enduring, Temperate, Joyful, Devoted, Fervent, Persevering, Sacrificial and Gracious
are gone. The Hermit's Devoted virtue becomes a **Love** fruit.

## 3. Stone

| | |
|---|---|
| Source | The Word only, never the tile pool |
| Gravity | Falls like any tile |
| Swappable | Yes |
| HP | **2** (+1 per Patience on the Word) |
| Matches | 3+ Stones clear, with no effect, whether damaged or not |
| Vs enemy tiles | Each Worry step deals 1 damage. While the Stone survives, the Worry stays put. Once it's deleted, the Worry moves in |
| Art (reused) | `spells/dud/rubble.png`. Damaged: the same art with a crack overlay |

## 4. Junk

Junk tiles fill the board alongside your tools. They replace all the old duds and novas, which are retired.
Their art is reused.

| Junk | Set effect | Art (reused) |
|---|---|---|
| **Time** | 3+ Time: deal **1 damage to 1 tile** anywhere on the board, including an enemy tile | `spells/dud/orb.png` |
| **Space** | 3+ Space: **nothing**. They just clear | `spells/dud/mist.png` |

## 5. Abilities

Powers outside the board. Each has **3 uses** per run, and using one **costs no move**. Hold at most **5**.
Abilities aren't tool sets: Critical, Foresight and fruit don't affect them.

| Ability | Rarity | Effect |
|---|---|---|
| **Abstain** | uncommon | Deal **10 damage** to 1 tile anywhere |
| **Stand Firm** | common | Gain **5 Block** |
| **Many Fish** | common | Deal **1 damage** to **3 tiles in a line**. You choose horizontal or vertical, then place it |
| **Revival** | rare | **+3 moves** this turn |

Sources and recharging are unchanged ([spec § 8](spec.md#8-abilities)). The old ten (Amen, Kindle…, Extended
Fast, Rooted in…) are retired.

## 6. Statuses

Statuses clear after every battle.

| Status | Lasts | Effect |
|---|---|---|
| **Critical** | until used | The next tool set is doubled. Each set uses 1. Stacks as a count |
| **Block** | until the start of your next turn | Absorbs incoming damage point for point |
| **Foresight** | whole battle, stacks | Every 3 gives Truth tools +1 damage per hit |
