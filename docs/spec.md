# Spellcross Game Spec

**The single source of truth for how Spellcross plays.** It folds Spellford's behaviour (commit `3f7b1a0`)
together with every resolved decision (D1–D17) into final rules, one section per system. Build from this
doc.

- Detailed **data** stays in the docs that own it, linked from each section: map tables, event text, enemy
  roster, gem values.
- **Why** a rule differs from Spellford is recorded in [features.md](features.md) (the Spellford reference and
  decision log) and in [open-questions.md](open-questions.md).
- **How** to implement it is in [architecture/](architecture/).

If this doc and another disagree, this doc wins. Fix the other one.

Numbers marked *(tune)* are starting values for playtesting.

---

## 1. Platform

- A React web app for **phone browsers held in landscape** (iOS Safari, Android Chrome), installable as a
  PWA. Touch only. Desktop shows the same layout, letterboxed (D13).
- Portrait shows a full-screen "Rotate your device" overlay. Nothing is lost.
- Layout, safe areas and touch rules: [03-frontend § Phone landscape layout](architecture/03-frontend.md#phone-landscape-layout).

## 2. The run

A **run** is one journey across a generated map, from Start to Finish.

```
Main menu ─New run─▶ Map (Start: Traveller event) ─travel─▶ … ─arrive at Finish─▶ Boss ─win─▶ Run won
                       │  Road/Trail trip → battle on the way
                       │  arrive at a stop → that stop's event
                       └  HP 0 anywhere → Defeat → save deleted
```

- **Main menu** (D11): **Pathway** = New run. **Hut** = Continue run (only when a save exists). **Chasm** =
  Abandon run (only when a save exists, with confirmation). **Tree** = decorative. Spellford's debug
  shortcuts (random event, quick battle) live in the dev-only debug panel (`?debug=1`).
- **Start:** the player has 100 HP, 0 gold, six spells (§7), the junk pool Orb + Slime, and **no
  abilities**. The run opens with the **Traveller** event: pick 1 of 3 random abilities.
- **Travelling:** tap a stop directly connected to your current stop. The token follows the road's curve
  (1s).
  - **Road** trip: a battle triggers at a random 30–70% of the way, drawing a random **normal** encounter
    with **3 loadout slots**.
  - **Trail** trip: the same, but a random **elite** encounter with **4 loadout slots**.
  - **Highway** trip: safe.
  - After the battle, travel resumes to the stop.
- **Arriving at a stop** opens its event (§4.2). **Finish** starts the **boss** encounter.
- **Winning the boss** shows the run-victory screen. The run ends and the save is deleted.
- **Defeat:** HP reaches 0 in a battle or an event. "Your journey ends", the save is deleted, and you return
  to the title (permadeath).
- **Between battles:** HP carries over. All statuses clear after every battle. Ability uses refill only
  through Rest and the Shrine.

## 3. World map

- Generated from the run seed: 3 parallel paths of 4–6 stops between Start (left) and Finish (right), with
  cross-path connector roads. Stop and road types are chosen by weighted chance per phase, with link boosts,
  blocks and minimum counts.
  - Full tables and rules: [features §3.1](features.md#31-procedural-map-generation-worldworldmapkt).
  - Stop types: Town, Village, Campfire, Market, Encounter, Start, Finish.
  - Road types: Highway, Road, Trail.
- **Size:** a logical space **1080 units tall** and **2 screens wide** (`2 × 1080 × viewport aspect`), fixed when
  the run starts and saved. Spellford's generation constants (radii, widths, jitter) port unchanged.
- **Display:** the map fits the height below the top bar and scrolls horizontally with an eased drag.
  Only connected stops are tappable, and each stop has a hit area of at least 44px.
- **Legend** panel (top bar) explains the road and stop types.

## 4. Events

### 4.1 Event rules

- An event has an image, title, text and options. An option has a label, a cost (red) and a reward (green),
  effects, and optionally a next event.
- Options with an unmet **condition** (not enough gold or HP, no abilities, …) are shown **disabled**.
- **Randomness is rolled when an option is chosen**, from the run RNG (D7). Probabilities are as listed.
- Options marked *stay* keep the event open, so you can do several things in one visit. Each *stay* option
  works **once per visit** (Spellford). Cancelling the gem pick gives the Buy gem option back.
- "Heal" always means **+50% of max HP** (clamped). "Rest" gives **1 ability recharge per ability owned**,
  which you assign in the recharge popup.

### 4.2 Stop events

| Stop | Event | Options |
|---|---|---|
| Start | Traveller | Pick 1 of 3 random abilities |
| Campfire | Campfire | Heal *or* Rest |
| Village | Village | Heal, Rest, Buy gem (100gp: pick 1 of 3 random gems), Leave (all *stay*) |
| Town | Town | Heal, Rest, Buy gem (100gp, pick 1 of 3), Train (100gp, +1 Spell Upgrade), Leave (all *stay*). While at a Town, the Spellbook also offers Unsocket (50gp) |
| Market | Market | Train (200gp, +random ability), Buy gem (100gp, pick 1 of 3), Study (100gp, +1 Spell Upgrade), Leave (all *stay*) |
| Encounter | random event | §4.3 |
| Finish | the boss battle | §2 |

### 4.3 Random events

The pool, in full: **Gambler, Salesman, Wandering Warlock, Fallen Shrine, Mysterious Chest, Abandoned Tavern,
Fight for Loot, Alchemist**. The flows are in [features §4.2](features.md#42-event-content-must-port-verbatim),
with the text ported word for word from Spellford's `EventLibrary.kt`. Spellcross changes:

- **Gambler:** the wager is deducted, and the outcome is rolled 50/50 on choosing. On a win, *Insist* pays
  **+201** gold after Gamble Small and **+601** after Gamble Big *(tune)*; *Take some junk* = a random gem.
- **Salesman:** Pay for Healing restores 50% of **max** HP (D6).
- **Wandering Warlock:** *Listen* = +1 Spell Upgrade. *Take* = a **Weight** gem (D5).
- **Mysterious Chest:** success gives a random ability.
- **Fight for Loot:** *Explore* gives the Wind Wall spell, then a normal-encounter battle (3 slots).
- **Alchemist:** changes the **first element** of the first spell in your collection that isn't already that element.
- **Holding 5 abilities:** paid ability options (Market Train, Salesman Weapon) are disabled. Free grants (Chest,
  Traveller) give nothing. Spellford instead took the gold and gave nothing (D20). Duplicate abilities are
  allowed. **Random rolls are weighted by rarity:** abilities common 3 : uncommon 1 (rare 0.5, legendary 0.2);
  gems by drop weight (§9.3).

## 5. Battle preparation

Before every battle:

- **Loadout:** fill **3** slots (Road, Fight for Loot) or **4** slots (Trail, boss *(tune)*) from your spells.
  FIGHT is enabled only when every slot is filled.
- **Junk:** fill up to **2** junk slots from your junk pool (starting pool: Orb, Slime). Empty is allowed.
- Spells show their final stats and icons (§9).

## 6. Battle

### 6.1 Overview

The player makes **3 swaps per turn** on a match-3 board to cast spells at **1–4 enemies**. Each enemy repeats a
fixed, visible cycle of intents. The board belongs to the player alone, and enemies never swap on it (D14).

### 6.2 Board

- **8 columns × 6 visible rows** (48 tiles), plus a hidden 6-row refill buffer above (D15).
- **Tile pool:** loadout spells, base duds (Ash, Rubble, Mist), base novas (Surge, Critical) and selected
  junk. Weights *(tune)*:
  - **Loadout spells: 60%**, shared by each spell's weight. Weight = 1 + 0.2 per Weight gem (additive). The
    share stays 60% in total, so with 3 spells one Weight gem takes a spell from 20% to 22.5% of tiles.
  - **Duds: 25%**, shared equally (base duds + selected dud junk).
  - **Novas: 15%**, shared equally (base novas + selected nova junk).
- **The initial fill** has no ready-made matches (re-roll until there are none).
- **Spell classes:**
  - *player*: matchable.
  - *dud*: 3+ of the **same type** clear as a set, with **no effect** (no cast: no Critical, Fortify or
    Darkstone). Different duds don't match each other, and duds block spell lines (D22).
  - *nova*: never matches, and blocks lines.
  - *both*: goes in the nova share but can match (Critical).
- **Linked tiles** (Ash, Slime, Orb, Surge, Charge, Wall): a linked tile orthogonally next to a triggered set is
  pulled in and cleared, but only if it's **available** (not locked or hidden). A pulled **Surge** turns into
  the adjacent spell and adds +1 power (spell sets only, never a dud set). Other linked tiles just clear (D10).
- **Locks:** swapping **doesn't** lock tiles (D23). Only enemy intents lock them (the Spider's Spin Web).
  Locked tiles can't be swapped or matched, and they free up at the end of the player's next turn. Hidden
  tiles can't be swapped. A lock belongs to the **tile**, not the cell: it falls with the tile, and clears when
  the tile is cleared.
- **Cast order within a cascade step:** groups cast in reading order of their top-left tile (top row first, then
  left to right). This decides which cast uses up a Critical. A Surge next to two matched spells joins the
  first one found looking down, up, right, then left.

### 6.3 Turn structure

```
battle start: enemies placed left→right in slots 0..n-1; intent cursors set (0, or random if start:'random')
┌▶ PLAYER TURN
│    player statuses onTurnStart  (Block clears, Poisoned ticks)
│    moves = 3
│    swap / use abilities / retarget … until moves = 0 (auto-end after the cascade) or END TURN
│    player statuses onTurnEnd   (Weak ticks)
│    board locks advance
│  ENEMY PHASE — each living enemy, left to right:
│    statuses onTurnStart (Block clears, Poisoned ticks — it may die)
│    perform its current intent; advance its cursor (wraps)
│    statuses onTurnEnd (Weak ticks)
│  ROUND START: all statuses onRoundStart
└──┘
```

- **Moves:** one move = one swap of two orthogonally adjacent, available tiles. A swap costs a move **even
  without a match**. Because any such swap is legal, there's **no reshuffle** (C4).
- **Free actions:** retargeting, info popups, and triggering abilities (each spends its own uses).
- **Win:** the battle ends **the moment the last enemy dies**, even mid-cascade. The killing cast's healing and
  statuses still apply, but its self-damage and extra move don't, and no later casts happen (the board still
  settles). Remaining moves are lost.
- **Loss:** player HP 0 at any moment. The battle stops immediately.
- **Ties:** if both happen at once, **victory wins**.

### 6.4 Input

- **Tap** a tile to select it. Tap an orthogonally adjacent available tile to swap. Tap the selection again to
  deselect. Tap another tile to reselect. Locked or hidden tiles shake.
- **Long-press** (~400ms) a tile, enemy, status or ability for its info popup.
- **Tap an enemy** to make it the target (reticle). The target defaults to the leftmost living enemy, and
  moves there when the target dies.
- During the playback of a move or the enemy phase, input is locked. A tap fast-forwards.

### 6.5 Casting

When a move resolves, matched sets are found (3+ in a row, horizontally or vertically; L and T shapes merge
at the shared tile). Within one cascade step, **all matched tiles of the same spell instance form one cast**.
Its **power** = number of tiles, including pulled Surges. Then tiles clear, gravity drops the rest, the
buffer refills, and new sets cascade until the board is stable.

Each cast hits targets by the spell's **target** type:
- `single`: the current target,
- `all`: every living enemy, each taking the full formula,
- `random`: one living enemy (battle RNG),
- `self`: no enemy.

Statuses carry their own *self* or *target* flag.

**Formula, per target** (statuses' hooks run in this order: target's then actor's `onSpellActivated` → compute →
target's then actor's `onSpellApplied`):

```
spell stats are FINAL stats (base + gems at the spell's level; §9)
chaos         : if the spell has Chaos C, roll damage | block | healing ONCE per cast (battle RNG, before targets)
                and add C per tile to that channel. Chaos damage counts as damage (gets Strength/Charge);
                a self spell with Chaos targets an enemy, since it may roll damage

mult          = actor.strengthStat (1) × 1.5 if actor has Critical (then Critical expires)
elementMod    = 2 if target weak to the spell's element, 0.5 if resistant, else 1   (either element with Sunstone;
                by element, not spell name as in Spellford, D21. No v1 enemy has weaknesses or resistances)
dmgPerTile    = if spell.damage > 0:
                  max(0, spell.damage × mult × elementMod
                         + Strength + Charge + Charge‹spell element›)              (D1, D4)
                else 0
healPerTile   = spell.healing × mult
damage        = floor(dmgPerTile × power), then × 0.75 (floor) if actor is Weak
                → reduced by target's Perma Block per hit → absorbed by target's Block
healing       = floor(healPerTile × power), applied to the actor (clamped to max HP)
statuses      = each spell status at value × power if per-tile, else value
                (Block per tile → actor; Poisoned per tile → target; Charge Lightning on Strike → actor, flat)
on cast       : Fortify → actor gains Block = power × value; Fortify‹spell element› likewise
                Darkstone → actor takes its self-damage (ignores Block); +1 move, at most once per turn
                across all spells. Several Darkstones on one spell add their damage, not more moves
Critical      : ×1.5 to damage and healing only (not Block or statuses, as in Spellford), consumed by the
                next cast even if that cast does neither
```

Healing applies once per cast, not once per target. If the target dies mid-cascade, later casts retarget to
the leftmost living enemy.

### 6.6 Statuses (authoritative)

Statuses on the same entity merge. Stacking statuses add values. Statuses with a duration add values and keep
the longer duration. **All statuses clear after every battle.**

| Status | Lasts | Effect |
|---|---|---|
| **Critical** | until used | Next cast ×1.5, then expires. Source: the Critical tile (flat 1) |
| **Strength** | whole battle, stacks | Player: +value damage per tile on spells with damage. Enemy: +value per attack hit. (Nothing grants the player Strength in v1; C2) |
| **Weak** | value = turns, ticks at owner's turn end | Damage dealt ×0.75 (floor), for both sides |
| **Charge** | whole battle, stacks | +value damage per tile on all damaging spells |
| **Charge ‹element›** (all six elements) | whole battle, stacks | +value damage per tile on spells of that element |
| **Fortify** | whole battle, stacks | On every cast: gain Block = tiles × value |
| **Fortify ‹element›** (all six elements) | whole battle, stacks | On casting that element: gain Block = tiles × value |
| **Block** | until owner's next turn start | Absorbs incoming damage, then expires. Protects through the opponent's turn (D8) |
| **Perma Block** | whole battle | Reduces each incoming hit by value |
| **Poisoned** | until 0 | At the owner's turn start: take value damage, then value halves (floor) |

Charge Fire/Lightning/Earth and Fortify Water/Earth/Air come from Spellford. The other element variants are
new (for Chargestone and Stormstone) and use placeholder icons.

### 6.7 Enemies and intents

- Each enemy has a tier (normal, elite, boss), HP, a gold reward range, and an **ordered list of intents** it
  cycles through forever. There's no AI and no conditions (D14).
- An **intent** is generic (Attack X, Defend X, Defend Allies X, Heal X, Heal Ally X, Heal Allies X, Buff, Buff
  Allies, Debuff, Steal X, Lock N, Add Tiles) or **named**: a name and icon around any number of intents, run
  in order.
- **Allies** = living enemies, including the one acting. *Heal Ally* picks the lowest HP fraction (ties go to
  the leftmost). Heals can't revive.
- **Board intents** (Lock, Add Tiles) are allowed on **elite and boss** enemies only.
- Each enemy shows its **current intent** as a badge: an icon per part, with numbers after its own Strength
  and Weak (not after your Block). The numbers also include Strength from **allies acting earlier** in the
  same enemy phase (e.g. the Harbinger's Rally before the Bear's Maul), so the badge always matches the hit.
  Long-press shows the whole cycle.
- **Lock** picks free visible tiles. **Add Tiles** picks visible tiles that aren't locked and never places a tile
  that completes a set (duds can match, D22).
- **Roster, cycles, encounters and data format:** [enemies.md](enemies.md). Wolf and Bear (normal), Spider
  (elite), Harbinger (boss, with a Wolf and a Bear).

### 6.8 Battle end

- **Victory:** gold = sum of each enemy's reward roll. **Gem drop** *(tune)*: normal encounter 25%, elite
  100%, boss 0%. Shown on the ResultScreen, then back to travel. After the boss, the ResultScreen leads to
  run victory (§2).
- **Defeat:** the run ends (§2).

### 6.9 Battle screen

Board on the left, filling the height (tiles `min((height − top bar − 8px)/6, 48px)`). The right column holds
the enemy zone (1–4 equal slots: intent badge, portrait, HP, statuses) above the player strip (portrait, HP,
Block, statuses, move pips ●●○, End Turn). The top bar holds Exit and the ability bar. Sketch:
[combat.md §6](combat.md#6-screen-layout-phone-landscape).

## 7. Player spells

The player starts with the first six. Wind Wall comes from Fight for Loot.

| Spell | Element | Damage | Healing | Statuses | Target |
|---|---|---|---|---|---|
| Scorch | Fire | 4 | | | single |
| Restore | **Water** (D3) | | 2 | | self |
| Strike | Lightning | 2 | | Charge Lightning 1 → self (flat, each cast) | single |
| Ice Bolt | Water | 3 | | | single |
| Venom | Acid | | | Poisoned 1 per tile → target | single |
| Shield | Earth | 1 | | Block 2 per tile → self | single |
| Wind Wall | Air | | | Fortify Air 1 → self (flat) | self |

Values are per tile. **Icons** are generated from stats (§9.5).

## 8. Abilities

Powers outside the board. Each has **3 uses**, and triggering one costs no move. Hold at most **5**.

| Ability | Effect |
|---|---|
| Low Blow | Poisoned 6 → target |
| Crane Stance | Block 20 → self |
| Finisher | 15 Fire damage × strength stat, element mods apply. Block absorbs it (Spellford bypassed Block: open-questions B4) |
| Fuel of Fire / Lightning / Stone | Charge Fire / Lightning / Earth 2 → self |
| Sicken | Triples the target's Poisoned (D12: description "Triple the target's Poisoned") |
| Bulwark of Ice / Stone / Air | Fortify Water / Earth / Air 1 → self |

- **Sources:** Traveller (pick 1 of 3), Market Train (200gp, random), Salesman Weapon (100gp, random),
  Mysterious Chest (random).
- **Recharging:** Rest (1 per ability owned) and Shrine Courage (3). You assign each recharge to an ability
  in the recharge popup. Uses never exceed 3.

## 9. Spell customisation

Full detail: [spells-and-gems.md](spells-and-gems.md) (D16).

### 9.1 Spell instances

Each owned spell is an instance with its own **element** (the Alchemist changes the first element), a
**level 1–5**, and **3 gem sockets**. Final stats = base stats + each gem's value at the spell's level.

### 9.2 Levels

A **Spell Upgrade** (Town Train, Market Study, Warlock) raises one spell's level by 1, up to 5. For now a level
only changes the spell's gem values.

### 9.3 Gems

Gems have no level of their own. Each value is read from the spell's level (1 / 2 / 3 / 4 / 5):

| Gem | Effect |
|---|---|
| Strikecut | +damage per tile: 2 / 2 / 3 / 4 / 5 |
| Lifelink | +healing per tile: 1 / 1 / 2 / 3 / 4 |
| Walled | +Block per tile to self: 2 / 2 / 3 / 3 / 4 |
| Toxicut | +Poisoned per tile to target: 1 / 1 / 1 / 2 / 3 |
| Cracked | +Chaos per tile: 2 / 2 / 2 / 4 / 4. Each cast, Chaos becomes damage, Block or healing at random |
| Weight | Tile weight +0.2, within the 60% loadout share (with 3 spells: 20% → 22.5% of tiles) |
| Chargestone | Each cast: Charge ‹spell's element› 1 / 1 / 1 / 2 / 3 → self |
| Stormstone | Each cast: Fortify ‹spell's element› 1 / 1 / 1 / 2 / 3 → self |
| Darkstone | Each cast: take 3 / 3 / 4 / 4 / 5 self-damage. +1 move, at most once per turn |
| Sunstone | The spell gains a second element, chosen when socketing. Both elements' Charge, Fortify and element mods apply |

- **Sockets:** all 3 open. Any gem in any socket. The same gem can repeat (values add). **No cap on effect
  types.**
- **Sources:** battle drops (§6.8), shops (pick 1 of 3 distinct gems for 100gp), and the Gambler. Every roll is
  weighted *(tune)*: **Weight 6, Cracked 6** (most common), Strikecut / Lifelink / Walled / Toxicut 4,
  Chargestone / Stormstone 2, Darkstone / Sunstone 1.
- **Unsocket:** in the Spellbook while at a Town, 50gp, gem returned.
- **Sunstone details:** a second Sunstone on the same spell adds nothing. If the Alchemist later makes the
  first element equal the second, the spell simply has one element. Chargestone and Stormstone grant their
  status for **each** of the spell's elements.

### 9.4 Spellbook

The screen for socketing and upgrading. It opens from the World top bar, not during battle. Every change shows
a before → after preview (stats and icon) and asks to confirm.

### 9.5 Spell icons

Built from final stats: categories damage, healing, Block, Poison, Chaos. Each gets a tier from its value
(1–3 → 1, 4–7 → 2, 8+ → 3). The **top two** give `spells/<element>/<cat1>[-<cat2>]-<tier>.png`, falling back to
`<element>/default.png` and then a placeholder. A spell with more than two categories shows a **"+n"
pip** on its tiles. Exact rule: [spells-and-gems §2](spells-and-gems.md#2-spell-icons-from-stats).

## 10. Economy

| Gold in | Amount |
|---|---|
| Battle victory | Sum of enemy reward rolls (Wolf 25–40, Bear 35–50, Spider 45–65) |
| Events | Gambler, Tavern (see features §4.2) |
| Enemy Steal intent | Takes gold. It returns when the thief dies (no v1 enemy uses it) |

| Gold out | Price |
|---|---|
| Gem (pick 1 of 3) | 100 |
| Spell Upgrade | 100 |
| Random ability (Market) | 200 |
| Unsocket | 50 |
| Salesman: ability / heal | 100 / 50 |
| Alchemist: change to Fire | 100 (Lightning and Earth cost your last ability instead) |
| Healing at stops | free |

Gold can't go negative. Unaffordable options are disabled.

## 11. Saving and determinism

- **One save slot** in `localStorage`. The whole run, including a battle in progress, is written after **every
  action** (travel, event option, swap, ability, retarget). The RNG state is saved too, so reloading can't
  re-roll anything.
- Everything random comes from RNG streams forked from the run seed: `map`, `terrain`, `events` (event rolls
  and offers), `run` (road-battle position, encounter picks, rewards) and `battle:N` (board and battle rolls).
  The same seed and inputs always replay the same run.
- Save format and migrations: [04-content-data-and-persistence.md](architecture/04-content-data-and-persistence.md).

## 12. Out of scope for v1

Relics (R7), XP and levelling, dialogue, item effects beyond gems and upgrades, more enemies, hidden boss
intents, linked-tile effects other than Surge, sound and music, portrait or tablet layouts, and a player
Strength source (C2).
