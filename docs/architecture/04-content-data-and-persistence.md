# 04: Content, Data and Persistence

## Content as data

Spellford defines content as Kotlin `object`s with lambdas (`SpellLibrary`, `StatusLibrary`,
`AbilitiesLibrary`, `EventLibrary`). Spellcross moves it to **typed TypeScript data modules** under
`src/content/`. Validation runs as a **test suite** (`tests/content/validation.test.ts`) rather than at boot, so it costs players nothing. This keeps type-checking and IDE autocomplete,
and leaves room to move content to JSON later for modding or a content editor.

```ts
// src/content/spells.ts
export const spells = defineSpells({
  scorch: { name: 'Scorch', description: 'Damage the enemy',
            element: 'fire',              // no icon: derived from stats → spells/fire/dmg-2.png
            damage: 4, healing: 0, weight: 1, spellClass: 'player', linked: false, target: 'single',
            statuses: [], color: '#ffb3b3' },
  strike: { ..., damage: 2, statuses: [{ status: 'chargeLightning', value: 1, self: true, perTile: false }] },
  shield: { ..., damage: 1, statuses: [{ status: 'block', value: 2, self: true, perTile: true }] },
  venom:  { ..., statuses: [{ status: 'poisoned', value: 1, self: false, perTile: true }] },
  ash:      { ..., spellClass: 'dud', linked: true },
  surge:    { ..., spellClass: 'nova', linked: true, linkBehaviour: 'mimicNeighbour' },
  ...
});
```

