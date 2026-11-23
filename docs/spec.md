# Spellcross Game Spec

> **Combat rework (2026-11).** Battles now work completely differently: one enemy whose tiles march down an
> 8×8 board, four starting tools, and Courage instead of HP. The authoritative combat rules are in
> [combat.md](combat.md), [enemies.md](enemies.md) and [tools.md](tools.md). Sections marked **TBD** are kept
> but wait for redesign around the new combat.

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
  ([combat § 9](combat.md#9-quick-fight-from-the-main-menu)). **Pathway** = New run. **Hut** = Continue run (only when a save exists). **Chasm** =
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

> **TBD.** Events are kept. Their rewards refer to the old systems (HP heals, gems, spell upgrades,
> abilities) and will be revisited as more events and enemies are made. Gold is now **Talents**, HP is
> **Courage**, gems are **virtues**, spells are **tools**.

### 4.1 Event rules

- An event has an image, title, text and options. An option has a label, a cost (red) and a reward (green),
  effects, and optionally a next event.
- Options with an unmet **condition** (not enough gold or HP, no abilities, …) are shown **disabled**.
- **Randomness is rolled when an option is chosen**, from the run RNG (D7). Probabilities are as listed.
- Options marked *stay* keep the event open, so you can do several things in one visit. Each *stay* option
  works **once per visit** (Spellford). Cancelling the gem pick gives the Buy gem option back.
- **Healing between battles** (D25): **one heal per visit**, either **Patch up** (+20% max HP, free) at Campfires,
  Villages and Towns, or the **Healer** (+50% max HP for 50gp) at Villages and Towns. Taking one disables the
  other. The Salesman event also sells +50%. Otherwise HP only comes back in battle (Restore, Lifelink). "Rest" gives **1 ability recharge per ability owned**,
  which you assign in the recharge popup.

### 4.2 Stop events

| Stop | Event | Options |
|---|---|---|
| Start | Traveller | Pick 1 of 3 random abilities |
| Campfire | Campfire | **One of:** Patch up (+20% HP), Rest (ability recharges) or **Meditate** (pick a spell: +1 level, free). Then Leave |
| Village | Village | Patch up (+20%) *or* Healer (+50%, 50gp), Rest, Buy gem (100gp: pick 1 of 3 random gems), Train (200gp, +1 random ability), Leave (all *stay*) |
| Town | Town | Patch up (+20%) *or* Healer (+50%, 50gp), Rest, Buy gem (100gp, pick 1 of 3), Train (200gp, +1 random ability), Leave (all *stay*). While at a Town, the Spellbook also offers Unsocket (50gp) |
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

## 5. Battle preparation (removed)

There's no loadout anymore: every battle uses all four starting tools plus the junk tiles Time and Space.
The enemy and its pattern are shown on the battle screen ([combat § 8](combat.md#8-screen-layout-portrait)).

## 6. Battle

Authoritative rules: **[combat.md](combat.md)**. In short:

- **One enemy**, an **8×8 board**, **portrait** layout (board on top, player and enemy panels below).
- Your turn: **3 swaps**. Tool sets trigger as they clear. Prayer, the Word and Time ask you to place
  removals or Stones.
- The enemy's **generator** decides which rows the board is built and refilled from (Hard Choices: a row of
  Worries, a normal row, a row of Worries, …).
- Enemy turn: enemy actions, if any (default none), then its **tiles activate**. A Worry steps down one row, destroying what's below. A Stone stops it and
  cracks. From the bottom row it hits you for 1.
- **Win** when the enemy has no tiles left on the board. **Lose** when Courage hits 0.
- Enemies and enemy tiles: [enemies.md](enemies.md). Tools, junk, Stones and statuses: [tools.md](tools.md).

## 7. Player tools

The player starts with **Fasting, Prayer, Thanksgiving and The Word**. See [tools.md](tools.md). Healing,
Serving, Fellowship and Worship are parked (TBD).

## 8. Abilities — TBD

> **TBD.** Kept, but every effect below refers to the old combat (Withering, damage, Kindled, Steadfast). New effects will be designed for the board-defence game.

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

## 9. Tool customisation — TBD

Kept: each tool has a **level 1–5** (raised by Upgrades) and **3 virtue sockets**. The virtue names stay.
**TBD:** what levels and virtues do in the new combat. Current notes: [tools.md § 5](tools.md#5-tbd-kept-waiting-for-redesign).
The pre-rework rules are in git history.

## 10. Economy — TBD

> **TBD.** Gold is now **Talents**. The prices below are pre-rework. Enemy reward ranges are gone with the old enemies.

| Gold in | Amount |
|---|---|
| Battle victory | TBD: a Talents reward per enemy |
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
| Healer +50% (Village, Town; instead of the free +20%) | 50 |

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

Relics (R7), XP, dialogue, sound and music, and tablet layouts.
