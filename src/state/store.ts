// App state (doc 03): the run (persisted), plus battle playback. Components never call the engine
// directly; they call these actions.

import { create } from 'zustand';
import { content } from '../content';
import { endTurn, playerMove, setTarget, snapshot, useAbility } from '../engine/battle';
import * as run from '../engine/run';
import type { RunState } from '../engine/run';
import type { Element, GemId, Pos, TimedEvent, ViewSnapshot } from '../engine/types';
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
}

interface Store {
  run: RunState | null;
  hasSave: boolean;
  playback: Playback;
  selection: Pos | null;
  toasts: Toast[];
  debug: boolean;
  spellbookOpen: boolean;

  newRun(seed?: number): void;
  continueRun(): void;
  abandonRun(): void;
  toTitle(): void;
  apply(fn: (r: RunState) => RunState): void;
  toast(text: string): void;

  travelTo(stopId: number): void;
  roadBattle(): void;
  arrive(): void;
  chooseOption(i: number): void;
  assignRecharge(i: number): void;
  skipRecharges(): void;
  pickGem(gem: GemId | null): void;
  startBattle(loadout: string[], junk: string[]): void;
  selectTile(p: Pos): void;
  target(slot: number): void;
  ability(i: number): void;
  endTurn(): void;
  advance(): void;
  fastForward(): void;
  continueResult(): void;
  setSpellbook(open: boolean): void;
  socket(spellUid: string, socket: number, gemIndex: number, secondElement?: Element): void;
  unsocket(spellUid: string, socket: number): void;
  upgrade(spellUid: string): void;
  debugBattle(encounterId: string): void;
  debugEvent(eventId: string): void;
}

let toastId = 1;
const emptyPlayback: Playback = { queue: [], view: null, current: null };

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

  return {
    run: null,
    hasSave: loadSave() !== null,
    playback: emptyPlayback,
    selection: null,
    toasts: [],
    debug: typeof location !== 'undefined' && (location.search.includes('debug=1') || import.meta.env.DEV),
    spellbookOpen: false,

    newRun(seed) {
      const aspect = typeof window !== 'undefined' ? Math.max(1.2, window.innerWidth / Math.max(1, window.innerHeight)) : 844 / 390;
      setRun(run.newRun(seed ?? Date.now() % 2147483647, content, aspect), { playback: emptyPlayback, selection: null });
    },
    continueRun() {
      const r = loadSave();
      if (!r) return;
      const view = r.battle ? snapshot(r.battle) : null;
      set({ run: r, hasSave: true, playback: { queue: [], view, current: null }, selection: null });
    },
    abandonRun() {
      clearSave();
      set({ run: null, hasSave: false, playback: emptyPlayback });
    },
    toTitle() {
      set({ run: null, hasSave: loadSave() !== null, playback: emptyPlayback, spellbookOpen: false });
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

    travelTo(stopId) { get().apply((r) => run.travelTo(r, stopId, content)); },
    roadBattle() { get().apply((r) => run.triggerRoadBattle(r, content)); },
    arrive() { get().apply((r) => run.arrive(r, content)); },
    chooseOption(i) { get().apply((r) => run.chooseOption(r, i, content)); },
    assignRecharge(i) { get().apply((r) => run.assignRecharge(r, i, content)); },
    skipRecharges() { get().apply((r) => run.skipRecharges(r, content)); },
    pickGem(gem) { get().apply((r) => run.pickGemOffer(r, gem, content)); },

    startBattle(loadout, junk) {
      const r = get().run;
      if (!r) return;
      guard(() => {
        const out = run.startBattle(r, loadout, junk, content);
        setRun(out.run, { playback: { queue: [], view: snapshot(out.run.battle!), current: null }, selection: null });
      });
    },
    selectTile(p) {
      const r = get().run;
      const b = r?.battle;
      if (!r || !b || b.phase !== 'player' || busy()) return;
      const sel = get().selection;
      if (!sel) return set({ selection: p });
      if (sel.x === p.x && sel.y === p.y) return set({ selection: null });
      if (Math.abs(sel.x - p.x) + Math.abs(sel.y - p.y) !== 1) return set({ selection: p });
      guard(() => {
        const out = playerMove(b, sel, p, content);
        setRun({ ...r, battle: out.state }, { selection: null });
        enqueue(out.events);
      });
    },
    target(slot) {
      const r = get().run;
      if (!r?.battle) return;
      const battle = setTarget(r.battle, slot);
      const pb = get().playback;
      setRun({ ...r, battle }, { playback: { ...pb, view: pb.view ? { ...pb.view, targetSlot: battle.targetSlot } : null } });
    },
    ability(i) {
      const r = get().run;
      if (!r?.battle || busy()) return;
      guard(() => {
        const out = useAbility(r.battle!, i, content);
        setRun({ ...r, battle: out.state });
        enqueue(out.events);
      });
    },
    endTurn() {
      const r = get().run;
      if (!r?.battle || busy()) return;
      guard(() => {
        const out = endTurn(r.battle!, content);
        setRun({ ...r, battle: out.state }, { selection: null });
        enqueue(out.events);
      });
    },
    advance() {
      const pb = get().playback;
      if (pb.queue.length === 0) {
        set({ playback: { ...pb, current: null } });
        const r = get().run;
        if (r?.battle?.outcome) setRun(run.finishBattle(r, content), { playback: emptyPlayback });
        return;
      }
      const [next, ...rest] = pb.queue;
      set({ playback: { queue: rest, view: next.after, current: next } });
    },
    fastForward() {
      const pb = get().playback;
      if (pb.queue.length === 0) return;
      const last = pb.queue[pb.queue.length - 1];
      set({ playback: { queue: [], view: last.after, current: null } });
      const r = get().run;
      if (r?.battle?.outcome) setTimeout(() => get().advance(), 300);
    },
    continueResult() { get().apply((r) => run.continueAfterResult(r)); },
    setSpellbook(open) { set({ spellbookOpen: open }); },
    socket(uid, socket, gemIndex, el) { get().apply((r) => run.socketGem(r, uid, socket, gemIndex, el, content)); },
    unsocket(uid, socket) { get().apply((r) => run.unsocketGem(r, uid, socket, content)); },
    upgrade(uid) { get().apply((r) => run.upgradeSpell(r, uid, content)); },
    debugBattle(id) { get().apply((r) => run.debugBattle(r, id, content)); },
    debugEvent(id) { get().apply((r) => run.debugEvent(r, id, content)); },
  };
});
