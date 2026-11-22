# 03: Frontend (React)

## Screens

There's no router. `App.tsx` shows the screen named by `run.screen` (`map`, `event`, `prep`, `battle`,
`result`, `victory`, `defeat`), or the menu when there's no run. The Spellbook is an overlay. This means deep
links can't skip game state and a reloaded save opens on the right screen.

| `run.screen` | Screen | Replaces | Store actions |
|---|---|---|---|
| *(no run)* | `MenuScreen` | `MenuScreen.kt` + `MenuRendering.kt` | `newRun`, `continueRun`, `abandonRun` |
| `map` | `WorldScreen` | `WorldScreen.kt` + `WorldMapRenderer.kt` | `travelTo`, `roadBattle`, `arrive` |
| `event` | `EventScreen` | `EventScreen.kt` (normal) | `chooseOption`, `assignRecharge`, `pickGem` |
| *(overlay)* | `SpellbookScreen` | *(new, D16)* | `socket`, `upgrade`, `unsocket` |
| `prep` | `BattlePrepScreen` | `EventScreen.kt` (BATTLE_PREP mode) | `startBattle(loadout, junk)` |
| `battle` | `BattleScreen` | `BattleScreen.kt` + `BattleBoardRenderer.kt` (redesigned, D14) | `selectTile`, `target`, `ability`, `endTurn` |
| `result` / `victory` / `defeat` | `ResultScreen` / `EndScreen` | *(new)* | `continueResult`, `toTitle` |

`BattlePrepScreen` is its own screen in Spellcross. In Spellford it's a mode of `EventScreen`. In landscape:
spell pool and loadout slots (3) on the left, junk pool and 2 junk slots on the right, FIGHT pinned
bottom-right and disabled until the loadout is full.
It reuses the event layout components (banner, framed pane, wood background).

## State management

One Zustand store (`src/state/store.ts`):

```
run: RunState | null        // the whole run, battle included; saved to localStorage after every action
playback: { queue, view, current }   // battle events still to animate; `view` lags `run.battle` while animating
selection, toasts, spellbookOpen, debug
actions: newRun, continueRun, travelTo, chooseOption, startBattle, selectTile, target, ability, endTurn, …
```

**Rule:** components never call engine functions directly. They dispatch store actions, which call
the engine and push the returned `events` onto `queue`.

### Animation playback loop

```
swap(a,b):
  if queue.length > 0 → ignore             // input locked during playback (Spellford: moveActive)
  {state, events} = engine.playerMove(...)
  set({ state, queue: events })

endTurn() / last move used:
  {state, events} = engine.endPlayerTurn(...)   // the whole enemy phase, already resolved
  queue.push(...events)

<BattleScreen> useEffect on queue[0]:
  animate(event) → on complete → advanceQueue()   // applies event to `view`
  tap during playback → fast-forward the rest of the queue
```

There's no AI timer. Enemy turns are just more events in the queue, paced at ~600ms per enemy (combat §7).

`view` is updated event by event, so health bars, statuses and tiles change *in sync* with the
animations, the same as Spellford, where values change as each step resolves.

## Component tree (battle)

```
<BattleScreen>
  <TopBar exit  <AbilityBar triggerable /> />            gold hidden in battle
  <BattleLayout>                                          board | right column (combat §6)
    <BoardView>                         CSS grid 8 cols × 6 rows, visible rows only
      <TileView × 48 layoutId=tileUid/> icon, spell tint, "+n" pip, linked overlay, lock overlay, selected ring
      <EffectsLayer/>                    lightning bolts (SVG), floating numbers, clear halos
    </BoardView>
    <RightColumn>
      <EnemyZone count={1..4}>
        <EnemySlot × n onTap={setTarget} onLongPress={showEnemy}>
          <IntentBadge/> <Portrait/> <TargetReticle/> <HealthBar color="red"/> <StatusRow/>
        </EnemySlot>
      </EnemyZone>
      <PlayerStrip>
        <Portrait/> <HealthBar color="green"/> <BlockBadge/> <StatusRow onTap={showStatus}/>
        <MovesPips left={movesLeft} max={3}/> <EndTurnButton/>
      </PlayerStrip>
    </RightColumn>
  </BattleLayout>
  <Popup/>                              spell / status / ability / enemy-cycle info (modal)
</BattleScreen>
```

