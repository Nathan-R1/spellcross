// Event screen (spec §4, doc 03): framed image left, text right, options pinned below.

import { content } from '../../content';
import { abilitySummary } from '../../content/describe';
import { eventView } from '../../engine/run';
import type { FruitId } from '../../engine/types';
import { useStore } from '../../state/store';
import { AbilityBar, Asset, FruitIcon, Modal, PlayerStats, TopBar } from '../components/common';

export function EventScreen() {
  const run = useStore((s) => s.run)!;
  const { chooseOption, assignRecharge, skipRecharges, pickFruit, pickLevelUp } = useStore.getState();
  const view = eventView(run, content);
  if (!view) return null;
  const ev = run.event!;
  return (
    <div className="screen">
      <TopBar>
        <PlayerStats />
        <span className="spacer" />
        <AbilityBar />
      </TopBar>
      <div className="event-body">
        <div className="event-image">
          <div className="banner">{view.title}</div>
          <div className="frame" style={{ backgroundImage: `url(/assets/${view.image})` }} />
        </div>
        <div className="event-text panel">
          <div className="story">{view.text || <span className="dim">What will you do?</span>}</div>
          <div className={`options ${view.options.length > 4 ? 'many' : ''}`} style={{ padding: 8 }}>
            {view.options.map((o, i) => (
              <button key={i} className="btn option" disabled={!o.enabled} onClick={() => chooseOption(i)}>
                <span>{o.label}</span>
                {o.cost && <span className="cost">&nbsp;{o.cost}</span>}
                {o.reward && <span className="reward">&nbsp;{o.reward}</span>}
              </button>
            ))}
          </div>
        </div>
      </div>

      {ev.pendingRecharges > 0 && (
        <Modal>
          <h2>Recharge abilities</h2>
          <div className="dim">{ev.pendingRecharges} recharge{ev.pendingRecharges > 1 ? 's' : ''} left. Tap an ability to add a use.</div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 10 }}>
            {run.player.abilities.map((a, i) => {
              const def = content.abilities[a.id];
              const full = a.uses >= def.maxUses;
              return (
                <button key={i} className="btn" disabled={full} onClick={() => assignRecharge(i)} style={{ flexDirection: 'column', minWidth: 80 }}>
                  <Asset path={def.icon} alt={def.name} size={36} />
                  <span style={{ fontSize: 12 }}>{def.name}</span>
                  <span className="dim" style={{ fontSize: 11 }}>{abilitySummary(a.id)}</span>
                  <span className="dim" style={{ fontSize: 12 }}>{a.uses}/{def.maxUses}</span>
                </button>
              );
            })}
          </div>
          <div className="actions"><button className="btn" onClick={skipRecharges}>Done</button></div>
        </Modal>
      )}

      {ev.levelUpPick && (
        <Modal onClose={() => pickLevelUp(null)}>
          <h2>Reflect</h2>
          <div className="dim">Choose a tool to level up.</div>
          <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
            {run.player.tools.map((t) => {
              const def = content.tools[t.toolId];
              return (
                <button key={t.uid} className="btn" disabled={t.level >= 5} onClick={() => pickLevelUp(t.uid)} style={{ flexDirection: 'column', minWidth: 92 }}>
                  <Asset path={def.icon} alt={def.name} size={32} color={def.color} />
                  <span style={{ fontSize: 12 }}>{def.name}</span>
                  <span className="dim" style={{ fontSize: 12 }}>Lv {t.level}{t.level < 5 ? ` → ${t.level + 1}` : ' (max)'}</span>
                </button>
              );
            })}
          </div>
          <div className="actions"><button className="btn" onClick={() => pickLevelUp(null)}>Cancel</button></div>
        </Modal>
      )}

      {ev.fruitOffer && (
        <Modal onClose={() => pickFruit(null)}>
          <h2>Choose a fruit</h2>
          <div className="dim">Pick 1 of 3 for {ev.fruitOfferPrice} Talents.</div>
          <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
            {ev.fruitOffer.map((f: FruitId) => {
              const def = content.fruits[f];
              return (
                <button key={f} className="btn" style={{ flexDirection: 'column', flex: 1, minWidth: 120, padding: 8 }} onClick={() => pickFruit(f)}>
                  <FruitIcon fruit={f} size={32} />
                  <b>{def.name}</b>
                  <span className="dim" style={{ fontSize: 12 }}>{def.keyword}</span>
                  <span style={{ fontSize: 12 }}>{def.description}</span>
                </button>
              );
            })}
          </div>
          <div className="actions"><button className="btn" onClick={() => pickFruit(null)}>Cancel</button></div>
        </Modal>
      )}
    </div>
  );
}
