# Spellcross Feature Set (Parity with Spellford)

This document lists every feature in Spellford (`../spellford`, commit `9b0a7bb`) that Spellcross
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
| 3.1.5 | Stop types are chosen by weighted chance per phase (start/mid/end), with link boosts (+5) and blocks from the previous road or stop | Done | See stop table |
| 3.1.6 | Road types are chosen by weighted chance per phase, with link boosts and blocks | Done | See road table |
| 3.1.7 | Cross-path **connector roads** between paths 1↔2 and 2↔3. Count is 1..(n-2)/2, each to a neighbouring index | Done | |
| 3.1.8 | **Minimum requirements**: ensures ≥1 Town, Campfire and Market, and ≥1 Trail, by converting the stops or roads nearest the map centre | Done | |
| 3.1.9 | Road curve style: highway = straight. Others: 45% curve up, 45% curve down, 10% S-curve | Done | |
| 3.1.10 | Stop texture variant and rotation (towns and villages get a random 0–359° rotation) | Done | |
| 3.1.11 | No duplicate roads between the same pair of stops | Done | |

**Stop types**

| Type | Radius | Start / Mid / End chance | Min | Links / blocks | Description |
|---|---|---|---|---|---|
| Town | 125 | 1 / 2 / 2 | 1 | boosted after Trail road or Campfire stop | Large settlement, many shops |
| Village | 60 | 4 / 4 / 4 | 0 | | Small settlement, some shops |
| Campfire | 60 | 5 / 5 / 2 | 1 | boosted after Town | Rest and heal |
| Market | 60 | 0 / 1 / 1 | 1 | boosted after Trail | Buy and trade items |
| Start | 65 | n/a | | | Journey begins |
| Finish | 65 | n/a | | | Journey ends |

**Road types**

| Type | Width | Start / Mid / End chance | Min | Links / blocks | Description |
|---|---|---|---|---|---|
| Highway | 30 | 5 / 3 / 2 | 0 | | Safe travel |
| Road | 15 | 5 / 5 / 5 | 0 | | Standard travel |
| Trail | 8 | 1 / 3 / 4 | 1 | boosted after Town; can't follow a Trail; can't leave Start | Dangerous travel |

### 3.2 World rendering (`world/WorldMapRenderer.kt`)

| # | Feature | Status | Notes |
|---|---|---|---|
| 3.2.1 | Procedural background terrain features, seeded | Done | |
| 3.2.2 | Procedural rivers with an outer border and inner water (35% width) | Done | |
| 3.2.3 | Roads drawn as quadratic Bézier curves (single, S-curve) or straight lines, with a glow by road type | Done | |
| 3.2.4 | Stops drawn with a shadow, base and texture icon, falling back to a procedural icon | Done | Textures: `assets/maps/stops/{town,village,market,campfire}N.png` |
| 3.2.5 | Map is wider than the screen (1600×1200 world) with horizontal drag-to-scroll, eased camera, clamped to bounds | Done | |

### 3.3 World interaction (`screens/WorldScreen.kt`)

| # | Feature | Status | Notes |
|---|---|---|---|
| 3.3.1 | Player token starts at the Start stop | Done | `assets/maps/people/player.png` |
| 3.3.2 | Tap a **directly connected** stop to travel there. Other taps are ignored | Done | |
| 3.3.3 | Travel animation follows the road's actual curve over a fixed duration | Done | |
| 3.3.4 | Input blocked while travelling | Done | |
| 3.3.5 | Slide-in **Legend** panel showing road and stop icons with descriptions | Done | Toggled from the top bar |
| 3.3.6 | Arriving at a stop triggers an event, shop, rest or battle | **Stub** | Stop types exist but have no behaviour on arrival |
| 3.3.7 | Random encounters while travelling (15% per step, `Constants.ENCOUNTER_CHANCE`) | **Stub** | `world/EncounterManager.kt` is empty |
| 3.3.8 | Reaching Finish completes the journey | **Stub** | |

