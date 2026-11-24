// Shared UI pieces: asset images with placeholders, long-press, status icons, HP bars, modal, top bar.

import { useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { content, assetExists } from '../../content';
import { describeAbility, describeTile, type AttrRow, type TileRef } from '../../content/describe';
import type { BattleState, FruitId, Tile } from '../../engine/types';
import { activeBattle, useStore } from '../../state/store';
import { enterFullscreen, exitFullscreen, fullscreenSupport, isFullscreen, onFullscreenChange } from '../fullscreen';

/** Image from public/assets with a generated placeholder (coloured circle + initial) when missing (doc 04). */
export function Asset({ path, alt, size, color = '#6b4523', className, style }: { path?: string; alt: string; size?: number; color?: string; className?: string; style?: React.CSSProperties }) {
  const [broken, setBroken] = useState(false);
  if (!path || broken || !assetExists(path)) {
    return (
      <span className={`ph ${className ?? ''}`} style={{ width: size, height: size, background: color, fontSize: size ? size * 0.5 : 14, ...style }} aria-label={alt}>
        {alt.charAt(0).toUpperCase()}
      </span>
    );
  }
  return <img src={`/assets/${path}`} alt={alt} width={size} height={size} className={className} style={style} onError={() => setBroken(true)} draggable={false} />;
}

/** Tap and long-press (~400ms) on the same element. A long-press suppresses the tap. */
export function useLongPress(onTap: () => void, onLong: () => void, ms = 400) {
  const timer = useRef<number | null>(null);
  const fired = useRef(false);
  const start = useRef<{ x: number; y: number } | null>(null);
  const clear = () => {
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = null;
  };
  return {
    onPointerDown: (e: React.PointerEvent) => {
      fired.current = false;
      start.current = { x: e.clientX, y: e.clientY };
      clear();
      timer.current = window.setTimeout(() => {
        fired.current = true;
        onLong();
      }, ms);
    },
    onPointerMove: (e: React.PointerEvent) => {
      if (start.current && Math.hypot(e.clientX - start.current.x, e.clientY - start.current.y) > 10) clear();
    },
    onPointerUp: () => {
      clear();
      if (!fired.current) onTap();
      start.current = null;
    },
    onPointerCancel: () => {
      clear();
      start.current = null;
    },
    onContextMenu: (e: React.MouseEvent) => e.preventDefault(),
  };
}

export function HpBar({ hp, max, green }: { hp: number; max: number; green?: boolean }) {
  return (
    <div className={`hpbar ${green ? 'green' : ''}`}>
      <i style={{ width: `${Math.max(0, (100 * hp) / max)}%` }} />
      <span>{hp}/{max}</span>
    </div>
  );
}

/** A popup over the whole app screen, wherever it's opened from (rendered at the app root). */
export function Modal({ children, onClose }: { children: ReactNode; onClose?: () => void }) {
  const back = (
    <div className="modal-back" onPointerDown={(e) => e.target === e.currentTarget && onClose?.()}>
      <div className="modal panel" role="dialog" aria-modal="true">{children}</div>
    </div>
  );
  const root = typeof document !== 'undefined' ? document.querySelector('.app') : null;
  return root ? createPortal(back, root) : back;
}

// ---------------------------------------------------------------- tile icons and popups
// Any tile can be shown as a TileIcon; tapping or holding it opens that tile's popup. Popups form one stack at the
// app root (TilePopupHost): an icon inside a popup pushes another, Back pops one, OK closes them all. Only the top
// popup is drawn, so following icons back and forth (Word -> Stone, or X -> Y -> X ...) never nests popups.

interface TileEntry { ref: TileRef; live?: Tile | null }
let tileStack: TileEntry[] = [];
const tileListeners = new Set<() => void>();
const setTileStack = (next: TileEntry[]) => { tileStack = next; tileListeners.forEach((l) => l()); };
const subscribeTiles = (l: () => void) => { tileListeners.add(l); return () => { tileListeners.delete(l); }; };

/** Open a tile's popup on top of any already open. `live` is the board tile, for its current HP. */
export const openTile = (ref: TileRef, live?: Tile | null) => setTileStack([...tileStack, { ref, live }]);
export const closeTiles = () => setTileStack([]);
const backTile = () => setTileStack(tileStack.slice(0, -1));

/** A tile's icon on its colour. Tap or hold it for the tile's popup. */
export function TileIcon({ tile, size = 22, battle }: { tile: TileRef; size?: number; battle?: BattleState | null }) {
  const d = describeTile(tile, { battle });
  // `battle` only matters for tool icons (which instance's look); the popup reads the live context itself.
  const open = () => openTile(tile);
  const press = useLongPress(open, open);
  return (
    <span className={`tile-icon tile-ref k-${tile.kind}`} style={{ background: d.color }} role="button" aria-label={`${d.name}: hold for details`} {...press}>
      <Asset path={d.icon} alt={d.name} size={size} color="transparent" />
    </span>
  );
}

/**
 * Trigger and effect lines (tile-effects.md § 4): a trigger, its effects indented under it, and each effect's
 * sub-properties under that. Text and tile icons; every icon opens that tile's popup.
 */
export function Attrs({ rows }: { rows: AttrRow[] }) {
  if (!rows.length) return null;
  return (
    <dl className="damage-attrs">
      {rows.map((r, i) => (
        <div key={i} className={`attr d${r.depth}`}>
          {r.label && <dt>{r.label}:</dt>}{' '}
          <dd>{r.parts.map((p, j) => (typeof p === 'string' ? <span key={j}>{p}</span> : <TileIcon key={j} tile={p} />))}</dd>
        </div>
      ))}
    </dl>
  );
}

/** A description followed by trigger lines (either may be empty). */
export function EffectText({ description, rows }: { description: string; rows: AttrRow[] }) {
  return (
    <>
      {description && <div>{description}</div>}
      <Attrs rows={rows} />
    </>
  );
}

/** The one tile popup layout: icon, name, HP and Speed, description, attribute lines, fruit. */
export function TilePopup({ entry, depth }: { entry: TileEntry; depth: number }) {
  const battle = useStore((s) => activeBattle(s));
  const player = useStore((s) => s.quick?.player ?? s.run?.player ?? null);
  const enemyId = useStore((s) => s.quick?.enemyId ?? s.run?.prep?.enemyId ?? null);
  const d = describeTile(entry.ref, { battle, player, enemyId: battle?.enemyId ?? enemyId }, entry.live);
  return (
    <Modal onClose={closeTiles}>
      <div className="row tile-popup">
        <span className="tile-icon" style={{ background: d.color }}><Asset path={d.icon} alt={d.name} size={44} color="transparent" /></span>
        <div>
          <h2>{d.name} <span className="dim" style={{ fontSize: 14 }}>HP {d.hp}/{d.maxHp} · Speed: {d.speed}</span></h2>
          <EffectText description={d.description} rows={d.attrs} />
          {d.fruits.length > 0 && <div className="dim">{d.fruits.map(([f, n]) => `${content.fruits[f].name}${n > 1 ? ` ×${n}` : ''} (${content.fruits[f].keyword})`).join(', ')}</div>}
        </div>
      </div>
      <div className="actions">
        {depth > 1 && <button className="btn" onClick={backTile}>Back</button>}
        <button className="btn" onClick={closeTiles}>OK</button>
      </div>
    </Modal>
  );
}

/** Mount once at the app root: draws the top of the tile popup stack. */
export function TilePopupHost() {
  const stack = useSyncExternalStore(subscribeTiles, () => tileStack, () => tileStack);
  if (!stack.length) return null;
  return <TilePopup key={stack.length} entry={stack[stack.length - 1]} depth={stack.length} />;
}

export function TopBar({ children, onExit }: { children?: ReactNode; onExit?: () => void }) {
  const toTitle = useStore((s) => s.toTitle);
  return (
    <div className="topbar">
      <button className="btn icon" onClick={onExit ?? toTitle} aria-label="Exit to title">✕</button>
      {children}
    </div>
  );
}

export function PlayerStats() {
  const p = useStore((s) => s.run?.player);
  if (!p) return null;
  return (
    <>
      <span className="chip" title="Courage"><Asset path="icons/heart.png" alt="Courage" size={20} /> {p.hp}/{p.maxHp}</span>
      <span className="chip" title="Talents"><Asset path="icons/gold.png" alt="Talents" size={20} /> {p.gold}</span>
      <span className="chip" title="Fruit"><Asset path="fruits/love.svg" alt="Fruit" size={20} /> {p.fruits.length}</span>
      {p.upgrades > 0 && <span className="chip" title="Upgrades">⬆ {p.upgrades}</span>}
    </>
  );
}

/** Full screen toggle (main menu). On iPhone it explains Add to Home Screen instead. Hidden when there's nothing to do. */
export function FullscreenButton() {
  const [support] = useState(fullscreenSupport);
  const [on, setOn] = useState(() => support === 'api' && isFullscreen());
  const [tip, setTip] = useState(false);
  useEffect(() => (support === 'api' ? onFullscreenChange(() => setOn(isFullscreen())) : undefined), [support]);
  if (support === 'none' || support === 'installed') return null;
  return (
    <>
      <button className="btn fullscreen-btn" aria-pressed={on} onClick={() => (support === 'api' ? (on ? exitFullscreen() : enterFullscreen()) : setTip(true))}>
        {on ? '⤡ Exit full screen' : '⤢ Full screen'}
      </button>
      {tip && (
        <Modal onClose={() => setTip(false)}>
          <h2>Play full screen</h2>
          <div>Safari on iPhone can't hide its bars for web pages. To play full screen, tap <b>Share</b>, then <b>Add to Home Screen</b>, and open Spellcross from your home screen.</div>
          <div className="actions"><button className="btn" onClick={() => setTip(false)}>OK</button></div>
        </Modal>
      )}
    </>
  );
}

export function Toasts() {
  const toasts = useStore((s) => s.toasts);
  return <div className="toasts">{toasts.map((t) => <div key={t.id} className="toast">{t.text}</div>)}</div>;
}

export function FruitIcon({ fruit, size = 20 }: { fruit: FruitId; size?: number }) {
  const def = content.fruits[fruit];
  return <Asset path={def.icon} alt={def.name} size={size} color="#6b8e23" />;
}

/** Ability bar (top bar). In battle, tapping an ability opens its popup with a Trigger button. */
export function AbilityBar({ onTrigger }: { onTrigger?: (i: number) => void }) {
  const player = useStore((s) => activeBattle(s)?.player ?? s.run?.player);
  const [open, setOpen] = useState<number | null>(null);
  if (!player) return null;
  const max = 'maxAbilities' in player ? player.maxAbilities : Math.max(player.abilities.length, 1);
  const slots = Array.from({ length: max }, (_, i) => player.abilities[i]);
  const openAbility = open !== null ? player.abilities[open] : undefined;
  const def = openAbility ? content.abilities[openAbility.id] : undefined;
  return (
    <div className="ability-bar">
      {slots.map((a, i) =>
        a ? (
          <button key={i} className="ability" onClick={() => setOpen(i)} aria-label={content.abilities[a.id].name}>
            <Asset path={content.abilities[a.id].icon} alt={content.abilities[a.id].name} size={30} />
            <b>{a.uses}</b>
          </button>
        ) : (
          <span key={i} className="ability empty" />
        ),
      )}
      {def && openAbility && (
        <Modal onClose={() => setOpen(null)}>
          <div className="row">
            <Asset path={def.icon} alt={def.name} size={56} />
            <div>
              <h2>{def.name}</h2>
              <div className="dim" style={{ fontStyle: 'italic' }}>{def.description}</div>
              <Attrs rows={describeAbility(def).rows} />
              <ul style={{ margin: '6px 0', paddingLeft: 18 }}>
                {describeAbility(def).lines.map((l) => <li key={l}>{l}</li>)}
              </ul>
              <div className="dim">Uses left: {openAbility.uses}/{def.maxUses} · {def.rarity}</div>
            </div>
          </div>
          <div className="actions">
            <button className="btn" onClick={() => setOpen(null)}>Close</button>
            {onTrigger && (
              <button className="btn primary" disabled={openAbility.uses <= 0} onClick={() => { onTrigger(open!); setOpen(null); }}>
                Trigger
              </button>
            )}
          </div>
        </Modal>
      )}
    </div>
  );
}

export function useNow(intervalMs: number) {
  const [now, setNow] = useState(() => performance.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(performance.now()), intervalMs);
    return () => window.clearInterval(id);
  }, [intervalMs]);
  return now;
}
