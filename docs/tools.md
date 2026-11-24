# Tools, Fruit, Abilities, Junk and Statuses

Everything the player brings into battle and matches on the board. The rules for sets, damage, placement and
Critical are in [combat.md](combat.md). All numbers are starting values *(tune)*.

Tools are the means God gives to His servants. Every tool belongs to a **pillar**: Faith, Truth, Love, Unity,
Spirit or Discipline. Right now pillars matter for **Foresight** (Prophecy) and the Mentor event.

---

## 1. Tools

### 1.1 Owned tools and the battle loadout

The player starts owning **seven** tools. **At the start of every battle** (quick fights too) you **choose 3** of
them. Only those 3 are in the tile pool for that battle ([combat § 1](combat.md#1-the-board)).

**Framework.** Every tool, junk tile and ability is data: triggers (**Set formed**, **On use**) holding effects
(**Attack**, **Gain**, **Create**, **Clears self**). The rules, the popup format and the vocabulary are in
[tile-effects.md](tile-effects.md); the data is in `src/content/tools.ts` and `src/content/abilities.ts`.

An **Attack** has three sub-properties, always in this order: **Targets** (**Choose anywhere**: pick single tiles,
the bracket says how many; or **Choose shape**: place a shape where it fits, the same way round, the bracket says
which), **Dmg** (damage to each target), and **On destroy** (Create + the icon of the tile a broken target turns
into, in place, so nothing falls; hidden when nothing is created). The placing banner shows the same three.

Every tile icon opens that tile's popup when you tap or hold it. Popups stack: an icon inside a popup opens the
next one, **Back** returns, **OK** closes them all.

Sizes are always counted as **tiles in the set**. A tile whose damage reaches its HP **breaks**.

| Source | Trigger | Effects |
|---|---|---|
| **Prayer** | Set formed | Attack: Choose shape (the set's shape) · Dmg 3 |
| **The Word** | Set formed | Attack: Choose anywhere (1 tile per tile in the set) · Dmg 1 · On destroy: Create [Stone] |
| **Prophecy** | Set formed | Attack: Choose shape (the set's shape) · Dmg 1 · On destroy: Create [Space]; Gain: Foresight, 1 per tile in the set |
| **Anoint** | Set formed | Attack: Choose anywhere (1 tile per tile in the set) · Dmg 0 · Apply: +1 Strengthen |
| **Thanksgiving** | Set formed | Gain: Block, 1 per tile in the set |
| **Worship** | Set formed; On activate | Gain: Block, 1 per tile in the set. On activate: Attack: Every adjacent [Space] · Dmg 1 |
| **Preaching** | Set formed | Attack: Choose anywhere (1 tile per tile in the set) · Dmg 0 · Apply: Locked |
| **Time** (junk) | Set formed | Attack: Choose anywhere (1 tile) · Dmg 1 |
| **Space** (junk) | (none: never forms sets) | |
| **Stone** | Set formed | Clears self |
| **Abstain** | On use | Attack: Choose anywhere (1 tile) · Dmg 10 |
| **Stand Firm** | On use | Gain: Block, 5 |
| **Many Fish** | On use | Attack: Choose shape (line of 3, horizontal or vertical) · Dmg 1 |
| **Revival** | On use | Gain: Moves, 3 |

Faithfulness and Foresight raise Dmg; the popup's value includes Faithfulness. Peace, Goodness and Self-Control
add their own Gain effects to the tool's Set formed list, so they show in its popup too.

| Tool | Pillar | Set effect | Scales with set size? |
|---|---|---|---|
| **Anoint** | Faith | Targets: **Choose anywhere**, 1 per tile in the set. Dmg **0**. Apply **+1 Strengthen** | Yes |
| **Prayer** | Faith | Targets: **Choose shape**. Dmg **3** | Yes: the shape *is* the set |
| **Thanksgiving** | Spirit | Gain **1 Block per tile in the set** | Yes |
| **The Word** | Truth | Targets: **Choose anywhere**, 1 per tile in the set. Dmg **1**. On destroy: **Create Stone** | Yes |
| **Prophecy** | Truth | Targets: **Choose shape**. Dmg **1**. On destroy: **Create Space**. Also gain **1 Foresight per tile in the set** | Yes, both |
| **Worship** | Spirit | Gain **1 Block per tile in the set**. On its own, every Worship tile deletes the Space next to it at the end of each enemy turn | Block: yes |
| **Preaching** | Discipline | Targets: **Choose anywhere**, 1 tile per tile in the set. Dmg **0**. Apply **Locked** | Yes |

### Anoint

Match 3+ Anoint: **pick tiles**, 1 per tile in the set, anywhere on the board (any tile; the same tile can be picked
more than once). Each takes **0 damage** and gains **+1 Strengthen**, which stacks and lasts until the tile clears.

When a Strengthened tile clears **in a set**, that set counts **1 tile bigger per point**:

- Per-tile effects grow: Thanksgiving and Worship +1 Block, the Word +1 pick, Prophecy +1 Foresight, Preaching and
  Anoint +1 pick.
- A placed shape (Prayer, Prophecy) grows by **1 cell per point**, always along the set's **longest straight line**,
  at the end nearest the Strengthened tile. A row of 3 with +2 becomes a row of 5 wherever the points were; L and T
  sets grow along their longest arm.
- It works with Supportive (Kindness): a Strengthened tile pulled into a set still counts.

Strengthen does nothing on a tile that never clears in a set: an enemy tile, Space, or a tile broken by damage. The
Faithfulness fruit adds 1 damage to Anoint's picks, which breaks 1-HP tiles before they're Strengthened.

Shown as a gold glow and a **+N** badge on the tile.

### Fasting (parked)

Parked on 2026-11-24, replaced by Anoint. Its effect and Critical still work if it comes back.

Match 3+ Fasting: gain **Critical**. The next tool set you complete is **doubled** ([combat § 3.3](combat.md#33-critical)):

- Fasting → Prayer (3): you place the set's shape **twice**. It's two separate shapes, not one line of 6.
- Fasting → The Word (3): you pick **6** tiles.
- Fasting → Thanksgiving (4): **8** Block.
- Fasting → Prophecy (3): you place the set's shape **twice**, and gain **6 Foresight**.

### Prayer

Match 3+ Prayer: place a copy of **the set's shape** anywhere it fits, the same way round. Every tile under it
takes **3 damage** *(tune)*. That breaks Worries, Greed, Depression, tools, junk and Stones alike. Prayer is the
main way to defeat enemy tiles. ([combat § 5.1](combat.md#51-choose-shape-prayer-prophecy))

### Thanksgiving

Match 3+ Thanksgiving: gain 1 **Block** per tile. Block absorbs damage to you, point for point, until the start of
your next turn ([combat § 4.3](combat.md#43-damage-and-block)). It doesn't stop enemy tiles moving.

### The Word

Match 3+ Word: **pick tiles**, 1 per tile in the set, anywhere on the board. Each takes **1 damage**
([combat § 5.3](combat.md#53-choose-anywhere-on-destroy-create-stone-the-word)):

- If it **breaks** the tile (a tool, junk or a 1-HP Worry), a **Stone** takes its place. It's a
  transformation, so nothing falls.
- If the tile **survives** (a Stone, or a tougher enemy tile), it just takes the damage, and no Stone appears.

Stones block Worries ([§ 3](#3-stone)).

### Prophecy

Match X Prophecy (3+): place a copy of **the set's shape**, like Prayer. Every tile under it takes **1 damage**.
A tile this breaks **becomes a Space** junk tile in place, so nothing falls; an enemy tile broken this way is
gone. Then you gain **X Foresight** (1 per tile in the set). That's after the damage, so it boosts *later* sets,
not this one.

**Foresight** (stacks, whole battle) counts at a third of its value: **every 3 Foresight** gives every **Truth**
tool (the Word, Prophecy) **+1 damage per tile**. It doesn't change Stone HP.

### Worship

Match 3+ Worship: gain 1 **Block** per tile, like Thanksgiving.

Worship also works **without being matched**. At the end of every enemy turn (its **On activate**), each Worship tile
on the board deletes **every Space orthogonally next to it** (1 damage each; Space has 1 HP). Tiles above fall and
refill as usual. It runs with the enemy tiles' On activate, after their Creates, so it also clears Space that Greed
made that turn. Time is untouched.

### Preaching

Match 3+ Preaching: **pick tiles**, 1 per tile in the set, anywhere on the board (any tile). Each takes **0 damage**
(Faithfulness adds damage as usual) and is **Locked** ([combat § 4.4](combat.md#44-locked)): through the next enemy
turn it doesn't move, activate or deal damage. The same tile can be picked more than once, but locking it again
only refreshes the lock.

Enemy tiles stop when the tile below is another enemy tile, so Locking the **lowest** enemy tile in a column holds
the whole column for a turn.

Any tile can be picked, but Locking a tool, junk or Stone has no effect beyond stopping its On activate (a Locked
Worship tile doesn't clear Space that turn). Locked tiles still match, fall and break as usual.

### 1.2 Parked tools

Fasting (Discipline), Healing (Love), Serving (Love) and Fellowship (Unity) are parked. They'll come back with new
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
- For **Prayer** and **Prophecy**, its cell joins the set's shape.
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
| Popup text | "When 3+ Stones clear: nothing." HP and Speed (0) are in the header, like every tile; blocking enemy steps is just its 2 HP |

## 4. Junk

Junk tiles fill the board alongside your tools. They replace all the old duds and novas, which are retired.
Their art is reused.

| Junk | Set effect | Art (reused) |
|---|---|---|
| **Time** | 3+ Time: Targets: **Choose anywhere** (1 tile, enemy tiles included). Dmg **1** | `spells/dud/orb.png` |
| **Space** | **Never forms sets.** Only damage clears it | `junk/space.svg` (wind) |

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
| **Critical** | until used | The next tool set is doubled. Each set uses 1. Stacks as a count. No source while Fasting is parked |
| **Block** | until the start of your next turn | Each point absorbs 1 damage to you |
| **Strengthen** (on a tile) | until the tile clears | Stacks. The set the tile clears in counts 1 tile bigger per point (a placed shape grows by 1 cell) |
| **Locked** (on a tile) | through the next enemy turn | The tile doesn't move, activate (On activate, At bottom) or deal damage. Shown as a padlock |
| **Foresight** | whole battle, stacks | Every 3 gives Truth tools +1 damage per hit |
