import { useState } from 'react';
import { content } from '../content';
import { RANDOM_EVENTS } from '../content/events';
import { useStore } from '../state/store';
import { Toasts } from './components/common';
import { BattlePrepScreen } from './screens/BattlePrepScreen';
import { BattleScreen } from './screens/BattleScreen';
import { EndScreen, ResultScreen } from './screens/EndScreens';
import { EventScreen } from './screens/EventScreen';
import { MenuScreen } from './screens/MenuScreen';
import { SpellbookScreen } from './screens/SpellbookScreen';
import { WorldScreen } from './screens/WorldScreen';

export function App() {
  const screen = useStore((s) => s.run?.screen ?? null);
  const spellbook = useStore((s) => s.spellbookOpen);
  return (
    <div className="app">
      {screen === null && <MenuScreen />}
      {screen === 'map' && <WorldScreen />}
      {screen === 'event' && <EventScreen />}
      {screen === 'prep' && <BattlePrepScreen />}
      {screen === 'battle' && <BattleScreen />}
      {screen === 'result' && <ResultScreen />}
      {(screen === 'victory' || screen === 'defeat') && <EndScreen />}
      {spellbook && screen !== null && <SpellbookScreen />}
      <Toasts />
      <DebugPanel />
      <div className="rotate">
        <div className="phone" />
        <h2 className="title">Rotate your device</h2>
        <div className="dim">Spellcross is played in landscape.</div>
      </div>
    </div>
  );
}

/** Dev-only (or ?debug=1): start any encounter or event; shows the run seed (doc 01). */
function DebugPanel() {
  const debug = useStore((s) => s.debug);
  const run = useStore((s) => s.run);
  const { debugBattle, debugEvent, newRun } = useStore.getState();
  const [open, setOpen] = useState(false);
  if (!debug) return null;
  return (
    <div className="debug">
      {!open ? (
        <button className="btn" onClick={() => setOpen(true)}>dbg</button>
      ) : (
        <div className="panel">
          <div>seed: {run?.seed ?? '-'}</div>
          {!run && <button className="btn" onClick={() => newRun(12345)}>New run (seed 12345)</button>}
          {run && run.screen === 'map' && (
            <>
              <b>Battle</b>
              {Object.keys(content.encounters).map((id) => <button key={id} className="btn" onClick={() => { debugBattle(id); setOpen(false); }}>{id}</button>)}
              <b>Event</b>
              {[...RANDOM_EVENTS, 'village', 'town', 'market', 'campfire'].map((id) => <button key={id} className="btn" onClick={() => { debugEvent(id); setOpen(false); }}>{id}</button>)}
              <button className="btn" onClick={() => useStore.getState().apply((r) => ({ ...r, player: { ...r.player, gold: r.player.gold + 500, spellUpgrades: r.player.spellUpgrades + 3, gems: [...r.player.gems, 'strikecut', 'walled', 'cracked', 'sunstone', 'darkstone'] } }))}>+500g +3⬆ +gems</button>
            </>
          )}
          <button className="btn" onClick={() => setOpen(false)}>close</button>
        </div>
      )}
    </div>
  );
}
