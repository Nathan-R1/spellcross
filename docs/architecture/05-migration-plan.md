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
  linked tiles (Surge, only when available). Board size **8×6 visible + 6 buffer** from one constant (D15).
- Port `BoardSetTest` and `BoardFullTest` with an ASCII-grid test helper.
- `playerMove` producing `events[]`.
- **Exit:** all ported tests green, plus golden cascade snapshots.

## M2: Battle engine ([combat.md](../combat.md), features §5.4–5.7)

- `castSpell` + `CastContext` with spell targets, all status behaviours (including D14's Strength and Weak),
  turn machine (3 moves, auto-end, enemy phase, win and loss checks), abilities, and the intents module.
- Content: player, named intents, the starting roster (Wolf, Bear, Spider, Boss) and starter encounters
  ([enemies.md](../enemies.md)). The Spider portrait and intent icons are an art dependency for M3.
  Retuned tile-pool weights.
- Player model uses `SpellInstance` from the start (spells-and-gems §5): plain instances with no gems or
  upgrades yet, plus `resolveSpell` as a pass-through. This avoids a save migration in M6b.
- Implement resolved decisions D1, D3, D4, D8, D10, D12, D14 and D15 (features.md).
- **Exit:** the greedy-bot sim plays every starter encounter to completion over 500 seeds with no exceptions.
  Record the balance baseline: win rate, average turns, average HP lost, average matches per move, and
  turns with no matching move. Also record damage per turn by round, to catch runaway scaling from permanent
  Strength and Charge (open-questions C1).

## M3: Battle UI (§5.1, §5.10, §7)

- BattlePrepScreen, BattleScreen, BoardView/TileView, EnemyZone/EnemySlot/IntentBadge, PlayerStrip with
  MovesPips and End Turn, targeting, long-press popups (including the enemy-cycle popup), TopBar, AbilityBar,
  animation playback queue for player moves and the enemy phase, phone landscape layout (combat §6,
  03-frontend § Phone landscape layout).
- ResultScreen (new, minimal; D9).
- **Exit:** a full battle is playable by touch on a **real iPhone (Safari) and a real Android phone (Chrome) in
  landscape**, including the 667×320 minimum. A 4-enemy encounter fits with all intents readable, and nothing is
  clipped by the notch or toolbars. Playwright e2e on the landscape phone projects: prep → retarget → 3 swaps →
  auto end turn → enemy phase → intents advance.

## M4: Menu and events (§2, §4)

- MenuScreen SVG scene with all four objects and animations.
- Event engine (graph, effects, branches, parametric nodes, option availability, `stay` options, recharge
  popup) and all random events: Gambler, Salesman, Warlock, Shrine, Chest, Tavern, Fight for Loot, Alchemist.
  Plus the battle prep event with junk selection.
- Implement resolved decisions D5–D7 and D11.
- **Exit:** every event path is reachable via the debug shortcuts, and the event graph validation test passes.

## M5: World map (§3)

- `generateMap` + terrain/river generation port, with invariant tests over 1,000 seeds.
- MapView SVG, drag-to-pan, travel along road paths, legend panel. Pan and tap must not get mixed up on touch.
- **Exit:** the generated map is visually comparable to Spellford for the same seed and world size (side-by-side screenshots).

## M6: Run loop and persistence (§1.8, §3.3.6–8, §6)

- sessionStore + save/load, continue run from the menu.
- **Parity (Spellford `3f7b1a0`):** set events on arrival (Traveller at Start, Campfire, Village, Town, Market,
  Encounter → random event), road battles on every Road and Trail trip (3 or 4 loadout slots), return to the
  map after battles.
- **Beyond parity** (D17, decided): Road battles draw normal encounters and Trail battles elite ones.
  Arriving at Finish starts the Harbinger boss fight, and winning it shows a victory screen and ends the run.
  Battle gold is per-enemy reward rolls (D9). Prices are Spellford's.
- **Exit:** a full run from Start to Finish, surviving a page refresh.

## M6b: Spells and gems (D16, [spells-and-gems.md](../spells-and-gems.md))

- Sockets, the 10 gems (values by spell level), Chaos rolls, Sunstone's second element, Darkstone's extra move,
  and Spell Upgrades (level 1–5) on top of M2's `SpellInstance`, with the full `resolveSpell`. No save migration needed.
- Socket rules, Spell Upgrades and Unsocket in the engine, with tests for gem stacking and values by level.
- `iconForSpell` from final stats, pinned by tests. Use the generated icon in popups too.
- Spellbook screen with before → after previews. Town Unsocket option. Final stats shown in battle prep.
- Gem sources: combat drops on the ResultScreen, and the shop's pick-1-of-3.
- Tile "+n" pip for spells with more than two effect categories.
- **Exit:** a run where gold → gems and upgrades → visibly stronger spells. Re-run the M2 sim with
  gemmed and upgraded loadouts to check the power curve against the boss.

## M7: Polish and release

- PWA (offline, installable from the home screen on iOS and Android, landscape manifest, Android fullscreen and
  orientation lock), reduced-motion, a11y pass, performance budget check on the reference phones.
- Deploy as a static site (any static host; choose per company hosting policy).
- Sign-off: tick every features.md row that D13–D16 don't supersede, and every rule in combat.md, enemies.md
  and spells-and-gems.md.

## Later (post-parity, from Spellford stubs and spec)

- ProgressionSystem: XP, levels, spell unlocks, max HP growth.
- DialogueSystem.
- Other item effects. (Gemstone, Weight Gem and Spell Upgrade are covered in M6b. Weapon and Recharge became
  real effects in Spellford.)
- More enemies and bosses beyond the starting roster. Hidden ("?") boss intents (combat §8).
- Linked-tile behaviours for Ash, Slime, Orb, Charge and Wall (D10). (Charge* and Fortify* effects are *not*
  here: D4 ships them in M2.)
- Sound and music (Spellford spec lists `sounds/` and `music/` folders, which are empty).
- Optional PixiJS board renderer.
- Portrait and tablet layouts, if there's demand (D13).

## Keeping Spellford and Spellcross in sync

Spellford is still under active development (branch `startup`). Until Spellcross reaches M3:

- Track Spellford commits that touch `battle/` (board mechanics only, D14), `spells/` and `world/`. Each one becomes a parity
  ticket.
- Record the Spellford commit each Spellcross milestone was checked against in this file.

| Milestone | Spellford commit checked |
|---|---|
| Docs written | `9b0a7bb` |
| Docs re-baselined | `3f7b1a0` |
