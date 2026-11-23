# Combat Tuning: Set Density, Cascades and Damage

Goals for how easy it is to make sets, how much luck adds, and how much a fight should hurt. Use them with the
balance sims when tuning the tile pool, enemies or tools. The rules themselves are in [combat.md](combat.md).

All numbers come from the **sim bot**, not from players. The bot is greedy and doesn't look ahead: it picks the swap
whose sets are best right now and aims damage at the lowest enemy tiles. A careful player should do better than it.

## 1. Damage targets

| Fight tier | Bot's average damage taken | A player who plays well |
|---|---|---|
| Standard | **5–10** | close to 0 |
| Elite | **10–20** | about 5 |

The bot should win almost every standard fight. A loss should come from a bad loadout or a bad run of draws,
not from the fight on its own.

## 2. Set-density goals

| Metric | Goal | Why |
|---|---|---|
| Turn 1: swaps that make a set | **5–8** | Enough that you're never stuck, few enough that choosing between them matters. Above ~10 you never have to look. |
| Any turn: swaps that make a set | **4–7** | A bit tighter than turn 1, so one of your 3 moves sometimes has to set up the next turn. |
| Tools you can fire on a turn (of 3) | **usually 1–2** | If all 3 are always available, you never trade Block against damage. The choice is where skill shows. |
| Sets made by the swap itself | **1.0–1.2** | Two sets from one swap should be a rare jackpot. |
| Auto sets per set-making swap | **0.25–0.4** | Cascades should be a bonus, not half your power. |
| ↳ auto **tool** sets per swap | **≤ 0.2** | Free tool sets break balance the most. Free junk sets matter much less. |
| % of swaps that cascade | **15–25%** | It should feel like a bonus that comes now and then. |
| Sets per turn (all) | **3–4** | About 2.5 from your moves plus about 1 bonus. |
| Enemy tiles killed per turn | **about 4–6** (1-HP enemies) | A 24–32-tile fight then lasts about 5–7 turns, long enough for its threat to land. |

**Why cascades matter most:** when about half your output is luck, the damage you take swings a lot from fight
to fight, and tuning enemies can't land it reliably in the target band. Fewer cascades make fights harder,
more predictable and more about the player's choices.

## 3. Levers

| Lever | Swaps available | Cascades | Where |
|---|---|---|---|
| More tile types in the pool (e.g. more junk) | ↓ somewhat | ↓↓ | `config.junk`, `config.pool` |
| **Refill damping** (§4) | barely changes | ↓ (removes luck cascades only) | `config.refillNoMatchChance` |
| More enemy cells on the board | ↓↓ | ↓ | the enemy's generator |
| Moves per turn | — | — | `config.player.movesPerTurn` (changes sets per turn) |

Enemy speed, HP and numbers change how much a fight hurts, not how dense the sets are. Tune them last, once set
density is on target.

## 4. Refill damping

New tiles that drop in from above the board are redrawn, with chance `refillNoMatchChance`, when they would
complete a set ([combat § 3.4](combat.md#34-cascades)). Tiles already on the board are never changed, so a
cascade you set up on purpose (clear one set so the tiles above it fall into another) still goes off. Only the
sets you couldn't see coming are removed.

**Current value: 1**, so refills never complete a set. Lower it (e.g. 0.7) to let some lucky cascades back in.

Even at 1, about a third of swaps still cascade, because tiles already on the board fall into sets. To get down
to the 15–25% goal, the next lever is a **third junk type**.

## 5. Measurements

Run `pnpm exec vitest run tests/sim/sets --silent=false` (options: `SEEDS`, `ENEMY`, `JUNK=2,3,4`,
`REFILL=0,0.7,1`) for the set-density table, and `pnpm sim` for win rate and damage by loadout.

**2026-11-24**: all 10 three-tool loadouts × 6 seeds. Each column gives the number of junk types / the refill damping chance.

| Metric | HC 2 / 0 | HC 2 / 1 | HC 3 / 1 | FS 2 / 0 | FS 2 / 1 | FS 3 / 1 | AQ 2 / 0 | AQ 2 / 1 | AQ 3 / 1 |
|---|---|---|---|---|---|---|---|---|---|
| Turn 1: set-making swaps | 6.2 | 6.2 | 6.0 | 16.7 | 16.7 | 15.0 | 17.8 | 17.8 | 16.7 |
| Any turn: set-making swaps | 9.1 | 10.7 | 8.0 | 13.5 | 13.7 | 9.9 | 4.9 | 4.6 | 3.7 |
| Tools you can fire (of 3) | 2.1 | 2.2 | 1.9 | 1.9 | 2.0 | 1.5 | 0.8 | 0.8 | 0.7 |
| Sets made by the swap | 1.32 | 1.27 | 1.15 | 1.21 | 1.21 | 1.14 | 1.19 | 1.20 | 1.16 |
| Auto sets per set-making swap | 1.30 | 0.54 | 0.40 | 1.09 | 0.57 | 0.38 | 0.74 | 0.41 | 0.29 |
| ↳ auto tool sets | 0.71 | 0.17 | 0.11 | 0.54 | 0.19 | 0.10 | 0.36 | 0.14 | 0.08 |
| % swaps that cascade | 52 | 36 | 29 | 50 | 33 | 26 | 35 | 27 | 20 |
| Sets per turn (all) | 7.1 | 5.0 | 4.0 | 7.4 | 5.3 | 3.7 | 2.2 | 1.8 | 1.3 |
| Enemy tiles killed per turn | 10.0 | 7.1 | 6.2 | 6.6 | 4.8 | 3.6 | 2.6 | 2.1 | 1.5 |
| Win % | 100 | 100 | 98 | 100 | 98 | 85 | 20 | 8 | 3 |
| Avg damage taken | 0.5 | 1.2 | 2.6 | 1.1 | 3.0 | 6.3 | 16.0 | 18.3 | 19.3 |

HC = Hard Choices (Worries at speed 2), FS = Financial Stress, AQ = All Quiet (elite).

**Where this leaves things:**
- **Hard Choices** is still far too easy: 1.2 damage against a 5–10 target. Its 24 Worries die faster than they
  arrive. It needs more threat, not just denser sets.
- **Financial Stress** lands in the target band with 3 junk types (6.3 damage, 85% wins).
- **All Quiet** is too hard and too swingy. Depression covers the board in about 3 turns and locks it: only
  ~0.8 of your tools can fire on an average turn. Its spread rule is under review
  ([enemies.md § 4](enemies.md#all-quiet-elite)).
- With refill damping at 1, the cascade goals are close but not met with 2 junk types. 3 junk types meets them.