## 4. Story events (`world/Event.kt`, `world/EventLibrary.kt`, `screens/EventScreen.kt`)

### 4.1 Event system

| # | Feature | Status | Notes |
|---|---|---|---|
| 4.1.1 | Event = image, title, body text, 1+ options | Done | |
| 4.1.2 | Option = label, red "cost" text, green "reward" text, optional effect on the player, optional `nextEvent` | Done | Shown inline as `[Label]  -cost  +reward` |
| 4.1.3 | Chained events: picking an option with `nextEvent` opens that event | Done | Supports branching trees |
| 4.1.4 | Randomised branches resolved when the event is built (gamble outcome, chest success, tavern ambush) | Done | |
| 4.1.5 | Death check after an option: HP 0 → back to the main menu | Done | Placeholder for game over |
| 4.1.6 | Event types `NORMAL` and `BATTLE_PREP` | Done | |
| 4.1.7 | Event screen layout: wood background, title banner, framed image pane, text pane with word wrap, option list with hover state | Done | Spellcross: hover becomes a pressed state |
| 4.1.8 | Random event picker from the library, seeded | Done | |

### 4.2 Event content (must port verbatim)

| Event | Flow and outcomes |
|---|---|
| **Gambler** ("Gambling in the Wilderness") | Gamble Small (50gp) / Gamble Big (200gp) / Ignore. The win branch offers *Insist* (+50 gold) or *Take some junk* (+Gemstone). The loss branch is flavour only. Note: the wager cost is shown but never deducted |
| **Salesman** ("A Salesman of Sorts") | Pay for a Weapon (−100gp, +"Weapon" item) / Pay for Healing (−50gp, heal 50% of *current* HP) / Ignore |
| **Wandering Warlock** | Ignore / Harass → *Ask for Wisdom* → Listen (+"Spell Upgrade") or *Ask for Stuff* → Take (labelled "+Weight Gem" but actually adds "Spell Upgrade") |
| **Fallen Shrine** | Ignore / Scorn → Stalk Away (−5 HP) / Pray → Courage (+"Recharge") |
| **Mysterious Chest** | Reach Inside: costs 3+n HP, success chance 25%+10n%, guaranteed on attempt 10. Success gives +"Ability". Failure repeats with a higher cost and chance. Or Leave |
| **Abandoned Tavern** | Ignore / Go Inside → up to 5 "Take Stuff" rounds (+50, 40, 30, 20, 10 gold) with escalating ominous text. 1% ambush per round (−50 HP) |
| **Enemy Encounter** (battle prep) | See §5.1 |

## 5. Battle

### 5.1 Battle preparation (`EventScreen` in `BATTLE_PREP` mode)

| # | Feature | Status | Notes |
|---|---|---|---|
| 5.1.1 | Shows the player's spell pool (up to 6 icons) | Done | |
| 5.1.2 | N loadout slots (default 3, `spellSelections`) | Done | Kept at 3 (combat §2.4) |
| 5.1.3 | Select a spell, then tap a slot to place it. Tapping a filled slot with nothing selected empties it. Spells already slotted are greyed out | Done | |
| 5.1.4 | FIGHT! button starts the battle with this loadout | Done | |
| 5.1.5 | Random loadout if the player enters battle with none | Done | `Entity.selectSpells(count)` |

### 5.2 Board (`battle/Board.kt`, `battle/Tile.kt`)

