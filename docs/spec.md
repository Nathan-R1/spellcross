# Spellcross Game Spec

> **Combat rework (2026-11).** Battles now work completely differently: one enemy whose tiles march down an
> 8×8 board, four starting tools, and Courage instead of HP. The authoritative combat rules are in
> [combat.md](combat.md), [enemies.md](enemies.md) and [tools.md](tools.md). Sections marked **TBD** are kept
> but wait for redesign around the new combat.

**The single source of truth for how Spellcross plays.** It folds Spellford's behaviour (commit `3f7b1a0`)
together with every resolved decision (D1–D26, plus the 2026-11 rework) into final rules, one section per system. Build from this
doc.

- Detailed **data** stays in the docs that own it, linked from each section: map tables, event text, enemy
  roster, tool and fruit details.
- **Why** a rule differs from Spellford is recorded in [features.md](features.md) (the Spellford reference and
  decision log) and in [open-questions.md](open-questions.md).
- **How** to implement it is in [architecture/](architecture/).

If this doc and another disagree, this doc wins, **except for battle rules**: there, [combat.md](combat.md),
[enemies.md](enemies.md) and [tools.md](tools.md) win. Either way, fix the other one.

Numbers marked *(tune)* are starting values for playtesting.

---

## 1. Platform

- A React web app for **phone browsers held in portrait** (iOS Safari, Android Chrome), installable as a
  PWA. Touch only. Desktop shows the same layout, letterboxed. *(Changed from landscape by the combat
  rework. The map and event screens need a portrait layout: TBD.)*
- A **Full screen** button on the main menu hides the browser bars (Android Chrome, desktop). On iPhone,
  where Safari can't do this for web pages, it explains *Add to Home Screen* instead.

## 2. The run — TBD

> **TBD.** The run structure is kept, but it was built for the old battles. Encounter tiers (normal, elite,
> boss), rewards and the boss need new tile-based enemies. Until those exist, the run can only draw
> **Hard Choices**. The text below describes the pre-rework run and still holds where it doesn't involve
> combat.

A **run** is one journey across a generated map, from Start to Finish.

```
Main menu ─New run─▶ Map (Start: Traveller event) ─travel─▶ … ─arrive at Finish─▶ Boss ─win─▶ Run won
                       │  Road/Trail trip → battle on the way
                       │  arrive at a stop → that stop's event
                       └  Courage 0 anywhere → Defeat → save deleted
```

