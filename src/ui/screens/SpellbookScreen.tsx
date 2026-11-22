// Spellbook (spec §9.4): socket gems, upgrade levels, unsocket at Towns. Every change previews first.

import { useMemo, useState } from 'react';
import { content } from '../../content';
import { ELEMENT_NAME } from '../../content/statuses';
import { atTown, resolvedPlayerSpells } from '../../engine/run';
import { resolveInstance } from '../../engine/spells';
import { ELEMENTS, type Element, type GemId, type ResolvedSpell, type SpellInstance } from '../../engine/types';
import { useStore } from '../../state/store';
import { Asset, GemIcon, Modal } from '../components/common';
import { statLine } from './BattlePrepScreen';

export function SpellbookScreen() {
  const run = useStore((s) => s.run)!;
  const { setSpellbook, socket, unsocket, upgrade } = useStore.getState();
  const spells = useMemo(() => resolvedPlayerSpells(run.player, content), [run.player]);
  const [sel, setSel] = useState(spells[0]?.ref);
  const [socketing, setSocketing] = useState<number | null>(null);
  const [preview, setPreview] = useState<null | { kind: 'socket'; gemIndex: number; element?: Element } | { kind: 'upgrade' }>(null);
  const inst = run.player.spells.find((s) => s.uid === sel);
  const spell = spells.find((s) => s.ref === sel);
  const town = atTown(run);
  const canEdit = run.screen === 'map' || run.screen === 'event';

  const previewed = (): ResolvedSpell | null => {
    if (!inst || !preview) return null;
    const copy: SpellInstance = structuredClone(inst);
    if (preview.kind === 'upgrade') copy.level = Math.min(5, copy.level + 1) as SpellInstance['level'];
    else if (socketing !== null) {
      const gem = run.player.gems[preview.gemIndex];
      copy.sockets[socketing] = { gem, secondElement: preview.element };
    }
    return resolveInstance(copy, content.spells[copy.spellId], content.gems, content.assetExists);
  };
  const after = previewed();

  return (
    <div className="modal-back" style={{ alignItems: 'stretch', padding: 0, background: 'var(--wood-dark)' }}>
      <div className="screen">
        <div className="topbar">
          <button className="btn icon" onClick={() => setSpellbook(false)} aria-label="Close toolbox">←</button>
          <span className="title" style={{ fontSize: 20 }}>Toolbox</span>
          <span className="spacer" />
          <span className="chip"><Asset path="icons/gem.png" alt="Virtues" size={20} /> {run.player.gems.length}</span>
          <span className="chip">⬆ {run.player.spellUpgrades}</span>
          <span className="chip"><Asset path="icons/gold.png" alt="Talents" size={20} /> {run.player.gold}</span>
        </div>
        <div className="prep-body">
          <div className="prep-col panel" style={{ flex: '0 0 34%', overflowY: 'auto' }}>
            {spells.map((s) => (
              <button key={s.ref} className={`spell-card ${s.ref === sel ? 'selected' : ''}`} style={{ flexDirection: 'row', justifyContent: 'flex-start', gap: 8 }} onClick={() => { setSel(s.ref); setSocketing(null); }}>
                <Asset path={s.icon} alt={s.name} size={30} color={s.color} />
                <span>{s.name}</span>
                <span className="dim">Lv{s.level}</span>
              </button>
            ))}
          </div>
          {spell && inst && (
            <div className="prep-col panel" style={{ flex: 1, overflowY: 'auto' }}>
              <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                <Asset path={spell.icon} alt={spell.name} size={52} color={spell.color} />
                <div>
                  <h2 style={{ margin: 0 }}>{spell.name} <span className="dim" style={{ fontSize: 16 }}>Lv {spell.level}</span></h2>
                  <div className="dim">{spell.elements.map((e) => ELEMENT_NAME[e]).join(' + ')} · {spell.target}</div>
                </div>
              </div>
              <div>{statLine(spell)}{spell.weight > 1 && ` · weight ×${spell.weight.toFixed(1)}`}{spell.selfDamage ? ` · self-dmg ${spell.selfDamage}, +1 move` : ''}</div>
              <b>Sockets</b>
              <div className="slots">
                {inst.sockets.map((sock, i) => (
                  <div key={i} className={`slot ${sock ? 'filled' : ''}`} style={{ width: 'auto', minWidth: 90, padding: 4, flexDirection: 'column', fontSize: 12 }}>
                    {sock ? (
                      <>
                        <GemIcon gem={sock.gem} size={16} />
                        <span>{content.gems[sock.gem].name}{sock.secondElement ? ` (${ELEMENT_NAME[sock.secondElement]})` : ''}</span>
                        {town && canEdit && <button className="btn" style={{ minHeight: 24, fontSize: 11 }} disabled={run.player.gold < content.config.prices.unsocket} onClick={() => unsocket(inst.uid, i)}>Remove −{content.config.prices.unsocket} Talents</button>}
                      </>
                    ) : (
                      <button className="btn" disabled={!canEdit || run.player.gems.length === 0} onClick={() => setSocketing(i)}>+ virtue</button>
                    )}
                  </div>
                ))}
              </div>
              {!town && <div className="dim" style={{ fontSize: 12 }}>Adding a virtue is permanent. Virtues can be removed at a Town for {content.config.prices.unsocket} Talents.</div>}
              <button className="btn" disabled={!canEdit || run.player.spellUpgrades <= 0 || inst.level >= 5} onClick={() => setPreview({ kind: 'upgrade' })}>
                Upgrade ⬆ (Lv {inst.level} → {Math.min(5, inst.level + 1)})
              </button>
              <div className="dim" style={{ fontSize: 12 }}>A tool's level sets the value of every virtue added to it.</div>
            </div>
          )}
        </div>
      </div>

      {socketing !== null && !preview && inst && (
        <Modal onClose={() => setSocketing(null)}>
          <h2>Add a virtue</h2>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {run.player.gems.map((g: GemId, i) => {
              const def = content.gems[g];
              return (
                <button key={i} className="btn" style={{ flexDirection: 'column', minWidth: 110 }} onClick={() => setPreview({ kind: 'socket', gemIndex: i, element: g === 'sunstone' ? ELEMENTS.find((e) => e !== inst.element) : undefined })}>
                  <GemIcon gem={g} />
                  <b>{def.name}</b>
                  <span style={{ fontSize: 11 }}>{def.description}{def.values ? `: ${def.values[inst.level - 1]} at Lv${inst.level}` : ''}</span>
                </button>
              );
            })}
          </div>
          <div className="actions"><button className="btn" onClick={() => setSocketing(null)}>Cancel</button></div>
        </Modal>
      )}

      {preview && spell && after && inst && (
        <Modal onClose={() => setPreview(null)}>
          <h2>{preview.kind === 'upgrade' ? 'Upgrade tool?' : 'Add virtue? (permanent)'}</h2>
          {preview.kind === 'socket' && run.player.gems[preview.gemIndex] === 'sunstone' && (
            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 8 }}>
              <span className="dim">Second element:</span>
              {ELEMENTS.filter((e) => e !== inst.element).map((e) => (
                <button key={e} className={`btn ${preview.element === e ? 'primary' : ''}`} style={{ minHeight: 28 }} onClick={() => setPreview({ ...preview, element: e })}>{ELEMENT_NAME[e]}</button>
              ))}
            </div>
          )}
          <div className="row" style={{ alignItems: 'center' }}>
            <div style={{ textAlign: 'center' }}><Asset path={spell.icon} alt={spell.name} size={48} color={spell.color} /><div style={{ fontSize: 12 }}>{statLine(spell)}</div></div>
            <span style={{ fontSize: 28 }}>→</span>
            <div style={{ textAlign: 'center' }}>
              <Asset path={after.icon} alt={after.name} size={48} color={after.color} />
              {after.hiddenCategories > 0 && <span className="dim"> +{after.hiddenCategories}</span>}
              <div style={{ fontSize: 12 }}>{statLine(after)}</div>
            </div>
          </div>
          <div className="actions">
            <button className="btn" onClick={() => setPreview(null)}>Cancel</button>
            <button className="btn primary" onClick={() => {
              if (preview.kind === 'upgrade') upgrade(inst.uid);
              else if (socketing !== null) socket(inst.uid, socketing, preview.gemIndex, preview.element);
              setPreview(null);
              setSocketing(null);
            }}>Confirm</button>
          </div>
        </Modal>
      )}
    </div>
  );
}