| # | Feature | Status | Notes |
|---|---|---|---|
| 5.2.1 | Grid is 8 columns × 16 rows. The top 8 rows are a hidden **refill buffer** and the bottom 8 are visible | Done | `Constants` says 8×8 (visible area) |
| 5.2.2 | Tile pool = both entities' selected spells + Dud spells (Ash, Rubble, Mist) + Nova spells (Surge, Critical) | Done | **→ D14**: player loadout only (combat §2.4) |
| 5.2.3 | **Weighted random** tile generation. Dud weights normalised to total 3 and Nova/Both weights normalised to total 3 | Done | **→ D14**: 60 / 25 / 15 split (combat §2.4) |
| 5.2.4 | Initial fill has **no pre-existing matches** (re-roll until no set) | Done | |
| 5.2.5 | Swap two orthogonally adjacent, *available* tiles | Done | Swaps are allowed even if no match forms |
| 5.2.6 | Match detection: 3+ in a row, horizontal or vertical. L/T shapes merge at the shared tile | Done | `getSetTiles` |
| 5.2.7 | Dud and Nova tiles never form sets and block lines | Done | |
| 5.2.8 | **Spell power = number of tiles in the group** (grouped by spell name across all sets this step) | Done | |
| 5.2.9 | **Linked tiles**: tiles with `linkedTile=true` orthogonally adjacent to a triggered set are pulled in and cleared. A linked **Surge** turns into the adjacent spell and adds to its power | Partial | Only Surge converts (TODO in code). Ash and others are cleared but have no effect |
| 5.2.10 | **Cascade**: cleared tiles drop down column by column, the buffer refills from the top, new sets trigger, repeat until stable | Done | Each cascade step currently runs on a 1s timer |
| 5.2.11 | **Tile lock states**: swapped tiles become `PENDING`. At end of turn PENDING → LOCKED and LOCKED → FREE. Locked tiles can't be swapped or matched | Done | `assets/spells/lockTile.png` overlay |
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
| 5.3.6 | Win/loss detection at end of turn | Partial | Detected and logged. **No victory or defeat screen**, no rewards, no return to the map. Spellcross: combat §1 |
| 5.3.7 | Defaults when started from the menu: a fresh Player vs a Wolf | Done | Debug panel: any encounter |
| 5.3.8 | XP, levelling and spell unlocks after battle | Stub | `systems/ProgressionSystem.kt` empty |

### 5.4 Damage and healing formula (`spells/Spell.kt::triggerSpell`)

```
power        = tiles in group
mod          = actor.strength × tempMultiplier
weaknessMod  = 2.0 if target weak to spell name, 0.5 if resistant, else 1
healing      = floor((spell.healing × mod + addSelfPerTile) × power) + addSelf
damage       = floor((spell.damage × mod × weaknessMod + addOtherPerTile) × power) + addOther
statuses     = each spell status applied (to self or target) with value × power
```

Hook order: target `onSpellActivated` → actor `onSpellActivated` → compute → target `onSpellApplied`
→ actor `onSpellApplied` → heal actor → damage target → apply statuses → flush expired statuses.

### 5.5 Spells (`spells/SpellLibrary.kt`)

| Spell | Owner | Element | Dmg | Heal | Status | Notes |
|---|---|---|---|---|---|---|
| Fireball | Player | Fire | 3 | 0 | | |
| Heal | Player | Lightning* | 0 | 3 | | |
| Lightning | Player | Lightning | 3 | 0 | | |
| Ice Shard | Player | Water | 3 | 0 | | |
| Poison | Player | Acid | 0 | 0 | Poisoned 1 → target | |
| Shield | Player | Earth | 0 | 0 | Block 3 → self | |
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
| Critical | Both | | | | Critical 1 → self | |

\* Defaults that look like data-entry mistakes. Corrected in Spellcross (D3).

**→ D14:** enemy spells (Dark Bolt to Frenzy) don't go on the board in Spellcross. They become or are
replaced by enemy intents (combat §5).

Elements: Fire, Lightning, Water, Earth, Air, Acid.

### 5.6 Statuses (`spells/Status.kt`, `spells/StatusLibrary.kt`)

Two kinds: **Status** (permanent, stacks value) and **DurationStatus** (stacks value, takes the max
duration, and counts down). Adding a status with the same name merges via `combine`. Removal is deferred
(`expireStatus` → `flushExpired`).

