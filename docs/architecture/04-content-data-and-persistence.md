# 04: Content, Data and Persistence

## Content as data

Spellford defines content as Kotlin `object`s with lambdas (`SpellLibrary`, `StatusLibrary`,
`AbilitiesLibrary`, `EventLibrary`). Spellcross moves it to **typed TypeScript data modules** under
`src/content/`, validated at startup with **Zod** schemas. This keeps type-checking and IDE autocomplete,
and leaves room to move content to JSON later for modding or a content editor.

```ts
// src/content/spells.ts
export const spells = defineSpells({
  fireball: { name: 'Fireball', description: 'Deal fire damage to the enemy',
              icon: 'spells/fire/fire-burst.png', element: 'fire',
              damage: 3, healing: 0, weight: 1, spellClass: 'player', linked: false,
              statuses: [], color: '#ff0000' },
  poison:   { ..., statuses: [{ status: 'poisoned', value: 1, self: false }] },
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
| `Player.kt`, `Wolf.kt`, `Enemy.kt` | `content/entities.ts` (stats, pool, starting statuses, AI tree as data) | |
| `EventLibrary.kt` | `content/events/*.ts`, one file per event graph | Effects and branch types are a closed set in the engine |
| `StopType`, `RoadType` enums | `content/map.ts` (chance tables, links, blocks, minimums, radius, width) | |
| `Constants.kt` | `content/config.ts` | |

**Validation at boot (dev and tests):** every referenced id exists (spell → status, ability → status,
entity → spell, event → node, event → item), every icon path resolves in the asset manifest, and every
event graph is acyclic or terminates (parametric chains have a max).

**Items:** Spellford uses raw strings (`"Gemstone"`, `"Weapon"`, `"Spell Upgrade"`, `"Recharge"`, `"Ability"`).
Spellcross adds `content/items.ts` with ids, names and icons, with `effect: null` for parity. Item effects
are a post-parity feature.

## Assets

- Copy `spellford/app/src/main/assets/**` → `spellcross/public/assets/**` unchanged.
- A build-time script generates `assets.manifest.json` (path → width/height), used by the content
  validator and for preloading.
- `<AssetImage path>` component: preloads the image and falls back to a generated placeholder (coloured
  circle + initial) if missing. This mirrors Spellford's null-texture fallback.
- Fonts → `@font-face` in `theme/fonts.css`.
- Missing today: `wood.png` (use a CSS wood texture) and `status/fortify-air.png`.

## Persistence

Spellford has **no save system**, so this is new. It's needed on the web, where a page refresh would
otherwise wipe the run.

| Data | Storage | Key | When written |
|---|---|---|---|
| Settings | `localStorage` | `spellcross:settings:v1` | on change |
| Current run | `localStorage` | `spellcross:run:v1` | after each travel, event option, and battle end |
| Battle in progress | not saved in v1 | n/a | Refresh mid-battle restarts the battle from its start snapshot (saved at `startBattle`) |

```ts
interface SaveFileV1 {
  version: 1;
  createdAt: string; updatedAt: string;
  seed: number; rng: Record<string, RngState>;
  map: WorldMap;                // or regenerate from seed. Store anyway to survive generator changes
  currentStopId: number;
  player: Entity;               // ids only: spell ids, status instances, ability ids + uses
  currentEvent?: { nodeId: string; params?: Record<string, number> };
  pendingBattle?: { enemyId: string; snapshot: BattleState };
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
- RNG streams forked from the run seed: `map`, `terrain`, `events`, `board:<battleN>`, `ai:<battleN>`.
- Debug panel can display and copy the seed and start a run from a given one.
- Battle replays: `{ startSnapshot, inputs: Move[] }` is enough to reproduce a battle. That's useful
  for bug reports and golden tests.