| Spellford source | Spellcross module | Behaviour-bearing parts |
|---|---|---|
| `SpellLibrary.kt` | `content/spells.ts` | `linkBehaviour` names a handler in `engine/board/linkBehaviours.ts` |
| `StatusLibrary.kt` | `content/statuses.ts` (name, icon, description, kind, default value/duration) | Hooks in `engine/status/behaviours/*.ts`, keyed by status id |
| `AbilitiesLibrary.kt` | `content/abilities.ts` | `effects: [{type:'doublePoison'}]` → `engine/ability/effects.ts` |
| `Player.kt` | `content/player.ts` (HP, `movesPerTurn: 3`, starting spells as instances, junk pool Orb + Slime, no starting abilities: the Traveller gives one) | |
| *(new, D16)* | `content/gems.ts`: the 10 gems (design tier, property, values by spell level 1–5, special) | Specials (Chaos, Darkstone, Sunstone) are handlers in `engine/progression/` |
| `Wolf.kt` (+ new Bear, Spider, Boss) | `content/intents.ts` (named intents) and `content/enemies.ts` (each enemy's ordered intent list). Format in [enemies.md §4](../enemies.md#4-data-files) | Generic intents are a closed set in `engine/intents/` |
| *(new)* | `content/encounters.ts`: 1–4 enemy ids per encounter, with tier | |
| `EventLibrary.kt` | `content/events/*.ts`, one file per event graph | Effects and branch types are a closed set in the engine |
| `StopType`, `RoadType` enums | `content/map.ts` (chance tables, links, blocks, minimums, radius, width) | |
| `Constants.kt` | `content/config.ts` | |

**Validation at boot (dev and tests):** every referenced id exists (spell → status, ability → status,
intent → status/spell, encounter → enemy, event → node, event → item/gem), every icon path resolves in the
asset manifest, and every event graph is acyclic or terminates (parametric chains have a max). Combat rules
are validated too: encounters have 1–4 enemies, every enemy has at least one intent, and **only `elite`
and `boss` enemies may have board effects** (combat §3.2). Starting spell instances obey the socket rules
(spells-and-gems §3.3).

**Items:** Spellford uses raw strings (`"Gemstone"`, `"Spell Upgrade"`, spelled `"Spellupgrade"` in shops).
In Spellcross, gems are their own content (`content/gems.ts`), held as `inventory.gems` (no rank). Spell
Upgrades are a counter (`inventory.spellUpgrades`). Spellford's "+Gemstone" shop purchases become "pick 1 of
3 random gems", and battles can drop gems (spells-and-gems §3.2) and its Weight Gem becomes the **Weight** gem ([spells-and-gems.md](../spells-and-gems.md), D16).
`content/items.ts` remains for any other items and is empty at launch.

**Set events:** `content/events/set/*.ts` hold the stop-arrival events (Traveller, Campfire, Village, Town,
Market), and `content/map.ts` maps stop type → set event id (features §4.3).

**Spell icons from stats:** player spells don't name an icon. `iconForSpell(def)` ports Spellford's
`getIconPathFromStats` (features §5.5): categories dmg/healing/block/poison/chaos, tiers at 1/4/8, top two
categories, falling back to `spells/<element>/default.png` and then the generic placeholder. It's computed
from the spell instance's **final** stats (base + upgrades + gems; `resolveSpell`), so customisation shows
on the icon. Rule, quirks and tests: [spells-and-gems.md §2](../spells-and-gems.md#2-spell-icons-from-stats).

**Player spells are instances:** the save stores `player.spells: SpellInstance[]` (spell id, element, upgrade
level, sockets) instead of spell ids. See [spells-and-gems.md §5](../spells-and-gems.md#5-data-model).

## Assets

- Copy `spellford/app/src/main/assets/**` → `spellcross/public/assets/**` unchanged.
- A build-time script generates `assets.manifest.json` (path → width/height), used by the content
  validator and for preloading.
- `<AssetImage path>` component: preloads the image and falls back to a generated placeholder (coloured
  circle + initial) if missing. This mirrors Spellford's null-texture fallback.
- Fonts → `@font-face` in `theme/fonts.css`.
- Missing today: `wood.png` (use a CSS wood texture), `status/fortify-air.png`, `portraits/traveller.png`,
  `spells/air/*` (Wind Wall) and `spells/acid/default.png`. Spellford references `town/town.png`, but the
  file is `town/town.jpg`, so Spellcross references the `.jpg`.

## Persistence

Spellford has **no save system**, so this is new. It's needed on the web, where a page refresh would
otherwise wipe the run.

| Data | Storage | Key | When written |
|---|---|---|---|
| Current run, including a battle in progress | `localStorage` | `spellcross:run:v1` | after **every action** (travel, event option, swap, ability, retarget, battle end). The RNG state is saved too, so a refresh or an iOS tab eviction resumes exactly where you were, with nothing to re-roll |

Settings aren't persisted in v0 (there are none yet).

```ts
// The save is the store's RunState (src/engine/run.ts), as JSON:
interface RunState {
  version: 1;
  seed: number; createdAt: string; updatedAt: string;
  rng: { events: RngState; run: RngState };   // battle RNG lives inside `battle`
  battleCount: number;
  map: WorldMap; terrainSeed: number;          // map stored, terrain regenerated from its seed
  currentStopId: number;
  travel: null | { from; to; roadId; battleAt: number | null; battleDone: boolean };
  player: Player;                              // spell instances (id, element, level, sockets), gems, junk, abilities
  screen: 'map' | 'event' | 'prep' | 'battle' | 'result' | 'victory' | 'defeat';
  event: EventState | null; prep: PrepState | null;
  battle: BattleState | null;                  // the live battle, including intent cursors
  result: { outcome; gold; gem; boss } | null;
}
```

- Everything in state is plain serialisable data (no lambdas, no class instances). That's why
  ability and event effects are data.
- Versioned migrations in `state/persistence.ts`. Unknown or corrupt saves are moved to a `…:corrupt`
  key and the player is offered a new run.
- Single save slot for v1. The schema supports multiple slots later.
- No personal data is stored. Saves are local to the browser.

## Determinism and seeds

- `newRun(seed = Date.now())` (Spellford: `System.currentTimeMillis()`).
- RNG streams forked from the run seed: `map`, `terrain`, `events` (event rolls and offers), `run` (road-battle
  position, encounter picks, rewards) and `battle:<N>` (the board, random targeting, intent start positions,
  board-intent tile picks).
- Debug panel can display and copy the seed and start a run from a given one.
- Battle replays: `{ startSnapshot, inputs: Move[] }` is enough to reproduce a battle. That's useful
  for bug reports and golden tests.