| Status | Kind | Effect | Implemented |
|---|---|---|---|
| Critical | Permanent, self | Next spell cast ×1.5, then expires | Yes |
| Strength | Duration 3, self | +value per tile to the caster's *self-additive* (healing) channel, ticks per cast | Yes (moves to the damage channel, D1) |
| Weakness | Duration 3 | −value per tile to the caster's self-additive channel | Yes (same caveat) |
| Charge | Permanent, self | +value per tile to the self-additive channel | Yes. Wolf starts with Charge 1 |
| Fortify | Permanent, self | On cast: gain Block = tiles × value | Yes |
| Block | Permanent, self | Absorbs incoming damage up to its value, then expires. Expires at the owner's turn start | Yes |
| Perma Block | Permanent, self | Reduces each incoming hit by its value | Yes |
| Poisoned | Permanent | At the owner's turn start: take value damage, then value halves. Expires at 0 | Yes |
| Charge Fire / Lightning / Stone | Duration 2, self | Icon and stacking only | **No effect** (given effects in Spellcross, D4) |
| Fortify Ice / Stone / Air | Duration 3, self | Icon and stacking only | **No effect** (given effects in Spellcross, D4) |

Status icons: `assets/status/*.png`. Tap a status (on a portrait or in a popup) to see its name,
description, value and duration.

### 5.7 Abilities (`spells/Ability.kt`, `spells/AbilitiesLibrary.kt`)

Player-triggered powers outside the board. Each has limited **uses** (3 max) and a rarity
(Common/Uncommon/Rare/Legendary). The player starts with **4 random abilities from 10**. The
inventory holds at most 5.

| Ability | Rarity | Effect |
|---|---|---|
| Low Blow | Common | Poisoned 6 → target |
| Crane Stance | Common | Block 20 → self |
| Finisher | Common | 15 fire damage × strength (respects weakness/resistance) |
| Fuel of Fire / Lightning / Stone | Common | Charge Fire/Lightning/Stone 2 → self |
| Sicken | Uncommon | Triples the target's existing Poisoned (adds 2× its value, D12) |
| Bulwark of Ice | Uncommon | Fortify 1 → self (Spellcross: Fortify Ice, D4) |
| Bulwark of Stone / Air | Uncommon | Fortify Stone/Air 1 → self |

| # | Feature | Status | Notes |
|---|---|---|---|
| 5.7.1 | Ability bar in the top menu (filled slots + dashed empty slots, up to max) | Done | |
| 5.7.2 | Tap an ability → info popup. In battle the popup has a **Trigger** button | Done | |
| 5.7.3 | Uses decrement. Can't trigger at 0 | Done | |
| 5.7.4 | `resetUses()` (recharge) | Partial | Exists. Nothing calls it (the Shrine "Recharge" only adds an item string) |

### 5.8 Entities (`entities/*`)

| Entity | HP | Spell pool | Extras |
|---|---|---|---|
| Player | 100 | Fireball, Heal, Lightning, Ice Shard, Poison, Shield | 4 random abilities, green team colour |
| Wolf | 60 | Bite, Howl, Frenzy | Starts with Charge 1. Behaviour-tree AI |
| Dark Mage (`Enemy`) | 80 | Dark Bolt, Life Drain, Curse, Inferno, Frost Nova, Vampiric Touch | No AI assigned and not used in game |

