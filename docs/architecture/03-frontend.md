# 03: Frontend (React)

## Screens and routes

| Route | Screen | Replaces | Reads | Dispatches |
|---|---|---|---|---|
| `/` | `MenuScreen` | `MenuScreen.kt` + `MenuRendering.kt` | settings, save slots | `newRun`, `continueRun`, debug shortcuts |
| `/world` | `WorldScreen` | `WorldScreen.kt` + `WorldMapRenderer.kt` | session.map, position | `travelTo(stopId)` |
| `/event/:nodeId` | `EventScreen` | `EventScreen.kt` (normal) | session.event | `chooseOption(i)` |
| `/battle/prep` | `BattlePrepScreen` | `EventScreen.kt` (BATTLE_PREP mode) | player.spellPool, loadout | `setLoadoutSlot`, `startBattle` |
| `/battle` | `BattleScreen` | `BattleScreen.kt` + `BattleBoardRenderer.kt` | battleStore | `swap`, `endTurn`, `useAbility` |
| `/battle/result` | `ResultScreen` | *(new: Spellford has a TODO)* | battle.outcome | `continue` |

Use a hash or memory router so deep links can't skip game state. Each screen guards on store state and
redirects to `/` if there's no active run.

`BattlePrepScreen` is its own screen in Spellcross. In Spellford it's a mode of `EventScreen`.
It reuses the event layout components (banner, framed pane, wood background).

## State management

```
sessionStore (Zustand + persist)
  seed, rngState, map, currentStopId, travel: {from,to,progress}|null,
  player: Entity, currentEvent: {nodeId, params}|null, flags
  actions: newRun(seed?), travelTo, arrive, chooseOption, startBattle, finishBattle

battleStore (Zustand, not persisted mid-battle in v1)
  state: BattleState                       // authoritative, already resolved
  queue: BattleEvent[]                     // pending animations
  view: ViewBoard                          // what the UI currently shows (lags state while animating)
  selection: TilePos | null
  actions: selectTile, swap, endTurn, useAbility, advanceQueue

settingsStore (persist): animationSpeed, reducedMotion, sound(future), debug
```

**Rule:** components never call engine functions directly. They dispatch store actions, which call
the engine and push the returned `events` onto `queue`.

### Animation playback loop

```
swap(a,b):
  if queue.length > 0 → ignore             // input locked during playback (Spellford: moveActive)
  {state, events} = engine.resolveMove(...)
  set({ state, queue: events })

<BattleScreen> useEffect on queue[0]:
  animate(event) → on complete → advanceQueue()   // applies event to `view`
  when queue empty and active entity is AI → setTimeout(aiDelay) → dispatch aiTurn()
```

`view` is updated event by event, so health bars, statuses and tiles change *in sync* with the
animations, the same as Spellford, where values change as each step resolves.

## Component tree (battle)

```
<BattleScreen>
  <TopBar exit  stats(hp,gold)  <AbilityBar triggerable /> />
  <BattleLayout>                         landscape only: panel | board | panel
    <CharacterPanel entity=player side="left">
      <EnergyOrb onClick={endTurn if active} label="2 / 2" | "END TURN" />
      <Portrait/> <HealthBar color="green"/> <Name/> <StatusRow onTap={showStatus}/>
    </CharacterPanel>
    <BoardView>                         CSS grid 8×8, visible rows only
      <TileView × 64 layoutId=tileUid/> icon, team tint, linked overlay, lock overlay, selected ring
      <EffectsLayer/>                    lightning bolts (SVG), floating numbers, clear halos
    </BoardView>
    <CharacterPanel entity=enemy side="right" />
  </BattleLayout>
  <Popup/>                              spell / status / ability info (modal)
</BattleScreen>
```

- **Tile identity:** each spawned tile gets a stable `uid` so Framer Motion `layoutId` animates drops
  naturally. This replaces Spellford's manual `blanksBelowThisSpace × tileSize × timer` offset.
- **Clears:** `AnimatePresence` exit animation with a white halo and fade (Spellford `renderDisappearance`).
- **Lightning:** SVG polyline with random jitter from the actor's portrait to the target's, plus floating
  `-12` / `+3` text that rises 30px and fades (Spellford `Animation.kt`). Positions come from refs on the
  portraits.
- **Input:** tap-tap selection (parity), plus **drag-to-swap** using pointer events (new, and more forgiving
  than tapping on small tiles). The board sets `touch-action: none` so a drag never scrolls or zooms the page.

## World map rendering

- Single `<svg viewBox="0 0 1600 1200">` inside a scrollable container.
- **Open decision: map scale on a landscape phone.** The 4:3 world doesn't match a ~2.2:1 viewport:
  - *Fit height* (≈0.29× at 350px tall): the whole map fits with spare width, so there's no panning, but a
    Village is ~35px across and a Trail is ~2px wide.
  - *Fit width* (≈0.53× at 844px wide): stops and roads are readable, and the map pans **vertically**
    (~2× the viewport height). This departs from Spellford's horizontal pan (features 3.2.5).
  - *Regenerate a wider world* (e.g. 2400×1100) for the new aspect ratio. This changes generation
    constants, so it isn't a pure port.

  Recommendation: fit width with vertical pan, since it's the only option where the map is readable
  without changing generation. Decide before M5.
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
- `<LegendPanel/>` slides in from the right (Framer Motion spring) when toggled from the TopBar. It is
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
Spellford's option hover state becomes a pressed state.

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
- **Top bar ≤ 40px.** Exit, HP and gold on the left, abilities in the middle, Legend on the right. Ability
  slots are 36px icons whose tap areas extend to the full bar height.
- **Battle:** the board is a square of side `100dvh − top bar − 8px`, so ~272–382px and tiles of
  **~34–48px**. The two character panels share the remaining width, ~150–250px each. Panels stack
  their contents vertically and let the status row wrap or scroll. They never push the board smaller.
- **Popups:** `max-height: calc(100dvh − 16px)` with internal scroll. In landscape, use a two-column
  layout (icon and stats left, text right) so they stay short.

### Safe areas

In landscape the notch or Dynamic Island sits on the **left or right** edge, and the home indicator sits
at the bottom.

- `<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">`.
- Backgrounds (wood, sky, map) go edge to edge. Interactive content is padded by
  `env(safe-area-inset-left/right/bottom)`. The character panels and the Legend panel absorb the side insets.

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

- Interactive targets are **≥ 44×44px** wherever space allows. Battle tiles are the one accepted
  exception (see Risks in 01). Their whole cell is the target, with no gaps between tiles.
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
