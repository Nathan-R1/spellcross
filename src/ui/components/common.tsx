// Shared UI pieces: asset images with placeholders, long-press, status icons, HP bars, modal, top bar.

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { content, assetExists } from '../../content';
import { describeAbility } from '../../content/describe';
import type { StatusInstance } from '../../engine/types';
import { useStore } from '../../state/store';
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

export function StatusRow({ statuses, max = 99, onPick }: { statuses: StatusInstance[]; max?: number; onPick?: (s: StatusInstance) => void }) {
  const shown = statuses.slice(0, max);
  return (
    <div className="statuses">
      {shown.map((s) => {
        const def = content.statuses[s.id];
        return (
          <span key={s.id} className="status" title={def?.name} onClick={() => onPick?.(s)}>
            <Asset path={def?.icon} alt={def?.name ?? s.id} size={20} />
            <b>{s.value}</b>
          </span>
        );
      })}
      {statuses.length > max && <span className="dim" style={{ fontSize: 12 }}>+{statuses.length - max}</span>}
    </div>
  );
}

export function Modal({ children, onClose }: { children: ReactNode; onClose?: () => void }) {
  return (
    <div className="modal-back" onPointerDown={(e) => e.target === e.currentTarget && onClose?.()}>
      <div className="modal panel" role="dialog" aria-modal="true">{children}</div>
    </div>
  );
}

export function StatusInfo({ s, onClose }: { s: StatusInstance; onClose: () => void }) {
  const def = content.statuses[s.id];
  return (
    <Modal onClose={onClose}>
      <div className="row">
        <Asset path={def?.icon} alt={def?.name ?? s.id} size={48} />
        <div>
          <h2>{def?.name ?? s.id}</h2>
          <div>{def?.description}</div>
          <div className="dim">Value: {s.value}{def?.family === 'weak' ? ' turn(s)' : ''}</div>
        </div>
      </div>
      <div className="actions"><button className="btn" onClick={onClose}>OK</button></div>
    </Modal>
  );
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
      <span className="chip"><Asset path="icons/heart.png" alt="HP" size={20} /> {p.hp}/{p.maxHp}</span>
      <span className="chip"><Asset path="icons/gold.png" alt="Gold" size={20} /> {p.gold}</span>
      <span className="chip"><Asset path="icons/gem.png" alt="Gems" size={20} /> {p.gems.length}</span>
      {p.spellUpgrades > 0 && <span className="chip">⬆ {p.spellUpgrades}</span>}
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

export function GemIcon({ gem, size = 14 }: { gem: keyof typeof content.gems; size?: number }) {
  return <i className="gem" style={{ background: content.gems[gem].color, width: size, height: size }} title={content.gems[gem].name} />;
}

/** Ability bar (top bar). In battle, tapping an ability opens its popup with a Trigger button. */
export function AbilityBar({ onTrigger }: { onTrigger?: (i: number) => void }) {
  const player = useStore((s) => s.run?.battle?.player ?? s.run?.player);
  const [open, setOpen] = useState<number | null>(null);
  if (!player) return null;
  const slots = Array.from({ length: player.maxAbilities }, (_, i) => player.abilities[i]);
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
