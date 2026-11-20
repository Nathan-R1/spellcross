# 01: Architecture Overview

## Goals

1. **Feature parity** with Spellford. [features.md](../features.md) is the checklist.
2. **Runs in the browser** on desktop and mobile (touch first, portrait and landscape), and is installable as a PWA.
3. **Game logic is separate from rendering.** The rules engine is plain TypeScript with no React or DOM imports,
   so it is deterministic, unit-testable, and could later run on a server or in a worker.
4. **Content is data, not code.** Spells, statuses, abilities, enemies and events are defined declaratively
   so new content needs no engine changes.
5. **Simple and modular**, matching the Spellford spec: small files and easy to extend.

## Non-goals (v1)

- Multiplayer, accounts or a backend. Spellcross is a static, client-only app.
- A game engine like Phaser or Unity. React plus SVG/CSS covers an 8×8 board and a 2D map.
- Pixel-identical visuals. We match the layout and feel, not libGDX rendering details.

## Tech stack

| Concern | Choice | Why |
|---|---|---|
| Language | **TypeScript** (strict) | Closest to Kotlin's type safety, and lets us port data classes and enums directly |
| UI | **React 18** | As requested |
| Build/dev | **Vite** | Fast, zero-config, static output |
| App state | **Zustand** | Small store that works outside React (the engine loop can read and write it) |
| Immutable updates | **Immer** (via Zustand middleware) | Lets engine reducers read like the Kotlin mutations but stay immutable |
| Rendering: board, portraits, popups | **DOM + CSS Grid** | 64 tiles is trivial for the DOM, and gives free accessibility and hit-testing |
| Rendering: world map, menu scene | **SVG** | Bézier roads, rivers and terrain map directly onto `<path>` |
| Animation | **Framer Motion** | Layout animations for tile drops, plus presence for popups and floating numbers |
| Routing | **React Router** (memory or hash router) | Screen = route. Hash router keeps static hosting trivial |
| Seeded RNG | Small PRNG (e.g. `mulberry32` / `seedrandom`) | Replaces `kotlin.random.Random(seed)` and `Math.random` |
| Persistence | `localStorage` (save slots, settings) | See doc 04 |
| Testing | **Vitest** (engine), **React Testing Library** (components), **Playwright** (e2e) | |
| Lint/format | ESLint + Prettier, plus an import-boundary rule | Enforces "engine never imports UI" |
| PWA | `vite-plugin-pwa` | Offline play and home-screen install on mobile |

**Escape hatch:** if board effects outgrow the DOM (particles, shaders), swap the board view for
**PixiJS via `@pixi/react`** without touching the engine. The engine/view boundary below exists to keep
that option open.

## Layered architecture

```
┌─────────────────────────────────────────────────────────────┐
│  UI layer (React)            src/ui/                        │
│  screens, components, animation, input → dispatch actions   │
├─────────────────────────────────────────────────────────────┤
│  App/state layer             src/state/                     │
│  Zustand stores: session (run), battle, settings, save      │
│  orchestrates engine calls, queues engine events for UI     │
├─────────────────────────────────────────────────────────────┤
│  Engine layer (pure TS)      src/engine/                    │
│  board, battle, spells, statuses, abilities, ai, world,     │
│  events, progression, rng — NO React/DOM imports            │
├─────────────────────────────────────────────────────────────┤
│  Content layer (data)        src/content/                   │
│  spells, statuses, abilities, enemies, events, map tables   │
└─────────────────────────────────────────────────────────────┘
```

**Dependency rule:** arrows only point down. The engine depends only on content *types*, and the
content registry is injected. This is enforced with `eslint-plugin-boundaries` (or
`import/no-restricted-paths`).

### Key architectural change from Spellford: engine emits events, UI animates them

In Spellford, `BattleScreen` drives the cascade with a 1-second frame timer, calling
`board.progressMove()` once per tick, and rendering reads mutable board state mid-cascade.

In Spellcross, `engine.playMove(state, move)` **resolves the whole move at once** and returns:

