# Spellcross

Spellcross is the web successor to **Spellford**, the Kotlin/libGDX Android RPG at `../spellford`.
It is a React web app with the same game: a young boy discovering magic travels a procedurally
generated world map, meets story events, and fights groups of 1–4 enemies by casting spells from a
match-3 board. Enemies telegraph their next move (see [docs/combat.md](docs/combat.md)).

**Target platform: phone browsers in landscape** (iOS Safari and Android Chrome, also installable as a
PWA). Every layout, touch-target and performance decision is made for a phone held sideways. Desktop
browsers work but are not a design target, and portrait shows a "rotate your device" prompt (D13).

## Running it

You need **Node.js 20+** and **pnpm 9+** (`npm install -g pnpm`).

```bash
pnpm install          # once
pnpm dev              # dev server on http://localhost:5173 (and your LAN, for testing on a phone)
```

**Play on your phone:** `pnpm dev` prints a `Network:` URL (e.g. `http://192.168.1.20:5173`). Open it in Safari
or Chrome on a phone on the same Wi-Fi and turn the phone sideways. To install it as an app, build and serve
it over HTTPS (service workers need HTTPS on anything but localhost), then use *Add to Home Screen*.

| Command | What it does |
|---|---|
| `pnpm dev` | Dev server with hot reload, exposed on your LAN |
| `pnpm build` | Typecheck, then a production build into `dist/` (a static site with an offline service worker) |
| `pnpm preview` | Serve the `dist/` build locally (also on your LAN) |
| `pnpm test` | All unit, integration and UI tests (Vitest) |
| `pnpm test:watch` | Tests in watch mode |
| `pnpm sim` | Headless combat sim: a bot plays every encounter and prints win rates (`SIM_SEEDS=100 pnpm sim` for more seeds) |
| `pnpm lint` / `pnpm typecheck` | ESLint (with the engine/UI boundary rule) and TypeScript |
| `pnpm assets:manifest` | Regenerate `src/content/assets.manifest.json` after adding files to `public/assets/` |

**Deploying:** `dist/` is a plain static site. Serve it from the web root of any static host (it uses
absolute `/assets/...` paths).

**Debug panel:** in `pnpm dev`, or with `?debug=1` on any build, a small **dbg** button (bottom left) shows the
run seed and jumps straight to any battle or event, plus a button for free gold, gems and upgrades.

**Saves** live in the browser's `localStorage` (one slot). *Abandon run* on the title screen clears it.

### Notes for Termux / Android development machines

Vite 8's bundler and some build tools ship native binaries that Android's linker refuses to load from a
project folder. The project already works around this: it uses the WebAssembly builds of rolldown
(`@rolldown/binding-wasm32-wasi`) and Rollup (a pnpm override to `@rollup/wasm-node`), and skips CSS
minification when lightningcss can't load. You'll see "WASI is experimental" warnings; they're harmless. Set
`NODE_NO_WARNINGS=1` to hide them.

## Code layout

```
src/
  engine/    framework-free game rules: board, battle, statuses, spells & gems, world map, the run
  content/   game data: spells, statuses, abilities, gems, enemies & intents, encounters, events, config
  state/     Zustand store (actions the UI calls) and localStorage persistence
  ui/        React screens: menu, world map, events, battle prep, battle, spellbook, results
tests/       Vitest suites (engine, run, content validation, UI smoke tests, sim)
public/assets/   art and fonts, copied from Spellford
```

## Documents

| Doc | What it covers |
|---|---|
| [docs/spec.md](docs/spec.md) | **Start here.** The consolidated game spec: final rules for every system, with all decisions folded in |
| [docs/features.md](docs/features.md) | Every feature in Spellford, with its status and source file, plus the decision log (D1–D17) |
| [docs/combat.md](docs/combat.md) | The core combat loop: 3 moves per turn, targeting, enemy intent cycles, 1–4 enemies, battle layout. Replaces Spellford's battle model (D14) |
| [docs/enemies.md](docs/enemies.md) | Generic and named intents, the enemy roster (Wolf, Bear, Spider, Harbinger) with their intent cycles, encounters, and the enemy/intent data-file format |
| [docs/spells-and-gems.md](docs/spells-and-gems.md) | Player spells, the stat-based spell icon rule, and spell customisation: gem sockets, Spell Upgrades, the Spellbook screen (D16) |
| [docs/open-questions.md](docs/open-questions.md) | Every design decision still to make, with recommendations and the milestone each one blocks |
| [docs/architecture/01-overview.md](docs/architecture/01-overview.md) | Goals, tech stack, layering, repo layout, key decisions |
| [docs/architecture/02-game-engine.md](docs/architecture/02-game-engine.md) | The framework-free TypeScript game core: board, spells, statuses, abilities, enemy intents, battle flow, world generation |
| [docs/architecture/03-frontend.md](docs/architecture/03-frontend.md) | React app: screens, routing, state, rendering, animation, input, responsive layout |
| [docs/architecture/04-content-data-and-persistence.md](docs/architecture/04-content-data-and-persistence.md) | Content as data (spells, statuses, events), assets, save games, RNG seeding |
| [docs/architecture/05-migration-plan.md](docs/architecture/05-migration-plan.md) | Milestones for porting Spellford to Spellcross, with test strategy |

## Source of truth

The Spellford codebase as of commit `3f7b1a0` ("Fixing cloning abilities") on branch `startup`, re-baselined from
`9b0a7bb`. `docs/features.md` ends with a summary of what changed between the two.
Where Spellford's behaviour looks accidental (bugs, TODOs), the docs don't quietly copy or fix it.
Each case, and each deliberate redesign, is recorded as a **resolved decision** (D1–D17 in `docs/features.md`) stating whether
Spellcross replicates or fixes it.
