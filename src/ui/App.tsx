import { useState } from 'react';
import { content } from '../content';
import { RANDOM_EVENTS } from '../content/events';
import { FRUIT_IDS } from '../content/fruits';
import { useStore } from '../state/store';
import { Toasts } from './components/common';
import { BattlePrepScreen } from './screens/BattlePrepScreen';
import { BattleScreen } from './screens/BattleScreen';
import { EndScreen, EnemyPickerScreen, QuickResultScreen, ResultScreen } from './screens/EndScreens';
import { EventScreen } from './screens/EventScreen';
import { MenuScreen } from './screens/MenuScreen';
import { ToolboxScreen } from './screens/ToolboxScreen';
import { WorldScreen } from './screens/WorldScreen';

export function App() {
  const screen = useStore((s) => s.run?.screen ?? null);
  const quick = useStore((s) => s.quick?.screen ?? null);
  const toolbox = useStore((s) => s.toolboxOpen);
  return (
    <div className="app">
      {quick === 'pick' && <EnemyPickerScreen />}
      {quick === 'prep' && <BattlePrepScreen />}
      {quick === 'battle' && <BattleScreen />}
      {quick === 'result' && <QuickResultScreen />}
      {!quick && (
        <>
          {screen === null && <MenuScreen />}
          {screen === 'map' && <WorldScreen />}
          {screen === 'event' && <EventScreen />}
          {screen === 'prep' && <BattlePrepScreen />}
          {screen === 'battle' && <BattleScreen />}
          {screen === 'result' && <ResultScreen />}
          {(screen === 'victory' || screen === 'defeat') && <EndScreen />}
          {toolbox && screen !== null && <ToolboxScreen />}
        </>
      )}
      <Toasts />
      <DebugPanel />
    </div>
  );
}

/** Dev-only (or ?debug=1): start any enemy or event; shows the run seed (doc 01). */
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
              {Object.keys(content.enemies).map((id) => <button key={id} className="btn" onClick={() => { debugBattle(id); setOpen(false); }}>{id}</button>)}
              <b>Event</b>
              {[...RANDOM_EVENTS, 'village', 'town', 'market', 'campfire'].map((id) => <button key={id} className="btn" onClick={() => { debugEvent(id); setOpen(false); }}>{id}</button>)}
              <button className="btn" onClick={() => useStore.getState().apply((r) => ({
                ...r, player: { ...r.player, gold: r.player.gold + 500, upgrades: r.player.upgrades + 3, fruits: [...r.player.fruits, ...FRUIT_IDS],
                  abilities: Object.keys(content.abilities).map((id) => ({ id, uses: 3 })) },
              }))}>+500 Talents +3⬆ +all fruit +all abilities</button>
            </>
          )}
          <button className="btn" onClick={() => setOpen(false)}>close</button>
        </div>
      )}
    </div>
  );
}