```ts
{ state: BattleState, events: BattleEvent[] }
// events: Swapped, SetMatched, LinkedPulled, SpellTriggered{damage,healing,statuses},
//         TilesCleared, TilesDropped, TilesSpawned, StatusTicked, EntityDefeated, ...
```

The UI keeps a **playback queue** and animates those events in order at whatever speed it likes. The
logical state is final the instant the move resolves. This gives us:

- deterministic tests (assert on the `events` list),
- skippable or fast-forward animations,
- replay and debug tooling for free,
- no "input during cascade" race conditions. Input is locked while the queue is non-empty.

See [02-game-engine.md](02-game-engine.md).

## Repository layout

```
spellcross/
  docs/                       ← these documents
  public/
    assets/                   ← copied 1:1 from spellford/app/src/main/assets
  src/
    main.tsx, App.tsx
    content/                  ← data definitions (doc 04)
      spells.ts statuses.ts abilities.ts enemies.ts events/ map.ts
    engine/
      rng.ts
      types.ts                ← Entity, Spell, Tile, StatusInstance, ...
      board/                  ← grid, matching, cascade, linked tiles, locking
      battle/                 ← turn machine, energy, win/loss, spell resolution
      status/                 ← hook pipeline + status behaviours
      ability/
      ai/                     ← behaviour tree + actions/conditions
      world/                  ← map generation, travel, encounters
      events/                 ← story event runner
      progression/
    state/
      sessionStore.ts         ← the current run: player, map, position, seed
      battleStore.ts          ← BattleState + animation queue
      settingsStore.ts
      persistence.ts
    ui/
      screens/  MenuScreen WorldScreen EventScreen BattlePrepScreen BattleScreen ResultScreen
      components/ TopBar AbilityBar Popup StatusIcon HealthBar EnergyOrb Legend ...
      board/    BoardView TileView effects/
      world/    MapView RoadPath StopNode Terrain River PlayerToken
      menu/     MenuScene ...
      theme/    tokens.css fonts.css
  tests/
    engine/   (ports of BoardSetTest, BoardFullTest + new)
    e2e/
```

## Runtime flow

```
MenuScreen ──Pathway──▶ WorldScreen ──arrive/encounter──▶ EventScreen ─┐
    │                     ▲    │                                       │
    │ Tree (debug)        │    └──battle──▶ BattlePrep ──▶ Battle ──▶ Result
    │ Hut (debug)         └──────────────────────────────────────────────┘
    └ Chasm → "Return to title" / no-op on web
```

A **run** (one journey from Start to Finish) lives in `sessionStore`: seed, generated map, current stop,
player entity, inventory. Screens are views over that store.

## Cross-cutting concerns

- **Determinism:** every random choice goes through an RNG stream derived from the run seed
  (`map`, `events`, `board`, `ai`). A run can be reproduced from its seed plus its list of inputs.
- **Responsive layout:** CSS container queries and `aspect-ratio` replace the hand-computed
  `calculateLayout`. Board is `min(95vh, 95vw)` square. Portraits sit beside it in landscape and below it in portrait.
- **Accessibility:** tiles are buttons with `aria-label="Fireball, row 3 col 5"`, and keyboard arrows + Enter
  can swap. Popups are dialogs that trap focus. Animations respect `prefers-reduced-motion`. These go beyond
  parity but cost little with DOM rendering.
- **Debug tooling:** a dev-only panel (or `?debug=1`) to set the seed, print the board, jump to any event,
  and start a battle against any enemy. This replaces Spellford's menu shortcuts and `printBoard` logs.
- **Error handling:** missing assets fall back to a placeholder (Spellford's behaviour). Engine invariants
  throw in dev and are logged in prod.

## Risks

| Risk | Mitigation |
|---|---|
| Behaviour drift during the port | Port Spellford's tests first, then write golden tests from Spellford runs with a fixed seed |
| Status hooks mutating shared spell objects (Spellford pattern) | Replace with a per-cast `CastContext` (doc 02) |
| Mobile perf of Framer Motion with 64 animated tiles | Animate `transform` only. Fall back to CSS transitions or Pixi if needed |
| Ambiguous intended behaviour | "Resolved decisions" table (D1–D12) in features.md. Each fix has a test tagged with its id |
