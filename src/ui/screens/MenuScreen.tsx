// Animated night-sky menu scene (features §2, D11): one wide landscape with the choices laid out left to right
// along the ground. The scene widens with the window so it always fills the screen. Objects lift on press, then
// act after 150ms.

import { useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createRng } from '../../engine/rng';
import { useStore } from '../../state/store';
import { FullscreenButton, Modal } from '../components/common';

type ObjId = 'pathway' | 'hut' | 'fight' | 'chasm' | 'tree';

/** Scene height in SVG units; the width follows the window's aspect ratio, between these bounds. */
const H = 600;
const GROUND = 470;
const MIN_W = 900;
const MAX_W = 2000;
/** Where each choice stands, left to right, measured from the centre of the scene. */
const SLOT = { hut: -315, pathway: -105, fight: 105, chasm: 315 } as const;

/** A jagged mountain ridge across the widest scene, as a closed path down to the ground. */
function ridge(seed: number, top: number, spread: number): string {
  const r = createRng(seed);
  const half = MAX_W / 2 + 100;
  const pts: string[] = [];
  for (let x = -half, up = true; x <= half; x += 90 + r.next() * 80, up = !up) {
    pts.push(`${x.toFixed(0)} ${(up ? top + r.next() * spread * 0.4 : top + spread * 0.6 + r.next() * spread * 0.4).toFixed(0)}`);
  }
  return `M${-half} ${GROUND} L${pts.join(' L')} L${half} ${GROUND}Z`;
}

