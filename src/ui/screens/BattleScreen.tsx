// Battle screen (combat § 8): portrait. The 8×8 board on top; your panel (left) and the enemy panel (right) below.
// The engine has already resolved each action; this screen plays its events back one at a time.

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { content } from '../../content';
import { STONE } from '../../content/tools';
import { placementCells, snapshot } from '../../engine/combat';
import type { BattleState, Placement, Pos, Tile, TimedEvent, ViewSnapshot } from '../../engine/types';
import { activeBattle, useStore } from '../../state/store';
import { AbilityBar, Asset, HpBar, Modal, TopBar, useLongPress } from '../components/common';

const DURATION: Record<TimedEvent['event']['type'], number> = {
  swapped: 200, matched: 280, effect: 420, damaged: 260, stone: 220, collapsed: 260, shining: 320, enemyStep: 160,
  playerHit: 320, ability: 200, turnStart: 160, battleEnd: 700,
};

interface Floater { id: number; text: string; cls: string }
let floaterId = 1;

export function BattleScreen() {
  const battle = useStore((s) => activeBattle(s))!;
  const playback = useStore((s) => s.playback);
  const selection = useStore((s) => s.selection);
  const orientation = useStore((s) => s.orientation);
  const { selectTile, ability, endTurn, advance, fastForward, setOrientation } = useStore.getState();
  const view = playback.view ?? snapshot(battle, content);
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

  // Square tiles from the available width, leaving room for the panels below.
  const bodyRef = useRef<HTMLDivElement>(null);
  const [tile, setTile] = useState(44);
  useLayoutEffect(() => {
    const el = bodyRef.current;
    if (!el) return;
    const measure = () => setTile(Math.max(30, Math.min(64, Math.floor(Math.min(el.clientWidth - 10, el.clientHeight - 190) / 8))));
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Effect log line (kept by the store) and floaters on the player panel.
  const log = playback.log;
  const [floaters, setFloaters] = useState<Floater[]>([]);
  useEffect(() => {
    const add = (text: string, cls: string) => {
      const f = { id: floaterId++, text, cls };
      setFloaters((fs) => [...fs, f]);
      window.setTimeout(() => setFloaters((fs) => fs.filter((x) => x.id !== f.id)), 950);
    };
    if (current?.type === 'playerHit') add(current.amount > 0 ? `-${current.amount}` : `🛡${current.blocked}`, current.amount > 0 ? 'dmg' : 'block');
  }, [current]);

  // Placement: first tap aims (preview), a second tap on the same cell confirms.
  // The aim is forgotten whenever the next placement (or orientation) changes.
  const aimKey = `${battle.pending.length}:${battle.nextUid}:${orientation}`;
  const [aimState, setAimState] = useState<{ key: string; pos: Pos } | null>(null);
  const aim = aimState?.key === aimKey ? aimState.pos : null;
  const setAim = (pos: Pos) => setAimState({ key: aimKey, pos });
  const pending = view.phase === 'placing' ? view.pending : null;
  const preview = pending && aim ? placementCells(battle, pending, aim, orientation) : null;
  const onTap = (x: number, y: number) => {
    if (busy) return;
    if (battle.phase === 'placing') {
      if (aim && aim.x === x && aim.y === y) selectTile({ x, y });
      else setAim({ x, y });
      return;
    }
    selectTile({ x, y });
  };

  const highlight = new Set<number>(current?.type === 'matched' ? current.uids : current?.type === 'shining' ? current.uids : []);
  const hurt = new Set<number>(current?.type === 'damaged' ? current.uids : []);
  const [info, setInfo] = useState<Tile | null>(null);
  const [enemyInfo, setEnemyInfo] = useState(false);
  const enemy = content.enemies[battle.enemyId];
  const maxMoves = Math.max(battle.player.movesPerTurn, view.movesLeft);
  const enemyPress = useLongPress(() => setEnemyInfo(true), () => setEnemyInfo(true));

  return (
    <div className="screen battle" onPointerDownCapture={() => busy && playback.queue.length > 2 && fastForward()}>
      <TopBar>
        <span className="chip">Turn {view.round}</span>
        <span className="spacer" />
        <span className="dim log">{log}</span>
      </TopBar>
      <div className="battle-body" ref={bodyRef}>
        {pending && <PlacingBanner pending={pending} orientation={orientation} onOrientation={setOrientation} aimed={!!aim} />}
        <BoardView view={view} battle={battle} tile={tile} selection={selection} preview={preview} highlight={highlight} hurt={hurt}
          onTap={onTap} onLong={(t) => setInfo(t)} />
        <div className="battle-panels">
          <div className="panel player-panel">
            <b>You</b>
            <HpBar hp={view.player.hp} max={view.player.maxHp} green />
            <div className="stat-row">
              <span className="chip" style={{ color: 'var(--block)' }} title="Block">🛡 {view.player.block}</span>
              {view.player.critical > 0 && <span className="chip" title="Critical: next tool set doubled">✦ ×{view.player.critical}</span>}
              {view.player.foresight > 0 && <span className="chip" title="Foresight: Truth tools +damage">👁 {view.player.foresight}</span>}
            </div>
            <div className="pips" aria-label={`${view.movesLeft} moves left`}>
              {Array.from({ length: maxMoves }, (_, i) => <i key={i} className={i < view.movesLeft ? '' : 'used'} />)}
            </div>
            <AbilityBar onTrigger={(i) => ability(i)} />
            <button className="btn end-turn" disabled={busy || battle.phase !== 'player'} onClick={endTurn}>End Turn</button>
            {floaters.map((f) => <div key={f.id} className={`floater ${f.cls}`}>{f.text}</div>)}
          </div>
          <div className="panel enemy-panel" role="button" aria-label={`${enemy.name}: hold for details`} {...enemyPress}>
            <b>{enemy.name}</b>
            <Asset path={enemy.portrait} alt={enemy.name} size={56} color="#5a2a2a" />
            <div>On board: <b>{view.enemyOnBoard}</b></div>
            <div>To come: <b>{view.enemyToCome}</b></div>
            <div className="dim" style={{ fontSize: 11 }}>(hold for info)</div>
          </div>
        </div>
      </div>
      {info && <TileInfo tile={info} battle={battle} onClose={() => setInfo(null)} />}
      {enemyInfo && <EnemyInfo enemyId={battle.enemyId} onClose={() => setEnemyInfo(false)} />}
      {battle.outcome && !busy && (
        <div className="modal-back" style={{ background: 'rgba(0,0,0,0.4)' }}>
          <h1 className="title" style={{ fontSize: 48 }}>{battle.outcome === 'victory' ? 'Victory!' : 'Defeated'}</h1>
        </div>
      )}
    </div>
  );
}

function placingText(p: Placement): string {
  switch (p.type) {
    case 'shape': return `${p.source}: place the ${p.cells.length}-tile shape (${p.damage} damage each)`;
    case 'hit': return `${p.source}: deal ${p.damage} damage to a tile`;
    case 'stone': return `${p.source}: place a Stone (${p.damage} damage; becomes a Stone if it breaks the tile)`;
    case 'line': return `${p.source}: ${p.damage} damage to ${p.length} in a line`;
  }
}

function PlacingBanner({ pending, orientation, onOrientation, aimed }: { pending: Placement; orientation: 'h' | 'v'; onOrientation: (o: 'h' | 'v') => void; aimed: boolean }) {
  const queued = useStore((s) => activeBattle(s)?.pending.length ?? 0);
  return (
    <div className="placing panel">
      <span>{placingText(pending)}{queued > 1 ? ` · ${queued} to place` : ''}</span>
      <span className="dim">{aimed ? 'Tap again to confirm' : 'Tap where it goes'}</span>
      {pending.type === 'line' && (
        <button className="btn" onClick={() => onOrientation(orientation === 'h' ? 'v' : 'h')}>{orientation === 'h' ? '↔ Horizontal' : '↕ Vertical'}</button>
      )}
    </div>
  );
}

function BoardView({ view, battle, tile, selection, preview, highlight, hurt, onTap, onLong }: {
  view: ViewSnapshot; battle: BattleState; tile: number; selection: Pos | null; preview: Pos[] | null; highlight: Set<number>; hurt: Set<number>;
  onTap: (x: number, y: number) => void; onLong: (t: Tile) => void;
}) {
  const b = view.board;
  const inPreview = (x: number, y: number) => !!preview?.some((p) => p.x === x && p.y === y);
  return (
    <div className="board" style={{ width: b.width * tile + 6, height: b.height * tile + 6 }} role="grid" aria-label="Tool board">
      {b.cells.map((t, i) => {
        if (!t) return null;
        const x = i % b.width;
        const y = Math.floor(i / b.width);
        const sel = selection && selection.x === x && selection.y === y;
        return (
          <TileView key={t.uid} t={t} battle={battle} x={x} y={y} tile={tile} selected={!!sel} aimed={inPreview(x, y)}
            matched={highlight.has(t.uid)} hurt={hurt.has(t.uid)} onTap={() => onTap(x, y)} onLong={() => onLong(t)} />
        );
      })}
      {preview?.filter((p) => !b.cells[p.y * b.width + p.x]).map((p) => (
        <div key={`p${p.x},${p.y}`} className="aim-empty" style={{ width: tile, height: tile, transform: `translate(${p.x * tile + 3}px, ${p.y * tile + 3}px)` }} />
      ))}
    </div>
  );
}

export function tileLook(t: Tile, battle: BattleState): { name: string; icon: string; color: string; description: string } {
  if (t.kind === 'tool') {
    const tool = battle.tools[t.id];
    return { name: tool?.name ?? '?', icon: tool?.icon ?? '', color: tool?.color ?? '#555', description: content.tools[tool?.toolId ?? '']?.description ?? '' };
  }
  if (t.kind === 'junk') {
    const j = content.junk[t.id];
    return { name: j?.name ?? t.id, icon: j?.icon ?? '', color: j?.color ?? '#555', description: j?.description ?? '' };
  }
  if (t.kind === 'stone') return { name: STONE.name, icon: STONE.icon, color: STONE.color, description: STONE.description };
  const e = content.enemyTiles[t.id];
  return { name: e.name, icon: e.icon, color: e.color, description: e.description };
}

function TileView({ t, battle, x, y, tile, selected, aimed, matched, hurt, onTap, onLong }: {
  t: Tile; battle: BattleState; x: number; y: number; tile: number; selected: boolean; aimed: boolean; matched: boolean; hurt: boolean; onTap: () => void; onLong: () => void;
}) {
  const press = useLongPress(onTap, onLong);
  const look = tileLook(t, battle);
  const enemy = t.kind === 'enemy' ? content.enemyTiles[t.id] : null;
  const supportive = t.kind === 'tool' && (battle.tools[t.id]?.fruit.kindness ?? 0) > 0;
  const shining = t.kind === 'tool' && (battle.tools[t.id]?.fruit.joy ?? 0) > 0;
  const danger = enemy && y === battle.board.height - 1;
  return (
    <div className={`tile ${t.kind} ${selected ? 'selected' : ''} ${matched ? 'matched' : ''} ${aimed ? 'aimed' : ''} ${hurt ? 'hurt' : ''} ${danger ? 'danger' : ''}`}
      style={{ width: tile, height: tile, transform: `translate(${x * tile + 3}px, ${y * tile + 3}px)` }}
      role="gridcell" aria-label={`${look.name}, row ${y + 1} col ${x + 1}${t.hp < t.maxHp ? ', damaged' : ''}`} {...press}>
      <div style={{ background: `linear-gradient(160deg, ${look.color}, ${shade(look.color)})` }}>
        <Asset path={look.icon} alt={look.name} color="transparent" />
        {supportive && <span className="linked" />}
        {shining && <span className="shine" />}
        {t.kind === 'stone' && t.hp < t.maxHp && <span className="crack" />}
        {(enemy || (t.kind !== 'stone' && t.maxHp > 1)) && <span className="hp">{t.hp}</span>}
        {enemy && <span className="speed">{'↓'.repeat(enemy.speed)}</span>}
      </div>
    </div>
  );
}

function shade(hex: string) {
  const n = parseInt(hex.slice(1), 16);
  const f = (v: number) => Math.max(0, Math.floor(v * 0.55));
  return `rgb(${f(n >> 16)}, ${f((n >> 8) & 255)}, ${f(n & 255)})`;
}

function TileInfo({ tile, battle, onClose }: { tile: Tile; battle: BattleState; onClose: () => void }) {
  const look = tileLook(tile, battle);
  const tool = tile.kind === 'tool' ? battle.tools[tile.id] : null;
  const fruits = tool ? (Object.entries(tool.fruit) as [keyof typeof tool.fruit, number][]).filter(([, n]) => n > 0) : [];
  return (
    <Modal onClose={onClose}>
      <div className="row">
        <Asset path={look.icon} alt={look.name} size={48} color={look.color} />
        <div>
          <h2>{look.name} <span className="dim" style={{ fontSize: 14 }}>HP {tile.hp}/{tile.maxHp}</span></h2>
          <div>{look.description}</div>
          {fruits.length > 0 && <div className="dim">{fruits.map(([f, n]) => `${content.fruits[f].name}${n > 1 ? ` ×${n}` : ''} (${content.fruits[f].keyword})`).join(', ')}</div>}
        </div>
      </div>
      <div className="actions"><button className="btn" onClick={onClose}>OK</button></div>
    </Modal>
  );
}

/** Enemy popup: its setup description (pattern and totals) and its tile types. */
export function EnemyInfo({ enemyId, onClose }: { enemyId: string; onClose: () => void }) {
  const def = content.enemies[enemyId];
  const tileIds = [...new Set(def.generator.flatMap((r) => (r === 'normal' ? [] : [r.tile])))];
  return (
    <Modal onClose={onClose}>
      <div className="row">
        <Asset path={def.portrait} alt={def.name} size={64} color="#5a2a2a" />
        <div style={{ flex: 1 }}>
          <h2>{def.name} <span className="dim" style={{ fontSize: 14 }}>{def.tier}</span></h2>
          <div>{def.description}</div>
          {tileIds.map((id) => {
            const t = content.enemyTiles[id];
            return <div key={id} className="dim" style={{ marginTop: 6 }}><b>{t.name}</b> (HP {t.hp}, speed {t.speed}): {t.description}</div>;
          })}
        </div>
      </div>
      <div className="actions"><button className="btn" onClick={onClose}>OK</button></div>
    </Modal>
  );
}