/** Spell info popup, used by battle prep and the board's long-press. */
export function SpellDetails({ spell, onClose }: { spell: ResolvedSpell; onClose: () => void }) {
  const cats = [spell.damage && `Damage ${spell.damage}/tile`, spell.healing && `Healing ${spell.healing}/tile`, spell.chaos && `Chaos ${spell.chaos}/tile (damage, Shield of Faith or healing)`].filter(Boolean);
  return (
    <Modal onClose={onClose}>
      <div className="row">
        <Asset path={spell.icon} alt={spell.name} size={56} color={spell.color} />
        <div>
          <h2>{spell.name} {spell.spellClass === 'player' && <span className="dim" style={{ fontSize: 15 }}>Lv {spell.level}</span>}</h2>
          <div>{spell.description}</div>
          {cats.map((c) => <div key={String(c)}>{c}</div>)}
          {spell.statuses.map((s, i) => (
            <div key={i}>{content.statuses[s.status]?.name ?? s.status} {s.value}{s.perTile ? '/tile' : ''} → {s.self ? 'you' : 'target'}</div>
          ))}
          {spell.gems.length > 0 && <div className="dim">Virtues: {spell.gems.map((g) => content.gems[g].name).join(', ')}</div>}
          {spell.spellClass !== 'player' && <div className="dim">{spell.spellClass === 'dud' ? 'Distraction: not much use. Line up 3 of the same to clear them away, but they do nothing.' : spell.spellClass === 'nova' ? 'Special: never matches.' : ''}{spell.linked ? ' Linked: cleared when next to a match.' : ''}</div>}
        </div>
      </div>
      <div className="actions"><button className="btn" onClick={onClose}>OK</button></div>
    </Modal>
  );
}