export function MenuScreen() {
  const { hasSave, newRun, continueRun, abandonRun, openQuickFight } = useStore();
  const [lifted, setLifted] = useState<ObjId | null>(null);
  const [confirmAbandon, setConfirmAbandon] = useState(false);
  const [confirmNew, setConfirmNew] = useState(false);

  // Scene width from the screen's shape, so a wide window shows more sky and hills instead of letterboxing.
  const ref = useRef<HTMLDivElement>(null);
  const [w, setW] = useState(H * (16 / 9));
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => {
      const aspect = el.clientHeight > 0 ? el.clientWidth / el.clientHeight : 16 / 9;
      setW(Math.round(Math.max(MIN_W, Math.min(MAX_W, H * aspect))));
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const stars = useMemo(() => {
    const r = createRng(7);
    return Array.from({ length: 150 }, () => ({ x: r.next() - 0.5, y: r.next() * 330, s: 0.6 + r.next() * 1.6, d: r.next() * 3 }));
  }, []);
  const ridges = useMemo(() => [ridge(11, 250, 140), ridge(12, 320, 110), ridge(13, 380, 80)], []);
  const trees = [-470, 470, ...(w >= 1300 ? [-(w / 2 - 110), w / 2 - 110] : [])];

  const act = (id: ObjId) => {
    if ((id === 'hut' || id === 'chasm') && !hasSave) return;
    if (id === 'tree') return;
    setLifted(id);
    window.setTimeout(() => {
      setLifted(null);
      if (id === 'pathway') {
        if (hasSave) setConfirmNew(true);
        else newRun();
      }
      if (id === 'hut') continueRun();
      if (id === 'fight') openQuickFight();
      if (id === 'chasm') setConfirmAbandon(true);
    }, 150);
  };

  const cls = (id: ObjId, enabled = true) => `obj ${lifted === id ? 'lift' : ''} ${enabled ? '' : 'disabled'}`;
  const press = (id: ObjId) => ({
    onPointerDown: () => setLifted(id),
    onPointerLeave: () => lifted === id && setLifted(null),
    onClick: () => act(id),
    role: 'button',
    tabIndex: 0,
    onKeyDown: (e: React.KeyboardEvent) => e.key === 'Enter' && act(id),
  });
  const at = (x: number) => `translate(${x} ${GROUND})`;

  return (
    <div className="screen menu" ref={ref}>
      <svg viewBox={`${-w / 2} 0 ${w} ${H}`} preserveAspectRatio="xMidYMid meet">
        <defs>
          <linearGradient id="sky" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0" stopColor="#0b1030" />
            <stop offset="0.6" stopColor="#2a2350" />
            <stop offset="1" stopColor="#5a3a58" />
          </linearGradient>
          <radialGradient id="glow"><stop offset="0" stopColor="#ffe9a8" stopOpacity="0.8" /><stop offset="1" stopColor="#ffe9a8" stopOpacity="0" /></radialGradient>
        </defs>
        <rect x={-w / 2} width={w} height={GROUND} fill="url(#sky)" />
        {stars.map((s, i) => <circle key={i} className="twinkle" cx={s.x * w} cy={s.y} r={s.s} fill="#fff" style={{ animationDelay: `${s.d}s` }} />)}
        <circle cx={w / 2 - 170} cy="95" r="38" fill="#f6efd0" opacity="0.9" />
        <path d={ridges[0]} fill="#2c2546" />
        <path d={ridges[1]} fill="#231c38" />
        <path d={ridges[2]} fill="#1a1529" />
        <rect x={-w / 2} y={GROUND} width={w} height={H - GROUND} fill="#1d2a1a" />
        <rect x={-w / 2} y={GROUND} width={w} height="4" fill="#3a5a30" />

        {/* Trees: decorative (D11) */}
        {trees.map((x) => (
          <g key={x} className="obj" transform={at(x)}>
            <rect x="-7" y="-76" width="14" height="78" fill="#4a2f17" />
            <circle cx="0" cy="-86" r="38" fill="#24402a" />
            <circle cx="-23" cy="-70" r="26" fill="#2c4d32" />
            <circle cx="25" cy="-72" r="24" fill="#2c4d32" />
          </g>
        ))}

        {/* Hut → Continue run */}
        <g className={cls('hut', hasSave)} {...press('hut')}>
          <g transform={at(SLOT.hut)}>
            <ellipse className="glow" cx="0" cy="-20" rx="95" ry="55" fill="url(#glow)" />
            <rect x="-50" y="-60" width="100" height="60" fill="#5c3a18" />
            <path d="M-62 -56 L0 -104 L62 -56Z" fill="#7a4d20" />
            <rect x="-12" y="-36" width="22" height="36" fill="#2b1b0e" />
            <rect x="-38" y="-46" width="18" height="16" fill={hasSave ? '#ffd36b' : '#2b1b0e'} />
            <text className="label" y="55" textAnchor="middle" fontSize="24">Continue run</text>
          </g>
        </g>

        {/* Pathway: a path winding into the hills, with a walking figure → New run */}
        <g className={cls('pathway')} {...press('pathway')}>
          <g transform={at(SLOT.pathway)}>
            <ellipse className="glow" cx="0" cy="40" rx="120" ry="60" fill="url(#glow)" />
            <path d="M-60 130 C-30 90 20 80 5 50 C-5 30 20 20 15 5 L25 5 C32 22 10 32 20 52 C40 85 0 95 60 130Z" fill="#8a6a44" />
            <g>
              <animateMotion dur="8s" repeatCount="indefinite" path="M0 125 C10 90 15 70 12 50 C8 30 18 18 20 6" />
              <circle r="4" cy="-10" fill="#f4e7cf" />
              <rect x="-3" y="-7" width="6" height="9" fill="#f4e7cf" />
              <animate attributeName="opacity" values="1;1;0" keyTimes="0;0.8;1" dur="8s" repeatCount="indefinite" />
            </g>
            <text className="label" y="55" textAnchor="middle" fontSize="24">{hasSave ? 'New run' : 'Begin your journey'}</text>
          </g>
        </g>

        {/* Crossed swords planted in the ground → Quick fight */}
        <g className={cls('fight')} {...press('fight')}>
          <g transform={at(SLOT.fight)}>
            <ellipse className="glow" cx="0" cy="-30" rx="90" ry="60" fill="url(#glow)" />
            {[-1, 1].map((side) => (
              <g key={side} transform={`translate(${side * -26} 2) rotate(${side * 22})`}>
                <path d="M-3 0 L-3 -72 L3 -72 L3 0 L0 6Z" fill="#cfd6de" stroke="#5d6670" strokeWidth="1" />
                <rect x="-15" y="-77" width="30" height="6" rx="2" fill="#b08a3a" />
                <rect x="-3" y="-95" width="6" height="18" fill="#5c3a18" />
                <circle cy="-98" r="5" fill="#b08a3a" />
              </g>
            ))}
            <text className="label" y="55" textAnchor="middle" fontSize="24">⚔ Fight</text>
            <text className="label sub" y="78" textAnchor="middle" fontSize="14">Battle an enemy now</text>
          </g>
        </g>

        {/* Chasm → Abandon run (with confirmation) */}
        <g className={cls('chasm', hasSave)} {...press('chasm')}>
          <g transform={at(SLOT.chasm)}>
            <ellipse className="glow" cx="0" cy="10" rx="95" ry="40" fill="url(#glow)" />
            <path d="M-70 10 Q-50 -6 -20 2 Q5 -10 30 2 Q60 -4 70 12 Q40 30 0 26 Q-40 32 -70 10Z" fill="#05040a" />
            <text className="label" y="55" textAnchor="middle" fontSize="24">Abandon run</text>
          </g>
        </g>

        <text x="0" y="130" textAnchor="middle" fontSize="80" className="label" style={{ letterSpacing: '0.06em' }}>Spellcross</text>
      </svg>

      <div className="menu-corner"><FullscreenButton /></div>
      {confirmAbandon && (
        <Modal onClose={() => setConfirmAbandon(false)}>
          <h2>Abandon this run?</h2>
          <div>Your saved journey will be lost.</div>
          <div className="actions">
            <button className="btn" onClick={() => setConfirmAbandon(false)}>Keep it</button>
            <button className="btn primary" onClick={() => { abandonRun(); setConfirmAbandon(false); }}>Abandon</button>
          </div>
        </Modal>
      )}
      {confirmNew && (
        <Modal onClose={() => setConfirmNew(false)}>
          <h2>Start a new run?</h2>
          <div>This replaces your saved journey.</div>
          <div className="actions">
            <button className="btn" onClick={() => setConfirmNew(false)}>Cancel</button>
            <button className="btn primary" onClick={() => { setConfirmNew(false); newRun(); }}>New run</button>
          </div>
        </Modal>
      )}
    </div>
  );
}
