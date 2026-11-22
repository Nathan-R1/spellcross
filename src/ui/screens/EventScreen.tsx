// Event screen (spec §4, doc 03): framed image left, text right, options pinned below.

import { content } from '../../content';
import { eventView } from '../../engine/run';
import type { GemId } from '../../engine/types';
import { useStore } from '../../state/store';
import { AbilityBar, Asset, GemIcon, Modal, PlayerStats, TopBar } from '../components/common';

export function EventScreen() {
  const run = useStore((s) => s.run)!;
  const { chooseOption, assignRecharge, skipRecharges, pickGem } = useStore.getState();
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
                  <span className="dim" style={{ fontSize: 12 }}>{a.uses}/{def.maxUses}</span>
                </button>
              );
            })}
          </div>
          <div className="actions"><button className="btn" onClick={skipRecharges}>Done</button></div>
        </Modal>
      )}

      {ev.gemOffer && (
        <Modal onClose={() => pickGem(null)}>
          <h2>Choose a gem</h2>
          <div className="dim">Pick 1 of 3 for {ev.gemOfferPrice}gp. Values grow with the level of the spell you socket it into.</div>
          <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
            {ev.gemOffer.map((g: GemId) => {
              const def = content.gems[g];
              return (
                <button key={g} className="btn" style={{ flexDirection: 'column', flex: 1, minWidth: 120, padding: 8 }} onClick={() => pickGem(g)}>
                  <GemIcon gem={g} size={20} />
                  <b>{def.name}</b>
                  <span style={{ fontSize: 12 }}>{def.description}</span>
                  {def.values && <span className="dim" style={{ fontSize: 11 }}>Lv1–5: {def.values.join(' / ')}</span>}
                </button>
              );
            })}
          </div>
          <div className="actions"><button className="btn" onClick={() => pickGem(null)}>Cancel</button></div>
        </Modal>
      )}
    </div>
  );
}
