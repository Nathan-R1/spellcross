// World map generation (spec §3, features §3.1). A direct port of Spellford's WorldMap.generateMap and
// WorldMapRenderer's terrain/river geometry, including its quirks (e.g. pickByChance totals exclude
// boosts). Coordinates use y-down (SVG); Spellford is y-up, which only mirrors the picture.

import { createRng, type Rng } from './rng';

export type StopType = 'town' | 'village' | 'campfire' | 'market' | 'encounter' | 'start' | 'finish';
export type RoadType = 'highway' | 'road' | 'trail';

interface TypeRow<T> {
  id: T;
  name: string;
  chances: [number, number, number]; // start / mid / end
  desc: string;
  linkedRoad?: RoadType;
  blockedRoad?: RoadType;
  linkedStop?: StopType;
  blockedStop?: StopType;
  minimum: number;
}

export interface StopTypeRow extends TypeRow<StopType> { radius: number; variants: number }
export interface RoadTypeRow extends TypeRow<RoadType> { width: number }

// Enum order matters: it is the iteration order of pickByChance.
export const STOP_TYPES: StopTypeRow[] = [
  { id: 'town', name: 'Town', radius: 125, chances: [1, 2, 2], desc: 'Large settlement many shops', linkedRoad: 'trail', linkedStop: 'campfire', minimum: 1, variants: 2 },
  { id: 'village', name: 'Village', radius: 60, chances: [4, 4, 4], desc: 'Small settlement some shops', minimum: 0, variants: 2 },
  { id: 'campfire', name: 'Campfire', radius: 60, chances: [2, 5, 0], desc: 'Rest and heal', linkedStop: 'town', minimum: 1, variants: 3 },
  { id: 'market', name: 'Market', radius: 60, chances: [0, 1, 1], desc: 'Buy and trade items', linkedRoad: 'trail', minimum: 1, variants: 2 },
  { id: 'encounter', name: 'Encounter', radius: 60, chances: [5, 5, 5], desc: 'A random event', minimum: 0, variants: 1 },
  { id: 'start', name: 'Start', radius: 65, chances: [0, 0, 0], desc: 'Journey begins here', minimum: 0, variants: 1 },
  { id: 'finish', name: 'Finish', radius: 65, chances: [0, 0, 0], desc: 'Journey ends here', minimum: 0, variants: 1 },
];

export const ROAD_TYPES: RoadTypeRow[] = [
  { id: 'highway', name: 'Highway', width: 30, chances: [1, 3, 2], desc: 'Safe travel', minimum: 0 },
  { id: 'road', name: 'Road', width: 15, chances: [5, 5, 5], desc: 'Standard travel', minimum: 0 },
  { id: 'trail', name: 'Trail', width: 8, chances: [1, 3, 4], desc: 'Dangerous travel', blockedRoad: 'trail', linkedStop: 'town', blockedStop: 'start', minimum: 1 },
];

export const stopRow = (t: StopType) => STOP_TYPES.find((s) => s.id === t)!;
export const roadRow = (t: RoadType) => ROAD_TYPES.find((r) => r.id === t)!;

export interface Stop {
  id: number;
  type: StopType;
  name: string;
  x: number;
  y: number;
  variant: number;
  rotation: number;
}

export interface Road {
  id: number;
  type: RoadType;
  a: number;
  b: number;
  /** 1 = curve one way, -1 = the other, 0 = S-curve, -2 = straight (highways). */
  curve: 1 | -1 | 0 | -2;
}

export interface WorldMap {
  width: number;
  height: number;
  stops: Stop[];
  roads: Road[];
  paths: number[][];
}

/** Spellford-style nextInt(a, b) and nextFloat on top of our RNG. */
const nextInt = (r: Rng, a: number, b: number) => r.int(a, b);

