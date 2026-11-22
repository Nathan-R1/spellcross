// Battle screen (spec §6.9, combat §6): board left, enemy zone and player strip right. The engine has
// already resolved each action; this screen plays its events back one at a time.

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { content } from '../../content';
import { pendingAllyStrength, previewParts, snapshot, type IntentPreviewPart } from '../../engine/battle';
import type { EnemyState, ResolvedSpell, StatusInstance, Target, TimedEvent } from '../../engine/types';
import { useStore } from '../../state/store';
import { AbilityBar, Asset, HpBar, Modal, StatusInfo, StatusRow, TopBar, useLongPress } from '../components/common';
import { SpellDetails } from './SpellbookScreen';

const DURATION: Record<TimedEvent['event']['type'], number> = {
  swapped: 200, matched: 280, cast: 380, cleared: 140, collapsed: 260, enemyTurn: 520, damage: 320, healed: 260,
  status: 200, goldStolen: 300, goldReturned: 300, tilesLocked: 380, tilesReplaced: 380, defeated: 380, ability: 200,
  targetChanged: 60, extraMove: 300, turnStart: 120, battleEnd: 700,
};

const KIND_ICON: Record<IntentPreviewPart['kind'], string> = { attack: '⚔', defend: '🛡', heal: '♥', buff: '▲', debuff: '▼', steal: '💰', board: '▦' };

interface Floater { id: number; text: string; cls: string; x: number; y: number }
let floaterId = 1;

