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
  <BattleLayout orientation={landscape|portrait}>
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
- **Input:** tap-tap selection (parity), plus **drag-to-swap** using pointer events (new; natural on the web).

## World map rendering

- Single `<svg viewBox="0 0 1600 1200">` inside a horizontally scrollable container.
  - Drag-to-pan using pointer events with eased `scrollLeft` (Spellford eases the camera at `maxSpeed`).
  - Clamped to map bounds.
- Layers: `<Terrain/>` → `<Rivers/>` (two stroked paths: border, then 35%-width water) → `<Roads/>`
  (glow stroke + road stroke, quadratic Bézier, S-curve = two quads) → `<Stops/>` (shadow circle + `<image>`
  with rotation, procedural fallback) → `<PlayerToken/>`.
- Travel: compute the point along the road's path with `SVGPathElement.getPointAtLength()` over
  `PLAYER_TRAVEL_DURATION`, which matches the curve exactly with no need to port the Bézier maths.
- Only stops connected to the current stop are clickable. Others get `aria-disabled` and dimmed hover.
- `<LegendPanel/>` slides in from the right (Framer Motion spring) when toggled from the TopBar.

## Main menu scene

SVG scene: sky `linearGradient`, twinkling stars (CSS keyframes on opacity, randomised per star), three
mountain layers, ground and highlight. Four interactive objects, each a `<g role="button">`:
Pathway (perspective path + looping walking figure), Tree, Hut, Chasm. Hover or focus lifts by 8px with
a glow, with a 150ms press delay before navigating (parity).

Menu objects in prod (D11): **Pathway** = New run · **Hut** = Continue run (only when a save exists) ·
**Chasm** = Abandon run (only when a save exists, with confirmation) · **Tree** = decorative. Spellford's
Tree and Hut shortcuts (random event, quick battle vs Wolf) move to the debug panel (dev build or `?debug=1`).

## Event screen

Layout: wood background (CSS gradient + grain), title banner, framed image pane (left), text pane
(right) with natural CSS text wrapping (replaces the manual `wrapText`), option buttons below the
text. Each option renders `[Label]` in white, the cost in red and the reward in green, with drop shadows (parity).

## Theming and layout

- Design tokens in `theme/tokens.css`: wood browns, bar brown `#66401A`, panel grey, health green and red,
  team colours. Fonts loaded with `@font-face` from the ported `mytitle.ttf` and `mytext.ttf`.
- Base design size 1280×720 (Spellford's `ExtendViewport`). The layout uses CSS units, not a scaled canvas.
- Orientation via `@media (orientation: portrait)` or a container query on the battle layout.
- Minimum supported width 360px.

## Performance budget

- First load < 300 KB JS gzip (excluding images). Assets lazy-loaded per screen.
- Battle: 60 fps on a mid-range phone during a 3-step cascade (animate `transform` and `opacity` only).
- Map SVG: < 2,000 nodes. Terrain is generated once per run and memoised.