- **Tile identity:** each spawned tile gets a stable `uid`; tiles are absolutely positioned by `uid`, so a CSS
  `transform` transition animates drops naturally. This replaces Spellford's manual `blanksBelowThisSpace × tileSize × timer` offset.
- **Clears:** `AnimatePresence` exit animation with a white halo and fade (Spellford `renderDisappearance`).
- **Lightning:** SVG polyline with random jitter from the player portrait to each target enemy, plus floating
  `-12` / `+3` text that rises 30px and fades (Spellford `Animation.kt`). Positions come from refs on the
  portraits.
- **Enemy actions:** the acting slot lunges and its intent badge pulses. Then the damage number flies to the
  PlayerStrip, heals and buffs glow on their targets, and board intents animate lock overlays or tiles
  morphing. The next intent fades in afterwards.
- **Input:** tap to select, tap an adjacent tile to swap (combat §2.2). There's no drag-to-swap. Long-press
  (~400ms) opens info popups for tiles and enemies, because a plain tap is taken by selection and targeting.
  The board sets `touch-action: none` so nothing on it scrolls or zooms the page.

## World map rendering

- **Fit the height and scroll horizontally, as in Spellford (U1).** Spellford generates the world at
  **2 screens wide × 1 screen tall** in device pixels (features 3.2.5), and its stop radii, road widths and
  jitter are tuned at that scale (e.g. Town radius 125 on a ~1080px-tall phone).
- Spellcross generates the map in a fixed **logical space 1080 units tall** and `2 × 1080 × (viewport
  width / viewport height)` units wide, so the generation constants port unchanged. That's ~4,670 units
  wide at the 844×390 reference. The size is fixed when the run starts and stored in the save, so a resize or
  rotation never regenerates the map.
- Rendered as one `<svg>` whose `viewBox` is that logical space, scaled so its height fills the area below the
  top bar, inside a horizontally scrolling container about 2 viewport widths long.
- Drag-to-pan using pointer events with eased scrolling (Spellford eases the camera at `maxSpeed`),
  clamped to map bounds.
- Layers: `<Terrain/>` → `<Rivers/>` (two stroked paths: border, then 35%-width water) → `<Roads/>`
  (glow stroke + road stroke, quadratic Bézier, S-curve = two quads) → `<Stops/>` (shadow circle + `<image>`
  with rotation, procedural fallback) → `<PlayerToken/>`.
- Travel: compute the point along the road's path with `SVGPathElement.getPointAtLength()` over
  `PLAYER_TRAVEL_DURATION`, which matches the curve exactly with no need to port the Bézier maths.
- Only stops connected to the current stop are tappable. Others get `aria-disabled` and are dimmed.
  Whatever the map scale, each stop gets an invisible hit circle of at least 44px.
- A drag that moves more than ~8px is a pan, not a tap, so panning never travels by accident.
- `<LegendPanel/>` slides in from the right (CSS transition) when toggled from the TopBar. It is
  full height, scrolls on its own, and stays inside the right safe-area inset.

## Main menu scene

SVG scene: sky `linearGradient`, twinkling stars (CSS keyframes on opacity, randomised per star), three
mountain layers, ground and highlight. Four interactive objects, each a `<g role="button">`:
Pathway (perspective path + looping walking figure), Tree, Hut, Chasm. Spellford's hover lift (8px plus a
glow) plays on **press** instead, since phones have no hover. The 150ms delay before navigating lets the
lift be seen (parity). Mouse hover also triggers it on desktop.

Menu objects in prod (D11): **Pathway** = New run · **Hut** = Continue run (only when a save exists) ·
**Chasm** = Abandon run (only when a save exists, with confirmation) · **Tree** = decorative. Spellford's
Tree and Hut shortcuts (random event, quick battle vs Wolf) move to the debug panel (dev build or `?debug=1`).

## Event screen

Layout: wood background (CSS gradient + grain), title banner, framed image pane (left), text pane
(right) with natural CSS text wrapping (replaces the manual `wrapText`), option buttons below the
text. Each option renders `[Label]` in white, the cost in red and the reward in green, with drop shadows (parity).

