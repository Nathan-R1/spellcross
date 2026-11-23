// App state (doc 03): the run (persisted), a quick fight (never saved), plus battle playback. Components never
// call the engine directly; they call these actions.

import { create } from 'zustand';
import { content } from '../content';
import { createBattle, endTurn, placeGroup, playerMove, snapshot, useAbility } from '../engine/combat';
import { createRng, forkSeed } from '../engine/rng';
import * as run from '../engine/run';
import type { RunState } from '../engine/run';
import type { BattleResult, BattleState, FruitId, Player, Pos, TimedEvent, ViewSnapshot } from '../engine/types';
import { clearSave, loadSave, writeSave } from './persistence';

export interface Toast {
  id: number;
  text: string;
}

interface Playback {
  queue: TimedEvent[];
  view: ViewSnapshot | null;
  /** The event currently animating (drives effects). */
  current: TimedEvent | null;
  /** The last effect line shown in the battle's top bar. */
  log: string;
}

/** A battle from the main menu's Fight button (combat § 9). Never touches the run save. */
export interface QuickFight {
  screen: 'pick' | 'prep' | 'battle' | 'result';
  player: Player;
  enemyId: string | null;
  battle: BattleState | null;
  lastLoadout?: string[];
  seed: number;
  result: null | { outcome: 'victory' | 'defeat'; gold: number; fruit: FruitId | null };
}

interface Store {
  run: RunState | null;
  quick: QuickFight | null;
  hasSave: boolean;
  playback: Playback;
  selection: Pos | null;
  /** Many Fish orientation while placing a line. */
  orientation: 'h' | 'v';
  toasts: Toast[];
  debug: boolean;
  toolboxOpen: boolean;

  newRun(seed?: number): void;
  continueRun(): void;
  abandonRun(): void;
  toTitle(): void;
  apply(fn: (r: RunState) => RunState): void;
  toast(text: string): void;

  openQuickFight(): void;
  quickPick(enemyId: string): void;

  travelTo(stopId: number): void;
  roadBattle(): void;
  arrive(): void;
  chooseOption(i: number): void;
  assignRecharge(i: number): void;
  skipRecharges(): void;
  pickFruit(fruit: FruitId | null): void;
  pickLevelUp(toolUid: string | null): void;
  startBattle(loadout: string[]): void;
  selectTile(p: Pos): void;
  /** Place the next group of pending placements (combat § 5). */
  confirmPlacement(targets: Pos[]): void;
  setOrientation(o: 'h' | 'v'): void;
  ability(i: number): void;
  endTurn(): void;
  advance(): void;
  fastForward(): void;
  continueResult(): void;
  setToolbox(open: boolean): void;
  socket(toolUid: string, socket: number, fruitIndex: number): void;
  unsocket(toolUid: string, socket: number): void;
  upgrade(toolUid: string): void;
  debugBattle(enemyId: string): void;
  debugEvent(eventId: string): void;
}

let toastId = 1;
const emptyPlayback: Playback = { queue: [], view: null, current: null, log: '' };

/** The battle being played: the run's, or the quick fight's. */
export const activeBattle = (s: Pick<Store, 'run' | 'quick'>): BattleState | null => s.quick?.battle ?? s.run?.battle ?? null;

