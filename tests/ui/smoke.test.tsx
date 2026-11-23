// @vitest-environment jsdom
// UI smoke tests: render the real app and click through the main flows (menu → Traveller → map →
// toolbox → battle prep → battle → end turn, and the quick fight). No browser here, so layout and animation aren't checked.

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
  useStore.setState({ run: null, quick: null, hasSave: false, toolboxOpen: false, playback: { queue: [], view: null, current: null, log: '' }, selection: null, debug: false });
});
afterEach(() => cleanup());

const tap = (el: Element) => {
  fireEvent.pointerDown(el);
  fireEvent.pointerUp(el);
  fireEvent.click(el);
};

const toPrep = () => {
  act(() => useStore.getState().newRun(42));
  act(() => useStore.getState().chooseOption(0));
  act(() => useStore.getState().debugBattle('hard_choices'));
};

describe('UI smoke', () => {
  it('menu → Traveller → map', async () => {
    render(<App />);
    expect(screen.getByText('Spellcross')).toBeTruthy();
    tap(screen.getByText('Begin your journey'));
    await waitFor(() => screen.getByText('A Fellow Pilgrim'));
    const option = screen.getAllByRole('button').find((b) => b.className.includes('option'))!;
    fireEvent.click(option);
    await waitFor(() => screen.getByText('Legend'));
    expect(screen.getByLabelText('World map')).toBeTruthy();
    expect(localStorage.getItem(SAVE_KEY)).toContain('"screen":"map"');
  });

  it('the toolbox lists the five starting tools', async () => {
    act(() => useStore.getState().newRun(42));
    act(() => useStore.getState().chooseOption(0));
    render(<App />);
    fireEvent.click(screen.getByText('Toolbox'));
    for (const name of ['Fasting', 'Prayer', 'Thanksgiving', 'The Word', 'Prophecy']) await waitFor(() => screen.getAllByText(name));
    fireEvent.click(screen.getByLabelText('Close toolbox'));
    await waitFor(() => expect(useStore.getState().toolboxOpen).toBe(false));
  });

  it('battle prep → choose 3 tools → battle: 8×8 board, enemy panel, end turn plays the enemy turn', async () => {
    toPrep();
    render(<App />);
    expect(screen.getByText('Hard Choices')).toBeTruthy();
    expect(screen.getByRole('img', { name: 'Coming next: 24 enemy tiles' })).toBeTruthy();
    expect(screen.getByRole('img', { name: 'Starting board: 8 enemy tiles' })).toBeTruthy();
    const fight = screen.getByText('FIGHT!') as HTMLButtonElement;
    expect(fight.disabled).toBe(false); // the first three tools are preselected
    fireEvent.click(fight);
    await waitFor(() => screen.getByText('End Turn'));
    expect(screen.getAllByRole('gridcell')).toHaveLength(64);
    expect(screen.getAllByLabelText(/^Worry/)).toHaveLength(8);
    expect(screen.getByLabelText('Hard Choices: hold for details')).toBeTruthy();
    fireEvent.click(screen.getByText('End Turn'));
    await waitFor(() => expect(useStore.getState().run!.battle!.round).toBe(2));
    await waitFor(() => expect(useStore.getState().playback.queue).toHaveLength(0), { timeout: 15000 });
    expect(useStore.getState().run!.player.hp).toBe(20); // run Courage updates only when the battle ends
  }, 20000);

  it('battle prep: tapping a selected tool deselects it and FIGHT needs 3', async () => {
    toPrep();
    render(<App />);
    const prayer = screen.getByText('Prayer').closest('button')!;
    expect(prayer.getAttribute('aria-pressed')).toBe('true');
    tap(prayer);
    await waitFor(() => expect((screen.getByText('FIGHT!') as HTMLButtonElement).disabled).toBe(true));
    tap(screen.getByText('Prophecy').closest('button')!);
    await waitFor(() => expect((screen.getByText('FIGHT!') as HTMLButtonElement).disabled).toBe(false));
  });

  it('battle prep preselects the tools used last battle', async () => {
    toPrep();
    act(() => useStore.getState().apply((r) => ({ ...r, lastLoadout: ['t3', 't4', 't5'] })));
    render(<App />);
    const selected = screen.getAllByRole('button').filter((b) => b.className.includes('tool-card') && b.className.includes('selected')).map((b) => b.textContent);
    expect(selected.join(' ')).toMatch(/Thanksgiving.*The Word.*Prophecy/);
  });

  it('quick fight: Fight → pick an enemy → choose tools → battle, without touching the run save', async () => {
    render(<App />);
    fireEvent.click(screen.getByText('⚔ Fight'));
    await waitFor(() => screen.getByText('Choose an enemy'));
    fireEvent.click(screen.getByText('Hard Choices'));
    await waitFor(() => screen.getByText('FIGHT!'));
    fireEvent.click(screen.getByText('FIGHT!'));
    await waitFor(() => screen.getByText('End Turn'));
    expect(useStore.getState().quick?.battle).toBeTruthy();
    expect(localStorage.getItem(SAVE_KEY)).toBeNull();
  });

  it('a Prayer set asks where to deal damage: tap a tile, then Continue', async () => {
    toPrep();
    act(() => useStore.getState().startBattle(['t1', 't2', 't3']));
    // Rig the bottom row so swapping columns 2 and 3 makes a Prayer set.
    act(() => {
      const r = useStore.getState().run!;
      const b = structuredClone(r.battle!);
      const mk = (kind: 'tool' | 'junk', id: string) => ({ uid: b.nextUid++, kind, id, hp: 1, maxHp: 1 });
      b.board.cells[56] = mk('tool', 't2'); b.board.cells[57] = mk('tool', 't2'); b.board.cells[58] = mk('junk', 'space'); b.board.cells[59] = mk('tool', 't2');
      useStore.setState({ run: { ...r, battle: b } });
    });
    render(<App />);
    act(() => { useStore.getState().selectTile({ x: 2, y: 7 }); useStore.getState().selectTile({ x: 3, y: 7 }); });
    await waitFor(() => expect(document.querySelector('.instruction')?.textContent).toMatch(/Prayer: 3-tile shape.*Tap the board/), { timeout: 8000 });
    tap(screen.getAllByRole('gridcell')[0]);
    await waitFor(() => screen.getByText('Continue'));
    expect(document.querySelectorAll('.tile.aimed')).toHaveLength(3);
    tap(screen.getAllByRole('gridcell')[0]); // tapping a chosen tile unselects it
    await waitFor(() => expect(document.querySelectorAll('.tile.aimed')).toHaveLength(0));
    tap(screen.getAllByRole('gridcell')[0]);
    await waitFor(() => screen.getByText('Continue'));
    fireEvent.click(screen.getByText('Continue'));
    await waitFor(() => expect(useStore.getState().run!.battle!.phase).toBe('player'));
  }, 20000);

  it('continue run restores a mid-battle save', async () => {
    toPrep();
    act(() => useStore.getState().startBattle(['t1', 't2', 't3']));
    useStore.setState({ run: null });
    act(() => useStore.getState().continueRun());
    render(<App />);
    await waitFor(() => screen.getByText('End Turn'));
    expect(screen.getAllByRole('gridcell')).toHaveLength(64);
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
