# Spells, Gems and Upgrades

How player spells are customised over a run, and how a spell's icon is built from what it does.

- **§1 and §2** describe Spellford as it is (commit `3f7b1a0`), which is parity.
- **§3 onwards** is the Spellcross design for spell customisation (decision **D16** in
  [features.md](features.md)). Spellford only has hooks for it: Gemstones and Spell Upgrades are sold but
  do nothing, and Ice Bolt has `TODO have 3 gemstone slots`.

Numbers marked *(tune)* are starting values. Questions marked **Open** are undecided. Each shows the
recommendation the rest of this doc assumes.

---

## 1. Player spells in Spellford

| Spell | Element | Dmg | Heal | Statuses | Icon (from stats) |
|---|---|---|---|---|---|
| Scorch | Fire | 4 | 0 | | `fire/dmg-2.png` |
| Restore | Lightning | 0 | 2 | | `lightning/healing-1.png` |
| Strike | Lightning | 2 | 0 | Charge Lightning 1 → self (not per tile) | `lightning/dmg-1.png` |
| Ice Bolt | Water | 3 | 0 | | `water/dmg-1.png` |
| Venom | Acid | 0 | 0 | Poisoned 1/tile → target | `acid/poison-1.png` |
| Shield | Earth | 1 | 0 | Block 2/tile → self | `earth/dmg-block-1.png` |
| Wind Wall | Air | 0 | 0 | Fortify Air 1 → self | none: no `air/` art |

All values are per tile, multiplied by match size (features §5.4), except where marked "not per tile".

The only way a spell changes in Spellford today is its **element**. The Alchemist event changes the element
of a spell in the pool (features §4.2).

## 2. Spell icons from stats

### 2.1 Rule (Spellford `Spell.getIconPathFromStats()`)

It only applies to spells with a blank `iconPath`, which is every player spell. Enemy, dud and nova spells
name a fixed icon.

1. Read five **categories** from the spell definition:

   | Category | Value read |
   |---|---|
   | `dmg` | base damage |
   | `healing` | base healing |
   | `block` | value of the spell's Block status |
   | `poison` | value of the spell's Poisoned status |
   | `chaos` | value of the spell's Critical status |

   Other statuses (Charge, Fortify, Strength, Weakness, …) don't count.
2. **Tier** each value: 0 → none, 1–3 → 1, 4–7 → 2, 8+ → 3.
3. Walk the categories in priority order: `dmg` → `healing` → `block` → `poison` → `chaos`. Keep the first
   two with a tier above 0. After that, a later category replaces the **lowest-tier** kept one (the last such
   one, if tied) only if its tier is **strictly higher**.
4. Sort the kept categories back into priority order and build the path:
   - two categories: `spells/<element>/<cat1>-<cat2>-<maxTier>.png`
   - one category: `spells/<element>/<cat>-<tier>.png`
   - none: `dmg-0`, which never exists, so it falls back.
5. Fallback: `spells/<element>/default.png`. If that's missing, no icon is drawn.

### 2.2 What changes an icon

- **Element:** the Alchemist moves the spell to another folder. Scorch → Lightning gives `lightning/dmg-2.png`.
  Scorch → Earth gives `earth/dmg-2.png`, which doesn't exist, so it falls back to `earth/default.png`.
- **Base stats:** crossing a tier boundary (4 or 8), or gaining a second category.

These **don't** change it: statuses gained in battle (Strike's growing Charge Lightning, Critical, …),
match size, and non-category statuses.

### 2.3 Quirks

- The tier shown is the **highest** of the two categories. Damage 8 + Block 1 shows `dmg-block-3`, which looks
  like strong Block.
- A third category is silently dropped. Damage 1 + Block 1 + Poison 4 shows `dmg-poison-2`.
- **Bug:** the tile info popup (`BattleScreen.showSpellPopup`) loads `Spell.getTexture(clickedSpell.iconPath)`,
  the blank path, so player spells show **no icon** in their popup. Spellcross uses the generated icon everywhere.

### 2.4 Art coverage (`assets/spells/<element>/`)