- **Main menu** (D11): **Fight** = quick fight: pick any enemy and battle it straight away, outside the run
  ([combat § 9](combat.md#9-quick-fight-from-the-main-menu)). **Pathway** = New run. *(The illustrated menu scene was drawn for landscape: its portrait version is TBD.)* **Hut** = Continue run (only when a save exists). **Chasm** =
  Abandon run (only when a save exists, with confirmation). **Tree** = decorative. Spellford's debug
  shortcuts (random event) live in the dev-only debug panel (`?debug=1`).
- **Start:** the player has **20 Courage**, 0 Talents, the four starting tools (§7), and **no abilities**. The run opens with the **Traveller** event: pick 1 of 3 random abilities.
- **Travelling:** tap a stop directly connected to your current stop. The token follows the road's curve
  (1s).
  - **Road** trip: a battle triggers at a random 30–70% of the way, drawing a random **normal** enemy.
  - **Trail** trip: the same, but a random **elite** enemy (TBD: none yet).
  - **Highway** trip: safe.
  - After the battle, travel resumes to the stop.
- **Arriving at a stop** opens its event (§4.2). **Finish** starts the **boss** battle (TBD: no boss yet).
- **Winning the boss** shows the run-victory screen. The run ends and the save is deleted.
- **Defeat:** Courage reaches 0 in a battle or an event. "Your journey ends", the save is deleted, and you return
  to the title (permadeath).
- **Between battles:** Courage carries over. All statuses clear after every battle. Ability uses refill only
  through Rest and the Shrine.

## 3. World map — TBD (needs a portrait layout)

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

## 4. Events — TBD

> **TBD.** Events are kept. Their rewards refer to the old systems (healing, fruit, Upgrades, abilities)
> and will be revisited as more events and enemies are made. Healing amounts below are % of max Courage.

### 4.1 Event rules

- An event has an image, title, text and options. An option has a label, a cost (red) and a reward (green),
  effects, and optionally a next event.
- Options with an unmet **condition** (not enough Talents or Courage, no abilities, …) are shown **disabled**.
- **Randomness is rolled when an option is chosen**, from the run RNG (D7). Probabilities are as listed.
- Options marked *stay* keep the event open, so you can do several things in one visit. Each *stay* option
  works **once per visit** (Spellford). Cancelling the fruit pick gives the Purchase option back.
- **Healing between battles** (D25): **one heal per visit**, either **Patch up** (+20% max Courage, free) at
  Campfires, Villages and Towns, or the **Healer** (+50% for 50 Talents) at Villages and Towns. Taking one
  disables the other. The Peddler event also sells +50%. *TBD: the new combat has no healing in battle.*
  **Resting** gives **1 ability recharge per ability owned**, which you assign in the recharge popup.

### 4.2 Stop events

| Stop | Event | Options |
|---|---|---|
| Start | A Fellow Pilgrim | Pick 1 of 3 random abilities |
| Campfire | Campfire | **One of:** Patch up (+20%), Resting (ability recharges) or **Reflect** (pick a tool: +1 level, free). Then Leave |
| Village | Village | Patch up (+20%) *or* Healer (+50%, 50 Talents), Resting, Purchase (100 Talents: pick 1 of 3 random fruit), Discipleship (200 Talents, +1 random ability), Leave (all *stay*) |
| Town | Town | As Village. While at a Town, the Toolbox also offers removing a fruit (50 Talents) |
| Market | Market | Discipleship (200 Talents, +1 random ability), Purchase (100 Talents, pick 1 of 3 fruit), Study (100 Talents, +1 Upgrade), Leave (all *stay*) |
| Encounter | random event | §4.3 |
| Finish | the boss battle (TBD) | §2 |

### 4.3 Random events

The pool, in full: **Gambler, Peddler, Wandering Hermit, Fallen Shrine, Mysterious Chest, Abandoned Tavern,
Fight for Loot, the Mentor**. The flows are in [features §4.2](features.md#42-event-content-must-port-verbatim)
under their Spellford names (Salesman, Wandering Warlock, Alchemist), and the current text is in
`src/content/events.ts`. Spellcross changes:

- **Gambler:** the wager is deducted, and the outcome is rolled 50/50 on choosing. On a win, *Insist* pays
  **+201** Talents after Gamble Small and **+601** after Gamble Big *(tune)*; *Take some junk* = a random fruit.
- **Peddler:** Pay for Healing restores 50% of **max** Courage (D6). Pay for a Tool gives a random ability.
- **Wandering Hermit:** *Listen* = +1 Upgrade. *Take* = a **Love** fruit (D5).
- **Fallen Shrine:** *Pray* → **[Take Heart]** = 3 ability recharges. (Renamed from [Courage] so it doesn't clash
  with the Courage stat.)
- **Mysterious Chest:** success gives a random ability.
- **Fight for Loot:** *Explore* gives a tool, then a battle. **The tool is a dud for now** (you get nothing)
  until more tools exist.
- **The Mentor:** changes the **first pillar** of the first tool in your collection that isn't already that
  pillar (Faith for 100 Talents; Truth or Unity for your last ability). *TBD with pillars.*
- **Holding 5 abilities:** paid ability options (Discipleship, the Peddler's Tool) are disabled. Free grants
  (Chest, Pilgrim) give nothing (D20). Duplicate abilities are allowed. **Random rolls are weighted by rarity:**
  abilities common 3 : uncommon 1 (rare 0.5, legendary 0.2); fruit by drop weight (TBD).

## 5. Battle preparation

Before every battle you **choose 3 of your tools** ([combat § 2.1](combat.md#21-choosing-tools)). The enemy and
its setup description are shown on the same screen. The tile pool is those 3 tools plus the junk tiles Time and
Space.

## 6. Battle

Authoritative rules: **[combat.md](combat.md)**. In short:

- **One enemy**, an **8×8 board**, **portrait** layout (board on top, player and enemy panels below).
- Your turn: **3 swaps**. Tool sets trigger as they clear. Prayer and Time ask you to place **damage**, and
  the Word asks you to place Stones (it transforms tiles, including Worries).
- **Every tile has HP** (1, Stones 2). Damage that reaches a tile's HP deletes it. There's no separate
  "remove" effect.
- The enemy's **generator** decides which rows the board is built and refilled from (Harder Choices: Worry rows 1, 2, 7 and 8 from the bottom, nothing more to come).
- Enemy turn: enemy actions, if any (default none), then its **tiles activate**. A Worry steps down one row,
  dealing 1 damage to the tile below and moving in if it's deleted. A Stone (2 HP) stops it for one turn.
  From the bottom row a Worry hits you for 1.
- **Win** when the enemy has no tiles left on the board. **Lose** when Courage hits 0.
- Enemies and enemy tiles: [enemies.md](enemies.md). Tools, junk, Stones and statuses: [tools.md](tools.md).
- How every tile's behaviour and text is built (triggers and effects): [tile-effects.md](tile-effects.md).

## 7. Player tools

The player starts owning **Prayer, Thanksgiving, The Word, Prophecy, Worship, Preaching and Anoint**, and takes 3 into each battle.
See [tools.md](tools.md). Healing and Serving are parked (TBD).

## 8. Abilities

Powers outside the board. Each has **3 uses**, and using one costs no move. Hold at most **5**. Effects:
[tools.md § 5](tools.md#5-abilities): **Abstain** (10 damage to 1 tile), **Stand Firm** (5 Block), **Many Fish**
(1 damage to 3 tiles in a line), **Revival** (+3 moves).

- **Sources:** A Fellow Pilgrim (pick 1 of 3), Discipleship (200 Talents, random), the Peddler's Tool (100
  Talents, random), Mysterious Chest (random). Rolls are weighted by rarity: common 3, uncommon 1, rare 0.5.
- **Recharging:** Resting (1 per ability owned) and the Shrine's Take Heart (3). You assign each recharge to an
  ability in the recharge popup. Uses never exceed 3.

## 9. Tool customisation

Each tool has **3 fruit sockets** and a **level 1–5** (raised by Upgrades). Fruit give flat bonuses and copies
stack: [tools.md § 2](tools.md#2-fruit). **TBD:** what a level does.

## 10. Economy — TBD

> **TBD.** The prices below are pre-rework and will be revisited.

| Talents in | Amount |
|---|---|
| Battle victory | TBD: a Talents reward per enemy |
| Events | Gambler, Tavern (see `src/content/events.ts`) |

| Talents out | Price |
|---|---|
| Virtue (Purchase: pick 1 of 3) | 100 |
| Upgrade (Market Study) | 100 |
| Random ability (Discipleship) | 200 |
| Remove a fruit (Town) | 50 |
| Peddler: Tool / Healing | 100 / 50 |
| Mentor: grow in Faith | 100 (Truth and Unity cost your last ability instead) |
| Healer +50% (Village, Town; instead of the free +20%) | 50 |

Talents can't go negative. Unaffordable options are disabled.

## 11. Saving and determinism

- **One save slot** in `localStorage`. The whole run, including a battle in progress, is written after **every
  action** (travel, event option, swap, placement, ability). The RNG state is saved too, so reloading can't
  re-roll anything. A battle in the middle of a placement saves the pending placement too.
- **Quick fights aren't saved.** Reloading during one returns you to the main menu, and the run save (if any)
  is untouched.
- Everything random comes from RNG streams forked from the run seed: `map`, `terrain`, `events` (event rolls
  and offers), `run` (road-battle position, enemy picks, rewards) and `battle:N` (normal generated rows and
  battle rolls). A quick fight uses a fresh random seed. The same seed and inputs always replay the same run.
- Save format and migrations: [04-content-data-and-persistence.md](architecture/04-content-data-and-persistence.md).

## 12. Out of scope for v1

Relics (R7), XP, dialogue, sound and music, and tablet layouts.