export function generateMap(seed: number, width: number, height: number): WorldMap {
  const rng = createRng(seed);
  const stops: Stop[] = [];
  const roads: Road[] = [];
  let stopId = 0;
  let roadId = 0;

  const createStop = (type: StopType, name: string, x: number, y: number, variant = 0, rotation = 0) => {
    const s: Stop = { id: stopId++, type, name, x, y, variant, rotation };
    stops.push(s);
    return s;
  };
  const createRoad = (type: RoadType, a: Stop, b: Stop, curve: Road['curve']) => {
    const existing = roads.find((r) => (r.a === a.id && r.b === b.id) || (r.a === b.id && r.b === a.id));
    if (existing) return existing;
    const r: Road = { id: roadId++, type, a: a.id, b: b.id, curve };
    roads.push(r);
    return r;
  };
  const variantOf = (t: StopType) => nextInt(rng, 0, stopRow(t).variants);

  function pickByChance<T extends { id: string }>(cands: T[], fallback: T, chance: (t: T) => number, boost: (t: T) => number): T {
    if (cands.length === 0) return fallback;
    if (cands.length === 1) return cands[0];
    const chances = cands.map(chance);
    const total = chances.reduce((a, b) => a + b, 0);
    if (total === 0) return rng.pick(cands);
    let roll = nextInt(rng, 0, total);
    for (let i = 0; i < cands.length; i++) {
      const eff = chances[i] + boost(cands[i]);
      if (roll < eff) return cands[i];
      roll -= eff;
    }
    return rng.pick(cands);
  }

  const phase = (isStart: boolean, isEnd: boolean) => (isStart ? 0 : isEnd ? 2 : 1);

  function stopTypeByChance(prevRoad: Road | null, prevStop: Stop | null, isStart: boolean, isEnd: boolean): StopType {
    const cands = STOP_TYPES.filter((st) => !(prevRoad && st.blockedRoad === prevRoad.type) && !(prevStop && st.blockedStop === prevStop.type));
    return pickByChance(cands, stopRow('campfire'), (st) => st.chances[phase(isStart, isEnd)], (st) => {
      let b = 0;
      if (prevRoad && st.linkedRoad === prevRoad.type) b += 5;
      if (prevStop && st.linkedStop === prevStop.type) b += 5;
      return b;
    }).id;
  }

  function roadTypeByChance(prevRoad: Road | null, prevStop: Stop | null, isStart: boolean, isEnd: boolean, connector = false): RoadType {
    const cands = ROAD_TYPES.filter((rt) => !(prevRoad && rt.blockedRoad === prevRoad.type) && !(prevStop && rt.blockedStop === prevStop.type));
    return pickByChance(cands, roadRow('road'), (rt) => (connector ? rt.chances[1] : rt.chances[phase(isStart, isEnd)]), (rt) => {
      let b = 0;
      if (prevRoad && rt.linkedRoad === prevRoad.type) b += 5;
      if (prevStop && rt.linkedStop === prevStop.type) b += 5;
      return b;
    }).id;
  }

  const curveDir = (): Road['curve'] => {
    const roll = nextInt(rng, 0, 100);
    return roll < 10 ? 0 : roll < 55 ? 1 : -1;
  };

  const margin = width / 6;
  const centerY = height / 2;
  const start = createStop('start', 'Start', margin, centerY);
  const finish = createStop('finish', 'Finish', width - margin, centerY);

  function generatePath(baseY: number): Stop[] {
    const count = nextInt(rng, 4, 7);
    const path: Stop[] = [start];
    let prevRoad: Road | null = null;
    let prevStop: Stop = start;
    for (let i = 0; i < count; i++) {
      const isStart = i < 2;
      const isEnd = i >= count - 2;
      const type = stopTypeByChance(prevRoad, prevStop, isStart, isEnd);
      const x = margin + ((width - margin * 2) * (i + 1)) / (count + 1) + (rng.next() - 0.5) * 100;
      const yOff = (rng.next() - 0.5) * 50;
      const variant = variantOf(type);
      const rotation = type === 'town' || type === 'village' ? nextInt(rng, 0, 360) : 0;
      const stop = createStop(type, `${stopRow(type).name} ${i + 1}`, x, baseY + yOff, variant, rotation);
      const roadType = roadTypeByChance(prevRoad, prevStop, isStart, isEnd);
      prevRoad = createRoad(roadType, prevStop, stop, roadType === 'highway' ? -2 : curveDir());
      prevStop = stop;
      path.push(stop);
    }
    const lastType = roadTypeByChance(prevRoad, prevStop, false, true);
    createRoad(lastType, prevStop, finish, lastType === 'highway' ? -2 : curveDir());
    path.push(finish);
    return path;
  }

  const p1 = generatePath(height * 0.25);
  const p2 = generatePath(height / 2);
  const p3 = generatePath(height * 0.75);

  function connectors(from: Stop[], to: Stop[]) {
    const max = Math.floor((from.length - 2) / 2);
    const count = nextInt(rng, 1, max + 1);
    for (let k = 0; k < count; k++) {
      const fromIndex = nextInt(rng, 1, from.length - 1);
      const cands = [fromIndex - 1, fromIndex, fromIndex + 1].filter((i) => i >= 0 && i < to.length);
      if (cands.length > 0) {
        const toIndex = rng.pick(cands);
        createRoad(roadTypeByChance(null, null, false, false, true), from[fromIndex], to[toIndex], 0);
      }
    }
  }
  connectors(p1, p2);
  connectors(p2, p3);

  // Minimum requirements: convert the stops / roads nearest the map centre.
  const cx = width / 2;
  const cy = height / 2;
  const inner = [...p1, ...p2, ...p3].filter((s, i, a) => a.indexOf(s) === i && s.type !== 'start' && s.type !== 'finish');
  const sortedStops = [...inner].sort((a, b) => Math.hypot(a.x - cx, a.y - cy) - Math.hypot(b.x - cx, b.y - cy));
  for (const req of STOP_TYPES.filter((t) => t.minimum > 0)) {
    let remaining = req.minimum - inner.filter((s) => s.type === req.id).length;
    while (remaining > 0) {
      // Fix of a Spellford bug: never convert a stop another minimum still depends on (Spellford could
      // turn the only Town into a Campfire, leaving ~2% of maps without a Town or Campfire).
      const protectedType = (t: StopType) => {
        const row = stopRow(t);
        return row.minimum > 0 && inner.filter((s) => s.type === t).length <= row.minimum;
      };
      const cand = sortedStops.find((s) => s.type !== req.id && !protectedType(s.type));
      if (!cand) break;
      cand.type = req.id;
      cand.name = `${req.name} ${nextInt(rng, 0, 100)}`;
      cand.variant = variantOf(req.id);
      cand.rotation = req.id === 'town' || req.id === 'village' ? nextInt(rng, 0, 360) : 0;
      sortedStops.splice(sortedStops.indexOf(cand), 1);
      remaining--;
    }
  }
  const byId = (id: number) => stops[id];
  const sortedRoads = [...roads].sort((r, q) => {
    const d = (x: Road) => Math.hypot((byId(x.a).x + byId(x.b).x) / 2 - cx, (byId(x.a).y + byId(x.b).y) / 2 - cy);
    return d(r) - d(q);
  });
  for (const req of ROAD_TYPES.filter((t) => t.minimum > 0)) {
    let remaining = req.minimum - roads.filter((r) => r.type === req.id).length;
    while (remaining > 0) {
      const cand = sortedRoads.find((r) => r.type !== req.id);
      if (!cand) break;
      cand.type = req.id;
      if (cand.curve === -2) cand.curve = 1;
      sortedRoads.splice(sortedRoads.indexOf(cand), 1);
      remaining--;
    }
  }

  return { width, height, stops, roads, paths: [p1, p2, p3].map((p) => p.map((s) => s.id)) };
}

