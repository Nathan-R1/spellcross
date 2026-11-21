import { content } from '../../content';
import { useStore } from '../../state/store';
import { GemIcon } from '../components/common';

export function ResultScreen() {
  const run = useStore((s) => s.run)!;
  const continueResult = useStore((s) => s.continueResult);
  const r = run.result!;
  return (
    <div className="screen">
      <div className="centered">
        <h1 className="title">Victory!</h1>
        <div className="panel" style={{ padding: '12px 20px', display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div className="reward">+{r.gold} gold</div>
          {r.gem && <div className="reward"><GemIcon gem={r.gem} /> {content.gems[r.gem].name} gem</div>}
          <div className="dim">HP {run.player.hp}/{run.player.maxHp}</div>
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
