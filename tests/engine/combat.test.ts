// The combat rules (docs/combat.md, docs/tools.md, docs/enemies.md) on hand-drawn boards.

import { content } from '../../src/content';
import { createBattle, endTurn, enemyToCome, findSets, place, playerMove, startingGrid, upcomingGrid, useAbility } from '../../src/engine/combat';
import { createPlayer } from '../../src/engine/run';
import { at, F1, F2, makeBattle } from '../helpers';
import { tc } from '../helpers';

const c = tc;

// A board with one Worry parked top-left (so the battle isn't won) and neutral filler elsewhere.
const base = (rows: Partial<Record<number, string>>) =>
  Array.from({ length: 8 }, (_, y) => rows[y] ?? (y === 0 ? 'X' + F1.slice(1) : y % 2 ? F2 : F1));

describe('battle setup', () => {
  it('Hard Choices: top row all Worries, 24 still to come, no ready-made matches', () => {
    const p = createPlayer(content);
    const { state } = createBattle({ player: p, enemyId: 'hard_choices', loadout: ['t1', 't2', 't3'], seed: 7 }, content);
    const top = state.board.cells.slice(0, 8);
    expect(top.every((t) => t?.kind === 'enemy' && t.id === 'worry')).toBe(true);
    expect(state.board.cells.slice(8).some((t) => t?.kind === 'enemy')).toBe(false);
    expect(enemyToCome(state, content)).toBe(24);
    expect(findSets(state)).toEqual([]);
    expect(state.player.hp).toBe(20);
    expect(state.movesLeft).toBe(3);
    // Only the 3 chosen tools are in the pool.
    expect(state.pool.filter((e) => e.kind === 'tool').map((e) => e.id).sort()).toEqual(['t1', 't2', 't3']);
  });
});

describe('sets', () => {
  it('a line of 3 is a set; an L merges into one; enemy tiles break lines', () => {
    const s = makeBattle({ rows: base({ 2: 'PPPsmsms', 4: 'TsmsmsmT', 5: 'TmsmsmsT', 6: 'TTTsmXms', 7: 'WWXWsmsm' }) });
    const sets = findSets(s);
    expect(sets.map((x) => [x.key, x.cells.length])).toEqual([['tool:t2', 3], ['tool:t3', 5]]);
  });
});