export function neighbours(map: WorldMap, stopId: number): { stop: Stop; road: Road }[] {
  return map.roads
    .filter((r) => r.a === stopId || r.b === stopId)
    .map((r) => ({ road: r, stop: map.stops[r.a === stopId ? r.b : r.a] }));
}

export function roadBetween(map: WorldMap, a: number, b: number): Road | undefined {
  return map.roads.find((r) => (r.a === a && r.b === b) || (r.a === b && r.b === a));
}

/** SVG path for a road, matching Spellford's quadratic curves (single, S-curve) or a straight line. */
export function roadPath(map: WorldMap, road: Road, fromId = road.a): string {
  const s1 = map.stops[fromId];
  const s2 = map.stops[fromId === road.a ? road.b : road.a];
  const [x1, y1, x2, y2] = [s1.x, s1.y, s2.x, s2.y];
  if (road.curve === -2 || road.type === 'highway') return `M${x1},${y1} L${x2},${y2}`;
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len = Math.hypot(dx, dy) || 1;
  const off = len * 0.15;
  // Keep the curve's side independent of travel direction.
  const sign = fromId === road.a ? 1 : -1;
  if (road.curve === 0) {
    const mx = (x1 + x2) / 2;
    const my = (y1 + y2) / 2;
    const px = (-dy / len) * off * sign;
    const py = (dx / len) * off * sign;
    const c1x = x1 + dx * 0.25 + px;
    const c1y = y1 + dy * 0.25 + py;
    const c2x = x1 + dx * 0.75 - px;
    const c2y = y1 + dy * 0.75 - py;
    return `M${x1},${y1} Q${c1x},${c1y} ${mx},${my} Q${c2x},${c2y} ${x2},${y2}`;
  }
  const px = (-dy / len) * off * road.curve * sign;
  const py = (dx / len) * off * road.curve * sign;
  return `M${x1},${y1} Q${(x1 + x2) / 2 + px},${(y1 + y2) / 2 + py} ${x2},${y2}`;
}

// ---------------------------------------------------------------- terrain (WorldMapRenderer port)

