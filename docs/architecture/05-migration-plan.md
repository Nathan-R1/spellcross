# 05: Migration Plan

The plan ports Spellford to Spellcross in vertical slices. Each milestone ends with something playable in
the browser and a parity check against [features.md](../features.md).

## M0: Scaffold (½ day)

- Vite + React + TS strict, ESLint (with engine/UI boundary rule), Prettier, Vitest, Playwright.
- Playwright projects use landscape phone emulation (`devices['iPhone 13 landscape']`,
  `devices['Pixel 7 landscape']`) plus one 667×320 viewport for the minimum size. Desktop Chromium is a smoke test only.
- App shell: viewport meta with `viewport-fit=cover`, `dvh` sizing, safe-area padding, portrait rotate overlay.
- Copy assets. Build the asset manifest script. Load fonts.
- `engine/rng.ts` with tests.
- CI: typecheck, lint, unit tests, build.

## M1: Board engine (parity §5.2)

- Types, content for spells, `createBoard`, `findSet`, `canSwap`, `collapse`, `validMoves`, lock states,
  linked tiles (Surge).
- Port `BoardSetTest` and `BoardFullTest` with an ASCII-grid test helper.
- `resolveMove` producing `events[]`.
- **Exit:** all ported tests green, plus golden cascade snapshots.

## M2: Battle engine (§5.3–5.9)

- `castSpell` + `CastContext`, all status behaviours, turn machine (energy, hooks, end turn, win check),
  abilities, behaviour-tree AI, entity content (Player, Wolf, Dark Mage).
- Implement resolved decisions D1–D4, D8, D10 and D12 (features.md).
- **Exit:** a headless test plays Player (random AI) vs Wolf to completion over 500 seeds with no exceptions.

## M3: Battle UI (§5.1, §5.10, §7)

- BattlePrepScreen, BattleScreen, BoardView/TileView, CharacterPanel, EnergyOrb, StatusRow, TopBar,
  AbilityBar, Popup, animation playback queue, lightning and floating numbers, phone landscape layout
  (03-frontend § Phone landscape layout).
- ResultScreen (new, minimal; D9).
- **Exit:** a full battle is playable by touch on a **real iPhone (Safari) and a real Android phone (Chrome) in
  landscape**, including the 667×320 minimum. Tap-tap and drag-to-swap both work, and nothing is clipped by the
  notch or toolbars. Playwright e2e on the landscape phone projects: prep → swap → end turn → AI turn.

## M4: Menu and events (§2, §4)

- MenuScreen SVG scene with all four objects and animations.
- Event engine (graph, effects, branches, parametric nodes) and all six events + battle prep event.
- Implement resolved decisions D5–D7 and D11.
- **Exit:** every event path is reachable via the debug shortcuts, and the event graph validation test passes.

## M5: World map (§3)

- `generateMap` + terrain/river generation port, with invariant tests over 1,000 seeds.
- MapView SVG, drag-to-pan, travel along road paths, legend panel. Pan and tap must not get mixed up on touch.
- **Exit:** the generated map is visually comparable to Spellford for the same seed (side-by-side screenshots).

## M6: Run loop and persistence (§1.8, §3.3.6–8, §6)

- sessionStore + save/load, continue run from the menu.
- Fill Spellford's stubs so the game loop actually closes (these are *beyond strict parity*, but needed
  for a complete product, so confirm scope first):
  - Arrival behaviour by stop type (proposal: Village/Town → random event, Campfire → heal, Market → event,
    Trail travel → higher encounter chance).
  - EncounterManager (15% per travel).
  - Battle rewards (gold) and return to map. Finish → victory screen.
- **Exit:** a full run from Start to Finish, surviving a page refresh.

## M7: Polish and release

- PWA (offline, installable from the home screen on iOS and Android, landscape manifest, Android fullscreen and
  orientation lock), reduced-motion, a11y pass, performance budget check on the reference phones.
- Deploy as a static site (any static host; choose per company hosting policy).
- Parity sign-off: walk through every row of features.md and tick it.

## Later (post-parity, from Spellford stubs and spec)

- ProgressionSystem: XP, levels, spell unlocks, max HP growth.
- DialogueSystem.
- Item effects (Gemstone, Weapon, Spell Upgrade, Weight Gem, Recharge).
- More enemies (Bear, Boar, Harbinger: portraits already exist).
- Linked-tile behaviours for Ash, Slime, Orb, Charge and Wall (D10). (Charge* and Fortify* effects are *not*
  here: D4 ships them in M2.)
- Sound and music (Spellford spec lists `sounds/` and `music/` folders, which are empty).
- Optional PixiJS board renderer.
- Portrait and tablet layouts, if there's demand (D13).

## Keeping Spellford and Spellcross in sync

Spellford is still under active development (branch `startup`). Until Spellcross reaches M3:

- Track Spellford commits that touch `battle/`, `spells/`, `ai/` and `world/`. Each one becomes a parity
  ticket.
- Record the Spellford commit each Spellcross milestone was checked against in this file.

| Milestone | Spellford commit checked |
|---|---|
| Docs written | `9b0a7bb` |