describe('tools', () => {
  it('Thanksgiving: 1 Block per tile; the swap costs a move', () => {
    const s = makeBattle({ rows: base({ 7: 'TTsTsmsm' }) });
    const r = playerMove(s, { x: 2, y: 7 }, { x: 3, y: 7 }, c);
    expect(r.state.player.block).toBe(3);
    expect(r.state.movesLeft).toBe(2);
  });

  it('a swap without a match still costs a move', () => {
    const s = makeBattle({ rows: base({}) });
    expect(playerMove(s, { x: 2, y: 5 }, { x: 3, y: 5 }, c).state.movesLeft).toBe(2);
  });

  it('Prayer: a damage shape the same as the set, 1 damage to everything under it', () => {
    const s = makeBattle({ rows: base({ 1: 'XXOmsmsm', 7: 'PPsPsmsm' }) });
    let r = playerMove(s, { x: 2, y: 7 }, { x: 3, y: 7 }, c);
    expect(r.state.phase).toBe('placing');
    expect(r.state.pending[0]).toMatchObject({ type: 'shape', damage: 1, cells: [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 2, y: 0 }] });
    r = place(r.state, { x: 0, y: 1 }, c);
    // Worries at (0,1),(1,1) deleted; the Stone at (2,1) survives at 1 HP (things fall in from above).
    expect(r.state.board.cells.filter((t) => t?.kind === 'enemy').length).toBe(1);
    const stone = r.state.board.cells.find((t) => t?.kind === 'stone');
    expect(stone?.hp).toBe(1);
    expect(r.state.phase).toBe('player');
  });

  it("a shape must fit on the board and keeps the set's orientation", () => {
    const s = makeBattle({ rows: base({ 7: 'PPsPsmsm' }) });
    const r = playerMove(s, { x: 2, y: 7 }, { x: 3, y: 7 }, c);
    expect(() => place(r.state, { x: 6, y: 0 }, c)).toThrow();
  });

  it('The Word: 1-damage hits; a deleted tile becomes a Stone, a survivor just takes damage', () => {
    const s = makeBattle({ rows: base({ 0: 'XsmsmsmX', 3: 'Omsmsmsm', 7: 'WWsWsmsm' }) });
    let r = playerMove(s, { x: 2, y: 7 }, { x: 3, y: 7 }, c);
    expect(r.state.pending.map((p) => p.type)).toEqual(['stone', 'stone', 'stone']);
    r = place(r.state, { x: 0, y: 0 }, c); // the Worry → a Stone
    expect(at(r.state, 0, 0)).toMatchObject({ kind: 'stone', hp: 2 });
    r = place(r.state, { x: 0, y: 3 }, c); // an existing Stone: cracked, no new Stone
    expect(at(r.state, 0, 3)).toMatchObject({ kind: 'stone', hp: 1 });
    r = place(r.state, { x: 4, y: 4 }, c); // a junk tile → a Stone, nothing falls
    expect(at(r.state, 4, 4)?.kind).toBe('stone');
  });

  it('Prophecy: 1 hit per tile, then Foresight boosts later Truth tools', () => {
    const s = makeBattle({ rows: base({ 7: 'RRsRsmsm' }) });
    let r = playerMove(s, { x: 2, y: 7 }, { x: 3, y: 7 }, c);
    expect(r.state.pending).toHaveLength(3);
    expect(r.state.pending.every((p) => p.type === 'hit' && p.damage === 1)).toBe(true);
    expect(r.state.player.foresight).toBe(1);
    for (const x of [5, 6, 7]) r = place(r.state, { x, y: 5 }, c);
    expect(r.state.phase).toBe('player');
    // The Word with Foresight 1: 2 damage per Stone and 3-HP Stones.
    const w = makeBattle({ rows: base({ 7: 'WWsWsmsm' }), state: (x) => (x.player.foresight = 1) });
    r = playerMove(w, { x: 2, y: 7 }, { x: 3, y: 7 }, c);
    expect(r.state.pending[0]).toMatchObject({ type: 'stone', damage: 2, stoneHp: 3 });
  });

  it('Fasting gives Critical, which doubles the next tool set', () => {
    const s = makeBattle({ rows: base({ 6: 'FFmFmsms', 7: 'TTsTsmsm' }) });
    let r = playerMove(s, { x: 2, y: 6 }, { x: 3, y: 6 }, c);
    expect(r.state.player.critical).toBe(1);
    r = playerMove(r.state, { x: 2, y: 7 }, { x: 3, y: 7 }, c);
    expect(r.state.player.block).toBe(6);
    expect(r.state.player.critical).toBe(0);
  });

  it('Critical Prayer gives two separate shapes', () => {
    const s = makeBattle({ rows: base({ 7: 'PPsPsmsm' }), state: (x) => (x.player.critical = 1) });
    const r = playerMove(s, { x: 2, y: 7 }, { x: 3, y: 7 }, c);
    expect(r.state.pending.filter((p) => p.type === 'shape')).toHaveLength(2);
  });

  it('Time: 3+ give 1 damage to 1 tile; it does not use Critical', () => {
    const s = makeBattle({ rows: base({ 7: 'iisismsm' }), state: (x) => (x.player.critical = 1) });
    const r = playerMove(s, { x: 2, y: 7 }, { x: 3, y: 7 }, c);
    expect(r.state.pending).toEqual([{ type: 'hit', damage: 1, source: 'Time' }]);
    expect(r.state.player.critical).toBe(1);
  });
});

describe('fruit', () => {
  it('Kindness: an adjacent Supportive tile joins another tool’s set as +1', () => {
    const s = makeBattle({ rows: base({ 6: 'msWsmsms', 7: 'TTsTsmsm' }), player: (p) => (p.tools[3].sockets[0] = 'kindness') });
    const r = playerMove(s, { x: 2, y: 7 }, { x: 3, y: 7 }, c);
    expect(r.state.player.block).toBe(4);
  });

  it('Peace +1 Block per tile; Goodness heals; Self-Control +1 move once per turn', () => {
    const s = makeBattle({
      rows: base({ 7: 'TTsTsmsm' }),
      player: (p) => { p.tools[2].sockets = ['peace', 'goodness', 'self_control']; p.hp = 10; },
    });
    let r = playerMove(s, { x: 2, y: 7 }, { x: 3, y: 7 }, c);
    expect(r.state.player.block).toBe(6);
    expect(r.state.player.hp).toBe(11);
    expect(r.state.movesLeft).toBe(3); // 3 − 1 + Focus 1
    r = playerMove(r.state, { x: 5, y: 3 }, { x: 6, y: 3 }, c);
    expect(r.state.movesLeft).toBe(2); // no set this time
  });

  it('Faithfulness +1 damage per hit; Patience +1 HP on placed Stones', () => {
    const s = makeBattle({ rows: base({ 7: 'WWsWsmsm' }), player: (p) => (p.tools[3].sockets = ['faithfulness', 'patience', null]) });
    const r = playerMove(s, { x: 2, y: 7 }, { x: 3, y: 7 }, c);
    expect(r.state.pending[0]).toMatchObject({ type: 'stone', damage: 2, stoneHp: 3 });
  });

  it('Gentleness: Sturdy tool tiles survive a Worry step', () => {
    const s = makeBattle({ rows: base({ 1: 'Tmsmsmsm' }), player: (p) => (p.tools[2].sockets[0] = 'gentleness') });
    const r = endTurn(s, c);
    expect(at(r.state, 0, 0)?.kind).toBe('enemy');
    expect(at(r.state, 0, 1)).toMatchObject({ kind: 'tool', hp: 1 });
  });

  it('Joy: Shining tiles damage adjacent enemy tiles at the end of your turn', () => {
    const s = makeBattle({ rows: base({ 0: 'XsmsmsXT' }), player: (p) => (p.tools[2].sockets[0] = 'joy') });
    const r = endTurn(s, c);
    expect(r.state.board.cells.filter((t) => t?.kind === 'enemy').length).toBe(1);
  });
});