| Element | Has | Missing |
|---|---|---|
| fire | dmg, healing, block and most pairs, tiers 1–3, `default` | `poison-*`, `chaos-*`, `healing-poison-*`, `poison-chaos-*` |
| water | dmg, block, most pairs, `default` | `healing-2/3`, `poison-*`, `chaos-*`, some pairs. Has an odd `dmg-healing-4` |
| lightning | dmg, healing, `block-1`, dmg-block, dmg-poison, `default` | most others |
| earth | pairs only, `default` | **all single categories** (so `dmg-2` → `default`) |
| acid | poison, poison pairs | **`default.png`**, any icon without poison |
| air | | **the whole folder** (Wind Wall has no icon) |

Ignore `earth/Template Frame Earth.png`.

### 2.5 Spellcross port

`iconForSpell(spell)` ports the rule exactly, with two changes:

1. It reads the spell's **final** stats (§3.4), so gems show on the icon. The `chaos` category reads the
   spell's **Chaos** value (Cracked gem, §3.2) instead of Critical.
2. The last fallback is the generic `<AssetImage>` placeholder (doc 04), not "no icon".

A unit test pins the expected filename for every starting spell, and for a few gemmed and upgraded
examples, against the asset manifest. New art for the gaps in §2.4 is an art task (doc 05).

---

## 3. Customised spells (Spellcross design)

### 3.1 Overview

Each spell the player owns is a **spell instance**: a base spell plus

