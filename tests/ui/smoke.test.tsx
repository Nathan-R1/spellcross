// @vitest-environment jsdom
// UI smoke tests: render the real app and click through the main flows (menu → Traveller → map →
// toolbox → battle prep → battle → end turn, and the quick fight). No browser here, so layout and animation aren't checked.

import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { App } from '../../src/ui/App';
import { closeTiles, openTile } from '../../src/ui/components/common';
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
afterEach(() => { cleanup(); act(() => closeTiles()); });

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

  it('the toolbox lists the seven starting tools', async () => {
    act(() => useStore.getState().newRun(42));
    act(() => useStore.getState().chooseOption(0));
    render(<App />);
    fireEvent.click(screen.getByText('Toolbox'));
    for (const name of ['Anoint', 'Prayer', 'Thanksgiving', 'The Word', 'Prophecy', 'Worship', 'Preaching']) await waitFor(() => screen.getAllByText(name));
    fireEvent.click(screen.getByLabelText('Close toolbox'));
    await waitFor(() => expect(useStore.getState().toolboxOpen).toBe(false));
  });

  it('battle prep → choose 3 tools → battle: 8×8 board, enemy panel, end turn plays the enemy turn', async () => {
    toPrep();
    render(<App />);
    expect(screen.getByText('Hard Choices')).toBeTruthy();
    expect(screen.getByRole('img', { name: 'Coming next and starting board: 32 enemy tiles' })).toBeTruthy();
    const fight = screen.getByText('FIGHT!') as HTMLButtonElement;
    expect(fight.disabled).toBe(false); // the first three tools are preselected
    fireEvent.click(fight);
    await waitFor(() => screen.getByText('End Turn'));
    expect(screen.getAllByRole('gridcell')).toHaveLength(64);
    expect(screen.getAllByLabelText(/^Worry/)).toHaveLength(32);
    expect(screen.getByLabelText('Hard Choices: hold for details')).toBeTruthy();
    // Block → Momentum: both chips show at 0, side by side, with the arrow between them.
    const flow = document.querySelector('.block-flow')!;
    expect(flow.querySelector('.s-block')?.getAttribute('aria-label')).toBe('Block 0: hold for details');
    expect(flow.querySelector('.flow-arrow')?.textContent).toBe('→');
    expect(flow.querySelector('.s-momentum')?.getAttribute('aria-label')).toBe('Momentum 0: hold for details');
    fireEvent.click(screen.getByText('End Turn'));
    // The enemy turn ran: either your next turn started, or a set formed during it and is waiting for a placement.
    await waitFor(() => { const b = useStore.getState().run!.battle!; expect(b.round === 2 || b.phase === 'placing').toBe(true); });
    await waitFor(() => expect(useStore.getState().playback.queue).toHaveLength(0), { timeout: 45000 });
    expect(useStore.getState().run!.player.hp).toBe(20); // run Courage updates only when the battle ends
  }, 60000);

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
    await waitFor(() => expect(document.querySelector('.instruction')?.textContent).toMatch(/Prayer: Targets: Choose shape \(3 tiles\) · Dmg: 3Tap the board/), { timeout: 8000 });
    tap(screen.getAllByRole('gridcell')[0]);
    await waitFor(() => screen.getByText('Continue'));
    // Centred on the corner, the line of 3 hangs one tile off the board: 2 tiles are aimed at.
    expect(document.querySelectorAll('.tile.aimed')).toHaveLength(2);
    tap(screen.getAllByRole('gridcell')[0]); // tapping a chosen tile unselects it
    await waitFor(() => expect(document.querySelectorAll('.tile.aimed')).toHaveLength(0));
    tap(screen.getAllByRole('gridcell')[0]);
    await waitFor(() => screen.getByText('Continue'));
    const before = useStore.getState().run!.battle!.nextUid;
    fireEvent.click(screen.getByText('Continue'));
    // The shape was applied: tiles broke and the board refilled (a new set may now be waiting to be placed).
    await waitFor(() => expect(useStore.getState().run!.battle!.nextUid).toBeGreaterThan(before));
  }, 20000);

  it('tile popups: follow an On destroy icon to its tile and back, as deep as you like', async () => {
    toPrep();
    render(<App />);
    const title = () => document.querySelector('.tile-popup h2')?.textContent ?? '';
    act(() => openTile({ kind: 'tool', id: 'word' }));
    await waitFor(() => expect(title()).toMatch(/^The Word/));
    expect(document.querySelector('.tile-popup')?.textContent).toMatch(/Set formed:\s*Attack\s*Targets: Choose anywhere \(1 tile per tile in the set\)\s*Dmg: 1\s*On destroy: Create/);
    tap(screen.getByLabelText('Stone: hold for details'));
    await waitFor(() => expect(title()).toMatch(/^Stone/));
    expect(document.querySelector('.tile-popup')?.textContent).not.toMatch(/On destroy/);
    expect(document.querySelector('.tile-popup')?.textContent).toMatch(/Never forms sets\. Only damage clears it\./);
    fireEvent.click(screen.getByText('Back'));
    await waitFor(() => expect(title()).toMatch(/^The Word/));
    expect(screen.queryByText('Back')).toBeNull();
    // Prayer creates nothing, so its popup has no On destroy row.
    act(() => openTile({ kind: 'tool', id: 'prayer' }));
    await waitFor(() => expect(title()).toMatch(/^Prayer/));
    expect(document.querySelector('.tile-popup')?.textContent).not.toMatch(/On destroy/);
    // Enemy tiles: Speed in the header, then Each step / On activate / At bottom. Depression's On activate links to itself.
    act(() => openTile({ kind: 'enemy', id: 'depression' }));
    await waitFor(() => expect(title()).toMatch(/^Depression/));
    expect(document.querySelector('.tile-popup')?.textContent).toMatch(/HP 3\/3 · Speed: 0.*On activate:\s*Create\s+on 1 random adjacent tool or junk\s*At bottom:\s*Attack\s*Targets: You\s*Dmg: 1/);
    expect(document.querySelector('.tile-popup')?.textContent).not.toMatch(/Each step|Move:/);
    tap(screen.getByLabelText('Depression: hold for details'));
    await waitFor(() => expect(screen.getAllByText('Back')).toHaveLength(1));
    expect(title()).toMatch(/^Depression/);
    fireEvent.click(screen.getByText('OK'));
    await waitFor(() => expect(document.querySelector('.tile-popup')).toBeNull());
  });

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
