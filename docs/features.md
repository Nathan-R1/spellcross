# Spellcross Feature Set (Parity with Spellford)

> **For the final Spellcross rules, read [spec.md](spec.md).** This doc is the Spellford reference and decision log. Its battle sections (§5) are historical: combat was replaced by the 2026-11 rework ([combat.md](combat.md)).

This document lists every feature in Spellford (`../spellford`, commit `3f7b1a0`, re-baselined from `9b0a7bb`) that Spellcross
must reproduce. Each feature has a **status in Spellford** so we don't "port" things that were never
finished:

- **Done**: implemented and reachable in the app
- **Partial**: implemented but not wired up end to end, or has a known gap
- **Stub**: file or hook exists but is empty or TODO
- **Planned**: in the original spec (`prompt.txt`) only

**Parity rule:** every **Done** and **Partial** feature is in scope for Spellcross v1. **Stub** and
**Planned** items are listed so they don't get lost, and they are scheduled in
[05-migration-plan.md](architecture/05-migration-plan.md).

**Combat redesign:** Spellcross replaces Spellford's 1v1 shared-board battle with an intent-based
loop against 1–4 enemies (D14, specified in [combat.md](combat.md)). Rows in §5 that D14 replaces are
marked **→ D14**. They're kept here as the record of what Spellford does.