- an **element** (starts as the base spell's, changeable at the Alchemist),
- a **level**, 1–5 (starts at 1, raised by Spell Upgrades), and
- **3 gem sockets**, all open from the start.

The spell's **level drives its gems**: every gem's value is read from the spell's level (§3.2). For now a
level changes nothing else. Base stats stay as they are, but the level is stored so later features can use it.

### 3.2 Gems

Ten gems (design list, 2026-11-21; Trapstone was cut). **Gems have no level or rank of their own.** Each
value column is indexed by the **level of the spell it's socketed in**.

| Gem | Design tier | Property | Value at spell level 1 / 2 / 3 / 4 / 5 | Special |
|---|---|---|---|---|
| **Strikecut** | 1 | Damage per tile | 2 / 2 / 3 / 4 / 5 | |
| **Lifelink** | 1 | Healing per tile | 1 / 1 / 2 / 3 / 4 | |
| **Walled** | 1 | Block per tile | 2 / 2 / 3 / 3 / 4 | |
| **Toxicut** | 1 | Poisoned per tile | 1 / 1 / 1 / 2 / 3 | |
| **Cracked** | 1 | Chaos per tile | 2 / 2 / 2 / 4 / 4 | |
| **Weight** | 1 | none | | +20% chance for this spell to appear on the board |
| **Chargestone** | 2 | Charge ‹X› | 1 / 1 / 1 / 2 / 3 | |
| **Stormstone** | 2 | Fortify ‹X› | 1 / 1 / 1 / 2 / 3 | |
| **Darkstone** | 3 | Self damage | 3 / 3 / 4 / 4 / 5 | Take another move |
| **Sunstone** | 3 | none | | Gain a second element |
| ~~Trapstone~~ | 3 | | | **Cut** (it needed enemies to play on the board, which D14 removed) |

Example: Strikecut in a level 1 spell adds **+2 damage per tile**, so a spell with 2 damage now does 4.
Upgrade that spell to level 4, and the same Strikecut adds +4, so it does 6.

What the effects do:

- **Effect gems** (Strikecut, Lifelink, Walled, Toxicut, Cracked) add to the spell's value in their category,
  per tile. They map onto the five icon categories (§2): `dmg`, `healing`, `block`, `poison`, `chaos`.
- **Chaos** (Cracked) is unpredictable output. Each time the spell is cast, its Chaos value turns into one of
  **damage, Block or healing** of that amount per tile, chosen at random (battle RNG, so it's deterministic
  per seed). Example: Chaos 6 becomes 6 damage, *or* 6 Block, *or* 6 healing per tile. The popup and the cast
  animation show which one came up. This replaces Spellford's use of "chaos" for Critical in the icon
  categories. Spellford's Critical tile and status are unchanged.
- **Weight**: tile weight +0.2 per gem (additive: two give 1.4). The loadout's share of the board stays 60%, so
  this redistributes within it: with 3 spells, one Weight gem takes a spell from 20% to 22.5% of tiles. It isn't
  a category.
  It replaces the Warlock's Weight Gem item (D5).
- **Chargestone / Stormstone**: ‹X› = the spell's own element (both elements with Sunstone). Each cast gives
  you Charge ‹element› / Fortify ‹element› at the gem's value (permanent, features §5.6). This needs Charge and
  Fortify statuses for **every** element. Today only Charge Fire/Lightning/Earth and Fortify
  Water/Earth/Air exist, so Charge Water/Air/Acid and Fortify Fire/Lightning/Acid are new.
- **Darkstone**: each cast costs you the self-damage value (not absorbed by your Block). It also gives **+1
  move**, at most **once per turn**.
- **Sunstone**: the spell gets a **second element, chosen by the player when socketing**. Charge and Fortify
  bonuses for either element apply, and so do weaknesses and resistances. The icon uses the first element's
  folder. The Alchemist changes only the first element.
- **Design tier** is the "Lvl" column from the design list. It's kept for reference only, and no rule uses it.
- **Where gems come from** (G12):
  - **Combat rewards:** winning a battle can drop a random gem, shown on the ResultScreen. Starting rates
    *(tune)*: normal encounters 25%, elite encounters 100%.
  - **Shops:** Spellford's "Purchase (−100gp, +Gemstone)" at Village, Town and Market becomes **pick 1 of 3
    random gems** (distinct) for 100gp.
  - **Drop weights** *(tune)*, used by every roll: **Weight 6, Cracked 6** (most common), Strikecut, Lifelink,
    Walled, Toxicut 4, Chargestone, Stormstone 2, Darkstone, Sunstone 1.
  - Spellford's other "+Gemstone" source, the Gambler's *Take some junk*, gives a random gem.
  - All rolls use the run RNG.

### 3.3 Socket rules

- **3 sockets per spell**, all open from the start.
- The same gem can be socketed more than once, and values add up.
- **No cap on effect types** (G6). A spell can do everything: e.g. Ice Bolt + Walled + Lifelink + Toxicut
  deals damage, gives Block, heals and poisons.
- **Hidden effects:** the icon still follows Spellford's rule (§2) and shows only the **top two** categories.
  So that a third or fourth effect isn't invisible:
  - a tile whose spell has more than two categories shows a small **"+n" pip** in its corner (n = hidden
    categories);
  - long-pressing the tile, the Spellbook and battle prep always list **every** effect with its value.
- **Removing gems:** socketing is permanent in the Spellbook, but Towns offer **Unsocket** (−50gp, gem
  returned to inventory).

### 3.4 Spell levels and Spell Upgrades

- A **Spell Upgrade** raises one spell's level by 1, up to **level 5**.
- For now, a level only changes the spell's **gem values** (§3.2). Base damage, healing and statuses don't
  change. The level is stored so later features can use it.
- Sources: Town *Train* and Market *Study* (100gp each, existing options), Warlock *Listen*.
- The spell's name shows its level: "Scorch Lv 3".

**Final stats** for a spell instance = base stats + each socketed gem's value at the spell's level.
`resolveSpell(instance)` computes them, and they feed the formula (features §5.4), the icon (§2.5), the popup
and tile weight.

### 3.5 Worked example

Ice Bolt (Water, damage 3), across a run:

| Step | Level | Stats per tile | Icon |
|---|---|---|---|
| Start | 1 | dmg 3 | `water/dmg-1` |
| Socket Walled (Block 2 at Lv 1) | 1 | dmg 3, block 2 | `water/dmg-block-1` |
| Spell Upgrade ×2 | 3 | dmg 3, block 3 (Walled is 3 at Lv 3) | `water/dmg-block-1` |
| Socket Strikecut (+3 at Lv 3) | 3 | dmg 6, block 3 | `water/dmg-block-2` |
| Socket Weight | 3 | dmg 6, block 3, weight ×1.2 | `water/dmg-block-2` |
| Spell Upgrade ×2 | 5 | dmg 8, block 4 | `water/dmg-block-3` |

A 3-match at the end deals 24 damage and gives you 12 Block, and the spell makes up ~22.5% of tiles instead of 20%.

### 3.6 Element synergy

This already works through statuses ported from Spellford (features §5.6, D4). Gems stack on top of it:

- **Charge ‹element›** (Strike, Fuel abilities, Chargestone) adds damage per tile to every spell of that
  element. A Lightning loadout snowballs.
- **Fortify ‹element›** (Bulwark abilities, Wind Wall, Stormstone) gives Block whenever you cast that element.
- The **Alchemist** and **Sunstone** let you line spells up on one element to build around those synergies.

---

## 4. Spellbook screen

Where customisation happens. It opens from the **Spellbook** button in the World screen's top bar. It isn't
available during battles or battle prep. Unsocket is offered while the player is at a Town.

Phone landscape layout (03-frontend § Phone landscape layout):

```
┌ Back │ Spellbook ························· 💎 5   ⬆ 1 ┐  top bar: gems owned, Spell Upgrades
│ ┌──────────────┐ ┌──────────────────────────────────┐ │
│ │ ▣ Scorch Lv2 │ │ [icon]  ICE BOLT  Lv 3   Water    │ │
│ │ ▣ Restore    │ │  dmg 6 / tile   block 3 / tile    │ │
│ │ ▣ Strike     │ │  weight ×1.2                      │ │
│ │▶▣ Ice Bolt   │ │                                   │ │
│ │ ▣ Venom      │ │  Sockets: [Walled] [Strikecut] [+]│ │
│ │ ▣ Shield     │ │                                   │ │
│ └──────────────┘ │  [Upgrade ⬆ (Lv 3 → 4)]           │ │
│   spell list     └──────────────────────────────────┘ │
```

- Left: owned spells, with live icons and levels. Right: the selected spell's final stats, element, sockets
  and Upgrade button.
- **Empty socket "+"** → a sheet of the gems you own, each showing its value **at this spell's level**. Picking
  a gem shows a **before → after preview** (stats, icon and any "+n" pip) and asks to confirm, because
  socketing is permanent.
- **Upgrade** shows the same preview: which gem values rise at the next level.
- At a Town, a filled socket offers **Unsocket (−50gp)**.
- Battle prep shows each spell's final stats and icon, so loadout choices reflect the customisation.

## 5. Data model

```ts
// content (immutable): SpellDef (doc 02) has `upgradable: boolean` (false for dud/nova/enemy spells)

// player state (saved)
interface SpellInstance {
  uid: string;                       // stable id; several copies of a base spell could be owned
  spellId: SpellId;                  // base definition
  element: Element;                  // starts as def.element. The Alchemist changes this, never the def
  level: 1 | 2 | 3 | 4 | 5;          // raised by Spell Upgrades; indexes gem values
  sockets: [GemSocket | null, GemSocket | null, GemSocket | null];
}
type GemId = 'strikecut' | 'lifelink' | 'walled' | 'toxicut' | 'cracked' | 'weight'
           | 'chargestone' | 'stormstone' | 'darkstone' | 'sunstone';
type GemSocket = { gem: GemId; secondElement?: Element /* Sunstone */ };
// content/gems.ts: { id, name, tier: 1|2|3, property, valuesByLevel: [l1, l2, l3, l4, l5], special? }

interface Player { /* … */ spells: SpellInstance[]; loadout: string[] /* SpellInstance uids */ }
// inventory: gems: GemId[] (no rank), spellUpgrades: number

resolveSpell(instance, defs) → ResolvedSpell   // final stats + weight + elements + iconPath; pure, memoised
```

- **Engine:** the board pool, `castSpell` and grouping use `ResolvedSpell`, keyed by instance `uid`, so two
  differently gemmed copies of the same spell never merge into one cast. Chaos is rolled inside `castSpell`
  from the battle RNG and reported in the `SpellTriggered` event.
- **Save file** (doc 04): `player.spells` stores instances, and resolved stats are always recomputed.
- **Status content:** add Charge and Fortify for every element (Chargestone / Stormstone).
- **Events:** new effect types `addGem`, `socketGem`, `upgradeSpell` and `unsocketGem`, used by the Spellbook and
  Town actions (doc 02 event effects).
- **Validation:** socket rules (§3.3) are enforced in the engine, not just the UI. Content tests check that every
  gem has 5 values.

## 6. Open questions

None for gems. See [open-questions.md](open-questions.md) for the log. Decided on 2026-11-21: gem values by spell
level, no cap on effect types, gem sources, Chaos, Trapstone cut, Sunstone choice, Unsocket, open sockets, upgrades only raise level for now, Darkstone once per turn,
and gem power left as is.
