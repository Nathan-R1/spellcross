# Enemies and Intents

Enemy and intent content for the combat loop in [combat.md](combat.md). All numbers are starting
values *(tune after the M2 sim)*.

## 1. How intents are built

An **intent** is what an enemy does on its turn. There are two kinds:

- **Generic intents**: parameterised building blocks such as *Attack 5* or *Defend 8*. They need no name
  or definition and can be used directly in an enemy's cycle.
- **Named intents**: a name, icon and description wrapped around **a list of any number of intents**,
  generic or named. *Disable* = [Attack 5, Weaken 1]. Named intents can contain other named intents.

When an intent runs, its parts run in order. Each part is resolved at that moment, so an *Attack* after a
*Buff Strength* in the same intent already benefits from the Strength.

A multi-hit attack is just a repeated attack: *Lunge* = [Attack 4, Attack 4]. Strength and Block apply
to each hit separately.

### 1.1 Generic intents

| Generic intent | Effect | Badge | Board? |
|---|---|---|---|
| `attack(X)` | Deal X damage to the player (+Strength, ×0.75 if Weak, then absorbed by the player's Block). The badge shows the number before Block | ⚔ X | |
| `defend(X)` | Gain X Block | 🛡 X | |
| `defendAllies(X)` | Every living ally (including self) gains X Block | 🛡 X all | |
| `heal(X)` | Heal self X | ♥ X | |
| `healAlly(X)` | Heal the living ally with the lowest HP fraction (ties go to the leftmost; may be self) | ♥ X ally | |
| `healAllies(X)` | Heal every living ally (including self) | ♥ X all | |
| `buff(status, X)` | Apply a status to self (e.g. Strength) | ▲ | |
| `buffAllies(status, X)` | Apply a status to every living ally | ▲ all | |
| `debuff(status, X)` | Apply a status to the player (e.g. Weak, Poisoned) | ▼ | |
| `steal(X)` | Take up to X gold from the player. **All stolen gold is returned if this enemy is defeated** | 💰 X | |
| `lock(N)` | Lock N random free, visible tiles (freed after the player's next turn) | ▦ N | **yes** |
| `addTiles(spell, N)` | Turn N random visible tiles into `spell` (e.g. Rubble), without triggering matches | ▦ N | **yes** |

`steal` isn't used by the starting roster. It's kept for a future thief-type enemy.

Shorthands for common debuffs and buffs: `weaken(X)` = `debuff('weakness', X)`, `poison(X)` =
`debuff('poisoned', X)`, `enrage(X)` = `buff('strength', X)`.

**Board rule:** `lock` and `addTiles` may appear (directly or inside a named intent) only in `elite` and
`boss` enemies. Content validation fails the build otherwise.

### 1.2 Intent badge

The badge above an enemy shows one icon per part, in order, with **final numbers**, e.g. Disable shows
`⚔ 5  ▼`. Identical consecutive attacks collapse, so Lunge shows `⚔ 4×2`. Long-pressing the enemy lists
the full cycle with names and descriptions (combat §3.4).

### 1.3 Statuses intents use

Intents only use statuses that already exist in Spellford, with existing icons in `assets/status/`.
No new art is needed.

| Status | Used as | Rule (combat §4) |
|---|---|---|
| Strength | buff | +X damage per attack hit, permanent, stacks |
| Weakness ("Weak") | debuff | Damage dealt ×0.75. Value = turns left, ticks at the owner's turn end |
| Block | `defend` | Absorbs damage, clears at the owner's next turn start |
| Poisoned | debuff | X damage at the owner's turn start, then drops by 1 (D24) |

---

## 2. Enemies

HP was halved on 2026-11-22 (Wolf 60 → 30, Bear 90 → 45, Spider 75 → 38, Harbinger 180 → 90).

| Enemy | Tier | HP | Start | Gold | Portrait |
|---|---|---|---|---|---|
| **Wolf** | normal | 30 | random | 25–40 | `portraits/wolf.png` ✓ |
| **Bear** | normal | 45 | first | 35–50 | `portraits/bear.png` ✓ |
| **Spider** | elite | 38 | first | 45–65 | **needs art** (no Spellford asset; placeholder until drawn, U5) |
| **Harbinger** (boss) | boss | 90 | first | 100–150 | `portraits/harbinger.png` ✓ |

### Wolf: pack hunter that ramps up

| # | Intent | Made of | Notes |
|---|---|---|---|
| 1 | **Fangs** | Attack 5 | |
| 2 | **Disable** | Attack 5, Weaken 1 | |
| 3 | **Rage** | Enrage 1 | Permanent Strength. Every loop it hits 1 harder |

`start: random`, so a pack of wolves doesn't attack in sync.

### Bear: slow and tanky, hits hard

| # | Intent | Made of | Notes |
|---|---|---|---|
| 1 | **Swipe** | Attack 6 | |
| 2 | *Defend 10* | Defend 10 | Generic intent, used inline without a name |
| 3 | **Maul** | Attack 12 | The big telegraphed hit. Have Block ready |
| 4 | **Roar** | Enrage 1, Weaken 1 | |

### Spider (elite): poison and webs on your board

| # | Intent | Made of | Notes |
|---|---|---|---|
| 1 | **Venom Bite** | Attack 4, Poison 3 | |
| 2 | **Spin Web** | Lock 4, Defend 6 | Board effect (elite only) |
| 3 | **Lunge** | Attack 4, Attack 4 | Shows `⚔ 4×2` |
| 4 | **Feed** | Attack 6, Heal 6 | |

### Harbinger (boss): commander that heals and buffs its pack, then corrupts the board

Always fought with allies (see encounters), so the ally heals and buffs matter.

| # | Intent | Made of | Notes |
|---|---|---|---|
| 1 | **Dark Bolt** | Attack 12 | |
| 2 | **Rally** | Heal Allies 10, Buff Allies Strength 1 | Heals and enrages the whole pack |
| 3 | **Corrupt** | Add 4 Rubble, Weaken 2 | Board effect (boss only) |
| 4 | **Ward** | Defend 15, Heal 10 | |
| 5 | **Doom** | Attack 6, Attack 6, Attack 6 | Shows `⚔ 6×3`. Telegraphed big hit |

## 3. Encounters

| Encounter | Tier | Enemies (left → right) |
|---|---|---|
| `wolf` | normal | Wolf |
| `wolf_pair` | normal | Wolf, Wolf |
| `bear` | normal | Bear |
| `wilds` | normal | Wolf, Bear |
| `hunting_party` | normal | Wolf, Bear, Wolf |
| `pack` | normal | Wolf, Wolf, Wolf, Wolf |
| `spider` | elite | Spider |
| `nest` | elite | Wolf, Spider |
| `boss` | boss | Wolf, Harbinger, Bear |

**How encounters are picked (D17):**
- A **Road** battle draws a random **normal** encounter, with 3 loadout slots.
- A **Trail** battle draws a random **elite** encounter, with 4 loadout slots.
- Arriving at **Finish** starts the **boss** encounter. Winning it wins the run.

All picks use the run RNG. Weighting normal encounters by distance from Start is a tuning option, not v1.

---

## 4. Data files

Everything lives in **`src/content/enemies.ts`**: the generic-intent helpers (`attack()`, `defend()`, …), the
named intents, the enemies (each listing its cycle **in order**, mixing named intents by id and generic intents
inline) and the encounters. The snippets below show the shape; the file is the source of truth. The boss's id
is `harbinger`, and the Spider has no portrait (placeholder, open-questions U5).

```ts
// src/content/intents.ts
import { defineIntents, attack, defend, heal, healAllies, buffAllies,
         weaken, poison, enrage, lock, addTiles } from '../engine/intents/dsl';

export const intents = defineIntents({
  // Wolf
  fangs:      { name: 'Fangs',       icon: 'intents/fangs.png',  description: 'Bites for 5.',
                do: [attack(5)] },
  disable:    { name: 'Disable',     icon: 'intents/claw.png',   description: 'Hits for 5 and leaves you Weak.',
                do: [attack(5), weaken(1)] },
  rage:       { name: 'Rage',        icon: 'intents/howl.png',   description: 'Gains 1 Strength.',
                do: [enrage(1)] },

  // Bear
  swipe:      { name: 'Swipe',       icon: 'intents/claw.png',   description: 'Hits for 6.',
                do: [attack(6)] },
  maul:       { name: 'Maul',        icon: 'intents/maul.png',   description: 'Hits for 12.',
                do: [attack(12)] },
  roar:       { name: 'Roar',        icon: 'intents/roar.png',   description: 'Gains 1 Strength and leaves you Weak.',
                do: [enrage(1), weaken(1)] },

  // Spider
  venomBite:  { name: 'Venom Bite',  icon: 'intents/fang-green.png', description: 'Hits for 4 and poisons you.',
                do: [attack(4), poison(3)] },
  spinWeb:    { name: 'Spin Web',    icon: 'intents/web.png',    description: 'Webs 4 of your tiles and gains 6 Block.',
                do: [lock(4), defend(6)] },
  lunge:      { name: 'Lunge',       icon: 'intents/lunge.png',  description: 'Hits twice for 4.',
                do: [attack(4), attack(4)] },
  feed:       { name: 'Feed',        icon: 'intents/drain.png',  description: 'Hits for 6 and heals 6.',
                do: [attack(6), heal(6)] },

  // Boss
  darkBolt:   { name: 'Dark Bolt',   icon: 'intents/bolt.png',   description: 'Hits for 12.',
                do: [attack(12)] },
  rally:      { name: 'Rally',       icon: 'intents/banner.png', description: 'Heals all allies 10 and gives them 1 Strength.',
                do: [healAllies(10), buffAllies('strength', 1)] },
  corrupt:    { name: 'Corrupt',     icon: 'intents/rot.png',    description: 'Turns 4 tiles to Rubble and leaves you Weak.',
                do: [addTiles('rubble', 4), weaken(2)] },
  ward:       { name: 'Ward',        icon: 'intents/ward.png',   description: 'Gains 15 Block and heals 10.',
                do: [defend(15), heal(10)] },
  doom:       { name: 'Doom',        icon: 'intents/skull.png',  description: 'Hits three times for 6.',
                do: [attack(6), attack(6), attack(6)] },
});
```

```ts
// src/content/enemies.ts
import { defineEnemies, defend } from '../engine/intents/dsl';

export const enemies = defineEnemies({
  wolf: {
    name: 'Wolf', tier: 'normal', hp: 30, portrait: 'portraits/wolf.png',
    start: 'random', gold: [25, 40],
    intents: ['fangs', 'disable', 'rage'],
  },
  bear: {
    name: 'Bear', tier: 'normal', hp: 45, portrait: 'portraits/bear.png',
    gold: [35, 50],
    intents: ['swipe', defend(10), 'maul', 'roar'],   // a generic intent used inline
  },
  spider: {
    name: 'Spider', tier: 'elite', hp: 38, // no portrait yet (U5)
    gold: [45, 65],
    intents: ['venomBite', 'spinWeb', 'lunge', 'feed'],
  },
  harbinger: {
    name: 'Harbinger', tier: 'boss', hp: 90, portrait: 'portraits/harbinger.png',
    gold: [100, 150],
    intents: ['darkBolt', 'rally', 'corrupt', 'ward', 'doom'],
  },
});
```

Bear's second intent shows both styles side by side: a generic intent used inline without a name, next
to named intents for anything with flavour. An inline generic intent gets an auto label ("Defend 10") and
the generic icon.

### Types

```ts
type IntentRef = string /* named intent id */ | GenericIntent;

type GenericIntent =
  | { type: 'attack'; amount: number }
  | { type: 'defend' | 'defendAllies'; amount: number }
  | { type: 'heal' | 'healAlly' | 'healAllies'; amount: number }
  | { type: 'buff' | 'buffAllies' | 'debuff'; status: StatusId; value: number }
  | { type: 'steal'; amount: number }
  | { type: 'lock'; count: number }                       // elite/boss
  | { type: 'addTiles'; spell: SpellId; count: number };  // elite/boss

interface NamedIntent { name: string; icon: string; description: string; do: IntentRef[] }   // any length, nests

interface EnemyDef {
  name: string; tier: 'normal' | 'elite' | 'boss'; hp: number; portrait: string;
  start?: 'first' | 'random'; gold: [min: number, max: number];
  intents: IntentRef[];               // the cycle, in order, repeating
  weaknesses?: Element[]; resistances?: Element[]; startingStatuses?: StatusInstance[];
}
```

### Validation

- Every intent id exists, and named intents contain no cycles (an intent can't contain itself, directly
  or through other intents).
- Every status and spell referenced exists.
- `lock` and `addTiles` appear only in elite and boss enemies, at any nesting depth.
- Every enemy has at least one intent, and every encounter has 1–4 enemies.
- Each intent's `description` numbers match its parts. A test renders the auto-description and compares,
  so the text can't drift from the data (the Sicken problem, D12).

## 5. Assets needed

- Portraits: **spider**. Wolf, Bear and Harbinger exist.
- Intent icons (`assets/intents/`): one per named intent, plus generic icons for attack, defend, heal,
  buff, debuff, steal and board. Until art exists, badges fall back to the generic icons.