Rows marked 🆕 were added or changed in the re-baseline to `3f7b1a0`
(see [Changes since 9b0a7bb](#changes-since-9b0a7bb) at the end).

Paths below are relative to `spellford/app/src/main/kotlin/com/spellford/`.

---

## 1. Application shell

| # | Feature | Status | Source | Notes |
|---|---|---|---|---|
| 1.1 | App launch into main menu | Done | `SpellfordGame.kt`, `screens/MenuScreen.kt` | |
| 1.2 | Screen navigation: Menu → World / Event / Battle → Menu | Done | `screens/*` | Screens swap via `game.screen = …` |
| 1.3 | Persistent top menu bar on World, Event and Battle screens | Done | `ui/TopMenuBar.kt` | See §7 |
| 1.4 | Exit button returns to the main menu from any screen | Done | `TopMenuBar.onExitClick` | |
| 1.5 | Landscape and portrait layouts | Done | `BattleScreen.calculateLayout` | Battle swaps layout by aspect ratio. Spellcross: **landscape only**, with a rotate prompt in portrait (D13) |
| 1.6 | Custom fonts (title and body) | Done | `utils/FontManager.kt`, `assets/fonts/mytitle.ttf`, `mytext.ttf` | |
| 1.7 | Quit the app | Done | Menu "chasm" object → `Gdx.app.exit()` | On web: becomes "Abandon run" (D11) |
| 1.8 | Save / load game | Planned | `prompt.txt` | Not implemented. No persistence at all today |
| 1.9 | Settings screen | Planned (optional) | `prompt.txt` | |

## 2. Main menu

An animated illustrated scene. Each menu option is an object in the scene, not a button.

| # | Feature | Status | Notes |
|---|---|---|---|
| 2.1 | Animated night-sky background: gradient, twinkling stars, layered mountains, ground | Done | `ui/MenuRendering.kt` (procedural, no textures) |
| 2.2 | **Pathway** object → start a journey (World screen) | Done | Curvy perspective path with an animated tiny walking figure that loops every 8s and fades near the top |
| 2.3 | **Tree with wood** object → play a random story event | Done | Debug/shortcut entry point |
| 2.4 | **Hut** object → battle prep, then a battle | Done | Debug/shortcut entry point. Uses a fresh `Player` |
| 2.5 | **Chasm** object → quit | Done | |
| 2.6 | Hover lift animation on scene objects (lerp to +8px), with a hover glow | Done | Spellcross: plays on press (phones have no hover) |
| 2.7 | Short press delay (0.15s) before acting on a selection | Done | Visual feedback |
| 2.8 | Icons for menu objects | Done | `assets/icons/icon_book.png`, `icon_chasm.png`, `icon_house.png`, `icon_stone.png` |

## 3. World map

### 3.1 Procedural map generation (`world/WorldMap.kt`)

| # | Feature | Status | Notes |
|---|---|---|---|
| 3.1.1 | Seeded generation (seed = current time) | Done | `WorldMap(width, height, SEED)` |
| 3.1.2 | Fixed **Start** stop on the left and **Finish** stop on the right, both vertically centred | Done | Margin = width/6 |
| 3.1.3 | Three parallel paths at 25%, 50% and 75% of map height | Done | |
| 3.1.4 | Each path has 4–6 intermediate stops, spaced evenly in x with ±50px x-jitter and ±25px y-jitter | Done | |
| 3.1.5 | Stop types are chosen by weighted chance per phase (start/mid/end), with link boosts (+5) and blocks from the previous road or stop | Done | See stop table. Quirk (ported as is): boosts aren't counted in the roll's total, so a boost takes probability from types later in the list rather than adding chance |
| 3.1.6 | Road types are chosen by weighted chance per phase, with link boosts and blocks | Done | See road table |
| 3.1.7 | Cross-path **connector roads** between paths 1↔2 and 2↔3. Count is 1..(n-2)/2, each to a neighbouring index | Done | |
| 3.1.8 | **Minimum requirements**: tries to ensure ≥1 Town, Campfire and Market, and ≥1 Trail, by converting the stops or roads nearest the map centre | Partial | A later conversion can destroy an earlier required type's only stop (`WorldMap.kt:199-226`), so ~1–2% of maps lack a Town or Campfire. **→ D18** |
| 3.1.9 | Road curve style: highway = straight. Others: 45% curve up, 45% curve down, 10% S-curve | Done | |
| 3.1.10 | Stop texture variant and rotation (towns and villages get a random 0–359° rotation) | Done | Variants: Town 2, Village 2, Market 2, Campfire 3, Encounter 1 🆕 |
| 3.1.11 | No duplicate roads between the same pair of stops | Done | |

**Stop types**

| Type | Radius | Start / Mid / End chance | Min | Links / blocks | Description |
|---|---|---|---|---|---|
| Town | 125 | 1 / 2 / 2 | 1 | boosted after Trail road or Campfire stop | Large settlement, many shops |
| Village | 60 | 4 / 4 / 4 | 0 | | Small settlement, some shops |
| Campfire | 60 | 2 / 5 / 0 🆕 | 1 | boosted after Town | Rest and heal |
| Market | 60 | 0 / 1 / 1 | 1 | boosted after Trail | Buy and trade items |
| Encounter 🆕 | 60 | 5 / 5 / 5 | 0 | | A random event |
| Start | 65 | n/a | | | Journey begins |
| Finish | 65 | n/a | | | Journey ends |

**Road types**

| Type | Width | Start / Mid / End chance | Min | Links / blocks | Description |
|---|---|---|---|---|---|
| Highway | 30 | 1 / 3 / 2 🆕 | 0 | | Safe travel. No road battle |
| Road | 15 | 5 / 5 / 5 | 0 | | Standard travel. Road battle every trip (3.3.7) |
| Trail | 8 | 1 / 3 / 4 | 1 | boosted after Town; can't follow a Trail; can't leave Start | Dangerous travel. Road battle every trip, with 4 loadout slots (3.3.7) |

### 3.2 World rendering (`world/WorldMapRenderer.kt`)

| # | Feature | Status | Notes |
|---|---|---|---|
| 3.2.1 | Procedural background terrain features, seeded | Done | |
| 3.2.2 | Procedural rivers with an outer border and inner water (35% width) | Done | |
| 3.2.3 | Roads drawn as quadratic Bézier curves (single, S-curve) or straight lines, with a glow by road type | Done | |
| 3.2.4 | Stops drawn with a shadow, base and texture icon, falling back to a procedural icon | Done | Textures: `assets/maps/stops/{town,village,market,campfire,encounter}N.png` |
| 3.2.5 | Map is **2 screens wide × 1 screen tall** (`worldWidth = screenW × 2`, `worldHeight = screenH`, generated from the device's screen size), with horizontal drag-to-scroll, eased camera, clamped to bounds | Done | Corrected in the re-baseline review: earlier versions of this doc said 1600×1200. Spellcross keeps it (U1, 03-frontend) |

### 3.3 World interaction (`screens/WorldScreen.kt`)

| # | Feature | Status | Notes |
|---|---|---|---|
| 3.3.1 | Player token starts at the Start stop | Done | Spellford loads `icons/player.png`; Spellcross uses `maps/people/player.png` (both exist) |
| 3.3.2 | Tap a **directly connected** stop to travel there. Other taps are ignored | Done | |
| 3.3.3 | Travel animation follows the road's actual curve over a fixed duration | Done | 1s (was 3s) 🆕 |
| 3.3.4 | Input blocked while travelling | Done | |
| 3.3.5 | Slide-in **Legend** panel showing road and stop icons with descriptions | Done | Toggled from the top bar. Includes Encounter 🆕 |
| 3.3.6 | Arriving at a stop opens that stop's **set event** (`EventLibrary.getSetEvent`) | Done 🆕 | Start → Traveller, Campfire, Village, Town, Market → their set events (§4.3), Encounter → random event. Finish → nothing |
| 3.3.7 | **Road battles:** travelling a **Road** or **Trail** always triggers a battle at a random 30–70% of the way. **Highways** are safe. Trail battles give **4** loadout slots, Road battles 3. Travel resumes after the battle | Done 🆕 | Not the 15% `ENCOUNTER_CHANCE`, which stays unused, and `EncounterManager.kt` is still empty. The position uses `Random(SEED)`, so it's identical every trip (D7) |
| 3.3.8 | Reaching Finish completes the journey | **Stub** | **→ D17**: boss fight, then victory |
| 3.3.9 | Map, position and player persist when returning from an event or battle | Done 🆕 | The map is generated once per WorldScreen |

## 4. Story events (`world/Event.kt`, `world/EventLibrary.kt`, `screens/EventScreen.kt`)

### 4.1 Event system

| # | Feature | Status | Notes |
|---|---|---|---|
| 4.1.1 | Event = image, title, body text, 1+ options | Done | |
| 4.1.2 | Option = label, red "cost" text, green "reward" text, optional effect on the player, optional `nextEvent` | Done | Shown inline as `[Label]  -cost  +reward` |
| 4.1.3 | Chained events: picking an option with `nextEvent` opens that event | Done | Supports branching trees |
| 4.1.4 | Randomised branches resolved when the event is built (gamble outcome, chest success, tavern ambush) | Done | D7 |
| 4.1.5 | Death check after an option: HP 0 → back to the main menu | Done | Placeholder for game over |
| 4.1.6 | Event types `NORMAL`, `BATTLE_PREP` and `END_EVENT` 🆕 (closes the event and returns to the map) | Done | |
| 4.1.9 | **Option availability:** options can have an `isAvailable` condition (enough gold, enough HP, has abilities, …) and are disabled when it's false | Done 🆕 | Applied to almost every option with a cost (D6) |
| 4.1.10 | **Recharge popup:** some options hand out N ability recharges, and the player assigns them to abilities one by one (`ui/PopupRechargeRenderer.kt`) | Done 🆕 | |
| 4.1.11 | Granted abilities are copies with full uses (`Ability.copy()`) | Done 🆕 | Previously shared instances |
| 4.1.7 | Event screen layout: wood background, title banner, framed image pane, text pane with word wrap, option list with hover state | Done | Spellcross: hover becomes a pressed state |
| 4.1.8 | Random event picker from the library, seeded | Done | 🆕 Pool is currently **Alchemist only**. The other random events are commented out, which looks like testing. Spellcross uses all of them |

### 4.2 Event content (must port verbatim)

| Event | Flow and outcomes |
|---|---|
| **Gambler** ("Gambling in the Wilderness") 🆕 | Gamble Small (−50gp, needs 50) / Gamble Big (−200gp, needs 200) / Leave. The wager is now deducted. Win branch: *Insist* (+201 gold, flat) or *Take some junk* (+Gemstone). The loss branch is flavour only. Win/loss is pre-rolled when the event is built (D7) |
| **Salesman** ("A Salesman of Sorts") 🆕 | Pay for a Weapon (−100gp, **+random Ability**) / Pay for Healing (−50gp, heal 50% of *current* HP) / Leave. Costs are gated on gold |
| **Wandering Warlock** | Ignore / Harass → *Ask for Wisdom* → Listen (+"Spell Upgrade") or *Ask for Stuff* → Take (labelled "+Weight Gem" but actually adds "Spell Upgrade") |
| **Fallen Shrine** 🆕 | Ignore (single-use in Spellford, so it does nothing; Scorn and Pray stay available. **→ D20**) / Scorn → Stalk Away (−5 HP, needs 5 HP) / Pray → Courage (**3 ability recharges** via the recharge popup, needs ≥1 ability) or Leave |
| **Mysterious Chest** 🆕 | Reach Inside: costs 3+n HP (needs that much HP), success chance 25%+10n% (reaching 105% at attempt 8; Spellford's label shows "105%"), forced on attempt 10. Shown as "n% Relic". Success gives a random **Ability**. Failure repeats with a higher cost and chance. Or Leave |
| **Abandoned Tavern** | Ignore / Go Inside → up to 5 "Take Stuff" rounds (+50, 40, 30, 20, 10 gold) with escalating ominous text. 1% ambush per round (−50 HP) |
| **A Dangerous Situation** ("Fight for Loot") 🆕 | *Intended:* Leave / Explore (+**Wind Wall** spell, then a battle with 3 slots). *Actual:* the event is `BATTLE_PREP`, so Spellford shows only battle prep: the options never appear and Wind Wall is never granted (`EventLibrary.kt:456-471`, `EventScreen.kt:116,810`). **→ D19** |
| **Alchemical Shop** ("Alchemist") 🆕 | Leave / Pay for Fire (−100gp) / Sacrifice for Lightning (−last ability) / Sacrifice for Earth (−last ability). Each changes the **element** of the first spell in your pool that isn't already that element. Elements matter because of Charge and Fortify ‹element› (§5.6) |
| **Enemy Encounter** (battle prep) | See §5.1. Now launched by road battles (3.3.7) as well as the menu shortcut |

Spellford's code also lists nine event ideas as TODOs (post-parity): duplicate an ability, swap any number of
abilities, trade gems for abilities/upgrades/spells, healing or max HP, gold + battle, gain a spell but lose an
ability slot, gain an ability slot, battle or downgrade a spell, and unique abilities.

### 4.3 Set events (stop arrival) 🆕

Each opens on arrival at its stop type (3.3.6). "Heal" is **50% of max HP**. "Rest" opens the recharge popup
with **1 recharge per ability you own** (needs ≥1 ability). Options with `→ stay` keep the event open, so you
can do several things in one visit.

| Stop | Event | Options |
|---|---|---|
| Start | **A Fellow Traveller** | Choose 1 of 3 random abilities (no duplicates). This replaces the old "start with 4 random abilities". Image `portraits/traveller.png` is missing |
| Campfire | **Campfire** | Heal *or* Rest (either one ends the event). **→ D25**: one of Patch up +20%, Rest or Meditate (+1 spell level), then Leave |
| Village | **Village** | Heal, Rest, Purchase (−100gp, +Gemstone), Leave. All `→ stay` |
| Town | **Town** | Heal, Rest, Purchase (−100gp, +Gemstone), Train (−100gp, +"Spellupgrade"), Leave. All `→ stay` |
| Market | **Market** | Train (−200gp, +random Ability), Purchase (−100gp, +Gemstone), Study (−100gp, +"Spellupgrade"), Leave. All `→ stay` |
| Encounter | random event | §4.2 pool |

Set events reference `town/town.png`, but the asset is `town/town.jpg`.

## 5. Battle

### 5.1 Battle preparation (`EventScreen` in `BATTLE_PREP` mode)

| # | Feature | Status | Notes |
|---|---|---|---|
| 5.1.1 | Shows the player's spell pool (up to 6 icons) | Done | |
| 5.1.2 | N loadout slots (default 3, `spellSelections`) | Done | 🆕 Road battles 3, Trail battles 4. Spellcross uses 3 for every battle (combat §2.4) |
| 5.1.3 | Select a spell, then tap a slot to place it. Tapping a filled slot with nothing selected empties it. Spells already slotted are greyed out | Done | |
| 5.1.4 | FIGHT! button starts the battle with this loadout | Done | 🆕 Needs ≥3 spells selected, otherwise shows "Not enough spells selected" |
| 5.1.6 | **Junk selection:** the entity's junk pool (dud and nova spells it owns) is shown beside the spells, with **2 junk slots**. The selected junk is added to the board's tile pool | Done 🆕 | Player junk pool: Orb, Slime. `Entity.junkPool` / `junkSelected`. Kept in Spellcross (combat §2.4) |
| 5.1.5 | Random loadout if the player enters battle with none | Done | `Entity.selectSpells(count)` |

### 5.2 Board (`battle/Board.kt`, `battle/Tile.kt`)

| # | Feature | Status | Notes |
|---|---|---|---|
| 5.2.1 | Grid is 8 columns × 16 rows. The top 8 rows are a hidden **refill buffer** and the bottom 8 are visible | Done | `Constants` says 8×8 (visible area). **→ D15**: 8 columns × 6 visible rows, 6-row buffer |
| 5.2.2 | Tile pool = both entities' selected spells + Dud spells (Ash, Rubble, Mist) + Nova spells (Surge, Critical) + 🆕 both entities' selected junk | Done | **→ D14**: player loadout + player junk only (combat §2.4) |
| 5.2.3 | **Weighted random** tile generation. Dud weights normalised to total 3 and Nova/Both weights normalised to total 3 | Done | **→ D14**: 60 / 25 / 15 split (combat §2.4) |
| 5.2.4 | Initial fill has **no pre-existing matches** (re-roll until no set) | Done | |
| 5.2.5 | Swap two orthogonally adjacent, *available* tiles | Done | Swaps are allowed even if no match forms |
| 5.2.6 | Match detection: 3+ in a row, horizontal or vertical. L/T shapes merge at the shared tile | Done | `getSetTiles` |
| 5.2.7 | Dud and Nova tiles never form sets and block lines | Done | **→ D22**: duds of the same type now clear as sets |
| 5.2.8 | **Spell power = number of tiles in the group** (grouped by spell name across all sets this step) | Done | |
| 5.2.9 | **Linked tiles**: tiles with `linkedTile=true` orthogonally adjacent to a triggered set are pulled in and cleared, 🆕 but only if **available** (a locked or hidden linked tile stays). A linked **Surge** turns into the adjacent spell and adds to its power | Partial | Only Surge converts (TODO in code). Ash and others are cleared but have no effect |
| 5.2.10 | **Cascade**: cleared tiles drop down column by column, the buffer refills from the top, new sets trigger, repeat until stable | Done | Each cascade step currently runs on a 1s timer |
| 5.2.11 | **Tile lock states**: swapped tiles become `PENDING`. At end of turn PENDING → LOCKED and LOCKED → FREE. Locked tiles can't be swapped or matched | Done | `assets/spells/lockTile.png` overlay. **→ D23**: swaps no longer lock; only Spin Web does |
| 5.2.12 | Hidden tiles can't be swapped | Done | |
| 5.2.13 | Move enumeration and swap simulation (used by AI) | Done | `getAllValidMoves`, `simulateSwap` |
| 5.2.14 | Board debug printing | Done | Dev only |

**Spell classes:** `PLAYER`, `ENEMY`, `DUD` (filler), `NOVA` (special, never matches), `BOTH` (goes into the Nova pool but *can* match, e.g. Critical).

### 5.3 Turn and battle flow (`screens/BattleScreen.kt`)

| # | Feature | Status | Notes |
|---|---|---|---|
| 5.3.1 | Player always goes first | Done | |
| 5.3.2 | **Energy**: max 2 per turn. Each swap costs 1 and you can't swap at 0 | Done | **→ D14**: 3 moves per turn |
| 5.3.3 | Player ends their turn by tapping their own energy circle (shows "X / X" or "END TURN") | Done | **→ D14**: auto-end at 0 moves, plus an End Turn button |
| 5.3.4 | AI turn: picks moves via its behaviour tree and auto-ends at 0 energy | Done | **→ D14**: enemy phase plays intents |
| 5.3.5 | Status hooks fire at turn start, turn end, round start (when control returns to the player), each tile move, and spell activate/apply | Done | |
| 5.3.6 | Battle end | Partial 🆕 | Checked every frame and at end of turn. On end: player energy reset, **all player statuses cleared**, **+50 gold** (flat, TODO says variable), return to the World (or wherever it was launched from). **No defeat handling**: the gold check is `currentHp >= 0`, which is always true (TODO "add permadeath"). No result screen. (The +50 gold and the missing defeat check are in `EventScreen.kt:1024-1031`; for menu-launched battles `onReturnTo ?: WorldScreen(game)` builds a fresh map.) Spellcross: combat §1, D9 |
| 5.3.7 | Defaults when started from the menu: a fresh Player vs 🆕 a **Dummy** (1 HP, Charge 1; Bite, Vampiric Touch, Dark Bolt; default AI) | Done | Looks like a test opponent. Debug panel: any encounter |
| 5.3.8 | XP, levelling and spell unlocks after battle | Stub | `systems/ProgressionSystem.kt` empty |

### 5.4 Damage and healing formula (`spells/Spell.kt::triggerSpell`)

```
power        = tiles in group
mod          = actor.strength × tempMultiplier
weaknessMod  = 2.0 if target weak to spell name, 0.5 if resistant, else 1
healing      = floor((spell.healing × mod + addSelfPerTile) × power) + addSelf
damage       = floor((spell.damage × mod × weaknessMod + addOtherPerTile) × power) + addOther
statuses     = each spell status applied (to self or target) with value × power if multipliedByTiles, else value  🆕
```

Hook order: target `onSpellActivated` → actor `onSpellActivated` → compute → target `onSpellApplied`
→ actor `onSpellApplied` → heal actor → damage target → apply statuses → flush expired statuses.

### 5.5 Spells (`spells/SpellLibrary.kt`)

| Spell | Owner | Element | Dmg | Heal | Status | Notes |
|---|---|---|---|---|---|---|
| **Scorch** 🆕 (was Fireball) | Player | Fire | 4 | 0 | | "Damage the enemy" |
| **Restore** 🆕 (was Heal) | Player | Lightning* | 0 | 2 | | |
| **Strike** 🆕 (was Lightning) | Player | Lightning | 2 | 0 | Charge Lightning 1 → self (not per tile) | "Pound the enemy with increasing strength". Each cast adds +1 permanent Charge Lightning, so Strike **ramps during a battle** |
| **Ice Bolt** 🆕 (was Ice Shard) | Player | Water | 3 | 0 | | "Deal 3 DMG per tile". Code: `TODO have 3 gemstone slots` |
| **Venom** 🆕 (was Poison) | Player | Acid | 0 | 0 | Poisoned 1/tile → target | |
| **Shield** 🆕 | Player | Earth | 1 | 0 | Block 2/tile → self | "Strike the enemy and guard yourself" |
| **Wind Wall** 🆕 | Player (from Fight for Loot) | Air | 0 | 0 | Fortify Air 1 → self | Not in the starting pool |
| Dark Bolt | Enemy (Dark Mage) | Fire* | 4 | 0 | | |
| Life Drain | Enemy | Fire* | 4 | 12 | | |
| Curse | Enemy | Fire* | 4 | 0 | | Description says "weaken" but no status |
| Inferno | Enemy | Fire | 6 | 0 | | |
| Frost Nova | Enemy | Fire* | 5 | 0 | | |
| Vampiric Touch | Enemy | Fire* | 6 | 3 | | |
| Bite | Wolf | Earth | 3 | 0 | | |
| Howl | Wolf | Earth | 4 | 0 | Weakness 1 → target | |
| Frenzy | Wolf | Earth | 3 | 1 | Strength 1 → self | |
| Ash, Slime, Orb | Dud | | | | | Linked |
| Rubble, Mist | Dud | | | | | |
| Charge, Wall, Surge | Nova | | | | | Linked |
| Wild | Nova | | | | | |
| Critical | Both | | | | Critical 1 → self (not per tile) | |

🆕 Player-owned junk: **Orb** and **Slime** (linked duds) are in the player's junk pool for junk selection (5.1.6).

\* Defaults that look like data-entry mistakes. Corrected in Spellcross (D3).

🆕 **Spell icons from stats.** Player spells no longer name an icon. `Spell.getIconPathFromStats()` builds
`spells/<element>/<cat>[-<cat2>]-<tier>.png`:
- Categories, in priority order: `dmg`, `healing`, `block`, `poison`, `chaos` (= Critical).
- Each category gets a tier from its value: 1–3 → 1, 4–7 → 2, 8+ → 3. At most 2 categories are kept,
  highest tiers first, and the file uses the highest tier.
- Missing file → `spells/<element>/default.png`.

So an upgraded spell's icon changes as its numbers grow. Full rule, quirks, art coverage and the Spellcross
port: [spells-and-gems.md §2](tools.md). Note: the spell info popup
still loads the blank `iconPath`, so player spells show no icon there (bug, not ported). Tiles are now
tinted by `spellColor` (pastels per spell) instead of team colour.

**→ D14:** enemy spells (Dark Bolt to Frenzy) don't go on the board in Spellcross. They become or are
replaced by enemy intents (combat §5).

Elements: Fire, Lightning, Water, Earth, Air, Acid.

### 5.6 Statuses (`spells/Status.kt`, `spells/StatusLibrary.kt`)

Two kinds: **Status** (permanent, stacks value) and **DurationStatus** (stacks value, takes the max
duration, and counts down). Adding a status with the same name merges via `combine`. Removal is deferred
(`expireStatus` → `flushExpired`).

| Status | Kind | Per tile? 🆕 | Effect | Implemented |
|---|---|---|---|---|
| Critical | Permanent, self | no | Next spell cast ×1.5, then expires | Yes |
| Strength | Duration 3, self | no | +value per tile to the caster's *self-additive* (healing) channel, ticks per cast. Default value now **2** 🆕 | Yes (moves to the damage channel, D1) |
| Weakness | Duration 3 | no | −value per tile to the caster's self-additive channel | Yes (same caveat) |
| Charge | Permanent, self | no | 🆕 +value per tile to the **damage** channel (was healing) | Yes. Wolf and Dummy start with Charge 1 |
| Fortify | Permanent, self | no | On cast: gain Block = tiles × value. Default value now 1 🆕 | Yes |
| Block | Permanent, self | **yes** | Absorbs incoming damage up to its value, then expires. Expires at the owner's turn start | Yes |
| Perma Block | Permanent, self | **yes** | Reduces each incoming hit by its value | Yes |
| Poisoned | Permanent | **yes** | At the owner's turn start: take value damage, then value halves. Expires at 0. **→ D24**: drops by 1 instead | Yes |
| Charge Fire / Lightning / Earth 🆕 | **Permanent**, self | no | +value damage per tile on spells **of that element** | **Yes** 🆕 (was icon-only). "Charge Stone" renamed to Charge Earth |
| Fortify Water / Earth / Air 🆕 | **Permanent**, self | no | On casting a spell **of that element**: gain Block = tiles × value | **Yes** 🆕 (was icon-only). "Fortify Ice" → Fortify Water, "Fortify Stone" → Fortify Earth |

🆕 `StatusFrame.multipliedByTiles` decides whether a spell's status is applied at `value × tiles` or at
plain `value` (§5.4). Status icons that exist without a status: `charge-air`, `charge-ice`, `fortify-fire`.

Status icons: `assets/status/*.png`. Tap a status (on a portrait or in a popup) to see its name,
description, value and duration.

### 5.7 Abilities (`spells/Ability.kt`, `spells/AbilitiesLibrary.kt`)

Player-triggered powers outside the board. Each has limited **uses** (3 max) and a rarity
(Common/Uncommon/Rare/Legendary). 🆕 The player now starts with **no abilities** and picks 1 of 3 from the
Traveller at Start (§4.3). More come from the Market, Salesman and Chest. The inventory holds at most 5.

| Ability | Rarity | Effect |
|---|---|---|
| Low Blow | Common | Poisoned 6 → target |
| Crane Stance | Common | Block 20 → self |
| Finisher | Common | 15 fire damage × strength (respects weakness/resistance) |
| Fuel of Fire / Lightning / Stone | Common | Charge Fire / Lightning / **Earth** 🆕 2 → self |
| Sicken | Uncommon | Triples the target's existing Poisoned (adds 2× its value, D12) |
| Bulwark of Ice | Uncommon | 🆕 **Fortify Water** 1 → self |
| Bulwark of Stone / Air | Uncommon | Fortify **Earth** 🆕 / Air 1 → self |

| # | Feature | Status | Notes |
|---|---|---|---|
| 5.7.1 | Ability bar in the top menu (filled slots + dashed empty slots, up to max) | Done | |
| 5.7.2 | Tap an ability → info popup. In battle the popup has a **Trigger** button | Done | |
| 5.7.3 | Uses decrement. Can't trigger at 0 | Done | |
| 5.7.4 | Recharging abilities | Done 🆕 | Through the recharge popup (4.1.10): Rest at Campfire/Village/Town (1 per ability) and the Shrine (3). `resetUses()` is still unused |

### 5.8 Entities (`entities/*`; 🆕 `Wolf.kt` renamed to `EnemyLibrary.kt`)

| Entity | HP | Spell pool | Extras |
|---|---|---|---|
| Player | 100 | 🆕 Scorch, Restore, Strike, Ice Bolt, Venom, Shield. Junk: Orb, Slime | 🆕 No starting abilities (Traveller event). Green team colour |
| Wolf | 60 | Bite, Howl, Frenzy | Starts with Charge 1. Behaviour-tree AI |
| Dummy 🆕 | 1 | Bite, Vampiric Touch, Dark Bolt | Charge 1, default AI. Current default battle opponent (test) |
| Dark Mage (`Enemy`) | 80 | Dark Bolt, Life Drain, Curse, Inferno, Frost Nova, Vampiric Touch | No AI assigned and not used in game |

Shared entity model: HP, energy (2), strength (1), weakness and resistance pools (by spell name),
spell pool, selected loadout, 🆕 junk pool and selected junk, statuses, inventory (gold, item strings, abilities, max abilities),
portrait, team colour.

Portrait assets exist for **bear, boar, harbinger** but those enemies are not implemented yet.

**→ D14:** Spellcross enemies are defined by HP, tier and an intent cycle (combat §3, roster in §5), and
battles have 1–4 of them.

### 5.9 Enemy AI (`ai/*`)

**→ D14:** the whole behaviour tree is replaced by fixed, visible intent cycles (combat §3.3). Kept for reference.

| # | Feature | Status |
|---|---|---|
| 5.9.1 | Behaviour tree nodes: `Move` (selector: first success wins), `Moveset` (round-robin sequence), `Leaf` (action + optional condition) | Done |
| 5.9.2 | Actions: `Attack(spellName)` (find a swap that makes a set containing that spell), `AnySet`, `RandomMove` | Done |
| 5.9.3 | Conditions: `IntCondition` (entity stat compare), `BoardCondition`, `SpellCondition` | Done |
| 5.9.4 | `DefaultNode` fallback: AnySet → RandomMove | Done |
| 5.9.5 | Wolf tree: Frenzy if HP < 50% → Howl → Bite → Frenzy → default | Done. Note: `Leaf.validate()` (the condition) is never checked by `Move`, so the HP condition is currently ignored |

### 5.10 Battle UI and feedback (`ui/BattleBoardRenderer.kt`, `ui/PopupRenderer.kt`, `ui/Animation.kt`)

| # | Feature | Status |
|---|---|---|
| 5.10.1 | Board centred, portraits either side (landscape) or below (portrait) | Done. **→ D14**: board left, enemy zone and player strip right (combat §6) |
| 5.10.2 | Tile background tinted by 🆕 spell colour (no longer team colour). Icon scaled to fit, aspect preserved. Linked-tile and lock overlays | Done. Spellcross: no team tint (player-only board) |
| 5.10.3 | Tap-tap selection with highlight border. Tapping a non-adjacent tile reselects | Done. The only swap input in Spellcross (combat §2.2) |
| 5.10.4 | Drop animation: tiles slide down by blanks-below × tile size over the cascade timer | Done |
| 5.10.5 | Disappearing tiles flash with a white halo | Done |
| 5.10.6 | Per-step **lightning bolt** from actor to target, plus floating, fading damage and +healing numbers. One animation per target per step | Done |
| 5.10.7 | Character panel: portrait, energy circle, health bar (green player / red enemy) with "cur/max" text, name, status icons with value badges (wrapping) | Done |
| 5.10.8 | Tap a tile's spell → popup (icon, name, description, damage, healing, 🆕 block, status icons) | Done. Spellcross: **long-press**, since tap selects |
| 5.10.9 | Tap a status → popup (description, value, duration) | Done |
| 5.10.10 | Popups are modal: tapping outside dismisses them and clears selection | Done |
| 5.10.11 | Wood-texture background, with a solid-colour fallback | Done |

## 6. Player progression and inventory

| # | Feature | Status | Notes |
|---|---|---|---|
| 6.1 | Gold (shown in the top bar with an icon) | Done | Earned through events and 🆕 +50 per battle. Spent at stops and events. 🆕 Costs are gated by option availability, so it no longer goes negative |
| 6.2 | Items as plain strings: Gemstone, Spell Upgrade | Partial | 🆕 Gemstones are sold at Village/Town/Market (100gp), and Spell Upgrades at Town/Market (100gp, spelled "Spellupgrade" there and "Spell Upgrade" in the Warlock event). "Weapon", "Recharge" and "Ability" are no longer items (they became real effects). Still **no item has any effect**, and there's no inventory screen. **→ D16**: Gemstones, Weight Gems and Spell Upgrades get effects ([spells-and-gems.md](tools.md)) |
| 6.3 | HP persists between events in the same chain | Done | |
| 6.4 | HP and player state carried across World → Event → Battle → World | Done 🆕 | Road battles and set events share the run's Player. Statuses are cleared after a battle. Menu shortcuts still create a fresh Player |
| 6.5 | XP, levels, spell unlocks, max HP growth | Planned | `ProgressionSystem.kt` empty. `Constants.PLAYER_START_XP` |
| 6.7 | Change a spell's element (Alchemist) | Done 🆕 | Mutates the spell in the pool |
| 6.6 | Dialogue system | Stub | `systems/DialogueSystem.kt`, `ui/DialogueBox.kt` empty |

## 7. Top menu bar (`ui/TopMenuBar.kt`)

| # | Feature | Status |
|---|---|---|
| 7.1 | Brown bar with an Exit button | Done |
| 7.2 | Player stats: HP (heart icon) and gold (gold icon), with shape fallbacks if icons fail to load | Done |
| 7.3 | Abilities box (see 5.7.1) | Done |
| 7.4 | Legend button (World screen only) | Done |
| 7.5 | Configurable font scale per screen | Done |

## 8. Assets to carry over

All of `spellford/app/src/main/assets/` is copied as-is into `spellcross/public/assets/`:
`abilities/`, `fonts/`, `icons/`, `portraits/`, `spells/{fire,water,earth,lightning,acid,monster,dud,nova}/` 🆕,
`spells/linkedTile.png`, `spells/lockTile.png`, `status/`, `maps/stops/` (now with `encounter1.png`), `maps/people/`,
`town/` 🆕.

🆕 The element folders hold the stat-based icon sets (`dmg-1.png`, `dmg-block-2.png`, …, §5.5). The old
`spells/ice/` folder and named icons like `fire-burst.png` and `water-wave.png` are gone. Coverage is uneven:
fire is complete, `acid/` has no `default.png`, `earth/` has no single-category icons, and there's no
`air/` folder (Wind Wall has no icon). Ignore `spells/earth/Template Frame Earth.png`.

The battle background `wood.png` is referenced but **missing**, so Spellford uses a solid-colour
fallback. Some files are referenced but don't exist either: `status/fortify-air.png`, 🆕 `portraits/traveller.png`, and
🆕 `town/town.png` (the file is `town.jpg`).
Spellcross needs a generic placeholder fallback for any missing asset.

## 9. Engineering features

| # | Feature | Status |
|---|---|---|
| 9.1 | Unit tests for board set detection and full-board behaviour (12 tests) | Done: `app/src/test/kotlin/spellford/` |
| 9.2 | Deterministic, seeded logic ("keep logic deterministic and testable") | Partial. Map and events are seeded. Board refill uses `Math.random` |

---

## Resolved decisions

These behaviours look accidental in Spellford, conflict with Spellcross's target platform, or are being redesigned. Each one has been
decided as **Replicate** (port as-is), **Fix** (port the evident intent) or **Change** (deliberate departure
for the web/phone platform). Spellcross implements the **Decision** column, and every
Fix gets a unit test that names this entry (e.g. `// features.md D1`).

| # | Spellford behaviour | Decision | Spellcross behaviour |
|---|---|---|---|
| D1 | Strength and Weakness add to the *self-per-tile* channel, which boosts **healing**. Descriptions say "damage dealt". (🆕 Spellford fixed Charge itself in `3f7b1a0`) | **Fix**, then amended by D14 | Final rule (spec §6.5–6.6): Strength and Charge add `+value` damage **per tile** to spells that deal damage, and Strength is **permanent** for the battle. Weak is **×0.75** on damage dealt, lasting `value` turns and ticking at the owner's turn end. The original per-tile Weakness and per-cast ticking no longer apply |
| D2 | `Leaf.validate()` is never called, so AI conditions are ignored | ~~Fix~~ **Superseded by D14** (no behaviour tree) | Selector nodes skip a leaf whose `when` is false. The Wolf then only uses its first Frenzy branch below 50% HP. (Frenzy is still reachable later in the list, so overall Wolf behaviour changes only slightly) |
| D3 | Several spells keep the default element Fire (Dark Bolt, Life Drain, Curse, Frost Nova, Vampiric Touch), and Restore (was Heal) is Lightning | **Fix** | Elements follow name and icon: Restore → Water, Dark Bolt → Earth, Life Drain → Water, Curse → Acid, Frost Nova → Water, Vampiric Touch → Acid. Elements have no combat effect today except through D4, so this is low risk |
| D4 | *At `9b0a7bb`:* Charge Fire/Lightning/Stone and Fortify Ice/Stone/Air had no effect. 🆕 *At `3f7b1a0`:* Spellford implemented them | **Replicate** (was Fix) | Port Spellford's implementation: **Charge ‹element›** (Fire, Lightning, Earth) is permanent, +value damage per tile on spells of that element. **Fortify ‹element›** (Water, Earth, Air) is permanent: casting a spell of that element gains Block = tiles × value. Bulwark of Ice grants Fortify Water. Our earlier design (Fortify reduces incoming damage of that element) is dropped |
| D5 | Warlock "Weight Gem" option gives "Spell Upgrade". (🆕 The Gambler wager is now deducted upstream) | **Fix** | The Warlock option gives a **Weight Gem** item. The Gambler follows Spellford `3f7b1a0` (wager deducted, Insist = +201 flat), with the roll moved to when you choose (D7) |
| D6 | Salesman "+50% HP" heals 50% of *current* HP. (🆕 Unaffordable options are now disabled upstream via `isAvailable`, and the set events already heal 50% of max) | **Fix** | Salesman healing restores 50% of **max** HP (clamped), like the set events. Disabled options are shown greyed with the cost in red |
| D7 | Outcomes are rolled when the event is built. 🆕 The road-battle position and the Traveller's ability offer use a fresh `Random(SEED)`, so they're identical every time | **Fix** | Rolls happen **when the option is chosen**, from the run's `events` RNG stream. The road-battle position (30–70%) and the Traveller offer use the run RNG too. Probabilities are unchanged: chest 25%+10%·n (capped at 100%, so guaranteed from attempt 8), tavern ambush 1% per take, gamble 50%. Side effect: Spellford pre-rolled the tavern ambush and showed "-50 HP" on the doomed option, a warning that rolling at choose time removes. The random event picker uses the same stream |
| D8 | Block expires at its owner's turn start | **Replicate** | Block protects through the opponent's turn and then clears. This is the standard convention and clearly intended (`onStartTurn` is explicit) |
| D9 | Battle end has no result screen or defeat handling. 🆕 Victory now gives a flat +50 gold and clears statuses | **Fix** (minimal) | New **ResultScreen**. *Victory*: gold reward from enemy content (enemies.md), a possible gem drop (D17), HP carries over, player statuses are cleared (as Spellford), ability uses are **not** refilled, then back to the map (or the menu if the battle was started from a debug shortcut). *Defeat*: "Your journey ends" → the run's save is deleted → title screen. Event deaths (HP 0 from an option) use the same defeat screen |
| D10 | Linked tiles other than Surge are only cleared, with no effect | **Replicate** | Ash, Slime, Orb, Charge and Wall stay "board cleaners": they get pulled into adjacent sets and removed, adding nothing. Surge keeps its mimic behaviour. The engine has a `linkBehaviour` hook so real effects can be added later (post-parity) |
| D11 | Chasm quits the app (`Gdx.app.exit()`) | **Fix** | Chasm becomes **"Abandon run"**, shown only when a saved run exists, with a confirmation dialog. Otherwise it's decorative. Hut becomes **"Continue run"** (when a save exists). Pathway = **New run**. Tree and Hut's original shortcuts (random event, quick battle) move to the dev-only debug panel |
| D12 | Sicken is described as "Poison the target heavily". `combine(2×value)` actually **triples** Poisoned | **Replicate** | Keep the ×3 result and update the description to "Triple the target's Poisoned" so the text matches the behaviour |
| D13 | Spellford supports both landscape and portrait (1.5, 5.10.1) | **Change** (platform) | Spellcross targets **phone browsers in landscape**. There is one landscape layout, and portrait shows a "rotate your device" overlay without losing state. Hover-only feedback (2.6, 4.1.7) moves to press. Desktop shows the same layout letterboxed. Portrait and tablet layouts are post-parity |

| D14 | 1v1 battle where the enemy plays on the shared board using a behaviour tree. 2 energy per turn | **Change** (design) | Intent-based combat against **1–4 enemies**. The board is the player's alone, with **3 moves per turn** by tap-tap swap. Each enemy repeats a fixed, visible intent cycle that can damage the player, heal itself or its allies, buff, debuff, or (elite and boss only) alter the board. Full spec: [combat.md](combat.md) |
| D15 | Board is 8×8 visible (8 columns × 16 rows including the hidden buffer) | **Change** (platform) | **8 columns × 6 visible rows** (8 × 12 with the buffer). On a landscape phone, height limits tile size: 8 rows gives ~34px tiles on the 320px-tall minimum, 6 rows gives ~45px, which meets the 44pt guideline everywhere. Tiles are capped at 48px so the enemy zone keeps its width. Cost: 48 tiles instead of 64, so fewer matches and cascades. Pool weights, loadout size and the no-move rule (combat §2.4) are checked by the M2 sim |

| D16 | Gemstones, Spell Upgrades and the Weight Gem are sold or given but do nothing. Ice Bolt has `TODO have 3 gemstone slots` | **Change** (design) | **Spell customisation:** each owned spell is an instance with an element, a **level 1–5** and 3 open gem sockets. **10 gems**, which have no level of their own: each value is read from the spell's level (Strikecut, Lifelink, Walled, Toxicut, Cracked/Chaos, Weight, Chargestone, Stormstone, Darkstone, Sunstone; Trapstone cut). No cap on effect types (the icon shows the top two, plus a "+n" pip). Spell Upgrades raise the level, which for now only raises gem values. Gems come from battle drops and shops (pick 1 of 3). Customise in the new Spellbook screen. Icons come from final stats. Full spec and open questions: [spells-and-gems.md](tools.md) |
| D17 | Arriving at stops and road battles work, but every battle is the same Dummy/Wolf. Finish does nothing. Battles pay a flat +50 gold | **Change** (design) | **Run structure:** Road battles draw a random **normal** encounter (3 slots), and Trail battles a random **elite** encounter (also 3 slots; Spellford gave Trails 4). Arriving at **Finish** starts the **Harbinger** boss encounter, and winning it wins the run. Battle gold = the sum of each enemy's reward roll (D9), and a battle can drop a random gem (normal 25%, elite 100%). Shop prices stay as Spellford, and "+Gemstone" purchases become pick 1 of 3 random gems. The first battle of a run is always a single-enemy encounter. Defeat = permadeath. No relics. See [enemies.md §3](enemies.md#3-encounters) |
| D18 | Map minimums can fail (3.1.8) | **Fix** | Converting a stop never removes the only stop of another required type. Minimums always hold |
| D19 | Fight for Loot never shows its options or grants Wind Wall (4.2) | **Fix** | Show Leave / Explore. Explore grants Wind Wall, then a normal battle (3 slots) |
| D20 | Small event-flow quirks: Shrine *Ignore* does nothing; Market *Train* and Salesman *Weapon* take gold at 5 abilities and give nothing | **Fix** | *Ignore* ends the event. Paid ability options are disabled at 5 abilities. Free grants (Chest, Traveller) give nothing at 5 |
| D21 | Weakness and resistance pools match by **spell name** (`Spell.kt:89-93`) | **Change** (design) | They match by **element** (×2 / ×0.5), so gems, the Alchemist and Sunstone interact with them. No v1 enemy has any; the hook is there for future content |
| D22 | Duds never match (5.2.7), so non-linked Rubble and Mist can never leave the board; long fights clog (37% of boss-fight moves had no match in the sim) | **Change** (design) | **Duds of the same type clear as sets** (3+ Rubble, Mist, Ash, Orb or Slime) with no effect: no cast, so no Critical, Fortify or Darkstone. Mixed duds don't match. Surge never joins a dud set. Linked tiles next to a dud set are still pulled in. Starting boards have no dud sets either, and Corrupt never places Rubble that completes a set. Novas still never match. Sim: boss win rate 0% → 40%, boss no-match moves 37% → 10% |
| D23 | Swapped tiles become pending, then locked for the next turn (5.2.11), to stop two players working the same tiles on a shared board | **Change** (design) | **Swapping doesn't lock tiles.** With one player on the board the locks only got in the way. Lock states remain for enemy intents: Spin Web locks 4 tiles, which free up at the end of the player's next turn |
| D24 | Poisoned halves each turn (`value / 2`) | **Change** (design) | Poisoned **drops by 1** each turn, so it lasts longer and deals 1 + 2 + … + value in total (Poisoned 6 deals 21, not 6 + 3 + 1 = 10). Low Blow + Sicken (Poisoned 18 → 171 total) needs watching |
| D25 | Campfires, Villages and Towns all heal +50% for free, so the player is topped up at almost every stop | **Change** (design) | **One heal per visit**: a free **Patch up** (+20% max HP) at Campfires, Villages and Towns, *or* a paid **Healer** (+50% for 50gp) at Villages and Towns. Markets and other stops don't heal. The Salesman still sells +50% |
Decisions D1 and D14 change combat balance (see open-questions B1–B3 for the current sim results). After M2, run the 500-seed headless sim over every
starter encounter (combat §5) and record the win rate, average turns and average HP lost per encounter in
`05-migration-plan.md` as the balance baseline.


---

## Changes since 9b0a7bb

Re-baselined to Spellford `3f7b1a0` (35 commits, 2026-03-18 to 19). Summary of what moved:

- **Spells reworked:** renamed and re-statted player spells, new Wind Wall, per-status `multipliedByTiles`,
  stat-based spell icons, tiles tinted by spell colour (§5.5).
- **Statuses:** element Charge and Fortify implemented (D4 is now Replicate), Charge moved to the damage
  channel, Stone/Ice renamed to Earth/Water (§5.6).
- **Battle prep:** junk selection (2 slots), Trail battles get 4 loadout slots (Spellcross: 3 everywhere), ≥3 spells required (§5.1).
- **Run loop:** Encounter stop, set events on arrival, road battles on every Road and Trail trip, return to the
  map after battles with +50 gold (§3.3, §4.3, §5.3).
- **Events:** option availability, END_EVENT, recharge popup, Traveller start pick, Gambler and Salesman changes,
  new Fight for Loot and Alchemist events (§4).
- **Abilities:** no starting abilities, recharging works, abilities are copied when granted (§5.7).
- **Board:** locked linked tiles are no longer pulled into sets (5.2.9).
- **Assets:** spell icon folders reorganised by element, new `town/` and `encounter1.png` (§8).
