# Open Questions

Design decisions still to make, with a recommendation that the other docs assume until decided. The
decisions already made are logged at the end. When something is decided, move it to the log and update the
doc it points to.

## Still open

| ID | Question | Recommendation | Blocks |
|---|---|---|---|
| **C2** | Player **Strength** value (explained below). *Deferred:* nothing grants the player Strength in v1 | Revisit when something does | Later |
| **U5** | Spider art: Spellford has no spider portrait or intent icons to pull | Placeholder (generated silhouette) until drawn. Intent icons fall back to the generic category icons | M3 |

**C2 explained.** Strength is a status that makes each spell tile hit harder. In Spellford a Strength status
defaults to **+2 per tile** (`StatusLibrary`, changed in `3f7b1a0`), and D1 moves it onto damage. Nothing in
Spellcross currently *gives* the player Strength. No spell, ability or gem does, so the question is moot
for v1. If something adds it later (e.g. a new ability), its value should be set there. "+2 per tile" is
strong: it's +50% on Scorch.

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
| G11 | The gem list's "Lvl" column is ignored (reference only) | spells-and-gems §3.2 |
| G12 | Gems **drop as combat rewards** (normal 25%, elite 100%, *tune*) or are **sold**: pick 1 of 3 random gems for 100gp at Village, Town and Market | spells-and-gems §3.2, D17 |
| Q12 | Darkstone's extra move is at most once per turn | spells-and-gems §3.2 |
| R1 | Road battles draw **normal** encounters, Trail battles draw **elite** encounters (4 loadout slots kept) | enemies.md §3, D17 |
| R2 | The **boss** (Harbinger) is fought on arriving at **Finish**. Winning it wins the run | enemies.md §3, D17 |
| R3 | Run length of about 4–6 battles plus the boss is right | n/a |
| R4 | Battle gold is the sum of each enemy's reward roll, not a flat +50 | D9 |
| R5 | Prices stay as Spellford: gem 100, Spell Upgrade 100, ability 200, Unsocket 50, healing free | features §4.3 |
| R6 | Defeat ends the run and deletes the save (permadeath) | D9 |
| R7 | **No relic system** | n/a |
| C1 | Enemy Strength and player Charge stay **permanent**. The M2 sim logs damage per round as a check | combat §4 |
| C3 | Junk selection (Orb, Slime) is fine as it is | combat §2.4 |
| C4 | **No reshuffle** when there's no matching move. Any adjacent swap is legal, so the player is never stuck | combat §2.4 |
| C5 | Abilities cost no moves | combat §2.1 |
| U1 | World map: **fit the height and scroll horizontally, as in Spellford** (the world is 2 screens wide) | 03-frontend, features 3.2.5 |
| U2 | Desktop: the same layout, letterboxed | D13 |
| U3 | Boss name: **Harbinger** | enemies.md |
| U4 | **Art comes from Spellford's assets.** Gaps get placeholders (see U5) | doc 04 |
| P1 | Consolidated game spec written | [spec.md](spec.md) |
| n/a | Boss fight uses 4 loadout slots *(tune; assumed in spec.md §5)* | spec.md |
