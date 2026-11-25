// Battle screen (combat § 8): portrait. The 8×8 board on top; your panel (left) and the enemy panel (right) below.
// The engine has already resolved each action; this screen plays its events back one at a time.

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { content } from '../../content';
import { genCell } from '../../content/enemies';
import { enemyTileSpeed, incomingHits, isLocked, pendingGroupSize, placementCells, previewPlacements, snapshot, upcomingGrid } from '../../engine/combat';
import type { BattleState, Placement, Pos, Tile, TimedEvent, ViewSnapshot } from '../../engine/types';
import { activeBattle, useStore } from '../../state/store';
import { AbilityBar, Asset, HpBar, Modal, openStatus, openTile, Parts, TileIcon, TopBar, useLongPress, toolTint } from '../components/common';
import { describeTile, placementStats, tileRef } from '../../content/describe';
import { PatternGrid } from '../components/EnemyPattern';

const DURATION: Record<TimedEvent['event']['type'], number> = {
  swapped: 200, matched: 280, effect: 420, damaged: 260, removed: 260, collapsed: 260, shining: 320, enemyStep: 160,
  playerHit: 320, locked: 300, strengthened: 300, created: 400, enemyTurn: 0, ability: 200, turnStart: 160, battleEnd: 700,
};

interface Floater { id: number; text: string; cls: string }
let floaterId = 1;
/** Largest tile, in px, so the board doesn't become huge on a big monitor. */
const TILE_MAX = 96;
/** Narrowest side column (instruction and panels) beside the board in the wide layout. */
const SIDE_MIN = 260;