Shared entity model: HP, energy (2), strength (1), weakness and resistance pools (by spell name),
spell pool, selected loadout, statuses, inventory (gold, item strings, abilities, max abilities),
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
| 5.10.2 | Tile background tinted by spell colour and team colour. Icon scaled to fit, aspect preserved. Linked-tile and lock overlays | Done. Spellcross: no team tint (player-only board) |
| 5.10.3 | Tap-tap selection with highlight border. Tapping a non-adjacent tile reselects | Done. The only swap input in Spellcross (combat §2.2) |
| 5.10.4 | Drop animation: tiles slide down by blanks-below × tile size over the cascade timer | Done |
| 5.10.5 | Disappearing tiles flash with a white halo | Done |
| 5.10.6 | Per-step **lightning bolt** from actor to target, plus floating, fading damage and +healing numbers. One animation per target per step | Done |
| 5.10.7 | Character panel: portrait, energy circle, health bar (green player / red enemy) with "cur/max" text, name, status icons with value badges (wrapping) | Done |
| 5.10.8 | Tap a tile's spell → popup (icon, name, description, damage, healing, status icons) | Done. Spellcross: **long-press**, since tap selects |
| 5.10.9 | Tap a status → popup (description, value, duration) | Done |
| 5.10.10 | Popups are modal: tapping outside dismisses them and clears selection | Done |
| 5.10.11 | Wood-texture background, with a solid-colour fallback | Done |

## 6. Player progression and inventory

| # | Feature | Status | Notes |
|---|---|---|---|
| 6.1 | Gold (shown in the top bar with an icon) | Done | Earned and spent through events. Can go negative (no checks) |
| 6.2 | Items as plain strings: Gemstone, Weapon, Spell Upgrade, Recharge, Ability | Partial | Collected but **no item has any effect**, and there's no inventory screen |
| 6.3 | HP persists between events in the same chain | Done | |
| 6.4 | HP and player state carried across World → Battle | Partial | The World screen doesn't start battles yet. Menu shortcuts create a fresh Player |
| 6.5 | XP, levels, spell unlocks, max HP growth | Planned | `ProgressionSystem.kt` empty. `Constants.PLAYER_START_XP` |
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
`abilities/`, `fonts/`, `icons/`, `portraits/`, `spells/{fire,ice,earth,water,monster,dud,nova}/`,
`spells/linkedTile.png`, `spells/lockTile.png`, `status/`, `maps/stops/`, `maps/people/`.