export function BattleScreen() {
  const run = useStore((s) => s.run)!;
  const battle = run.battle!;
  const playback = useStore((s) => s.playback);
  const selection = useStore((s) => s.selection);
  const { selectTile, target, ability, endTurn, advance, fastForward } = useStore.getState();
  const view = playback.view ?? snapshot(battle);
  const busy = playback.queue.length > 0 || playback.current !== null;
  const current = playback.current?.event;

  // Playback driver.
  useEffect(() => {
    if (!playback.current) {
      if (playback.queue.length > 0 || battle.outcome) {
        const id = window.setTimeout(advance, battle.outcome && playback.queue.length === 0 ? 400 : 0);
        return () => window.clearTimeout(id);
      }
      return;
    }
    const id = window.setTimeout(advance, DURATION[playback.current.event.type] ?? 200);
    return () => window.clearTimeout(id);
  }, [playback, battle.outcome, advance]);

  // Layout: tile size from the available height, capped at 48px (D15).
  const bodyRef = useRef<HTMLDivElement>(null);
  const [tile, setTile] = useState(44);
  useLayoutEffect(() => {
    const el = bodyRef.current;
    if (!el) return;
    const rows = battle.board.height - battle.board.visibleFrom;
    const measure = () => setTile(Math.max(28, Math.min(48, Math.floor((el.clientHeight - 14) / rows))));
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [battle.board.height, battle.board.visibleFrom]);

  // Floating numbers anchored on enemy slots / the player strip.
  const anchors = useRef<Record<string, HTMLElement | null>>({});
  const screenRef = useRef<HTMLDivElement>(null);
  const [floaters, setFloaters] = useState<Floater[]>([]);
  useEffect(() => {
    if (!current) return;
    const add = (t: Target, text: string, cls: string) => {
      const el = anchors.current[String(t)];
      const root = screenRef.current;
      if (!el || !root) return;
      const a = el.getBoundingClientRect();
      const r = root.getBoundingClientRect();
      const f = { id: floaterId++, text, cls, x: a.left - r.left + a.width / 2 - 12 + (Math.random() * 16 - 8), y: a.top - r.top + a.height * 0.35 };
      setFloaters((fs) => [...fs, f]);
      window.setTimeout(() => setFloaters((fs) => fs.filter((x) => x.id !== f.id)), 950);
    };
    if (current.type === 'cast') {
      for (const h of current.hits) add(h.target, h.damage > 0 ? `-${h.damage}` : h.blocked > 0 ? `🛡${h.blocked}` : '0', h.damage > 0 ? 'dmg' : 'block');
      if (current.healing > 0) add('player', `+${current.healing}`, 'heal');
    } else if (current.type === 'damage') add(current.target, current.amount > 0 ? `-${current.amount}` : `🛡${current.blocked}`, current.amount > 0 ? 'dmg' : 'block');
    else if (current.type === 'healed' && current.amount > 0) add(current.target, `+${current.amount}`, 'heal');
    else if (current.type === 'goldStolen') add('player', `-${current.amount}g`, 'dmg');
  }, [current]);

  const matched = new Set(current?.type === 'matched' ? current.uids : current?.type === 'tilesLocked' || current?.type === 'tilesReplaced' ? current.uids : []);
  const acting = current?.type === 'enemyTurn' ? current.slot : null;
  const [spellInfo, setSpellInfo] = useState<ResolvedSpell | null>(null);
  const [enemyInfo, setEnemyInfo] = useState<number | null>(null);
  const [statusInfo, setStatusInfo] = useState<StatusInstance | null>(null);
  const block = view.player.statuses.find((s) => s.id === 'block')?.value ?? 0;
  const maxMoves = Math.max(battle.player.movesPerTurn, view.movesLeft);

  return (
    <div className="screen" ref={screenRef} onPointerDownCapture={() => busy && playback.queue.length > 2 && fastForward()}>
      <TopBar>
        <span className="spacer" />
        <AbilityBar onTrigger={(i) => ability(i)} />
      </TopBar>
      <div className="battle-body" ref={bodyRef}>
        <div className="board-wrap">
          <Board view={view} tile={tile} matched={matched} selection={selection} spells={battle.spells}
            onTap={(x, y) => selectTile({ x, y })}
            onLong={(ref) => setSpellInfo(battle.spells[ref] ?? null)} />
        </div>
        <div className="right-col">
          <div className="enemy-zone">
            {battle.enemies.map((e) => {
              const v = view.enemies[e.slot];
              return (
                <EnemySlot key={e.slot} enemy={e} hp={v.hp} statuses={v.statuses} alive={v.alive} cursor={v.intentCursor}
                  allyStrength={pendingAllyStrength(battle.enemies.map((x) => ({ slot: x.slot, defId: x.defId, alive: view.enemies[x.slot].alive, intentCursor: view.enemies[x.slot].intentCursor })), e.slot, content)}
                  targeted={view.targetSlot === e.slot && v.alive} acting={acting === e.slot}
                  anchor={(el) => (anchors.current[String(e.slot)] = el)}
                  onTap={() => target(e.slot)} onLong={() => setEnemyInfo(e.slot)} />
              );
            })}
          </div>
          <div className="player-strip panel" ref={(el) => { anchors.current.player = el; }}>
            <Asset path="portraits/player.png" alt="You" className="portrait" size={44} />
            <div className="info">
              <HpBar hp={view.player.hp} max={view.player.maxHp} green />
              <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                {block > 0 && <span className="chip" style={{ color: 'var(--block)' }}>🛡 {block}</span>}
                <StatusRow statuses={view.player.statuses.filter((s) => s.id !== 'block')} max={5} onPick={setStatusInfo} />
              </div>
            </div>
            <div className="pips" aria-label={`${view.movesLeft} moves left`}>
              {Array.from({ length: maxMoves }, (_, i) => <i key={i} className={i < view.movesLeft ? '' : 'used'} />)}
            </div>
            <button className="btn end-turn" disabled={busy || battle.phase !== 'player'} onClick={endTurn}>End Turn</button>
          </div>
        </div>
      </div>
      {floaters.map((f) => <div key={f.id} className={`floater ${f.cls}`} style={{ left: f.x, top: f.y }}>{f.text}</div>)}
      {spellInfo && <SpellDetails spell={spellInfo} onClose={() => setSpellInfo(null)} />}
      {statusInfo && <StatusInfo s={statusInfo} onClose={() => setStatusInfo(null)} />}
      {enemyInfo !== null && <EnemyInfo enemy={battle.enemies[enemyInfo]} cursor={view.enemies[enemyInfo].intentCursor} onClose={() => setEnemyInfo(null)} />}
      {battle.outcome && !busy && (
        <div className="modal-back" style={{ background: 'rgba(0,0,0,0.4)' }}>
          <h1 className="title" style={{ fontSize: 48 }}>{battle.outcome === 'victory' ? 'Victory!' : 'Defeated'}</h1>
        </div>
      )}
    </div>
  );
}

function Board({ view, tile, matched, selection, spells, onTap, onLong }: {
  view: ReturnType<typeof snapshot>; tile: number; matched: Set<number>; selection: { x: number; y: number } | null;
  spells: Record<string, ResolvedSpell>; onTap: (x: number, y: number) => void; onLong: (ref: string) => void;
}) {
  const b = view.board;
  const rows = b.height - b.visibleFrom;
  return (
    <div className="board" style={{ width: b.width * tile + 6, height: rows * tile + 6, overflow: 'hidden' }} role="grid" aria-label="Spell board">
      {b.cells.map((t, i) => {
        const x = i % b.width;
        const y = Math.floor(i / b.width);
        if (!t.spell) return null;
        const s = spells[t.spell];
        const sel = selection && selection.x === x && selection.y === y;
        return (
          <TileView key={t.uid} spell={s} x={x} y={y - b.visibleFrom} tile={tile} lock={t.lock} matched={matched.has(t.uid)} selected={!!sel}
            onTap={() => onTap(x, y)} onLong={() => onLong(t.spell!)} hidden={y < b.visibleFrom} />
        );
      })}
    </div>
  );
}

function TileView({ spell, x, y, tile, lock, matched, selected, hidden, onTap, onLong }: {
  spell: ResolvedSpell | undefined; x: number; y: number; tile: number; lock: string; matched: boolean; selected: boolean; hidden: boolean; onTap: () => void; onLong: () => void;
}) {
  const press = useLongPress(onTap, onLong);
  const name = spell?.name ?? '?';
  return (
    <div className={`tile ${selected ? 'selected' : ''} ${matched ? 'matched' : ''}`}
      style={{ width: tile, height: tile, transform: `translate(${x * tile + 3}px, ${y * tile + 3}px)`, visibility: hidden ? 'hidden' : undefined }}
      role="gridcell" aria-label={`${name}, row ${y + 1} col ${x + 1}${lock === 'locked' ? ', locked' : ''}`} {...press}>
      <div style={{ background: spell ? `linear-gradient(160deg, ${spell.color}, ${shade(spell.color)})` : '#333' }}>
        <Asset path={spell?.icon} alt={name} color="transparent" />
        {spell?.linked && <span className="linked" />}
        {lock === 'locked' && <span className="lock" />}
        {spell && spell.hiddenCategories > 0 && <span className="pip">+{spell.hiddenCategories}</span>}
      </div>
    </div>
  );
}

function shade(hex: string) {
  const n = parseInt(hex.slice(1), 16);
  const f = (v: number) => Math.max(0, Math.floor(v * 0.55));
  return `rgb(${f(n >> 16)}, ${f((n >> 8) & 255)}, ${f(n & 255)})`;
}

function intentParts(enemy: EnemyState, statuses: StatusInstance[], cursor: number, allyStrength: number) {
  const cycle = content.enemyIntents[enemy.defId];
  const intent = cycle[cursor % cycle.length];
  return { intent, parts: previewParts(intent.parts, { statuses }, allyStrength) };
}

function EnemySlot({ enemy, hp, statuses, alive, cursor, allyStrength, targeted, acting, anchor, onTap, onLong }: {
  enemy: EnemyState; hp: number; statuses: StatusInstance[]; alive: boolean; cursor: number; allyStrength: number; targeted: boolean; acting: boolean;
  anchor: (el: HTMLElement | null) => void; onTap: () => void; onLong: () => void;
}) {
  const press = useLongPress(onTap, onLong);
  const { parts } = useMemo(() => intentParts(enemy, statuses, cursor, allyStrength), [enemy, statuses, cursor, allyStrength]);
  const def = content.enemies[enemy.defId];
  const block = statuses.find((s) => s.id === 'block')?.value ?? 0;
  return (
    <div className={`enemy panel ${alive ? '' : 'dead'} ${targeted ? 'targeted' : ''} ${acting ? 'acting' : ''}`} ref={anchor} {...press} role="button" aria-label={`${def.name}, ${hp} HP${targeted ? ', targeted' : ''}`}>
      {targeted && <span className="reticle">◎</span>}
      <div className="intent" aria-label="Intent">
        {alive && parts.map((p, i) => <span key={i} className={`k-${p.kind}`}>{KIND_ICON[p.kind]}{p.label}</span>)}
      </div>
      <div className="portrait"><Asset path={def.portrait} alt={def.name} color="#5a2a2a" size={undefined} style={{ width: '100%', height: '100%', objectFit: 'contain' }} /></div>
      <div className="name">{def.name}{block > 0 && <span style={{ color: 'var(--block)' }}> 🛡{block}</span>}</div>
      <HpBar hp={hp} max={enemy.maxHp} />
      <StatusRow statuses={statuses.filter((s) => s.id !== 'block')} max={3} />
    </div>
  );
}

function EnemyInfo({ enemy, cursor, onClose }: { enemy: EnemyState; cursor: number; onClose: () => void }) {
  const def = content.enemies[enemy.defId];
  const cycle = content.enemyIntents[enemy.defId];
  return (
    <Modal onClose={onClose}>
      <div className="row">
        <Asset path={def.portrait} alt={def.name} size={64} color="#5a2a2a" />
        <div style={{ flex: 1 }}>
          <h2>{def.name} <span className="dim" style={{ fontSize: 14 }}>{def.tier}</span></h2>
          <div className="dim">Repeats this cycle:</div>
          <ol style={{ margin: '4px 0', paddingLeft: 20 }}>
            {cycle.map((it, i) => (
              <li key={i} style={{ color: i === cursor % cycle.length ? 'var(--accent)' : undefined }}>
                <b>{it.name}</b>{i === cursor % cycle.length ? ' (next)' : ''}: {it.description}
              </li>
            ))}
          </ol>
        </div>
      </div>
      <div className="actions"><button className="btn" onClick={onClose}>OK</button></div>
    </Modal>
  );
}