describe('enemy turn', () => {
  it('a Worry deals 1 damage to the tile below and moves in when it breaks', () => {
    const s = makeBattle({ rows: base({}) });
    const below = at(s, 0, 1)!.uid;
    const r = endTurn(s, c);
    expect(at(r.state, 0, 1)?.kind).toBe('enemy');
    expect(r.state.board.cells.some((t) => t?.uid === below)).toBe(false);
    expect(r.state.round).toBe(2);
    expect(r.state.movesLeft).toBe(3);
  });

  it('a Stone stops a Worry for one turn (2 HP), then breaks', () => {
    const s = makeBattle({ rows: base({ 1: 'Omsmsmsm' }) });
    let r = endTurn(s, c);
    expect(at(r.state, 0, 0)?.kind).toBe('enemy');
    expect(at(r.state, 0, 1)).toMatchObject({ kind: 'stone', hp: 1 });
    r = endTurn(r.state, c);
    expect(at(r.state, 0, 1)?.kind).toBe('enemy');
  });

  it('enemy tiles never damage each other; a column moves together from the bottom up', () => {
    const s = makeBattle({ rows: base({ 1: 'Xmsmsmsm' }) });
    const r = endTurn(s, c);
    expect(at(r.state, 0, 1)?.kind).toBe('enemy');
    expect(at(r.state, 0, 2)?.kind).toBe('enemy');
  });

  it('from the bottom row a Worry hits you for 1; Block absorbs first; Block clears on your turn', () => {
    const s = makeBattle({ rows: base({ 7: 'XXsmsmsm' }), state: (x) => (x.player.block = 1) });
    const r = endTurn(s, c);
    expect(r.state.player.hp).toBe(19);
    expect(r.state.player.block).toBe(0);
    expect(at(r.state, 0, 7)?.kind).toBe('enemy');
  });

  it('defeat when Courage reaches 0', () => {
    const s = makeBattle({ rows: base({ 7: 'Xmsmsmsm' }), player: (p) => (p.hp = 1) });
    const r = endTurn(s, c);
    expect(r.state.outcome).toBe('defeat');
  });
});

describe('winning', () => {
  it('victory the moment no enemy tiles are left on the board', () => {
    const s = makeBattle({ rows: base({ 7: 'PPsPsmsm' }) });
    let r = playerMove(s, { x: 2, y: 7 }, { x: 3, y: 7 }, c);
    r = place(r.state, { x: 0, y: 0 }, c);
    expect(r.state.outcome).toBe('victory');
    expect(r.events.at(-1)?.event).toEqual({ type: 'battleEnd', outcome: 'victory' });
  });
});

describe('abilities', () => {
  const withAbilities = makeBattle({ rows: base({}), player: (p) => (p.abilities = ['stand_firm', 'revival', 'abstain', 'many_fish'].map((id) => ({ id, uses: 3 }))) });

  it('Stand Firm +5 Block; Revival +3 moves; both cost no move', () => {
    let r = useAbility(withAbilities, 0, c);
    expect(r.state.player.block).toBe(5);
    r = useAbility(r.state, 1, c);
    expect(r.state.movesLeft).toBe(6);
    expect(r.state.player.abilities[0].uses).toBe(2);
  });

  it('Abstain deals 10 damage to one tile; Many Fish 1 damage to a line of 3', () => {
    let r = useAbility(withAbilities, 2, c);
    expect(r.state.pending[0]).toMatchObject({ type: 'hit', damage: 10 });
    r = place(r.state, { x: 3, y: 3 }, c);
    r = useAbility(r.state, 3, c);
    expect(() => place(r.state, { x: 0, y: 6 }, c, 'v')).toThrow(); // runs off the board
    r = place(r.state, { x: 0, y: 1 }, c, 'v');
    expect(r.state.phase).toBe('player');
  });
});

describe('pattern picture', () => {
  it('Hard Choices: the starting board has Worries on the top row; the next 8 rows alternate, nearest at the bottom', () => {
    const row = (r: (string | null)[]) => (r.every((x) => x === 'worry') ? 'W' : r.every((x) => x === null) ? '.' : '?');
    expect(startingGrid(content, 'hard_choices').map(row).join('')).toBe('W.......');
    expect(upcomingGrid(content, 'hard_choices', Array(8).fill(8)).map(row).join('')).toBe('..W.W.W.');
  });

  it('columns advance independently: a column that pulled one tile in shows its next one at the bottom', () => {
    const g = upcomingGrid(content, 'hard_choices', [9, 8, 8, 8, 8, 8, 8, 8]);
    expect(g[7][0]).toBe('worry'); // column 0 is one row further on
    expect(g[7][1]).toBeNull();
  });
});