On a phone in landscape the image pane is about 40% of the width and the text column scrolls on its own.
Option buttons are pinned to the bottom of that column, at least 44px tall, so they are always reachable.
Spellford's option hover state becomes a pressed state. Unavailable options (features 4.1.9) are greyed with
the cost in red. The **recharge popup** (features 4.1.10) is a modal listing abilities with their uses and a
"+1" button each, plus a counter of recharges left.

## Theming

- Design tokens in `theme/tokens.css`: wood browns, bar brown `#66401A`, panel grey, health green and red,
  team colours. Fonts loaded with `@font-face` from the ported `mytitle.ttf` and `mytext.ttf`.
- The layout uses CSS units, not a scaled canvas.

## Phone landscape layout

Target: phone browsers held sideways. Everything else is secondary (D13).

### Viewport budget

| | Size (CSS px) | Example |
|---|---|---|
| Reference design | 844 × 390 | iPhone 13/14, Safari toolbar hidden |
| Minimum supported | 667 × 320 | iPhone SE 2/3 with Safari's landscape toolbar showing |
| Large | 932 × 430 | iPhone Pro Max, large Android phones |

Height is the constraint and width is plentiful. Rules:

- Size with `100dvh` (falling back to `100svh`), never `100vh`. On mobile, `vh` includes the hidden browser
  toolbar, so content gets cut off.
- **Top bar ≤ 40px.** Exit, HP and gold on the left, abilities in the middle, Legend and Spellbook (World screen) on the right. Ability
  slots are 36px icons whose tap areas extend to the full bar height.
- **Battle** (sketch in combat §6): the board is **8 columns × 6 rows** (D15). Tile size is
  `min((100dvh − top bar − 8px) / 6, 48px)`, so **~45px** at the 320px-tall minimum and **48px** from the
  reference size up (board 384×288). Everything to its right is the enemy zone (1–4 equal-width slots)
  above an ~84px player strip. 4 enemies get ~90px each at 844px wide and ~75px at the 667px minimum. Priority when space
  runs out: intent badge > HP bar > portrait > statuses (collapse to "+n"). The right column never pushes
  the board smaller.
- **Popups:** `max-height: calc(100dvh − 16px)` with internal scroll. In landscape, use a two-column
  layout (icon and stats left, text right) so they stay short.

### Safe areas

In landscape the notch or Dynamic Island sits on the **left or right** edge, and the home indicator sits
at the bottom.

- `<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">`.
- Backgrounds (wood, sky, map) go edge to edge. Interactive content is padded by
  `env(safe-area-inset-left/right/bottom)`. On the battle screen the board absorbs the left inset and the right column the right inset. Elsewhere the Legend panel and screen gutters do.

### Orientation

- `@media (orientation: portrait)` shows a full-screen **"Rotate your device"** overlay over the paused
  app. No state is lost and no portrait layout exists (D13).
- On Android Chrome, the first tap on New run / Continue run requests fullscreen and then
  `screen.orientation.lock('landscape')`. This is best effort, and failures are ignored.
- iOS Safari supports neither the orientation lock nor the manifest `orientation` key, so iOS always
  relies on the overlay.
- Desktop or any viewport wider than 932px: the app renders at the large size, centred and letterboxed, so
  there is still a single layout to design and test.

### Touch rules

- Interactive targets are **≥ 44×44px** wherever space allows. Battle tiles meet this too (≥ 45px with
  6 rows, D15). Their whole cell is the target, with no gaps between tiles.
- No hover-only affordances. Anything Spellford shows on hover shows on press (`:active` / pointer down).
- Page-level: `overscroll-behavior: none` (no pull-to-refresh or rubber-banding), `touch-action:
  manipulation` (no double-tap zoom), `user-select: none` and `-webkit-touch-callout: none` on game
  surfaces (no text selection or long-press menus).
- `pointercancel` (for example a notification swipe) aborts any drag in progress without making a move.

## Performance budget

- First load < 300 KB JS gzip (excluding images). Assets lazy-loaded per screen.
- Battle: 60 fps on a mid-range phone during a 3-step cascade (animate `transform` and `opacity` only).
  Reference devices: iPhone SE (2nd gen) and a ~US$200 Android phone from the last three years.
- Assume mobile networks: first screen interactive in < 3s on "Fast 3G" throttling.
- Map SVG: < 2,000 nodes. Terrain is generated once per run and memoised.
