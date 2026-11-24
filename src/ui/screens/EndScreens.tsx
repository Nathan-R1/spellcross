import { content } from '../../content';
import { useStore } from '../../state/store';
import { Asset, FruitIcon } from '../components/common';
import { EnemyPatternPreview } from '../components/EnemyPattern';
import { useUiScale } from '../scale';

export function ResultScreen() {
  const run = useStore((s) => s.run)!;
  const continueResult = useStore((s) => s.continueResult);
  const r = run.result!;
  return (
    <div className="screen">
      <div className="centered">
        <h1 className="title">Victory!</h1>
        <div className="panel" style={{ padding: '12px 20px', display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div className="reward">+{r.gold} Talents</div>
          {r.fruit && <div className="reward"><FruitIcon fruit={r.fruit} /> {content.fruits[r.fruit].name} fruit</div>}
          <div className="dim">Courage {run.player.hp}/{run.player.maxHp}</div>
        </div>
        <button className="btn primary big" onClick={continueResult}>{r.boss ? 'Finish the journey' : 'Continue'}</button>
      </div>
    </div>
  );
}

export function EndScreen() {
  const run = useStore((s) => s.run)!;
  const toTitle = useStore((s) => s.toTitle);
  const won = run.screen === 'victory';
  return (
    <div className="screen">
      <div className="centered">
        <h1 className="title">{won ? 'Journey complete' : 'Your journey ends'}</h1>
        <div className="dim">{run.endMessage}</div>
        <button className="btn primary big" onClick={toTitle}>Return to title</button>
      </div>
    </div>
  );
}

/** Quick fight result: back to the main menu. Rewards are shown but not kept. */
export function QuickResultScreen() {
  const quick = useStore((s) => s.quick)!;
  const toTitle = useStore((s) => s.toTitle);
  const r = quick.result!;
  return (
    <div className="screen">
      <div className="centered">
        <h1 className="title">{r.outcome === 'victory' ? 'Victory!' : 'Defeated'}</h1>
        <div className="dim">{content.enemies[quick.enemyId!].name}</div>
        {r.outcome === 'victory' && (
          <div className="panel" style={{ padding: '12px 20px' }}>
            <div className="reward">+{r.gold} Talents</div>
            {r.fruit && <div className="reward"><FruitIcon fruit={r.fruit} /> {content.fruits[r.fruit].name} fruit</div>}
            <div className="dim" style={{ fontSize: 12 }}>(quick fight: rewards aren't kept)</div>
          </div>
        )}
        <button className="btn primary big" onClick={toTitle}>Main menu</button>
      </div>
    </div>
  );
}

/** Quick fight: pick the enemy (combat § 9). */
export function EnemyPickerScreen() {
  const { quickPick, toTitle } = useStore.getState();
  const s = useUiScale();
  return (
    <div className="screen">
      <div className="topbar"><button className="btn icon" onClick={toTitle} aria-label="Back">←</button><span className="title topbar-title">Fight</span></div>
      <div className="enemy-picker">
        <div className="dim enemy-picker-title">Choose an enemy</div>
        <div className="enemy-picker-grid">
          {Object.values(content.enemies).map((e) => (
            <button key={e.id} className="btn enemy-pick" onClick={() => quickPick(e.id)}>
              <Asset path={e.portrait} alt={e.name} size={Math.round(72 * s)} color="#5a2a2a" />
              <span style={{ textAlign: 'left' }}><b className="enemy-pick-name">{e.name}</b><EnemyPatternPreview enemyId={e.id} cell={Math.round(7 * s)} /></span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
