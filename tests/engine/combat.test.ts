// The combat rules (docs/combat.md, docs/tools.md, docs/enemies.md) on hand-drawn boards.

import { content } from '../../src/content';
import { createBattle, endTurn, incomingHits, isLocked, enemyTileSpeed, enemyToCome, findSets, pendingGroupSize, place, placeGroup, playerMove, previewPlacements, startingGrid, upcomingGrid, useAbility } from '../../src/engine/combat';
import { createPlayer } from '../../src/engine/run';
import { at, F1, F2, makeBattle } from '../helpers';
import { tc } from '../helpers';

const c = tc;

// A board with one Worry parked top-left (so the battle isn't won) and neutral filler elsewhere.
const base = (rows: Partial<Record<number, string>>) =>
  Array.from({ length: 8 }, (_, y) => rows[y] ?? (y === 0 ? 'X' + F1.slice(1) : y % 2 ? F2 : F1));

describe('battle setup', () => {
  it('Hard Choices: Worry rows at rows 5 to 8 from the bottom (the top half), nothing to come, no ready-made matches', () => {
    const p = createPlayer(content);
    const { state } = createBattle({ player: p, enemyId: 'hard_choices', loadout: ['t1', 't2', 't3'], seed: 7 }, content);
    const worryRows = [0, 1, 2, 3, 4, 5, 6, 7].filter((y) => state.board.cells.slice(y * 8, y * 8 + 8).every((t) => t?.kind === 'enemy'));
    expect(worryRows).toEqual([0, 1, 2, 3]); // y = 0–3 are rows 8 to 5 from the bottom
    expect(state.board.cells.filter((t) => t?.kind === 'enemy')).toHaveLength(32);
    expect(enemyToCome(state, content)).toBe(0);
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

  it('Space never forms sets; Time still does', () => {
    const s = makeBattle({ rows: base({ 6: 'sssmiiis', 7: F1 }) });
    expect(findSets(s).map((x) => [x.key, x.cells.length])).toEqual([['junk:time', 3]]);
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

  it("Prayer: the set's shape, 3 damage to every tile under it", () => {
    const s = makeBattle({ rows: base({ 1: 'XXOmsmsm', 7: 'PPsPsmsm' }) });
    let r = playerMove(s, { x: 2, y: 7 }, { x: 3, y: 7 }, c);
    expect(r.state.phase).toBe('placing');
    expect(r.state.pending[0]).toMatchObject({ target: { type: 'shape', cells: [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 2, y: 0 }] }, damage: 3 });
    // The board settles first: columns 0–2 fell one row, so the Worries and Stone are now on row 2.
    expect(r.state.board.cells.every((t) => t !== null)).toBe(true);
    r = place(r.state, { x: 0, y: 2 }, c);
    // Worries at (0,2),(1,2) deleted, and the Stone at (2,2) (2 HP) breaks too.
    expect(r.state.board.cells.filter((t) => t?.kind === 'enemy').length).toBe(1);
    expect(r.state.board.cells.some((t) => t?.kind === 'stone')).toBe(false);
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
    expect(r.state.pending.map((p) => [p.target.type, p.onDestroy?.kind])).toEqual([['anywhere', 'stone'], ['anywhere', 'stone'], ['anywhere', 'stone']]);
    // Columns 0–2 fell one row before placing: the Worry is at (0,1), the Stone at (0,4).
    r = placeGroup(r.state, [{ x: 0, y: 1 }, { x: 0, y: 4 }, { x: 4, y: 4 }], c);
    expect(at(r.state, 0, 1)).toMatchObject({ kind: 'stone', hp: 2 }); // the Worry → a Stone
    expect(at(r.state, 0, 4)).toMatchObject({ kind: 'stone', hp: 1 }); // an existing Stone: cracked, no new Stone
    expect(at(r.state, 4, 4)?.kind).toBe('stone'); // a junk tile → a Stone, nothing falls
  });

  it("Prophecy: the set's shape, 1 damage to every tile under it; broken tiles become Space; 1 Foresight per tile", () => {
    const s = makeBattle({ rows: base({ 1: 'smsOsmsm', 7: 'RRsRsmsm' }) });
    let r = playerMove(s, { x: 2, y: 7 }, { x: 3, y: 7 }, c);
    expect(r.state.pending).toHaveLength(1);
    expect(r.state.pending[0]).toMatchObject({ target: { type: 'shape', cells: [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 2, y: 0 }] }, damage: 1, onDestroy: { kind: 'junk', id: 'space' } });
    expect(r.state.player.foresight).toBe(3);
    // Columns 0–2 fell one row: the Worry is at (0,1). The shape covers (0,1)–(2,1); the Stone at (3,1) is outside it.
    r = place(r.state, { x: 0, y: 1 }, c);
    for (const x of [0, 1, 2]) expect(at(r.state, x, 1)).toMatchObject({ kind: 'junk', id: 'space' }); // nothing falls
    expect(r.state.outcome).toBe('victory');
  });

  it('Prophecy with Critical: two shapes, chosen together', () => {
    const s = makeBattle({ rows: base({ 7: 'RRsRsmsm' }), state: (x) => { x.player.critical = 1; } });
    const r = playerMove(s, { x: 2, y: 7 }, { x: 3, y: 7 }, c);
    expect(r.state.pending.map((p) => p.target.type)).toEqual(['shape', 'shape']);
    expect(pendingGroupSize(r.state)).toBe(2);
    expect(r.state.player.foresight).toBe(6);
  });

  it('Foresight: every 3 gives Truth tools +1 damage (and nothing to Stone HP)', () => {
    const word = (f: number) => playerMove(makeBattle({ rows: base({ 7: 'WWsWsmsm' }), state: (x) => (x.player.foresight = f) }), { x: 2, y: 7 }, { x: 3, y: 7 }, c).state.pending[0];
    expect(word(2)).toMatchObject({ target: { type: 'anywhere' }, damage: 1, onDestroy: { kind: 'stone' } });
    expect(word(3)).toMatchObject({ target: { type: 'anywhere' }, damage: 2, onDestroy: { kind: 'stone' } });
    expect(word(6)).toMatchObject({ target: { type: 'anywhere' }, damage: 3, onDestroy: { kind: 'stone' } });
    // Prayer is Faith, not Truth: no bonus.
    const prayer = playerMove(makeBattle({ rows: base({ 7: 'PPsPsmsm' }), state: (x) => (x.player.foresight = 6) }), { x: 2, y: 7 }, { x: 3, y: 7 }, c).state.pending[0];
    expect(prayer).toMatchObject({ target: { type: 'shape' }, damage: 3 });
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
    expect(r.state.pending.filter((p) => p.target.type === 'shape')).toHaveLength(2);
  });

  it('Time: 3+ give 1 damage to 1 tile; it does not use Critical', () => {
    const s = makeBattle({ rows: base({ 7: 'iisismsm' }), state: (x) => (x.player.critical = 1) });
    const r = playerMove(s, { x: 2, y: 7 }, { x: 3, y: 7 }, c);
    expect(r.state.pending).toEqual([{ target: { type: 'anywhere' }, damage: 1, source: 'Time', sourceTile: { kind: 'junk', id: 'time' } }]);
    expect(r.state.player.critical).toBe(1);
  });

  it('Time: Dmg 1 per 3 tiles in the set, rounded up (5 Time: 2 damage; Strengthen counts)', () => {
    // Swapping the Time at (2,6) down makes 5 in a row.
    const five = makeBattle({ rows: base({ 6: 'smismsms', 7: 'iisiimsm' }) });
    expect(playerMove(five, { x: 2, y: 6 }, { x: 2, y: 7 }, c).state.pending).toEqual([{ target: { type: 'anywhere' }, damage: 2, source: 'Time', sourceTile: { kind: 'junk', id: 'time' } }]);
    // 3 Time with +4 Strengthen count as 7: 3 damage.
    const strong = makeBattle({ rows: base({ 7: 'iisismsm' }), state: (x) => (x.board.cells[7 * 8]!.strength = 4) });
    expect(playerMove(strong, { x: 2, y: 7 }, { x: 3, y: 7 }, c).state.pending[0].damage).toBe(3);
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
    expect(r.state.pending[0]).toMatchObject({ target: { type: 'anywhere' }, damage: 2, onDestroy: { kind: 'stone' }, onDestroyHp: 3 });
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

  it('Block only absorbs damage: it no longer stops enemy steps', () => {
    const s = makeBattle({ rows: base({ 4: 'msXsmsms' }), state: (x) => (x.player.block = 2) });
    const r = endTurn(s, c);
    expect(at(r.state, 2, 5)?.kind).toBe('enemy'); // stepped down
    expect(at(r.state, 0, 1)?.kind).toBe('enemy'); // so did the top one
    expect(r.state.player.block).toBe(0); // unused Block clears on your turn
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
    r = place(r.state, { x: 0, y: 1 }, c); // the Worry fell from (0,0) to (0,1) before placing
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
    expect(r.state.pending[0]).toMatchObject({ target: { type: 'anywhere' }, damage: 10 });
    r = place(r.state, { x: 3, y: 3 }, c);
    r = useAbility(r.state, 3, c);
    expect(() => place(r.state, { x: 0, y: 6 }, c, 'v')).toThrow(); // runs off the board
    r = place(r.state, { x: 0, y: 1 }, c, 'v');
    expect(r.state.phase).toBe('player');
  });
});

describe('pattern picture', () => {
  it('Hard Choices: Worries on the top 4 rows of the board, nothing coming', () => {
    const row = (r: (string | null)[]) => (r.every((x) => x === 'worry') ? 'W' : r.every((x) => x === null) ? '.' : '?');
    expect(startingGrid(content, 'hard_choices').map(row).join('')).toBe('WWWW....');
    expect(upcomingGrid(content, 'hard_choices', Array(8).fill(8)).map(row).join('')).toBe('........');
  });

  it('columns advance independently: a column that pulled one tile in shows its next one at the bottom', () => {
    const g = upcomingGrid(content, 'financial_stress', [8, 8, 11, 8, 8, 8, 8, 8]);
    expect(g[7][2]).toBeNull(); // column 2 is three rows further on: row 12 (no Greed) is next
    expect(g[7][3]).toBe('greed'); // column 3 still has row 9 (Greed) next
  });
});

describe('placing a group', () => {
  it('The Word: all 3 picks are chosen together; the same tile can be picked twice; the preview says what breaks', () => {
    const s = makeBattle({ rows: base({ 7: 'WWsWsmsm' }), state: (x) => { x.board.cells[5 * 8 + 5] = { uid: 4000, kind: 'stone', id: 'stone', hp: 2, maxHp: 2 }; } });
    const r = playerMove(s, { x: 2, y: 7 }, { x: 3, y: 7 }, c);
    expect(pendingGroupSize(r.state)).toBe(3);
    const targets = [{ x: 5, y: 5 }, { x: 5, y: 5 }, { x: 7, y: 3 }];
    const pv = previewPlacements(r.state, targets, 'h');
    expect(pv.damage.get(4000)).toBe(2);
    expect(pv.deleted.has(4000)).toBe(true);
    expect(() => placeGroup(r.state, targets.slice(0, 2), c)).toThrow(); // all 3 must be chosen
    const done = placeGroup(r.state, targets, c);
    expect(done.state.board.cells.some((t) => t?.uid === 4000)).toBe(false); // broken, and a new Stone took its place
    expect(at(done.state, 5, 5)?.kind).toBe('stone');
    expect(done.state.phase).toBe('player');
  });
});

describe('Greed and Financial Stress', () => {
  it('Financial Stress: Worries in the edge columns on rows 7 and 8, 4 Greed on row 8; 24 more to come', () => {
    const p = createPlayer(content);
    const { state } = createBattle({ player: p, enemyId: 'financial_stress', loadout: ['t1', 't2', 't3'], seed: 7 }, content);
    const enemyAt = state.board.cells.map((t, i) => (t?.kind === 'enemy' ? i : -1)).filter((i) => i >= 0);
    expect(enemyAt).toEqual([0, 2, 3, 4, 5, 7, 8, 15]); // row 8 (top): Worry, 4 Greed, Worry; row 7: the edge Worries
    expect(state.board.cells[2]?.id).toBe('greed');
    expect(enemyToCome(state, content)).toBe(24);
    const next = upcomingGrid(content, 'financial_stress', Array(8).fill(8));
    expect(next[7]).toEqual(['worry', null, 'greed', 'greed', 'greed', 'greed', null, 'worry']); // row 9, next in
    expect(next.slice(6).flat().filter((t) => t === 'greed')).toHaveLength(8); // rows 9–10 still to come (row 8 is on the board)
  });

  it('Greed has 3 HP and takes 2 steps down per enemy turn', () => {
    const s = makeBattle({ rows: base({ 1: 'sGsmsmsm' }) });
    const r = endTurn(s, c);
    const g = r.state.board.cells.findIndex((t) => t?.id === 'greed');
    expect(g).toBe(3 * 8 + 1); // from row y=1 to y=3
    expect(r.state.board.cells[g]?.hp).toBe(3);
  });

  it('at the end of the enemy turn, tool tiles next to Greed turn into junk', () => {
    // Greed at (4,6) stays put on a Stone; tools to its left and right become Time or Space.
    const s = makeBattle({ rows: base({ 6: 'msmTGTms', 7: 'smsmOmsm' }) });
    const r = endTurn(s, c);
    expect(at(r.state, 4, 6)?.id).toBe('greed');
    for (const x of [3, 5]) expect(['mud', 'space']).toContain(at(r.state, x, 6)?.id); // the junk in play (test pool: Mud, Space)
    expect(r.events.some((e) => e.event.type === 'created')).toBe(true);
  });
});

describe('Depression and All Quiet', () => {
  it('All Quiet: a mirrored Depression zigzag on the top 4 rows, nothing else, nothing to come', () => {
    const p = createPlayer(content);
    const { state } = createBattle({ player: p, enemyId: 'all_quiet', loadout: ['t1', 't2', 't3'], seed: 7 }, content);
    const kind = (id: string) => state.board.cells.map((t, i) => (t?.id === id ? i : -1)).filter((i) => i >= 0);
    expect(kind('depression')).toEqual([0, 7, 9, 14, 16, 23, 25, 30]); // (0,0) (7,0) (1,1) (6,1) (0,2) (7,2) (1,3) (6,3)
    expect(kind('worry')).toEqual([]);
    expect(enemyToCome(state, content)).toBe(0);
    expect(content.enemies.all_quiet.tier).toBe('elite');
  });

  it("Depression doesn't move; at the end of the enemy turn one random tool or junk neighbour becomes Depression, never a Stone", () => {
    const picked = new Set<string>();
    for (let seed = 1; seed <= 20; seed++) {
      const s = makeBattle({ rows: base({ 4: 'msmsOsms', 5: 'smsTDism', 6: 'msmsWsms' }), state: (x) => { x.rng = seed; } });
      const r = endTurn(s, c);
      expect(at(r.state, 4, 5)?.id).toBe('depression');
      expect(at(r.state, 4, 4)?.kind).toBe('stone');
      const turned = [[3, 5], [5, 5], [4, 6]].filter(([x, y]) => at(r.state, x, y)?.id === 'depression');
      expect(turned).toHaveLength(1);
      expect(at(r.state, turned[0][0], turned[0][1])?.hp).toBe(3);
      picked.add(turned[0].join(','));
      expect(at(r.state, 2, 5)?.id).toBe('space'); // new Depression doesn't spread until next turn
      expect(r.events.some((e) => e.event.type === 'created')).toBe(true);
    }
    expect(picked.size).toBe(3); // it's random: over 20 seeds each neighbour gets picked
  });

  it('two Depressions never pick the same tile in one turn', () => {
    // Both touch the Thanksgiving at (4,5); the left one has no other choice, so the right one takes (6,5).
    const s = makeBattle({ rows: base({ 4: 'msmOmOms', 5: 'smODTDsm', 6: 'msmOmOms' }) });
    const r = endTurn(s, c);
    expect(at(r.state, 4, 5)?.id).toBe('depression');
    expect(at(r.state, 6, 5)?.id).toBe('depression');
    expect(r.state.board.cells.filter((t) => t?.id === 'depression')).toHaveLength(4);
  });

  it('Depression on the bottom row hits the player for 1 each enemy turn, and Block absorbs it', () => {
    const s = makeBattle({ rows: base({ 7: 'smsmDmsm' }) });
    const r = endTurn(s, c);
    expect(r.state.player.hp).toBe(s.player.hp - 1);
    expect(at(r.state, 4, 7)?.id).toBe('depression'); // it stays put
    s.player.block = 1;
    expect(endTurn(s, c).state.player.hp).toBe(s.player.hp);
  });
});

describe('placement groups', () => {
  it('placements with different shapes are aimed separately, not as one group', () => {
    const s = makeBattle({ rows: base({}) });
    s.phase = 'placing';
    s.pending = [
      { target: { type: 'shape', cells: [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 2, y: 0 }] }, damage: 3, source: 'Prayer' },
      { target: { type: 'shape', cells: [{ x: 0, y: 0 }, { x: 0, y: 1 }, { x: 0, y: 2 }] }, damage: 3, source: 'Prayer' },
    ];
    expect(pendingGroupSize(s)).toBe(1);
    s.pending[1] = structuredClone(s.pending[0]);
    expect(pendingGroupSize(s)).toBe(2);
  });
});

describe('Preaching and Locked', () => {
  it('Preaching: Choose anywhere (any tile), 1 per tile in the set; Dmg 1; targets that survive are Locked', () => {
    // A Greed (3 HP) and a Worry (1 HP) on top; both fall one row when the set clears.
    const s = makeBattle({ rows: base({ 0: 'GmXsmsms', 7: 'KKsKsmsm' }) });
    const r = playerMove(s, { x: 2, y: 7 }, { x: 3, y: 7 }, c);
    expect(r.state.phase).toBe('placing');
    expect(r.state.pending).toHaveLength(3);
    expect(r.state.pending[0]).toMatchObject({ target: { type: 'anywhere' }, damage: 1, apply: 'locked' });
    const greed = { x: 0, y: 1 }, worry = at(r.state, 2, 1)!;
    expect(worry.id).toBe('worry');
    const done = placeGroup(r.state, [greed, greed, { x: 2, y: 1 }], c).state;
    const g = at(done, 0, 1)!;
    expect(g.hp).toBe(1); // 3 − 1 − 1
    expect(isLocked(g, done.round)).toBe(true);
    // The Worry died to the hit, so nothing kept its lock.
    expect(done.board.cells.some((t) => t?.uid === worry.uid)).toBe(false);
    expect(done.board.cells.filter((t) => t && isLocked(t, done.round)).map((t) => t!.uid)).toEqual([g.uid]);
  });

  it("a Locked tile doesn't move or hit you during the enemy turn, and the lock wears off on your next turn", () => {
    const s = makeBattle({ rows: base({ 4: 'msXsmsms', 7: 'smsmsmsX' }), state: (x) => {
      x.board.cells[4 * 8 + 2]!.lockedUntil = 1;
      x.board.cells[7 * 8 + 7]!.lockedUntil = 1;
    } });
    const r = endTurn(s, c);
    expect(at(r.state, 2, 4)?.kind).toBe('enemy'); // stayed put
    expect(at(r.state, 0, 1)?.kind).toBe('enemy'); // the unlocked one moved
    expect(r.state.player.hp).toBe(s.player.hp); // the Locked one on the bottom row didn't hit
    expect(isLocked(at(r.state, 2, 4), r.state.round)).toBe(false);
    const r2 = endTurn(r.state, c);
    expect(at(r2.state, 2, 5)?.kind).toBe('enemy'); // moves again
    expect(r2.state.player.hp).toBe(s.player.hp - 1);
  });

  it('a Locked Depression does not spread', () => {
    const s = makeBattle({ rows: base({ 5: 'smsmDTsm' }), state: (x) => (x.board.cells[5 * 8 + 4]!.lockedUntil = 1) });
    const r = endTurn(s, c);
    expect(r.state.board.cells.filter((t) => t?.id === 'depression')).toHaveLength(1);
  });
});

describe('Anoint and Strengthen', () => {
  it("Anoint: Choose shape (the set's shape); Dmg 0; +2 Strengthen on each tile under it", () => {
    const s = makeBattle({ rows: base({ 7: 'AAsAsmsm' }) });
    const r = playerMove(s, { x: 2, y: 7 }, { x: 3, y: 7 }, c);
    expect(r.state.pending).toHaveLength(1);
    expect(r.state.pending[0]).toMatchObject({ target: { type: 'shape', cells: [0, 1, 2].map((x) => ({ x, y: 0 })) }, damage: 0, apply: 'strengthen', applyAmount: 2 });
    // A line of 3 over (3..5, 7): each gets +2.
    const once = placeGroup(r.state, [{ x: 3, y: 7 }], c).state;
    expect([3, 4, 5].map((x) => at(once, x, 7)?.strength)).toEqual([2, 2, 2]);
  });

  it('a Strengthened tile makes its set count 1 tile bigger per point', () => {
    // Thanksgiving ×3 with +2 Strengthen on one tile: 5 Block.
    const s = makeBattle({ rows: base({ 7: 'TTsTsmsm' }), state: (x) => (x.board.cells[7 * 8]!.strength = 2) });
    expect(playerMove(s, { x: 2, y: 7 }, { x: 3, y: 7 }, c).state.player.block).toBe(5);
  });

  it('Strengthen in the middle of a line still grows the line, at the nearer end (here: either, so the right)', () => {
    // Prayer ×3 at x=0..2 after the swap; +2 Strengthen on the middle tile (x=1): a straight line of 5.
    const s = makeBattle({ rows: base({ 7: 'PPsPsmsm' }), state: (x) => (x.board.cells[7 * 8 + 1]!.strength = 2) });
    const r = playerMove(s, { x: 2, y: 7 }, { x: 3, y: 7 }, c);
    expect(r.state.pending[0].target).toEqual({ type: 'shape', cells: [0, 1, 2, 3, 4].map((x) => ({ x, y: 0 })) });
  });

  it('Strengthen near the left end grows the line to the left', () => {
    const s = makeBattle({ rows: base({ 7: 'PPsPsmsm' }), state: (x) => (x.board.cells[7 * 8]!.strength = 1) });
    const r = playerMove(s, { x: 2, y: 7 }, { x: 3, y: 7 }, c);
    expect(r.state.pending[0].target).toEqual({ type: 'shape', cells: [0, 1, 2, 3].map((x) => ({ x, y: 0 })) });
  });

  it("Strengthen grows a placed shape by 1 cell per point, continuing the line through the tile", () => {
    // Prayer ×3 in a row with +1 Strengthen on the right end: a line of 4.
    const s = makeBattle({ rows: base({ 7: 'PPsPsmsm' }), state: (x) => (x.board.cells[7 * 8 + 3]!.strength = 1) });
    const r = playerMove(s, { x: 2, y: 7 }, { x: 3, y: 7 }, c);
    expect(r.state.pending[0].target).toEqual({ type: 'shape', cells: [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 2, y: 0 }, { x: 3, y: 0 }] });
  });
  it("a grown shape stops at the board's length, so it always fits; the set still counts its full size", () => {
    // Prayer ×3 with +8 Strengthen: the line stops at 8 cells, not 11.
    const s = makeBattle({ rows: base({ 7: 'PPsPsmsm' }), state: (x) => (x.board.cells[7 * 8]!.strength = 8) });
    const r = playerMove(s, { x: 2, y: 7 }, { x: 3, y: 7 }, c);
    expect(r.state.pending[0].target).toEqual({ type: 'shape', cells: [0, 1, 2, 3, 4, 5, 6, 7].map((x) => ({ x, y: 0 })) });
    // Thanksgiving ×3 with +8: 11 Block, uncapped.
    const t = makeBattle({ rows: base({ 7: 'TTsTsmsm' }), state: (x) => (x.board.cells[7 * 8]!.strength = 8) });
    expect(playerMove(t, { x: 2, y: 7 }, { x: 3, y: 7 }, c).state.player.block).toBe(11);
  });
});

describe('Worship', () => {
  it('Set formed: 1 Block per tile', () => {
    const s = makeBattle({ rows: base({ 7: 'VVsVsmsm' }) });
    expect(playerMove(s, { x: 2, y: 7 }, { x: 3, y: 7 }, c).state.player.block).toBe(3);
  });

  it('On activate: at the end of the enemy turn, each Worship tile deletes every adjacent Space', () => {
    // Worship at (4,6): Space left, right, above and below it. Mud is untouched.
    const s = makeBattle({ rows: base({ 6: 'msmsVsms' }) });
    const spaces = [[3, 6], [5, 6], [4, 5], [4, 7]].map(([x, y]) => at(s, x, y)!);
    expect(spaces.every((t) => t.id === 'space')).toBe(true);
    const r = endTurn(s, c);
    const deleted = r.events.flatMap((e) => (e.event.type === 'damaged' ? e.event.deleted : []));
    for (const t of spaces) expect(deleted).toContain(t.uid);
    const mud = at(s, 2, 6)!;
    expect(deleted).not.toContain(mud.uid);
  });
});

describe('per-fight tile speed', () => {
  it('Hard Choices: Worries take 2 steps per enemy turn; other fights keep speed 1', () => {
    expect(enemyTileSpeed(content, 'hard_choices', 'worry')).toBe(2);
    expect(enemyTileSpeed(content, 'financial_stress', 'worry')).toBe(1);
    const s = makeBattle({ rows: base({ 1: 'sXsmsmsm' }) });
    const hc = endTurn(s, content).state; // real content: the Hard Choices override applies
    expect(hc.board.cells.findIndex((t, i) => t?.id === 'worry' && i % 8 === 1)).toBe(3 * 8 + 1); // y=1 → y=3
  });
});

describe('refill damping', () => {
  const withP = (p: number) => ({ ...c, config: { ...c.config, refillNoMatchChance: p } });
  const matchedWaves = (r: { events: { event: { type: string } }[] }) => r.events.filter((e) => e.event.type === 'matched').length;
  // Swapping (6,0) and (7,0) makes Fasting ×3 on the top row; three new tiles drop in from Mud, Space and Time.
  const topRowSet = (seed: number) => makeBattle({
    rows: base({ 0: 'XsmsFFsF' }),
    state: (s) => { s.rng = seed; s.pool = ['mud', 'space', 'time'].map((id) => ({ kind: 'junk' as const, id, weight: 1 })); },
  });

  it('at 1, new tiles from above the board never complete a set', () => {
    for (let seed = 1; seed <= 30; seed++) expect(matchedWaves(playerMove(topRowSet(seed), { x: 6, y: 0 }, { x: 7, y: 0 }, withP(1)))).toBe(1);
  });

  it('at 0, they sometimes do (the sanity check for the test above)', () => {
    const waves = Array.from({ length: 30 }, (_, i) => matchedWaves(playerMove(topRowSet(i + 1), { x: 6, y: 0 }, { x: 7, y: 0 }, withP(0))));
    expect(waves.some((n) => n > 1)).toBe(true);
  });

  it('at 1, tiles already on the board that fall into a set still go off (strategic cascades)', () => {
    // Swap (0,4) and (0,5): Fasting ×3 down column 0. The Mud above falls to (0,7) and lines up with two more.
    const s = makeBattle({ rows: base({ 4: 'Fsmsmsms', 5: 'mmsmsmsm', 6: 'Fsmsmsms', 7: 'Fmmsmsms' }) });
    const mud = [1, 2].map((x) => at(s, x, 7)!.uid);
    const r = playerMove(s, { x: 0, y: 4 }, { x: 0, y: 5 }, withP(1));
    expect(matchedWaves(r)).toBeGreaterThanOrEqual(2);
    expect(r.state.board.cells.some((t) => t && mud.includes(t.uid))).toBe(false); // the Mud line went off
  });
});

describe('incomingHits: the enemy tiles that will hit you this enemy turn', () => {
  const uidAt = (st: ReturnType<typeof makeBattle>, x: number, y: number) => at(st, x, y)!.uid;

  it('a Speed 2 Grief one row up will hit (not only the bottom row); the Worry far up will not', () => {
    const s = makeBattle({ rows: base({ 6: 'smsYsmsm' }) });
    expect([...incomingHits(s, c)]).toEqual([uidAt(s, 3, 6)]);
  });

  it('a Stone below holds it, so it will not hit', () => {
    const s = makeBattle({ rows: base({ 5: 'smsYsmsm', 6: 'msmOmsms' }) });
    expect(incomingHits(s, c).size).toBe(0);
  });

  it('a Locked tile on the bottom row will not hit', () => {
    const s = makeBattle({ rows: base({ 7: 'smsYsmsm' }), state: (st) => { st.board.cells[7 * 8 + 3]!.lockedUntil = st.round; } });
    expect(incomingHits(s, c).size).toBe(0);
  });

  it('it matches what endTurn actually does, and changes nothing', () => {
    const s = makeBattle({ rows: base({ 6: 'smsYsmsm' }) });
    const before = JSON.stringify(s);
    incomingHits(s, c);
    expect(JSON.stringify(s)).toBe(before);
    expect(endTurn(s, c).state.player.hp).toBe(s.player.hp - 3);
  });
});

describe('Grief and The Long Night', () => {
  it('The Long Night: one row of Grief across the top of the board, nothing to come', () => {
    const p = createPlayer(content);
    const { state } = createBattle({ player: p, enemyId: 'long_night', loadout: ['t1', 't2', 't3'], seed: 7 }, content);
    const grief = state.board.cells.map((t, i) => (t?.id === 'grief' ? i : -1)).filter((i) => i >= 0);
    expect(grief).toEqual([0, 1, 2, 3, 4, 5, 6, 7]);
    expect(state.board.cells.filter((t) => t?.kind === 'enemy')).toHaveLength(8);
    expect(enemyToCome(state, content)).toBe(0);
    expect(content.enemies.long_night.tier).toBe('elite');
  });

  it('Grief takes 2 steps, breaking what is below; from the bottom row it hits you for 3 and leaves', () => {
    const s = makeBattle({ rows: base({ 6: 'smsYsmsm' }) });
    const r = endTurn(s, c);
    expect(r.state.player.hp).toBe(s.player.hp - 3);
    expect(r.state.board.cells.some((t) => t?.id === 'grief')).toBe(false);
    expect(r.events.some((e) => e.event.type === 'removed')).toBe(true);
    expect(r.state.outcome).toBeNull(); // the Worry top-left is still there
  });

  it('Block absorbs the Grief hit, and Grief still leaves', () => {
    const s = makeBattle({ rows: base({ 7: 'smsYsmsm' }), state: (st) => { st.player.block = 1; } });
    const r = endTurn(s, c);
    expect(r.state.player.hp).toBe(s.player.hp - 2);
    expect(r.state.board.cells.some((t) => t?.id === 'grief')).toBe(false);
  });

  it('a Stone holds Grief for a turn (it cracks, Grief stays put)', () => {
    const s = makeBattle({ rows: base({ 4: 'smsYsmsm', 5: 'msmOmsms' }) });
    const r = endTurn(s, c);
    expect(at(r.state, 3, 4)?.id).toBe('grief');
    expect(at(r.state, 3, 5)?.hp).toBe(1);
  });

  it('the last Grief leaving wins the battle', () => {
    const rows = Array.from({ length: 8 }, (_, y) => (y === 7 ? 'smsYsmsm' : y % 2 ? F2 : F1));
    const r = endTurn(makeBattle({ rows }), c);
    expect(r.state.outcome).toBe('victory');
    expect(r.state.player.hp).toBe(r.state.player.maxHp - 3);
  });
});

describe('Momentum', () => {
  const withMomentum = (row: string, m: number) => makeBattle({ rows: base({ 7: row }), state: (x) => { x.player.momentum = m; } });

  it('unspent Block becomes Momentum at the start of your turn, adding to what you have', () => {
    const s = makeBattle({ rows: base({}), state: (x) => { x.player.block = 4; x.player.momentum = 2; } });
    const r = endTurn(s, c); // nothing reaches you
    expect(r.state.player.block).toBe(0);
    expect(r.state.player.momentum).toBe(6);
  });

  it('Block spent on a hit is not Momentum', () => {
    const s = makeBattle({ rows: base({ 7: 'smsmXmsm' }), state: (x) => { x.player.block = 3; } });
    const r = endTurn(s, c); // the Worry on the bottom row hits for 1
    expect(r.state.player.momentum).toBe(2);
  });

  it('every 3 gives the next damage set +1 Dmg on every hit, and it spends all of it', () => {
    const r = playerMove(withMomentum('PPsPsmsm', 3), { x: 2, y: 7 }, { x: 3, y: 7 }, c);
    expect(r.state.pending[0].damage).toBe(4);
    expect(r.state.player.momentum).toBe(0);
  });

  it('Time with 6 Momentum deals 1 + 2', () => {
    const r = playerMove(withMomentum('iisismsm', 6), { x: 2, y: 7 }, { x: 3, y: 7 }, c);
    expect(r.state.pending[0].damage).toBe(3);
    expect(r.state.player.momentum).toBe(0);
  });

  it('less than 3 adds nothing but is still all spent', () => {
    const r = playerMove(withMomentum('PPsPsmsm', 2), { x: 2, y: 7 }, { x: 3, y: 7 }, c);
    expect(r.state.pending[0].damage).toBe(3);
    expect(r.state.player.momentum).toBe(0);
  });

  it('sets that deal no damage (Anoint, Thanksgiving) leave it alone', () => {
    expect(playerMove(withMomentum('AAsAsmsm', 5), { x: 2, y: 7 }, { x: 3, y: 7 }, c).state.player.momentum).toBe(5);
    expect(playerMove(withMomentum('TTsTsmsm', 5), { x: 2, y: 7 }, { x: 3, y: 7 }, c).state.player.momentum).toBe(5);
  });

  it('abilities neither use nor spend it', () => {
    const s = makeBattle({ rows: base({}), player: (p) => (p.abilities = [{ id: 'abstain', uses: 3 }]), state: (x) => { x.player.momentum = 6; } });
    const r = useAbility(s, 0, c);
    expect(r.state.pending[0].damage).toBe(10);
    expect(r.state.player.momentum).toBe(6);
  });
});

describe('Stone', () => {
  it('never forms sets: three Stones in a line stay on the board', () => {
    const s = makeBattle({ rows: base({ 7: 'OOsOsmsm' }) });
    const r = playerMove(s, { x: 2, y: 7 }, { x: 3, y: 7 }, c);
    expect([0, 1, 2].map((x) => at(r.state, x, 7)?.kind)).toEqual(['stone', 'stone', 'stone']);
    expect(findSets(r.state)).toEqual([]);
  });
});