export function BattleScreen() {
  const battle = useStore((s) => activeBattle(s))!;
  const playback = useStore((s) => s.playback);
  const selection = useStore((s) => s.selection);
  const orientation = useStore((s) => s.orientation);
  const { selectTile, confirmPlacement, ability, endTurn, advance, fastForward, setOrientation } = useStore.getState();
  const busy = playback.queue.length > 0 || playback.current !== null;
  // While events play, show their frames; once idle, show the battle as it really is (e.g. waiting for a placement).
  const view = busy && playback.view ? playback.view : snapshot(battle, content);
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

  // Square tiles sized to the screen. Wider than tall: the board fills the height and the panels sit beside it.
  // Taller than wide: the board fills the width and the panels sit below it.
  const bodyRef = useRef<HTMLDivElement>(null);
  const [layout, setLayout] = useState({ tile: 44, wide: false });
  useLayoutEffect(() => {
    const el = bodyRef.current;
    if (!el) return;
    const measure = () => {
      const w = el.clientWidth, h = el.clientHeight;
      const wide = w > h;
      const room = wide ? Math.min(h - 18, w - SIDE_MIN - 24) : Math.min(w - 16, h - 260);
      setLayout({ tile: Math.max(30, Math.min(TILE_MAX, Math.floor(room / 8))), wide });
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const { tile, wide } = layout;

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

  // Placement (combat § 5): tap to choose targets — every hit of the group (Prophecy's hits, the Word's Stones, a
  // doubled Prayer) is chosen first — the preview shows the damage and ✕ on tiles that break, then Continue or
  // Select again. The choice is forgotten whenever the pending placements (or the orientation) change.
  const pickKey = `${battle.pending.length}:${battle.nextUid}:${orientation}`;
  const [pickState, setPickState] = useState<{ key: string; taps: Pos[] } | null>(null);
  const taps = pickState?.key === pickKey ? pickState.taps : [];
  const pending = view.phase === 'placing' && !busy ? view.pending : null;
  const group = pending ? pendingGroupSize(battle) : 0;
  const targets = pending ? taps.map((t) => anchorFor(pending, t, orientation, battle.board.width, battle.board.height)) : [];
  const preview = pending && targets.length ? previewPlacements(battle, targets, orientation) : null;
  const onTap = (x: number, y: number) => {
    if (busy) return;
    if (battle.phase === 'placing') {
      const tap = { x, y };
      // Tapping a tile that's already chosen (or inside a chosen shape or line) unselects that choice.
      let hitIndex = -1;
      targets.forEach((t, i) => {
        if (pending && (placementCells(battle, pending, t, orientation) ?? []).some((c) => c.x === x && c.y === y)) hitIndex = i;
      });
      const next = hitIndex >= 0 ? taps.filter((_, i) => i !== hitIndex)
        : group <= 1 ? [tap] : taps.length < group ? [...taps, tap] : [...taps.slice(0, -1), tap];
      setPickState({ key: pickKey, taps: next });
      return;
    }
    selectTile({ x, y });
  };
  const confirm = () => {
    if (targets.length === group) confirmPlacement(targets);
  };

  const highlight = new Set<number>(current?.type === 'matched' || current?.type === 'shining' || current?.type === 'created' || current?.type === 'locked' || current?.type === 'strengthened' ? current.uids : []);
  const hurt = new Set<number>(current?.type === 'damaged' || current?.type === 'removed' ? current.uids : []);
  const [enemyInfo, setEnemyInfo] = useState(false);
  const enemy = content.enemies[battle.enemyId];
  const maxMoves = Math.max(battle.player.movesPerTurn, view.movesLeft);
  const enemyPress = useLongPress(() => setEnemyInfo(true), () => setEnemyInfo(true));
  // Enemy tiles that will hit you this enemy turn (from any row), once the board has settled on your turn.
  const danger = useMemo(() => (busy ? new Set<number>() : incomingHits(battle, content)), [battle, busy]);

  const board = (
    <BoardView view={view} battle={battle} tile={tile} selection={selection} preview={preview} ghost={pending?.onDestroy ? describeTile(pending.onDestroy).icon : null} placing={!!pending} applyMark={pending?.apply === 'locked' ? '🔒' : pending?.apply === 'strengthen' ? `+${pending.applyAmount ?? 1}` : ''} highlight={highlight} hurt={hurt} danger={danger}
      onTap={onTap} onLong={(t) => openTile(tileRef(t, battle), t)} />
  );

  return (
    <div className="screen battle" onPointerDownCapture={() => busy && playback.queue.length > 2 && fastForward()}>
      <TopBar>
        <span className="chip">Turn {view.round}</span>
        <span className="spacer" />
        <span className="dim log">{log}</span>
      </TopBar>
      <div className={`battle-body ${wide ? 'wide' : 'tall'}`} ref={bodyRef}>
        {wide && board}
        <div className="battle-side">
          <div className={`instruction panel ${pending ? 'active' : ''}`}>
            <span className="instruction-icon" aria-hidden={!pending?.sourceTile}>
              {pending?.sourceTile && <TileIcon tile={pending.sourceTile} size={34} battle={battle} />}
            </span>
            {pending ? (
              <PlacingBanner pending={pending} group={group} chosen={targets.length} orientation={orientation} onOrientation={setOrientation}
                onContinue={confirm} onAgain={() => setPickState(null)} />
            ) : (
              <span className="dim instruction-text">{busy ? '…' : battle.phase === 'player' ? (selection ? 'Tap a neighbouring tile to swap' : 'Tap a tile, then a neighbour to swap them') : ''}</span>
            )}
          </div>
          {!wide && board}
          <div className="battle-panels">
            <div className="panel player-panel">
              <b>You</b>
              <HpBar hp={view.player.hp} max={view.player.maxHp} green />
              <div className="stat-row">
                <StatusChip id="block" text={`${view.player.block}`} value={view.player.block} />
                {view.player.critical > 0 && <StatusChip id="critical" text={`×${view.player.critical}`} value={view.player.critical} />}
                {view.player.momentum > 0 && (
                  <StatusChip id="momentum" value={view.player.momentum}
                    text={`${view.player.momentum} (+${Math.floor(view.player.momentum / content.config.momentumPerBonus)})`} />
                )}
                {view.player.foresight > 0 && (
                  <StatusChip id="foresight" value={view.player.foresight}
                    text={`${view.player.foresight} (+${Math.floor(view.player.foresight / content.config.foresightPerBonus)})`} />
                )}
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
              <PatternGrid rows={upcomingGrid(content, battle.enemyId, view.genPos)} cell={Math.max(6, Math.min(11, Math.floor(tile / 5)))} label="Coming next" />
              <div style={{ fontSize: 12 }}>On board <b>{view.enemyOnBoard}</b> · To come <b>{view.enemyToCome}</b></div>
              <div className="dim" style={{ fontSize: 11 }}>(hold for info)</div>
            </div>
          </div>
        </div>
      </div>
      {enemyInfo && <EnemyInfo enemyId={battle.enemyId} view={view} onClose={() => setEnemyInfo(false)} />}
      {battle.outcome && !busy && (
        <div className="modal-back" style={{ background: 'rgba(0,0,0,0.4)' }}>
          <h1 className="title outcome-title">{battle.outcome === 'victory' ? 'Victory!' : 'Defeated'}</h1>
        </div>
      )}
    </div>
  );
}

/** A status chip on your panel: its icon and amount. Tap or hold it for the status popup. */
function StatusChip({ id, text, value }: { id: string; text: string; value: number }) {
  const def = content.statuses[id];
  const open = () => openStatus(id, value);
  const press = useLongPress(open, open);
  return (
    <span className={`chip status-chip s-${id}`} role="button" aria-label={`${def.name} ${value}: hold for details`} {...press}>
      <Asset path={def.icon} alt={def.name} size={18} color="#333" /> {text}
    </span>
  );
}

/** "Prayer: Targets: Choose shape (3 tiles) · Dmg: 3", plus "· On destroy: Create [icon]" when it creates a tile. */
function PlacingText({ p, n }: { p: Placement; n: number }) {
  const d = placementStats(p, n);
  return (
    <>
      {p.source}: Targets: {d.targets} · Dmg: {d.dmg}
      {d.onDestroy && <> · On destroy: Create <TileIcon tile={d.onDestroy} size={18} /></>}
      {d.apply && <> · Apply: <Parts parts={d.apply} size={18} /></>}
    </>
  );
}

/** Where a placement goes for a tapped cell: shapes and lines are centred on it, then kept on the board. */
export function anchorFor(p: Placement, tap: Pos, orientation: 'h' | 'v', width: number, height: number): Pos {
  const clamp = (v: number, max: number) => Math.max(0, Math.min(max, v));
  const t = p.target;
  if (t.type === 'shape') {
    const w = Math.max(...t.cells.map((c) => c.x)) + 1;
    const h = Math.max(...t.cells.map((c) => c.y)) + 1;
    const mid = t.cells[Math.floor(t.cells.length / 2)];
    return { x: clamp(tap.x - mid.x, width - w), y: clamp(tap.y - mid.y, height - h) };
  }
  if (t.type === 'line') {
    const back = Math.floor(t.length / 2);
    return orientation === 'h' ? { x: clamp(tap.x - back, width - t.length), y: tap.y } : { x: tap.x, y: clamp(tap.y - back, height - t.length) };
  }
  return tap;
}

function PlacingBanner({ pending, group, chosen, orientation, onOrientation, onContinue, onAgain }: {
  pending: Placement; group: number; chosen: number; orientation: 'h' | 'v'; onOrientation: (o: 'h' | 'v') => void; onContinue: () => void; onAgain: () => void;
}) {
  const ready = chosen === group;
  return (
    <div className="placing instruction-text">
      <span><b><PlacingText p={pending} n={group} /></b></span>
      {pending.target.type === 'line' && (
        <button className="btn" onClick={() => onOrientation(orientation === 'h' ? 'v' : 'h')}>{orientation === 'h' ? '↔ Horizontal' : '↕ Vertical'}</button>
      )}
      {chosen === 0 ? (
        <span className="dim">Tap the board to choose where. Tap a chosen tile again to unselect it.</span>
      ) : (
        <span className="placing-actions">
          {group > 1 && <span className={ready ? '' : 'dim'}>{chosen} / {group} chosen</span>}
          <button className="btn" onClick={onAgain}>Select again</button>
          <button className="btn primary" disabled={!ready} onClick={onContinue}>Continue</button>
        </span>
      )}
    </div>
  );
}

function BoardView({ view, battle, tile, selection, preview, ghost, placing, applyMark, highlight, hurt, danger, onTap, onLong }: {
  view: ViewSnapshot; battle: BattleState; tile: number; selection: Pos | null; preview: ReturnType<typeof previewPlacements> | null; ghost: string | null;
  placing: boolean; applyMark: string; highlight: Set<number>; hurt: Set<number>; danger: Set<number>;
  onTap: (x: number, y: number) => void; onLong: (t: Tile) => void;
}) {
  const b = view.board;
  return (
    <div className={`board ${placing ? 'placing-mode' : ''} ${preview ? 'has-aim' : ''}`} style={{ width: b.width * tile + 6, height: b.height * tile + 6 }} role="grid" aria-label="Tool board">
      {b.cells.map((t, i) => {
        if (!t) return null;
        const x = i % b.width;
        const y = Math.floor(i / b.width);
        const sel = selection && selection.x === x && selection.y === y;
        return (
          <TileView key={t.uid} t={t} battle={battle} x={x} y={y} tile={tile} selected={!!sel}
            aimed={!!preview?.damage.has(t.uid)} applyMark={applyMark} locked={isLocked(t, view.round)}
            incoming={preview?.damage.get(t.uid) ?? 0} breaks={!!preview?.deleted.has(t.uid)} ghost={preview?.deleted.has(t.uid) ? ghost : null}
            matched={highlight.has(t.uid)} hurt={hurt.has(t.uid)} danger={danger.has(t.uid)} onTap={() => onTap(x, y)} onLong={() => onLong(t)} />
        );
      })}
    </div>
  );
}

/** A board tile's name, icon and colour (the popup itself is common.tsx's TilePopup). */
export function tileLook(t: Tile, battle: BattleState) {
  return describeTile(tileRef(t, battle), { battle });
}

function TileView({ t, battle, x, y, tile, selected, aimed, applyMark, locked, incoming, breaks, ghost, matched, hurt, danger, onTap, onLong }: {
  t: Tile; battle: BattleState; x: number; y: number; tile: number; selected: boolean; aimed: boolean; applyMark: string; locked: boolean;
  incoming: number; breaks: boolean; ghost: string | null; matched: boolean; hurt: boolean; danger: boolean; onTap: () => void; onLong: () => void;
}) {
  const press = useLongPress(onTap, onLong);
  const look = tileLook(t, battle);
  const enemy = t.kind === 'enemy' ? content.enemyTiles[t.id] : null;
  const supportive = t.kind === 'tool' && (battle.tools[t.id]?.fruit.kindness ?? 0) > 0;
  const shining = t.kind === 'tool' && (battle.tools[t.id]?.fruit.joy ?? 0) > 0;
  return (
    <div className={`tile ${t.kind} ${selected ? 'selected' : ''} ${matched ? 'matched' : ''} ${aimed ? 'aimed' : ''} ${hurt ? 'hurt' : ''} ${danger ? 'danger' : ''}`}
      style={{ width: tile, height: tile, transform: `translate(${x * tile + 3}px, ${y * tile + 3}px)` }}
      role="gridcell" aria-label={`${look.name}, row ${y + 1} col ${x + 1}${t.hp < t.maxHp ? ', damaged' : ''}${locked ? ', locked' : ''}${danger ? ', will hit you this enemy turn' : ''}${t.strength ? `, strengthened +${t.strength}` : ''}`} {...press}>
      <div style={{ background: t.kind === 'tool' ? toolTint(look.color) : `linear-gradient(160deg, ${look.color}, ${shade(look.color)})` }}>
        <Asset path={look.icon} frame={look.frame} alt={look.name} color="transparent" />
        {supportive && <span className="linked" />}
        {shining && <span className="shine" />}
        {t.kind === 'stone' && t.hp < t.maxHp && <span className="crack" />}
        {(enemy || (t.kind !== 'stone' && t.maxHp > 1)) && <span className="hp">{t.hp}</span>}
        {enemy && <span className="speed">{'↓'.repeat(enemyTileSpeed(content, battle.enemyId, t.id))}</span>}
        {ghost && <span className="stone-ghost" style={{ backgroundImage: `url(/assets/${ghost})` }} />}
        {breaks && <span className="breaks">✕</span>}
        {locked && <span className="locked" />}
        {(t.strength ?? 0) > 0 && <><span className="anointed" /><span className="strength"><img src={`/assets/${content.statuses.strengthen.icon}`} alt="" draggable={false} />+{t.strength}</span></>}
        {aimed && <span className="incoming">{incoming > 0 ? `−${incoming}` : ''}{applyMark}</span>}
      </div>
    </div>
  );
}

function shade(hex: string) {
  const n = parseInt(hex.slice(1), 16);
  const f = (v: number) => Math.max(0, Math.floor(v * 0.55));
  return `rgb(${f(n >> 16)}, ${f((n >> 8) & 255)}, ${f(n & 255)})`;
}

/**
 * Enemy popup: the picture of what's coming, then each enemy tile type as its icon with how many are left
 * (on the board + still to come) out of the total. Hold or tap an icon for that tile's description.
 */
export function EnemyInfo({ enemyId, view, onClose }: { enemyId: string; view: ViewSnapshot; onClose: () => void }) {
  const def = content.enemies[enemyId];
  const width = content.config.board.width;
  const total = new Map<string, number>();
  const toCome = new Map<string, number>();
  def.generator.forEach((r, row) => {
    for (let x = 0; x < width; x++) {
      const id = genCell(r, x);
      if (!id) continue;
      total.set(id, (total.get(id) ?? 0) + 1);
      if (row >= view.genPos[x]) toCome.set(id, (toCome.get(id) ?? 0) + 1);
    }
  });
  const onBoard = (id: string) => view.board.cells.filter((t) => t?.kind === 'enemy' && t.id === id).length;
  return (
    <Modal onClose={onClose}>
      <div className="row">
        <Asset path={def.portrait} alt={def.name} size={64} color="#5a2a2a" />
        <div style={{ flex: 1 }}>
          <h2>{def.name} <span className="dim" style={{ fontSize: 14 }}>{def.tier}</span></h2>
          <div className="dim pattern-cap">Coming next (the bottom row drops in first)</div>
          <PatternGrid rows={upcomingGrid(content, enemyId, view.genPos)} cell={18} label="Coming next" />
          <div className="enemy-tile-counts">
            {[...total].map(([id, n]) => (
              <EnemyTileCount key={id} id={id} left={onBoard(id) + (toCome.get(id) ?? 0)} total={n} />
            ))}
          </div>
        </div>
      </div>
      <div className="actions"><button className="btn" onClick={onClose}>OK</button></div>
    </Modal>
  );
}

function EnemyTileCount({ id, left, total }: { id: string; left: number; total: number }) {
  return (
    <div className="enemy-tile-count">
      <TileIcon tile={{ kind: 'enemy', id }} size={30} />
      <span>× <b>{left}</b> of {total} left</span>
    </div>
  );
}