export type TerrainFeature =
  | { type: 'forest' | 'lake'; x: number; y: number; size: number }
  | { type: 'mountain'; x: number; y: number; size: number; triangles: { x: number; y: number; size: number; icecap: boolean }[] }
  | { type: 'hill'; x: number; y: number; size: number; hills: { x: number; y: number }[] }
  | { type: 'river'; points: { x: number; y: number }[]; size: number };

export function generateTerrain(seed: number, width: number, height: number): TerrainFeature[] {
  const rng = createRng(seed);
  const f = () => rng.next();
  const out: TerrainFeature[] = [];
  const forests = nextInt(rng, 5, 15);
  const mountains = nextInt(rng, 5, 12);
  const lakes = nextInt(rng, 0, 6);
  const hills = nextInt(rng, 6, 15);
  const rivers = nextInt(rng, 1, 5);
  for (let i = 0; i < forests; i++) out.push({ type: 'forest', x: f() * width, y: f() * height, size: 60 + f() * 40 });
  for (let i = 0; i < mountains; i++) {
    const base = 80 + f() * 53;
    const n = nextInt(rng, 5, 21);
    const triangles = Array.from({ length: n }, () => ({ x: f() * base * 1.2 - base * 0.6, y: f() * base * 0.9 - base * 0.45, size: 0.6 + f() * 0.4, icecap: f() < 0.3 }));
    out.push({ type: 'mountain', x: f() * width, y: f() * height, size: base, triangles });
  }
  for (let i = 0; i < lakes; i++) out.push({ type: 'lake', x: f() * width, y: f() * height, size: 50 + f() * 50 });
  for (let i = 0; i < hills; i++) {
    const n = nextInt(rng, 1, 11);
    const base = 30 + f() * 30;
    const hs = Array.from({ length: n }, (_, k) => ({ x: k * base * 0.7 + f() * base * 0.3, y: f() * base * 0.4 - base * 0.2 }));
    out.push({ type: 'hill', x: f() * width, y: f() * height, size: base * (1 + n * 0.3), hills: hs });
  }
  for (let i = 0; i < rivers; i++) out.push({ type: 'river', points: riverPath(rng, width, height), size: 20 });
  return out;
}

function riverPath(rng: Rng, w: number, h: number): { x: number; y: number }[] {
  const side = () => nextInt(rng, 0, 4);
  const startSide = side();
  let endSide = side();
  while (endSide === startSide) endSide = side();
  const edge = (s: number) =>
    s === 0 ? { x: rng.next() * w, y: 0 } : s === 1 ? { x: rng.next() * w, y: h } : s === 2 ? { x: 0, y: rng.next() * h } : { x: w, y: rng.next() * h };
  const st = edge(startSide);
  let end = edge(endSide);
  const pts = [{ ...st }];
  let x = st.x;
  let y = st.y;
  let total = 0;
  let hitMax = false;
  const maxLen = h * 1.5;
  const toNearestEdge = (px: number, py: number) => {
    const m = Math.min(py, h - py, px, w - px);
    return m === py ? { x: px, y: 0 } : m === h - py ? { x: px, y: h } : m === px ? { x: 0, y: py } : { x: w, y: py };
  };
  for (let i = 1; i <= 50; i++) {
    if (hitMax) {
      const t = (i / 50) * 0.3;
      const nx = (rng.next() - 0.5) * w * 0.1;
      const ny = (rng.next() - 0.5) * h * 0.1;
      x = x + (end.x - x) * t + nx * 0.1;
      y = y + (end.y - y) * t + ny * 0.1;
      pts.push({ x, y });
      continue;
    }
    const t = i / 50;
    const nx = (rng.next() - 0.5) * w * 0.3;
    const ny = (rng.next() - 0.5) * h * 0.3;
    const newX = st.x + (end.x - st.x) * t + nx * 0.1;
    const newY = st.y + (end.y - st.y) * t + ny * 0.1;
    if (i > 1) {
      const p = pts[pts.length - 1];
      total += Math.hypot(newX - p.x, newY - p.y);
    }
    if (newX < 0 || newX > w || newY < 0 || newY > h) {
      end = toNearestEdge(x, y);
      hitMax = true;
      continue;
    }
    if (total >= maxLen) {
      end = toNearestEdge(newX, newY);
      hitMax = true;
    }
    x = newX;
    y = newY;
    pts.push({ x, y });
  }
  const last = pts[pts.length - 1];
  if (pts.length < 2 || (last.x !== 0 && last.x !== w && last.y !== 0 && last.y !== h)) pts.push(end);
  return pts;
}