export const useStore = create<Store>((set, get) => {
  const save = (r: RunState | null) => {
    if (!r || r.screen === 'defeat' || r.screen === 'victory') clearSave();
    else writeSave(r);
  };
  const setRun = (r: RunState | null, extra: Partial<Store> = {}) => {
    save(r);
    set({ run: r, hasSave: !!r && r.screen !== 'defeat' && r.screen !== 'victory', ...extra });
  };
  const guard = (fn: () => void) => {
    try {
      fn();
    } catch (e) {
      get().toast(e instanceof Error ? e.message : String(e));
    }
  };
  const enqueue = (events: TimedEvent[]) => {
    const pb = get().playback;
    set({ playback: { ...pb, queue: [...pb.queue, ...events] } });
  };
  const busy = () => get().playback.queue.length > 0 || get().playback.current !== null;

  /** Apply a battle action to whichever battle is active. */
  const battleAction = (fn: (b: BattleState) => BattleResult, extra: Partial<Store> = {}) => {
    const st = get();
    const b = activeBattle(st);
    if (!b || busy()) return;
    guard(() => {
      const out = fn(b);
      if (st.quick?.battle) set({ quick: { ...st.quick, battle: out.state }, ...extra });
      else if (st.run) setRun({ ...st.run, battle: out.state }, extra);
      enqueue(out.events);
    });
  };

  return {
    run: null,
    quick: null,
    hasSave: loadSave() !== null,
    playback: emptyPlayback,
    selection: null,
    orientation: 'h',
    toasts: [],
    debug: typeof location !== 'undefined' && (location.search.includes('debug=1') || import.meta.env.DEV),
    toolboxOpen: false,

    newRun(seed) {
      const aspect = typeof window !== 'undefined' ? Math.max(1.2, window.innerWidth / Math.max(1, window.innerHeight)) : 844 / 390;
      setRun(run.newRun(seed ?? Date.now() % 2147483647, content, aspect), { quick: null, playback: emptyPlayback, selection: null });
    },
    continueRun() {
      const r = loadSave();
      if (!r) return;
      const view = r.battle ? snapshot(r.battle, content) : null;
      set({ run: r, quick: null, hasSave: true, playback: { ...emptyPlayback, view }, selection: null });
    },
    abandonRun() {
      clearSave();
      set({ run: null, hasSave: false, playback: emptyPlayback });
    },
    toTitle() {
      set({ run: null, quick: null, hasSave: loadSave() !== null, playback: emptyPlayback, toolboxOpen: false, selection: null });
    },
    apply(fn) {
      const r = get().run;
      if (r) guard(() => setRun(fn(r)));
    },
    toast(text) {
      const id = toastId++;
      set({ toasts: [...get().toasts, { id, text }] });
      setTimeout(() => set({ toasts: get().toasts.filter((t) => t.id !== id) }), 2200);
    },

    openQuickFight() {
      const seed = Date.now() % 2147483647;
      set({ run: null, quick: { screen: 'pick', player: run.createPlayer(content), enemyId: null, battle: null, seed, result: null }, playback: emptyPlayback });
    },
    quickPick(enemyId) {
      const q = get().quick;
      if (q) set({ quick: { ...q, enemyId, screen: 'prep' } });
    },

    travelTo(stopId) { get().apply((r) => run.travelTo(r, stopId, content)); },
    roadBattle() { get().apply((r) => run.triggerRoadBattle(r, content)); },
    arrive() { get().apply((r) => run.arrive(r, content)); },
    chooseOption(i) { get().apply((r) => run.chooseOption(r, i, content)); },
    assignRecharge(i) { get().apply((r) => run.assignRecharge(r, i, content)); },
    skipRecharges() { get().apply((r) => run.skipRecharges(r, content)); },
    pickFruit(fruit) { get().apply((r) => run.pickFruitOffer(r, fruit, content)); },
    pickLevelUp(uid) { get().apply((r) => run.pickLevelUp(r, uid, content)); },

    startBattle(loadout) {
      const q = get().quick;
      if (q?.enemyId) {
        guard(() => {
          run.validateLoadout(q.player, loadout, content);
          const { state } = createBattle({ player: q.player, enemyId: q.enemyId!, loadout, seed: forkSeed(q.seed, `quick:${q.enemyId}`) }, content);
          set({ quick: { ...q, screen: 'battle', battle: state, lastLoadout: loadout }, playback: { ...emptyPlayback, view: snapshot(state, content) }, selection: null });
        });
        return;
      }
      const r = get().run;
      if (!r) return;
      guard(() => {
        const out = run.startBattle(r, loadout, content);
        setRun(out.run, { playback: { ...emptyPlayback, view: snapshot(out.run.battle!, content) }, selection: null });
      });
    },
    selectTile(p) {
      const b = activeBattle(get());
      if (!b || busy()) return;
      if (b.phase !== 'player') return;
      const sel = get().selection;
      if (!sel) return set({ selection: p });
      if (sel.x === p.x && sel.y === p.y) return set({ selection: null });
      if (Math.abs(sel.x - p.x) + Math.abs(sel.y - p.y) !== 1) return set({ selection: p });
      battleAction((x) => playerMove(x, sel, p, content), { selection: null });
    },
    confirmPlacement(targets) { battleAction((x) => placeGroup(x, targets, content, get().orientation), { selection: null }); },
    setOrientation(o) { set({ orientation: o }); },
    ability(i) { battleAction((x) => useAbility(x, i, content), { selection: null }); },
    endTurn() { battleAction((x) => endTurn(x, content), { selection: null }); },
    advance() {
      const pb = get().playback;
      if (pb.queue.length === 0) {
        set({ playback: { ...pb, current: null } });
        const st = get();
        const q = st.quick;
        if (q?.battle?.outcome) {
          const outcome = q.battle.outcome;
          const rewards = outcome === 'victory' ? createRng(q.seed) : null;
          const r = rewards ? run.rollRewards(rewards, q.battle.enemyId, content) : { gold: 0, fruit: null };
          set({ quick: { ...q, screen: 'result', battle: null, result: { outcome, ...r } }, playback: emptyPlayback });
          return;
        }
        const r = st.run;
        if (r?.battle?.outcome) setRun(run.finishBattle(r, content), { playback: emptyPlayback });
        return;
      }
      const [next, ...rest] = pb.queue;
      const ev = next.event;
      const log = ev.type === 'effect' ? ev.text : ev.type === 'turnStart' ? `Turn ${ev.round}` : pb.log;
      set({ playback: { queue: rest, view: next.after, current: next, log } });
    },
    fastForward() {
      const pb = get().playback;
      if (pb.queue.length === 0) return;
      const last = pb.queue[pb.queue.length - 1];
      set({ playback: { ...pb, queue: [], view: last.after, current: null } });
      if (activeBattle(get())?.outcome) setTimeout(() => get().advance(), 300);
    },
    continueResult() { get().apply((r) => run.continueAfterResult(r)); },
    setToolbox(open) { set({ toolboxOpen: open }); },
    socket(uid, socket, fruitIndex) { get().apply((r) => run.socketFruit(r, uid, socket, fruitIndex)); },
    unsocket(uid, socket) { get().apply((r) => run.unsocketFruit(r, uid, socket, content)); },
    upgrade(uid) { get().apply((r) => run.upgradeTool(r, uid, content)); },
    debugBattle(id) { get().apply((r) => run.debugBattle(r, id, content)); },
    debugEvent(id) { get().apply((r) => run.debugEvent(r, id, content)); },
  };
});
