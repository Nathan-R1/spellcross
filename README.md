# Spellcross

Spellcross is the web successor to **Spellford**, the Kotlin/libGDX Android RPG at `../spellford`.
It is a React web app with the same game: a young boy discovering magic travels a procedurally
generated world map, meets story events, and fights enemies on a match-3 spell board.

This folder currently holds **design documents only**. No code has been written yet.

## Documents

| Doc | What it covers |
|---|---|
| [docs/features.md](docs/features.md) | Every feature in Spellford today, with its status and source file. This is the **parity checklist**: Spellcross must ship all of it. |
| [docs/architecture/01-overview.md](docs/architecture/01-overview.md) | Goals, tech stack, layering, repo layout, key decisions |
| [docs/architecture/02-game-engine.md](docs/architecture/02-game-engine.md) | The framework-free TypeScript game core: board, spells, statuses, abilities, AI, battle flow, world generation |
| [docs/architecture/03-frontend.md](docs/architecture/03-frontend.md) | React app: screens, routing, state, rendering, animation, input, responsive layout |
| [docs/architecture/04-content-data-and-persistence.md](docs/architecture/04-content-data-and-persistence.md) | Content as data (spells, statuses, events), assets, save games, RNG seeding |
| [docs/architecture/05-migration-plan.md](docs/architecture/05-migration-plan.md) | Milestones for porting Spellford to Spellcross, with test strategy |

## Source of truth

The Spellford codebase as of commit `9b0a7bb` ("Testing new battle event") on branch `startup`.
Where Spellford's behaviour looks accidental (bugs, TODOs), the docs don't quietly copy or fix it.
Each case is recorded as a **resolved decision** (D1–D12 in `docs/features.md`) stating whether
Spellcross replicates or fixes it.
