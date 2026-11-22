// @vitest-environment jsdom
// UI smoke tests: render the real app and click through the main flows (menu → Traveller → map →
// spellbook → battle prep → battle → end turn). No browser here, so layout and animation aren't checked.

import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { App } from '../../src/ui/App';
import { useStore } from '../../src/state/store';
import { SAVE_KEY } from '../../src/state/persistence';

beforeAll(() => {
  // jsdom lacks these.
  globalThis.ResizeObserver = class { observe() {} unobserve() {} disconnect() {} } as unknown as typeof ResizeObserver;
  Object.defineProperty(window.SVGElement.prototype, 'getTotalLength', { value: () => 100, configurable: true });
  Object.defineProperty(window.SVGElement.prototype, 'getPointAtLength', { value: () => ({ x: 0, y: 0 }), configurable: true });
});

beforeEach(() => {
  localStorage.clear();
  useStore.setState({ run: null, hasSave: false, spellbookOpen: false, playback: { queue: [], view: null, current: null }, selection: null, debug: false });
});
afterEach(() => cleanup());

const tap = (el: Element) => {
  fireEvent.pointerDown(el);
  fireEvent.pointerUp(el);
  fireEvent.click(el);
};

describe('UI smoke', () => {
  it('menu → Traveller → map', async () => {
    render(<App />);
    expect(screen.getByText('Spellcross')).toBeTruthy();
    tap(screen.getByText('Begin your journey'));
    await waitFor(() => screen.getByText('A Fellow Traveller'));
    const option = screen.getAllByRole('button').find((b) => b.className.includes('option'))!;
    fireEvent.click(option);
    await waitFor(() => screen.getByText('Legend'));
    expect(screen.getByLabelText('World map')).toBeTruthy();
    expect(localStorage.getItem(SAVE_KEY)).toContain('"screen":"map"');
  });

  it('spellbook lists the starting spells', async () => {
    act(() => useStore.getState().newRun(42));
    act(() => useStore.getState().chooseOption(0));
    render(<App />);
    fireEvent.click(screen.getByText('Spellbook'));
    await waitFor(() => screen.getAllByText('Scorch'));
    expect(screen.getAllByText('Ice Bolt').length).toBeGreaterThan(0);
    fireEvent.click(screen.getByLabelText('Close spellbook'));
    await waitFor(() => expect(useStore.getState().spellbookOpen).toBe(false));
  });

  it('battle prep → battle: board, enemies, end turn plays the enemy phase', async () => {
    act(() => useStore.getState().newRun(42));
    act(() => useStore.getState().chooseOption(0));
    act(() => useStore.getState().debugBattle('wolf'));
    render(<App />);
    expect(screen.getByText('Enemy Encounter!')).toBeTruthy();
    fireEvent.click(screen.getByText('FIGHT!'));
    await waitFor(() => screen.getByText('End Turn'));
    const visible = screen.getAllByRole('gridcell').filter((t) => (t as HTMLElement).style.visibility !== 'hidden');
    expect(visible).toHaveLength(48);
    expect(screen.getByLabelText(/Wolf, 30 HP/)).toBeTruthy();
    const cursor = useStore.getState().run!.battle!.enemies[0].intentCursor;
    fireEvent.click(screen.getByText('End Turn'));
    await waitFor(() => expect(useStore.getState().run!.battle!.round).toBe(2));
    await waitFor(() => expect(useStore.getState().playback.queue).toHaveLength(0), { timeout: 5000 });
    expect(useStore.getState().run!.battle!.enemies[0].intentCursor).toBe((cursor + 1) % 3);
    expect(useStore.getState().run!.player.hp).toBe(100); // run HP updates only when the battle ends
  });

  it('continue run restores a mid-battle save', async () => {
    act(() => useStore.getState().newRun(42));
    act(() => useStore.getState().chooseOption(0));
    act(() => useStore.getState().debugBattle('bear'));
    act(() => useStore.getState().startBattle(useStore.getState().run!.player.spells.slice(0, 3).map((s) => s.uid), []));
    useStore.setState({ run: null });
    act(() => useStore.getState().continueRun());
    render(<App />);
    await waitFor(() => screen.getByText('End Turn'));
    expect(screen.getByLabelText(/Bear, 45 HP/)).toBeTruthy();
  });

  it('abandon run clears the save', async () => {
    act(() => useStore.getState().newRun(1));
    act(() => useStore.getState().toTitle());
    render(<App />);
    tap(screen.getByText('Abandon run'));
    await waitFor(() => screen.getByText('Abandon this run?'));
    fireEvent.click(screen.getByText('Abandon'));
    expect(localStorage.getItem(SAVE_KEY)).toBeNull();
  });
});
