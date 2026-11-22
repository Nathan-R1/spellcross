// Animated night-sky menu scene (features §2, D11). Objects lift on press, then act after 150ms.

import { useMemo, useState } from 'react';
import { createRng } from '../../engine/rng';
import { useStore } from '../../state/store';
import { FullscreenButton, Modal } from '../components/common';

type ObjId = 'pathway' | 'hut' | 'chasm' | 'tree';

export function MenuScreen() {
  const { hasSave, newRun, continueRun, abandonRun } = useStore();
  const [lifted, setLifted] = useState<ObjId | null>(null);
  const [confirmAbandon, setConfirmAbandon] = useState(false);
  const [confirmNew, setConfirmNew] = useState(false);

  const stars = useMemo(() => {
    const r = createRng(7);
    return Array.from({ length: 70 }, () => ({ x: r.next() * 1000, y: r.next() * 260, s: 0.6 + r.next() * 1.6, d: r.next() * 3 }));
  }, []);

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

  return (
    <div className="screen menu">
      <svg viewBox="0 0 1000 460" preserveAspectRatio="xMidYMid slice">
        <defs>
          <linearGradient id="sky" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0" stopColor="#0b1030" />
            <stop offset="0.6" stopColor="#2a2350" />
            <stop offset="1" stopColor="#5a3a58" />
          </linearGradient>
          <radialGradient id="glow"><stop offset="0" stopColor="#ffe9a8" stopOpacity="0.8" /><stop offset="1" stopColor="#ffe9a8" stopOpacity="0" /></radialGradient>
        </defs>
        <rect width="1000" height="460" fill="url(#sky)" />
        {stars.map((s, i) => <circle key={i} className="twinkle" cx={s.x} cy={s.y} r={s.s} fill="#fff" style={{ animationDelay: `${s.d}s` }} />)}
        <circle cx="820" cy="80" r="34" fill="#f6efd0" opacity="0.9" />
        <path d="M0 300 L120 190 L230 280 L360 160 L480 270 L600 180 L740 290 L860 200 L1000 290 L1000 460 L0 460Z" fill="#2c2546" />
        <path d="M0 330 L160 250 L300 320 L450 240 L600 330 L760 250 L900 320 L1000 280 L1000 460 L0 460Z" fill="#231c38" />
        <path d="M0 360 L200 300 L380 350 L560 300 L720 360 L880 310 L1000 350 L1000 460 L0 460Z" fill="#1a1529" />
        <rect y="370" width="1000" height="90" fill="#1d2a1a" />
        <rect y="370" width="1000" height="4" fill="#3a5a30" />

        {/* Pathway: perspective path with a walking figure → New run */}
        <g className={cls('pathway')} {...press('pathway')}>
          <ellipse className="glow" cx="500" cy="400" rx="120" ry="40" fill="url(#glow)" />
          <path d="M440 460 C470 420 520 410 505 380 C495 360 520 350 515 335 L525 335 C532 352 510 362 520 382 C540 415 500 425 560 460Z" fill="#8a6a44" />
          <g>
            <animateMotion dur="8s" repeatCount="indefinite" path="M500 455 C510 420 515 400 512 380 C508 360 518 348 520 336" />
            <circle r="4" cy="-10" fill="#f4e7cf" />
            <rect x="-3" y="-7" width="6" height="9" fill="#f4e7cf" />
            <animate attributeName="opacity" values="1;1;0" keyTimes="0;0.8;1" dur="8s" repeatCount="indefinite" />
          </g>
          <text className="label" x="500" y="450" textAnchor="middle" fontSize="26">{hasSave ? 'New run' : 'Begin your journey'}</text>
        </g>

        {/* Hut → Continue run */}
        <g className={cls('hut', hasSave)} {...press('hut')}>
          <ellipse className="glow" cx="190" cy="370" rx="90" ry="40" fill="url(#glow)" />
          <rect x="140" y="320" width="100" height="60" fill="#5c3a18" />
          <path d="M128 324 L190 276 L252 324Z" fill="#7a4d20" />
          <rect x="178" y="344" width="22" height="36" fill="#2b1b0e" />
          <rect x="152" y="334" width="18" height="16" fill={hasSave ? '#ffd36b' : '#2b1b0e'} />
          <text className="label" x="190" y="410" textAnchor="middle" fontSize="22">Continue run</text>
        </g>

        {/* Chasm → Abandon run (with confirmation) */}
        <g className={cls('chasm', hasSave)} {...press('chasm')}>
          <ellipse className="glow" cx="810" cy="400" rx="90" ry="34" fill="url(#glow)" />
          <path d="M740 400 Q760 384 790 392 Q815 380 840 392 Q870 386 880 402 Q850 420 810 416 Q770 422 740 400Z" fill="#05040a" />
          <text className="label" x="810" y="445" textAnchor="middle" fontSize="22">Abandon run</text>
        </g>

        {/* Tree: decorative (D11) */}
        <g className="obj">
          <rect x="356" y="300" width="14" height="76" fill="#4a2f17" />
          <circle cx="363" cy="290" r="38" fill="#24402a" />
          <circle cx="340" cy="306" r="26" fill="#2c4d32" />
          <circle cx="388" cy="304" r="24" fill="#2c4d32" />
        </g>

        <text x="500" y="90" textAnchor="middle" fontSize="64" className="label" style={{ letterSpacing: '0.06em' }}>Spellcross</text>
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