The battle background `wood.png` is referenced but **missing**, so Spellford uses a solid-colour
fallback. Some status icons are referenced but don't exist either (for example `status/fortify-air.png`).
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
| D1 | Strength, Weakness and Charge add to the *self-per-tile* channel, which boosts **healing**. Descriptions say "damage dealt" | **Fix** (Weakness and ticking amended by D14, combat §4) | They act on the **damage** channel (`addOtherPerTile`): Strength `+value`/tile, Charge `+value`/tile, Weakness `−value`/tile. Per-tile damage is floored at 0, so Weakness can't turn damage into healing. They only apply when the spell deals base damage > 0. Strength and Weakness keep ticking down 1 duration per cast, as in Spellford |
| D2 | `Leaf.validate()` is never called, so AI conditions are ignored | ~~Fix~~ **Superseded by D14** (no behaviour tree) | Selector nodes skip a leaf whose `when` is false. The Wolf then only uses its first Frenzy branch below 50% HP. (Frenzy is still reachable later in the list, so overall Wolf behaviour changes only slightly) |
| D3 | Several spells keep the default element Fire (Dark Bolt, Life Drain, Curse, Frost Nova, Vampiric Touch), and Heal is Lightning | **Fix** | Elements follow name and icon: Heal → Water, Dark Bolt → Earth, Life Drain → Water, Curse → Acid, Frost Nova → Water, Vampiric Touch → Acid. Elements have no combat effect today except through D4, so this is low risk |
| D4 | Charge Fire/Lightning/Stone and Fortify Ice/Stone/Air have no effect. Bulwark of Ice grants *generic* Fortify, unlike its siblings | **Fix** | **Charge ‹element›**: `+value` damage per tile on spells of that element (Fire, Lightning, Stone→Earth). It ticks 1 duration per matching cast. **Fortify ‹element›**: incoming damage from spells of that element (Ice→Water, Stone→Earth, Air) is reduced by `value × tiles`, and it ticks 1 duration at the owner's turn end. Bulwark of Ice grants **Fortify Ice**. Generic Fortify stays as-is (cast → gain Block) |
| D5 | Gambler shows a wager but never deducts it. Warlock "Weight Gem" option gives "Spell Upgrade" | **Fix** | The wager (50 / 200) is deducted when chosen, and the outcome is rolled 50/50. On a win: **Insist** = +2× wager gold, **Take some junk** = wager back + Gemstone. The Warlock option gives a **Weight Gem** item |
| D6 | Salesman allows negative gold, and "+50% HP" heals 50% of *current* HP | **Fix** | Any option whose gold cost exceeds current gold is shown **disabled** (greyed, cost in red). This applies to all events, Gambler included. Healing restores 50% of **max** HP (clamped) |
| D7 | `randomizer` builds `Random(seed)` per call, so every roll in a session is identical, and outcomes are rolled when the event is built | **Fix** | Rolls happen **when the option is chosen**, from the run's `events` RNG stream. Probabilities are unchanged: chest 25%+10%·n (guaranteed at attempt 10), tavern ambush 1% per take, gamble 50%. The random event picker uses the same stream |
| D8 | Block expires at its owner's turn start | **Replicate** | Block protects through the opponent's turn and then clears. This is the standard convention and clearly intended (`onStartTurn` is explicit) |
| D9 | Battle end is detected but nothing happens | **Fix** (minimal) | New **ResultScreen**. *Victory*: gold reward from enemy content (Wolf 25–40, Dark Mage 40–60, rolled from the run RNG), HP carries over, ability uses are **not** refilled, then back to the map (or the menu if the battle was started from a debug shortcut). *Defeat*: "Your journey ends" → the run's save is deleted → title screen. Event deaths (HP 0 from an option) use the same defeat screen |
| D10 | Linked tiles other than Surge are only cleared, with no effect | **Replicate** | Ash, Slime, Orb, Charge and Wall stay "board cleaners": they get pulled into adjacent sets and removed, adding nothing. Surge keeps its mimic behaviour. The engine has a `linkBehaviour` hook so real effects can be added later (post-parity) |
| D11 | Chasm quits the app (`Gdx.app.exit()`) | **Fix** | Chasm becomes **"Abandon run"**, shown only when a saved run exists, with a confirmation dialog. Otherwise it's decorative. Hut becomes **"Continue run"** (when a save exists). Pathway = **New run**. Tree and Hut's original shortcuts (random event, quick battle) move to the dev-only debug panel |
| D12 | Sicken is described as "Poison the target heavily". `combine(2×value)` actually **triples** Poisoned | **Replicate** | Keep the ×3 result and update the description to "Triple the target's Poisoned" so the text matches the behaviour |
| D13 | Spellford supports both landscape and portrait (1.5, 5.10.1) | **Change** (platform) | Spellcross targets **phone browsers in landscape**. There is one landscape layout, and portrait shows a "rotate your device" overlay without losing state. Hover-only feedback (2.6, 4.1.7) moves to press. Desktop shows the same layout letterboxed. Portrait and tablet layouts are post-parity |

| D14 | 1v1 battle where the enemy plays on the shared board using a behaviour tree. 2 energy per turn | **Change** (design) | Intent-based combat against **1–4 enemies**. The board is the player's alone, with **3 moves per turn** by tap-tap swap. Each enemy repeats a fixed, visible intent cycle that can damage the player, heal itself or its allies, buff, debuff, or (elite and boss only) alter the board. Full spec: [combat.md](combat.md) |

Decisions D1, D4 and D14 change combat balance. After M2, run the 500-seed headless sim over every
starter encounter (combat §5) and record the win rate, average turns and average HP lost per encounter in
`05-migration-plan.md` as the balance baseline.
