// The Toolbox (tools.md §1–2): add fruit to tools, remove them at a Town, spend Upgrades.

import { useState } from 'react';
import { content } from '../../content';
import { PILLAR_NAME } from '../../content/tools';
import { atTown } from '../../engine/run';
import { useStore } from '../../state/store';
import { Asset, FruitIcon, Modal } from '../components/common';
import { ToolCard } from './BattlePrepScreen';

export function ToolboxScreen() {
  const run = useStore((s) => s.run)!;
  const { setToolbox, socket, unsocket, upgrade } = useStore.getState();
  const [sel, setSel] = useState(run.player.tools[0]?.uid ?? '');
  const [socketing, setSocketing] = useState<number | null>(null);
  const inst = run.player.tools.find((t) => t.uid === sel);
  const town = atTown(run);
  const canEdit = run.screen === 'map' || run.screen === 'event';

  return (
    <div className="modal-back" style={{ alignItems: 'stretch' }}>
      <div className="panel toolbox">
        <div className="topbar" style={{ borderRadius: 8 }}>
          <button className="btn icon" onClick={() => setToolbox(false)} aria-label="Close toolbox">←</button>
          <span className="title" style={{ fontSize: 20 }}>Toolbox</span>
          <span className="spacer" />
          <span className="chip"><Asset path="fruits/love.svg" alt="Fruit" size={20} /> {run.player.fruits.length}</span>
          <span className="chip">⬆ {run.player.upgrades}</span>
        </div>
        <div className="tool-grid">
          {run.player.tools.map((t) => <ToolCard key={t.uid} tool={t} selected={t.uid === sel} onTap={() => { setSel(t.uid); setSocketing(null); }} onLong={() => setSel(t.uid)} />)}
        </div>
        {inst && (() => {
          const def = content.tools[inst.toolId];
          return (
            <div className="tool-detail">
              <h2 style={{ margin: 0 }}>{def.name} <span className="dim" style={{ fontSize: 15 }}>Lv {inst.level} · {PILLAR_NAME[inst.pillar]}</span></h2>
              <div>{def.description}</div>
              <div className="sockets">
                {inst.sockets.map((f, i) => (
                  <div key={i} className="socket-slot">
                    {f ? (
                      <>
                        <FruitIcon fruit={f} size={28} />
                        <span><b>{content.fruits[f].name}</b> <span className="dim">{content.fruits[f].keyword}</span></span>
                        {town && canEdit && (
                          <button className="btn" style={{ minHeight: 24, fontSize: 11 }} disabled={run.player.gold < content.config.prices.unsocket} onClick={() => unsocket(inst.uid, i)}>
                            Remove −{content.config.prices.unsocket} Talents
                          </button>
                        )}
                      </>
                    ) : (
                      <button className="btn" disabled={!canEdit || run.player.fruits.length === 0} onClick={() => setSocketing(i)}>+ fruit</button>
                    )}
                  </div>
                ))}
              </div>
              {!town && <div className="dim" style={{ fontSize: 12 }}>Adding a fruit is permanent. Fruit can be removed at a Town for {content.config.prices.unsocket} Talents.</div>}
              <button className="btn" disabled={!canEdit || run.player.upgrades <= 0 || inst.level >= content.config.maxToolLevel} onClick={() => upgrade(inst.uid)}>
                Upgrade (Lv {inst.level} → {Math.min(content.config.maxToolLevel, inst.level + 1)})
              </button>
              <div className="dim" style={{ fontSize: 12 }}>What a level does is still to be designed.</div>
            </div>
          );
        })()}
      </div>
      {socketing !== null && inst && (
        <Modal onClose={() => setSocketing(null)}>
          <h2>Add a fruit (permanent)</h2>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {run.player.fruits.map((f, i) => (
              <button key={i} className="btn" style={{ flexDirection: 'column', minWidth: 110 }} onClick={() => { socket(inst.uid, socketing, i); setSocketing(null); }}>
                <FruitIcon fruit={f} size={28} />
                <b>{content.fruits[f].name}</b>
                <span style={{ fontSize: 11 }}>{content.fruits[f].description}</span>
              </button>
            ))}
          </div>
          <div className="actions"><button className="btn" onClick={() => setSocketing(null)}>Cancel</button></div>
        </Modal>
      )}
    </div>
  );
}
