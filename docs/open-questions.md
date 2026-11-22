# Open Questions

Design decisions still to make, with a recommendation that the other docs assume until decided. The
decisions already made are logged at the end. When something is decided, move it to the log and update the
doc it points to.

## Still open

| ID | Question | Recommendation | Blocks |
|---|---|---|---|
| **C2** | Player **Strength** value (explained below). *Deferred:* nothing grants the player Strength in v1 | Revisit when something does | Later |
| **U5** | Spider art: Spellford has no spider portrait or intent icons to pull | Placeholder (generated silhouette) until drawn. Intent icons fall back to the generic category icons | M3 |
| **B1** | **Everything is too easy now.** After D22 (dud sets), D23 (no swap locks), halved enemy HP and linear poison, the sim bot wins **every** encounter 100%: normal fights in 1–4 rounds losing ~2 HP, the boss in ~7 rounds losing ~24 HP | Raise enemy damage rather than HP (keeps fights short but dangerous), e.g. +50% to attack values; or start the player below full HP. Then add a whole-run sim with HP carry-over | M2 / M6 |
| **B4** | **Finisher vs Block.** Spellford's Finisher bypasses Block (`takeDamage`); Spellcross lets Block absorb it (relevant against Ward 15 and Bear's Defend 10) | Bypass Block, as Spellford: it's a finisher | M2 |
| **C1** | (Reopened) Permanent Strength/Charge was decided on the condition that the sim logs damage per round. That logging doesn't exist yet | Add per-round damage logging to `pnpm sim`, then confirm | M2 |

**C2 explained.** Strength is a status that makes each spell tile hit harder. In Spellford a Strength status
defaults to **+2 per tile** (`StatusLibrary`, changed in `3f7b1a0`), and D1 moves it onto damage. Nothing in
Spellcross currently *gives* the player Strength. No spell, ability or gem does, so the question is moot
for v1. If something adds it later (e.g. a new ability), its value should be set there. "+2 per tile" is
strong: it's +50% on Scorch.

## Decided during the build and review (please confirm)

Gaps the adversarial doc review found, which I filled so code and docs agree. Each is easy to change.

| Rule | What I chose | Where |
|---|---|---|
| Win and loss at the same moment | Victory wins. The battle ends the instant the last enemy dies: no later casts, no Darkstone self-damage | spec §6.3 |
| Intent badges with ally buffs | Badges include Strength from allies acting earlier the same phase (Rally → Maul shows 13, hits 13) | spec §6.7 |
| Add Tiles on locked tiles | Skips locked tiles, keeps pending locks, only adds junk | spec §6.7 |
| Chaos details | Rolled once per cast; counts as damage for Strength/Charge; a self spell with Chaos targets an enemy | spec §6.5 |
| Critical scope | ×1.5 to damage and healing only, consumed by the next cast | spec §6.5 |
| Saving | The whole run is saved after every action, battle included | spec §11 |
| Spellford fixes | D18 map minimums, D19 Fight for Loot, D20 Shrine Ignore and full-inventory purchases, D21 element-based weaknesses | features.md |

## Decision log

| ID | Decided (2026-11-21) | Where |
|---|---|---|
| G1 | Gem values are indexed by the **spell's level** (1–5). Example: Strikecut adds +2 damage per tile at level 1, so a 2-damage spell does 4 | spells-and-gems §3.2 |
| G2 | **Chaos** is unpredictable output: each cast, its value becomes damage, Block or healing (random) | spells-and-gems §3.2 |
| G3 | **Trapstone** is cut | spells-and-gems §3.2 |
| G4 | **Sunstone**: the player picks the second element | spells-and-gems §3.2 |
| G5 | Gems have **no levels**. They use the level of the spell they're in | spells-and-gems §3.2 |
| G7 | **Spell Upgrades** raise the spell's level (stored, max 5). For now that only changes gem values | spells-and-gems §3.4 |
| G8 | Paid **Unsocket** at Towns (−50gp, gem returned) | spells-and-gems §3.3 |
| G9 | All 3 sockets are open from the start | spells-and-gems §3.3 |
| G6 | **No cap** on effect types: a spell can do everything. The icon shows the top two, and a "+n" pip marks the rest | spells-and-gems §3.3 |
| G10 | Gem power is fine as listed | n/a |
| B2 | Board clog fixed by **dud sets** (D22): 3+ duds of the same type clear with no effect. Boss no-match moves 37% → 10%, boss win rate 0% → 40% | features D22, spec §6.2 |
| n/a | Enemy HP halved (Wolf 30, Bear 45, Spider 38, Harbinger 90); first battle of a run is always one enemy; Poisoned drops by 1 per turn (D24) | enemies.md, spec §2, §6.6 |
| n/a | One heal per visit: free +20% at Campfires, Villages and Towns, or +50% for 50gp at Villages and Towns (D25) | spec §4 |
| B3 | Gamble Big pays gold: Insist gives +601 after a Big win (+201 after Small) | spec §4.3 |
| B5 | Rolls weighted by rarity: abilities common 3 : uncommon 1; gems Weight 6, Cracked 6, other tier-1 4, Chargestone/Stormstone 2, Darkstone/Sunstone 1; duplicate abilities allowed | spec §4.3, §9.3 |
| G11 | The gem list's "Lvl" column is ignored (reference only) | spells-and-gems §3.2 |
| G12 | Gems **drop as combat rewards** (normal 25%, elite 100%, *tune*) or are **sold**: pick 1 of 3 random gems for 100gp at Village, Town and Market | spells-and-gems §3.2, D17 |
| Q12 | Darkstone's extra move is at most once per turn | spells-and-gems §3.2 |
| R1 | Road battles draw **normal** encounters, Trail battles draw **elite** encounters (3 loadout slots, like every battle) | enemies.md §3, D17 |
| R2 | The **boss** (Harbinger) is fought on arriving at **Finish**. Winning it wins the run | enemies.md §3, D17 |
| R3 | Run length of about 4–6 battles plus the boss is right | n/a |
| R4 | Battle gold is the sum of each enemy's reward roll, not a flat +50 | D9 |
| R5 | Prices stay as Spellford: gem 100, Spell Upgrade 100, ability 200, Unsocket 50, healing free | features §4.3 |
| R6 | Defeat ends the run and deletes the save (permadeath) | D9 |
| R7 | **No relic system** | n/a |
| C3 | Junk selection (Orb, Slime) is fine as it is | combat §2.4 |
| C4 | **No reshuffle** when there's no matching move. Any adjacent swap is legal, so the player is never stuck | combat §2.4 |
| C5 | Abilities cost no moves | combat §2.1 |
| U1 | World map: **fit the height and scroll horizontally, as in Spellford** (the world is 2 screens wide) | 03-frontend, features 3.2.5 |
| U2 | Desktop: the same layout, letterboxed | D13 |
| U3 | Boss name: **Harbinger** | enemies.md |
| U4 | **Art comes from Spellford's assets.** Gaps get placeholders (see U5) | doc 04 |
| P1 | Consolidated game spec written | [spec.md](spec.md) |
| n/a | Every battle uses 3 loadout slots, including Trails and the boss | spec.md §5 |
