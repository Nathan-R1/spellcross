// World map (spec §3, doc 03): fit the height, scroll horizontally. Tap a connected stop to travel; the
// token follows the road's curve, stopping for a road battle on Roads and Trails.

import { useEffect, useMemo, useRef, useState } from 'react';
import { terrainFor } from '../../engine/run';
import { neighbours, roadPath, ROAD_TYPES, STOP_TYPES, stopRow, type Stop, type TerrainFeature, type WorldMap } from '../../engine/world';
import { useStore } from '../../state/store';
import { AbilityBar, Asset, PlayerStats, TopBar } from '../components/common';

const TRAVEL_MS = 1000;
const ROAD_COLOR = { highway: '#666', road: '#80735a', trail: '#998059' } as const;
const ROAD_GLOW = { highway: 'rgba(255,255,255,0.1)', road: 'rgba(255,255,255,0.1)', trail: 'rgba(255,51,51,0.7)' } as const;
const GLOW_MUL = { highway: 1.5, road: 2, trail: 2.5 } as const;
const BASE_COLOR: Record<string, string> = { town: '#4d80cc', village: '#669966', campfire: '#f0daaf', market: '#f0daaf', encounter: '#f0daaf', start: '#33cc66', finish: '#e6334d' };

export function WorldScreen() {
  const run = useStore((s) => s.run)!;
  const { travelTo, roadBattle, arrive, setSpellbook } = useStore.getState();
  const [legend, setLegend] = useState(false);
  const scroller = useRef<HTMLDivElement>(null);
  const pathRef = useRef<SVGPathElement>(null);
  const [token, setToken] = useState<{ x: number; y: number } | null>(null);
  const map = run.map;
  const terrain = useMemo(() => terrainFor(run), [run.terrainSeed, map.width]); // eslint-disable-line react-hooks/exhaustive-deps
  const current = map.stops[run.currentStopId];
  const reachable = new Set(run.travel ? [] : neighbours(map, run.currentStopId).map((n) => n.stop.id));
  const travel = run.travel;

  // Scroll so the current stop is in view.
  useEffect(() => {
    const el = scroller.current;
    if (!el) return;
    const scale = el.clientHeight / map.height;
    el.scrollLeft = Math.max(0, current.x * scale - el.clientWidth / 2);
  }, [current.id, map.height]); // eslint-disable-line react-hooks/exhaustive-deps

  // Travel animation along the road path.
  useEffect(() => {
    if (!travel) return;
    const path = pathRef.current;
    if (!path) return;
    const len = path.getTotalLength();
    const from = travel.battleDone && travel.battleAt !== null ? travel.battleAt : 0;
    let t0 = -1;
    let raf = 0;
    let done = false;
    const tick = (now: number) => {
      if (done) return;
      if (t0 < 0) t0 = now - from * TRAVEL_MS;
      const p = Math.min(1, (now - t0) / TRAVEL_MS);
      const pt = path.getPointAtLength(p * len);
      setToken({ x: pt.x, y: pt.y });
      const el = scroller.current;
      if (el) el.scrollLeft = Math.max(0, pt.x * (el.clientHeight / map.height) - el.clientWidth / 2);
      if (travel.battleAt !== null && !travel.battleDone && p >= travel.battleAt) {
        done = true;
        roadBattle();
        return;
      }
      if (p >= 1) {
        done = true;
        arrive();
        return;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => {
      done = true;
      cancelAnimationFrame(raf);
    };
  }, [travel?.from, travel?.to, travel?.battleDone]); // eslint-disable-line react-hooks/exhaustive-deps

  const travelRoad = travel ? map.roads[travel.roadId] : null;
  const tokenPos = travel && token ? token : { x: current.x, y: current.y };

  return (
    <div className="screen">
      <TopBar>
        <PlayerStats />
        <span className="spacer" />
        <AbilityBar />
        <button className="btn" onClick={() => setSpellbook(true)}>Spellbook</button>
        <button className="btn" onClick={() => setLegend((v) => !v)}>Legend</button>
      </TopBar>
      <div className="world-scroll" ref={scroller}>
        <svg viewBox={`0 0 ${map.width} ${map.height}`} style={{ aspectRatio: `${map.width} / ${map.height}` }} role="img" aria-label="World map">
          <rect width={map.width} height={map.height} fill="#264026" />
          <Terrain features={terrain} />
          {map.roads.map((r) => {
            const d = roadPath(map, r);
            const w = ROAD_TYPES.find((t) => t.id === r.type)!.width;
            return (
              <g key={r.id}>
                <path d={d} fill="none" stroke={ROAD_GLOW[r.type]} strokeWidth={w * GLOW_MUL[r.type]} strokeLinecap="round" />
                <path d={d} fill="none" stroke={ROAD_COLOR[r.type]} strokeWidth={w} strokeLinecap="round" />
              </g>
            );
          })}
          {travelRoad && <path ref={pathRef} d={roadPath(map, travelRoad, travel!.from)} fill="none" stroke="none" />}
          {map.stops.map((s) => (
            <StopNode key={s.id} stop={s} reachable={reachable.has(s.id)} current={s.id === run.currentStopId && !travel} onTap={() => reachable.has(s.id) && travelTo(s.id)} />
          ))}
          <image href="/assets/maps/people/player.png" x={tokenPos.x - 45} y={tokenPos.y - 90} width={90} height={90} style={{ pointerEvents: 'none' }} />
        </svg>
      </div>
      <Legend open={legend} />
    </div>
  );
}

function StopNode({ stop, reachable, current, onTap }: { stop: Stop; reachable: boolean; current: boolean; onTap: () => void }) {
  const row = stopRow(stop.type);
  const r = row.radius;
  const tex = stop.type === 'start' || stop.type === 'finish' ? undefined : `maps/stops/${stop.type}${stop.variant + 1}.png`;
  const settlement = stop.type === 'town' || stop.type === 'village';
  return (
    <g className={`stop ${reachable ? 'reachable' : 'unreachable'}`} onClick={onTap} role={reachable ? 'button' : undefined} aria-disabled={!reachable} aria-label={stop.name}>
      {!settlement && (
        <>
          <circle cx={stop.x + 3} cy={stop.y + 3} r={r + 4} fill="rgba(0,0,0,0.3)" />
          <circle cx={stop.x} cy={stop.y} r={r + 4} fill={BASE_COLOR[stop.type]} opacity={0.85} />
          <circle cx={stop.x} cy={stop.y} r={r} fill={BASE_COLOR[stop.type]} />
        </>
      )}
      {tex && <image href={`/assets/${tex}`} x={stop.x - r} y={stop.y - r} width={r * 2} height={r * 2} transform={`rotate(${stop.rotation} ${stop.x} ${stop.y})`} />}
      {(reachable || current) && <circle className="ring" cx={stop.x} cy={stop.y} r={r + 12} fill="none" stroke={current ? '#fff' : undefined} strokeWidth={current ? 4 : undefined} />}
      <text x={stop.x} y={stop.y + r + 40} textAnchor="middle" fontSize="40" fill="#fff" stroke="#000" strokeWidth="6" paintOrder="stroke" fontFamily="SpellText, serif">{stop.name}</text>
      <circle className="stop-hit" cx={stop.x} cy={stop.y} r={Math.max(r, 75)} />
    </g>
  );
}

function Terrain({ features }: { features: TerrainFeature[] }) {
  return (
    <g style={{ pointerEvents: 'none' }}>
      {features.map((f, i) => {
        switch (f.type) {
          case 'forest':
            return (
              <g key={i} fill="#1a3314">
                <path d={`M${f.x},${f.y - f.size} L${f.x - f.size * 0.7},${f.y} L${f.x + f.size * 0.7},${f.y}Z M${f.x},${f.y + f.size * 0.5} L${f.x - f.size * 0.7},${f.y} L${f.x + f.size * 0.7},${f.y}Z`} />
                {[0, 1, 2, 3].map((k) => {
                  const ox = (k % 2 === 0 ? 1 : -1) * f.size * 0.6;
                  const oy = (k < 2 ? -1 : 1) * f.size * 0.4;
                  const s = f.size * 0.5;
                  const x = f.x + ox, y = f.y + oy;
                  return <path key={k} d={`M${x},${y - s} L${x - s * 0.7},${y} L${x + s * 0.7},${y}Z M${x},${y + s * 0.5} L${x - s * 0.7},${y} L${x + s * 0.7},${y}Z`} />;
                })}
              </g>
            );
          case 'mountain':
            return (
              <g key={i}>
                {f.triangles.map((t, k) => {
                  const tx = f.x + t.x, ty = f.y - t.y, ts = (f.size / 2) * t.size;
                  return (
                    <g key={k}>
                      <path d={`M${tx},${ty - ts} L${tx - ts * 0.8},${ty + ts * 0.3} L${tx + ts * 0.8},${ty + ts * 0.3}Z`} fill="rgba(89,89,97,0.5)" />
                      <path d={`M${tx - ts * 0.1},${ty - ts * 0.3} L${tx - ts * 0.6},${ty + ts * 0.1} L${tx + ts * 0.1},${ty + ts * 0.1}Z`} fill="rgba(64,64,71,0.5)" />
                      {t.icecap && <path d={`M${tx},${ty - ts * 1.1} L${tx - ts * 0.28},${ty - ts * 0.22} L${tx + ts * 0.28},${ty - ts * 0.22}Z`} fill="rgba(230,230,242,0.5)" />}
                    </g>
                  );
                })}
              </g>
            );
          case 'lake':
            return (
              <g key={i}>
                {[[0, 0, 1], [0.3, 0.2, 0.7], [-0.25, -0.15, 0.6], [0.15, -0.25, 0.5]].map(([dx, dy, k], j) => (
                  <circle key={`o${j}`} cx={f.x + f.size * dx} cy={f.y + f.size * dy} r={(f.size + 6) * k} fill="rgba(102,153,204,0.7)" />
                ))}
                {[[0, 0, 1], [0.3, 0.2, 0.7], [-0.25, -0.15, 0.6], [0.15, -0.25, 0.5]].map(([dx, dy, k], j) => (
                  <circle key={`i${j}`} cx={f.x + f.size * dx} cy={f.y + f.size * dy} r={f.size * k} fill="#335980" />
                ))}
              </g>
            );
          case 'hill': {
            const base = f.size / (1 + f.hills.length * 0.3);
            return <g key={i} fill="rgba(46,71,43,0.5)">{f.hills.map((h, k) => <circle key={k} cx={f.x + h.x - f.hills.length * base * 0.35} cy={f.y - h.y} r={base} />)}</g>;
          }
          case 'river': {
            const pts = f.points.map((p) => `${p.x},${p.y}`).join(' ');
            return (
              <g key={i} fill="none" strokeLinecap="round" strokeLinejoin="round">
                <polyline points={pts} stroke="rgba(102,128,204,0.7)" strokeWidth={f.size} />
                <polyline points={pts} stroke="rgba(77,128,179,0.8)" strokeWidth={f.size * 0.35} />
              </g>
            );
          }
        }
      })}
    </g>
  );
}

function Legend({ open }: { open: boolean }) {
  return (
    <div className={`legend panel ${open ? 'open' : ''}`} aria-hidden={!open}>
      <h3 style={{ margin: '0 0 6px' }}>Roads</h3>
      {ROAD_TYPES.map((r) => (
        <div key={r.id} className="item">
          <svg width="40" height="14"><line x1="2" y1="7" x2="38" y2="7" stroke={ROAD_GLOW[r.id]} strokeWidth={Math.min(14, r.width * 0.4 * GLOW_MUL[r.id])} /><line x1="2" y1="7" x2="38" y2="7" stroke={ROAD_COLOR[r.id]} strokeWidth={Math.max(2, r.width * 0.3)} /></svg>
          <span><b>{r.name}</b> <span className="dim">{r.desc}{r.id === 'road' ? ': battle on the way' : r.id === 'trail' ? ': elite battle on the way' : ''}</span></span>
        </div>
      ))}
      <h3 style={{ margin: '10px 0 6px' }}>Stops</h3>
      {STOP_TYPES.filter((s) => s.id !== 'start').map((s) => (
        <div key={s.id} className="item">
          <Asset path={s.id === 'finish' ? undefined : `maps/stops/${s.id}1.png`} alt={s.name} size={30} color={BASE_COLOR[s.id]} />
          <span><b>{s.name}</b> <span className="dim">{s.id === 'finish' ? 'The Harbinger awaits' : s.desc}</span></span>
        </div>
      ))}
    </div>
  );
}

export type { WorldMap };
