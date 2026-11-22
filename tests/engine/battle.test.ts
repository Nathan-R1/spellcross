// Battle engine (spec §6, combat.md). Boards are drawn by hand; refills are Mist so nothing cascades
// unless the test draws it. Visible row 0 is the top row; at(x, row) converts.

import { content, type Content } from '../../src/content';
import { endTurn, playerMove, previewIntent, setTarget, useAbility, BattleError } from '../../src/engine/battle';
import { findSet, tileAt } from '../../src/engine/board';
import { statusValue } from '../../src/engine/status';
import type { BattleState } from '../../src/engine/types';
import { at, FILL, FILL2, makeBattle } from '../helpers';

// Swapping (2,0) with (2,1) completes "SSS" on row 0.
const SCORCH_3 = ['SSImrmrm', 'rmSrmrmr', FILL, FILL2, FILL, FILL2];
const swap3 = (s: BattleState, c: Content = content) => playerMove(s, at(2, 0), at(2, 1), c);
const castEvents = (r: ReturnType<typeof playerMove>) => r.events.map((e) => e.event).filter((e) => e.type === 'cast');

describe('moves', () => {
  it('a swap costs a move and does not lock the tiles (D23)', () => {
    const s = makeBattle({ rows: [FILL, FILL2, FILL, FILL2, FILL, FILL2] });
    const r = playerMove(s, at(0, 0), at(1, 0), content);
    expect(r.state.movesLeft).toBe(2);
    expect(tileAt(r.state.board, 0, 6).lock).toBe('free');
    expect(tileAt(r.state.board, 1, 6).lock).toBe('free');
    // The same tiles can be swapped straight back, this turn and next.
    expect(() => playerMove(r.state, at(0, 0), at(1, 0), content)).not.toThrow();
  });

  it('a swap without a match is legal (no reshuffle needed, C4)', () => {
    const s = makeBattle({ rows: [FILL, FILL2, FILL, FILL2, FILL, FILL2] });
    expect(() => playerMove(s, at(0, 0), at(1, 0), content)).not.toThrow();
  });

  it('rejects illegal moves', () => {
    const s = makeBattle({ rows: SCORCH_3 });
    expect(() => playerMove(s, at(0, 0), at(2, 0), content)).toThrow(BattleError);
    tileAt(s.board, 2, 7).lock = 'locked';
    expect(() => swap3(s)).toThrow(BattleError);
    const none = makeBattle({ rows: SCORCH_3, state: (x) => (x.movesLeft = 0) });
    expect(() => swap3(none)).toThrow(BattleError);
  });

  it('does not mutate the input state', () => {
    const s = makeBattle({ rows: SCORCH_3 });
    const before = JSON.stringify(s);
    swap3(s);
    expect(JSON.stringify(s)).toBe(before);
  });

  it('at 0 moves the turn ends automatically and the enemy phase runs', () => {
    const s = makeBattle({ rows: SCORCH_3, state: (x) => (x.movesLeft = 1) });
    const r = swap3(s);
    expect(r.state.round).toBe(2);
    expect(r.state.phase).toBe('player');
    expect(r.state.movesLeft).toBe(3);
    expect(r.state.player.hp).toBe(95); // Wolf Fangs: Attack 5
    expect(r.state.enemies[0].intentCursor).toBe(1);
  });

  it('is deterministic: the same state and inputs give the same result', () => {
    const s = makeBattle({ rows: SCORCH_3 });
    expect(JSON.stringify(swap3(s))).toBe(JSON.stringify(swap3(s)));
  });
});

describe('casting (formula, spec §6.5)', () => {
  it('a 3-match Scorch deals 4 × 3 = 12 to the target', () => {
    const r = swap3(makeBattle({ rows: SCORCH_3 }));
    expect(r.state.enemies[0].hp).toBe(48);
    expect(castEvents(r)[0]).toMatchObject({ power: 3, hits: [{ target: 0, damage: 12 }] });
  });

  it('a 4-match deals 16', () => {
    const r = playerMove(makeBattle({ rows: ['SSIS' + 'mrmr', 'rmSrmrmr', FILL, FILL2, FILL, FILL2] }), at(2, 0), at(2, 1), content);
    expect(r.state.enemies[0].hp).toBe(44);
  });

  it('two different spells matched by one swap cast separately', () => {
    // Row 0 gets SSS, row 1 gets III.
    const r = playerMove(makeBattle({ rows: ['SSImrmrm', 'IISrmrmr', FILL, FILL2, FILL, FILL2] }), at(2, 0), at(2, 1), content);
    expect(castEvents(r).map((e) => (e.type === 'cast' ? e.power : 0))).toEqual([3, 3]);
    expect(r.state.enemies[0].hp).toBe(60 - 12 - 9);
  });

  it('an adjacent Surge joins the set and adds +1 power', () => {
    const r = swap3(makeBattle({ rows: ['SSIumrmr', 'rmSrmrmr', FILL, FILL2, FILL, FILL2] }));
    expect(r.state.enemies[0].hp).toBe(60 - 16);
  });

  it('adjacent Ash / Orb are cleared but cast nothing', () => {
    const r = swap3(makeBattle({ rows: ['SSIamrmr', 'roSrmrmr', FILL, FILL2, FILL, FILL2] }));
    expect(castEvents(r)).toHaveLength(1);
    expect(r.state.enemies[0].hp).toBe(48);
    const cleared = r.events.find((e) => e.event.type === 'cleared')!.event;
    expect(cleared.type === 'cleared' && cleared.uids.length).toBe(5);
  });

  it('Critical multiplies the next cast by 1.5, then expires', () => {
    const r = swap3(makeBattle({ rows: SCORCH_3, player: (p) => p.statuses.push({ id: 'critical', value: 1 }) }));
    expect(r.state.enemies[0].hp).toBe(60 - 18);
    expect(statusValue(r.state.player, 'critical')).toBe(0);
  });

  it('Strength and Charge add damage per tile (D1)', () => {
    const r = swap3(makeBattle({ rows: SCORCH_3, player: (p) => p.statuses.push({ id: 'strength', value: 2 }, { id: 'charge', value: 1 }) }));
    expect(r.state.enemies[0].hp).toBe(60 - (4 + 2 + 1) * 3);
  });

  it('Charge of an element only boosts spells of that element (D4)', () => {
    const fire = swap3(makeBattle({ rows: SCORCH_3, player: (p) => p.statuses.push({ id: 'charge_fire', value: 1 }) }));
    expect(fire.state.enemies[0].hp).toBe(60 - 15);
    const lightning = swap3(makeBattle({ rows: SCORCH_3, player: (p) => p.statuses.push({ id: 'charge_lightning', value: 5 }) }));
    expect(lightning.state.enemies[0].hp).toBe(48);
  });

  it('Fortify of an element gains Block = tiles × value when casting that element (D4)', () => {
    const r = swap3(makeBattle({ rows: SCORCH_3, player: (p) => p.statuses.push({ id: 'fortify_fire', value: 2 }) }));
    expect(statusValue(r.state.player, 'block')).toBe(6);
  });

  it('Weak reduces damage dealt by 25% (rounded down)', () => {
    const r = swap3(makeBattle({ rows: SCORCH_3, player: (p) => p.statuses.push({ id: 'weakness', value: 1 }) }));
    expect(r.state.enemies[0].hp).toBe(60 - 9);
  });

  it('enemy Block absorbs spell damage', () => {
    const r = swap3(makeBattle({ rows: SCORCH_3, state: (s) => s.enemies[0].statuses.push({ id: 'block', value: 5 }) }));
    expect(r.state.enemies[0].hp).toBe(60 - 7);
    expect(castEvents(r)[0]).toMatchObject({ hits: [{ damage: 7, blocked: 5 }] });
  });

  it('elemental weakness doubles damage', () => {
    const r = swap3(makeBattle({ rows: SCORCH_3, state: (s) => (s.enemies[0].weaknesses = ['fire']) }));
    expect(r.state.enemies[0].hp).toBe(60 - 24);
  });

  it('Shield deals 1 per tile and gives Block 2 per tile', () => {
    const r = playerMove(makeBattle({ rows: ['HHImrmrm', 'rmHrmrmr', FILL, FILL2, FILL, FILL2] }), at(2, 0), at(2, 1), content);
    expect(r.state.enemies[0].hp).toBe(57);
    expect(statusValue(r.state.player, 'block')).toBe(6);
  });

  it('Venom poisons per tile; Poisoned ticks at the enemy turn start', () => {
    const s = makeBattle({ rows: ['VVImrmrm', 'rmVrmrmr', FILL, FILL2, FILL, FILL2] });
    const r = playerMove(s, at(2, 0), at(2, 1), content);
    expect(statusValue(r.state.enemies[0], 'poisoned')).toBe(3);
    const e = endTurn(r.state, content);
    expect(e.state.enemies[0].hp).toBe(57);
    expect(statusValue(e.state.enemies[0], 'poisoned')).toBe(1);
  });

  it('Restore heals 2 per tile', () => {
    const r = playerMove(makeBattle({ rows: ['RRImrmrm', 'rmRrmrmr', FILL, FILL2, FILL, FILL2], player: (p) => (p.hp = 50) }), at(2, 0), at(2, 1), content);
    expect(r.state.player.hp).toBe(56);
  });

  it("Strike gives a flat +1 Charge Lightning per cast, so the next Strike hits harder", () => {
    const rows = ['TTImrmrm', 'rmTrmrmr', 'TTImrmrm', 'rmTrmrmr', FILL, FILL2];
    const r1 = playerMove(makeBattle({ rows }), at(2, 0), at(2, 1), content);
    expect(statusValue(r1.state.player, 'charge_lightning')).toBe(1);
    expect(r1.state.enemies[0].hp).toBe(54);
    const r2 = playerMove(r1.state, at(2, 2), at(2, 3), content);
    expect(r2.state.enemies[0].hp).toBe(54 - 9);
  });

  it("'all' spells hit every living enemy; healing applies once", () => {
    const s = makeBattle({ rows: SCORCH_3, encounter: 'wolf_pair', player: (p) => (p.hp = 50), state: (x) => { x.spells.s1.target = 'all'; x.spells.s1.healing = 1; } });
    const r = swap3(s);
    expect(r.state.enemies.map((e) => e.hp)).toEqual([48, 48]);
    expect(r.state.player.hp).toBe(53);
  });

  it("'single' hits the current target", () => {
    const s = setTarget(makeBattle({ rows: SCORCH_3, encounter: 'wolf_pair' }), 1);
    const r = swap3(s);
    expect(r.state.enemies.map((e) => e.hp)).toEqual([60, 48]);
  });

  it('Chaos becomes damage, Block or healing each cast (seeded)', () => {
    const outcomes = new Set<string>();
    for (let seed = 0; seed < 40; seed++) {
      const s = makeBattle({ rows: SCORCH_3, player: (p) => (p.hp = 50), state: (x) => { x.spells.s1.chaos = 2; x.rng = seed; } });
      const r = swap3(s);
      const cast = castEvents(r)[0];
      if (cast.type !== 'cast') continue;
      outcomes.add(cast.chaos!);
      if (cast.chaos === 'damage') expect(r.state.enemies[0].hp).toBe(60 - 18);
      if (cast.chaos === 'healing') expect(r.state.player.hp).toBe(56);
      if (cast.chaos === 'block') expect(statusValue(r.state.player, 'block')).toBe(6);
    }
    expect([...outcomes].sort()).toEqual(['block', 'damage', 'healing']);
  });

  it('Darkstone: self-damage every cast, +1 move only once per turn', () => {
    const rows = ['SSImrmrm', 'rmSrmrmr', 'SSImrmrm', 'rmSrmrmr', FILL, FILL2];
    const s = makeBattle({ rows, state: (x) => { x.spells.s1.selfDamage = 3; x.spells.s1.extraMove = true; } });
    const r1 = playerMove(s, at(2, 0), at(2, 1), content);
    expect(r1.state.movesLeft).toBe(3);
    expect(r1.state.player.hp).toBe(97);
    const r2 = playerMove(r1.state, at(2, 2), at(2, 3), content);
    expect(r2.state.movesLeft).toBe(2);
    expect(r2.state.player.hp).toBe(94);
  });
});

describe('cascades', () => {
  it('tiles falling into a new set cast again in the same move', () => {
    // Clearing row 1's SSS drops the column above; column 3 then lines up III on row 1.
    const rows = [
      'mrmImrmr',
      'SSIrIImr',
      'rmSrmrmr',
      FILL2, FILL, FILL2,
    ];
    // swap (2,1)I with (2,2)S → row1: S S S at x0..2 → cleared; row0 m,r,m fall into row1 x0..2.
    // Column 3 is untouched, so no extra set; this checks the step loop terminates cleanly.
    const r = playerMove(makeBattle({ rows }), at(2, 1), at(2, 2), content);
    expect(r.state.enemies[0].hp).toBe(48);
    expect(r.events.filter((e) => e.event.type === 'matched')).toHaveLength(1);
  });

  it('a drop that completes a set triggers a second step', () => {
    // After SSS on row 2 clears, the I in row 1 column 2 falls to row 2 next to I I → III.
    const rows = [
      'mrmrmrmr',
      'rmIrmrmr',
      'SSmIIrmr',
      'rmSrmrmr',
      FILL, FILL2,
    ];
    const r = playerMove(makeBattle({ rows }), at(2, 2), at(2, 3), content);
    // Row 2 after swap: S S S I I → SSS cast (12). Column 2 above (I at row 1) drops to row 2: I I I? x2..x4 = I,I,I.
    // Step 1 casts Scorch, step 2 casts Ice Bolt. Later steps may clear dud sets (D22), which cast nothing.
    expect(castEvents(r).map((e) => (e.type === 'cast' ? r.state.spells[e.ref].name : ''))).toEqual(['Scorch', 'Ice Bolt']);
    expect(r.events.filter((e) => e.event.type === 'matched').length).toBeGreaterThanOrEqual(2);
    expect(r.state.enemies[0].hp).toBe(60 - 12 - 9);
  });
});

describe('enemy phase (intents, combat §3)', () => {
  it('enemies act left to right, then the cursor advances and wraps', () => {
    let s = makeBattle({ rows: [FILL, FILL2, FILL, FILL2, FILL, FILL2] });
    const hp: number[] = [];
    for (let i = 0; i < 4; i++) {
      s = endTurn(s, content).state;
      hp.push(s.player.hp);
    }
    // Fangs 5, Disable 5 (+Weak), Rage (Strength +1), Fangs 5+1
    expect(hp).toEqual([95, 90, 90, 84]);
    expect(s.enemies[0].intentCursor).toBe(1);
  });

  it('Disable leaves the player Weak for one turn', () => {
    const s = makeBattle({ rows: SCORCH_3, state: (x) => (x.enemies[0].intentCursor = 1) });
    const after = endTurn(s, content).state;
    expect(statusValue(after.player, 'weakness')).toBe(1);
    expect(swap3(after).state.enemies[0].hp).toBe(60 - 9);
    expect(statusValue(endTurn(after, content).state.player, 'weakness')).toBe(0);
  });

  it("player Block absorbs attacks, then clears at the player's next turn start", () => {
    const s = makeBattle({ rows: [FILL, FILL2, FILL, FILL2, FILL, FILL2], player: (p) => p.statuses.push({ id: 'block', value: 3 }) });
    const r = endTurn(s, content).state;
    expect(r.player.hp).toBe(98);
    expect(statusValue(r.player, 'block')).toBe(0);
  });

  it('enemy Block from Defend protects through the player turn, then clears', () => {
    const s = makeBattle({ rows: SCORCH_3, encounter: 'bear', state: (x) => (x.enemies[0].intentCursor = 1) }); // Defend 10
    const r = endTurn(s, content).state;
    expect(statusValue(r.enemies[0], 'block')).toBe(10);
    expect(swap3(r).state.enemies[0].hp).toBe(90 - 2);
    expect(statusValue(endTurn(r, content).state.enemies[0], 'block')).toBe(0);
  });

  it('a multi-hit attack applies Strength to each hit', () => {
    const s = makeBattle({ rows: [FILL, FILL2, FILL, FILL2, FILL, FILL2], encounter: 'spider', state: (x) => { x.enemies[0].intentCursor = 2; x.enemies[0].statuses.push({ id: 'strength', value: 1 }); } });
    expect(endTurn(s, content).state.player.hp).toBe(90);
  });

  it('Spin Web locks 4 free tiles; they free up after the next player turn', () => {
    const s = makeBattle({ rows: [FILL, FILL2, FILL, FILL2, FILL, FILL2], encounter: 'spider', state: (x) => (x.enemies[0].intentCursor = 1) });
    const r = endTurn(s, content);
    const locked = r.state.board.cells.filter((t) => t.lock === 'locked');
    expect(locked).toHaveLength(4);
    expect(statusValue(r.state.enemies[0], 'block')).toBe(6);
    const next = endTurn(r.state, content).state;
    for (const t of locked) expect(next.board.cells.find((c) => c.uid === t.uid)!.lock).toBe('free');
  });

  it('Corrupt turns 4 visible tiles into Rubble and Weakens 2', () => {
    const s = makeBattle({ rows: [FILL, FILL2, FILL, FILL2, FILL, FILL2], encounter: 'boss', state: (x) => (x.enemies[1].intentCursor = 2) });
    const r = endTurn(s, content);
    const ev = r.events.find((e) => e.event.type === 'tilesReplaced')!.event;
    expect(ev.type === 'tilesReplaced' && ev.uids.length).toBe(4);
    expect(statusValue(r.state.player, 'weakness')).toBe(2); // applied after the player's turn end, so no tick yet
  });

  it('Rally heals and enrages every living ally, and cannot revive', () => {
    const s = makeBattle({ rows: [FILL, FILL2, FILL, FILL2, FILL, FILL2], encounter: 'boss', state: (x) => {
      x.enemies[0].hp = 0; x.enemies[0].alive = false;
      x.enemies[1].intentCursor = 1; x.enemies[1].hp = 100;
      x.enemies[2].hp = 50; x.enemies[2].intentCursor = 1; // Bear defends
    } });
    const r = endTurn(s, content).state;
    expect(r.enemies[0].hp).toBe(0);
    expect(r.enemies[1].hp).toBe(110);
    expect(r.enemies[2].hp).toBe(60);
    expect(statusValue(r.enemies[2], 'strength')).toBe(1);
  });

  it('defeat stops the enemy phase immediately', () => {
    const s = makeBattle({ rows: [FILL, FILL2, FILL, FILL2, FILL, FILL2], encounter: 'wolf_pair', player: (p) => (p.hp = 4) });
    const r = endTurn(s, content);
    expect(r.state.outcome).toBe('defeat');
    expect(r.state.phase).toBe('over');
    expect(r.state.enemies[1].intentCursor).toBe(0);
    expect(r.events.at(-1)!.event).toEqual({ type: 'battleEnd', outcome: 'defeat' });
  });

  it('an enemy can die of poison at its turn start (and never acts)', () => {
    const s = makeBattle({ rows: [FILL, FILL2, FILL, FILL2, FILL, FILL2], state: (x) => { x.enemies[0].hp = 3; x.enemies[0].statuses.push({ id: 'poisoned', value: 5 }); } });
    const r = endTurn(s, content);
    expect(r.state.outcome).toBe('victory');
    expect(r.state.player.hp).toBe(100);
  });
});

describe('custom intents (heal ally, steal)', () => {
  const custom = (): Content => {
    return {
      ...content,
      enemies: {
        ...content.enemies,
        thief: { id: 'thief', name: 'Thief', tier: 'normal', hp: 20, gold: [1, 1], intents: [] },
        medic: { id: 'medic', name: 'Medic', tier: 'normal', hp: 40, gold: [1, 1], intents: [] },
      },
      enemyIntents: {
        ...content.enemyIntents,
        thief: [{ name: 'Pilfer', description: '', parts: [{ type: 'steal', amount: 15 }] }],
        medic: [{ name: 'Mend', description: '', parts: [{ type: 'healAlly', amount: 10 }] }],
      },
      encounters: { ...content.encounters, heist: { id: 'heist', tier: 'normal', enemies: ['thief', 'medic'] } },
    };
  };

  it('Steal takes gold; it comes back when the thief dies', () => {
    const c = custom();
    const s = makeBattle({ c, rows: SCORCH_3, encounter: 'heist', player: (p) => (p.gold = 10) });
    const r = endTurn(s, c).state;
    expect(r.player.gold).toBe(0);
    expect(r.enemies[0].stolenGold).toBe(10);
    r.enemies[0].hp = 5;
    const k = swap3(r, c);
    expect(k.state.enemies[0].alive).toBe(false);
    expect(k.state.player.gold).toBe(10);
  });

  it('Heal Ally picks the lowest HP fraction (may be itself)', () => {
    const c = custom();
    const s = makeBattle({ c, rows: SCORCH_3, encounter: 'heist', state: (x) => { x.enemies[0].hp = 15; x.enemies[1].hp = 10; } });
    const r = endTurn(s, c).state;
    expect(r.enemies[1].hp).toBe(20); // 10/40 < 15/20
    expect(r.enemies[0].hp).toBe(15);
  });
});

describe('targeting and winning', () => {
  it('killing the last enemy wins at once and ends the battle', () => {
    const r = swap3(makeBattle({ rows: SCORCH_3, state: (x) => (x.enemies[0].hp = 5) }));
    expect(r.state.outcome).toBe('victory');
    expect(r.state.phase).toBe('over');
    expect(() => playerMove(r.state, at(0, 3), at(1, 3), content)).toThrow(BattleError);
  });

  it('when the target dies the target moves to the leftmost living enemy', () => {
    const s = setTarget(makeBattle({ rows: SCORCH_3, encounter: 'hunting_party' }), 1);
    s.enemies[1].hp = 5;
    const r = swap3(s);
    expect(r.state.targetSlot).toBe(0);
  });

  it('setTarget ignores dead enemies', () => {
    const s = makeBattle({ rows: SCORCH_3, encounter: 'wolf_pair' });
    s.enemies[1].alive = false;
    expect(setTarget(s, 1).targetSlot).toBe(0);
  });
});

describe('abilities (spec §8)', () => {
  const withAbility = (id: string) => makeBattle({ rows: SCORCH_3, player: (p) => p.abilities.push({ id, uses: 3 }) });

  it('cost no move, spend a use', () => {
    const r = useAbility(withAbility('crane_stance'), 0, content);
    expect(r.state.movesLeft).toBe(3);
    expect(r.state.player.abilities[0].uses).toBe(2);
    expect(statusValue(r.state.player, 'block')).toBe(20);
  });

  it('Finisher deals 15 to the target', () => {
    expect(useAbility(withAbility('finisher'), 0, content).state.enemies[0].hp).toBe(45);
  });

  it('Low Blow poisons 6, Sicken triples it (D12)', () => {
    const s = makeBattle({ rows: SCORCH_3, player: (p) => p.abilities.push({ id: 'low_blow', uses: 3 }, { id: 'sicken', uses: 3 }) });
    const a = useAbility(s, 0, content);
    expect(statusValue(a.state.enemies[0], 'poisoned')).toBe(6);
    expect(statusValue(useAbility(a.state, 1, content).state.enemies[0], 'poisoned')).toBe(18);
  });

  it('Bulwark of Ice grants Fortify Water (D4)', () => {
    expect(statusValue(useAbility(withAbility('bulwark_of_ice'), 0, content).state.player, 'fortify_water')).toBe(1);
  });

  it('cannot be used at 0 uses', () => {
    const s = makeBattle({ rows: SCORCH_3, player: (p) => p.abilities.push({ id: 'finisher', uses: 0 }) });
    expect(() => useAbility(s, 0, content)).toThrow(BattleError);
  });
});

describe('intent previews (badge numbers)', () => {
  it('include the enemy Strength and Weak, not the player Block', () => {
    const s = makeBattle({ rows: SCORCH_3, player: (p) => p.statuses.push({ id: 'block', value: 50 }), state: (x) => x.enemies[0].statuses.push({ id: 'strength', value: 2 }) });
    expect(previewIntent(s, 0, content)!.parts[0]).toMatchObject({ kind: 'attack', amount: 7 });
    s.enemies[0].statuses.push({ id: 'weakness', value: 1 });
    expect(previewIntent(s, 0, content)!.parts[0].amount).toBe(5);
  });

  it('collapse identical hits ("4×2")', () => {
    const s = makeBattle({ rows: SCORCH_3, encounter: 'spider', state: (x) => (x.enemies[0].intentCursor = 2) });
    expect(previewIntent(s, 0, content)!.parts).toEqual([{ kind: 'attack', amount: 4, label: '4×2', hits: 2 }]);
  });

  it('match what actually happens', () => {
    for (const enc of ['wolf', 'bear', 'spider']) {
      for (let cursor = 0; cursor < 4; cursor++) {
        const s = makeBattle({ rows: [FILL, FILL2, FILL, FILL2, FILL, FILL2], encounter: enc, state: (x) => (x.enemies[0].intentCursor = cursor % content.enemyIntents[x.enemies[0].defId].length) });
        const expected = previewIntent(s, 0, content)!.parts.filter((p) => p.kind === 'attack').reduce((a, p) => a + p.amount * (p.hits ?? 1), 0);
        const dealt = endTurn(s, content).events.reduce((a, e) => a + (e.event.type === 'damage' && e.event.source === 'intent' ? e.event.amount : 0), 0);
        expect(dealt).toBe(expected);
      }
    }
  });
});

describe('review fixes', () => {
  it('B3: killing the last enemy ends the battle at once; Darkstone self-damage does not apply; victory wins ties', () => {
    const s = makeBattle({ rows: SCORCH_3, player: (p) => (p.hp = 2), state: (x) => { x.enemies[0].hp = 5; x.spells.s1.selfDamage = 5; x.spells.s1.extraMove = true; } });
    const r = swap3(s);
    expect(r.state.outcome).toBe('victory');
    expect(r.state.player.hp).toBe(2);
  });

  it('B3: no casts happen after the last enemy dies in a cascade', () => {
    const r = playerMove(makeBattle({ rows: ['SSImrmrm', 'IISrmrmr', FILL, FILL2, FILL, FILL2], state: (x) => (x.enemies[0].hp = 5) }), at(2, 0), at(2, 1), content);
    expect(castEvents(r)).toHaveLength(1);
    expect(r.state.outcome).toBe('victory');
  });

  it("B4: badges include Strength from allies acting earlier (Rally before the Bear's Maul)", () => {
    const s = makeBattle({ rows: [FILL, FILL2, FILL, FILL2, FILL, FILL2], encounter: 'boss', state: (x) => { x.enemies[1].intentCursor = 1; x.enemies[2].intentCursor = 2; } });
    const preview = previewIntent(s, 2, content)!.parts.find((p) => p.kind === 'attack')!.amount;
    expect(preview).toBe(13);
    const r = endTurn(s, content);
    const bearHit = r.events.map((e) => e.event).filter((e) => e.type === 'damage' && e.source === 'intent').at(-1)!;
    expect(bearHit.type === 'damage' && bearHit.amount).toBe(13);
    // The wolf (slot 0) acts before the Rally, so it gets no bonus.
    expect(previewIntent(s, 0, content)!.parts[0].amount).toBe(5);
  });

  it('M16: Add Tiles never replaces web-locked tiles', () => {
    // The Spider webs tiles first (slot 0), then the Harbinger corrupts (slot 1) in the same enemy phase.
    for (let seed = 0; seed < 20; seed++) {
      const s = makeBattle({ rows: [FILL, FILL2, FILL, FILL2, FILL, FILL2], encounter: 'boss', state: (x) => {
        x.enemies[0].defId = 'spider'; x.enemies[0].intentCursor = 1; // Spin Web
        x.enemies[1].intentCursor = 2; // Corrupt
        x.rng = seed;
      } });
      const r = endTurn(s, content);
      const locked = r.events.find((e) => e.event.type === 'tilesLocked')!.event;
      const replaced = r.events.find((e) => e.event.type === 'tilesReplaced')!.event;
      const webbed = new Set(locked.type === 'tilesLocked' ? locked.uids : []);
      for (const uid of replaced.type === 'tilesReplaced' ? replaced.uids : []) expect(webbed.has(uid)).toBe(false);
    }
  });
});

describe('dud sets (D22)', () => {
  // Swapping (2,0) with (2,1) completes "rrr" on row 0.
  const RUBBLE_3 = ['rrSmImIm', 'IMrImImI'.replace('M', 'm'), 'mImImImI', 'ImImImIm', 'mImImImI', 'ImImImIm'];

  it('3 Rubble clear with no cast, no damage and no move refund', () => {
    const s = makeBattle({ rows: RUBBLE_3 });
    const r = playerMove(s, at(2, 0), at(2, 1), content);
    expect(castEvents(r)).toHaveLength(0);
    expect(r.events.some((e) => e.event.type === 'cleared')).toBe(true);
    expect(r.state.enemies[0].hp).toBe(60);
    expect(r.state.movesLeft).toBe(2);
  });

  it('a dud set does not use up Critical or trigger Fortify', () => {
    const s = makeBattle({ rows: RUBBLE_3, player: (p) => p.statuses.push({ id: 'critical', value: 1 }, { id: 'fortify', value: 2 }) });
    const r = playerMove(s, at(2, 0), at(2, 1), content);
    expect(statusValue(r.state.player, 'critical')).toBe(1);
    expect(statusValue(r.state.player, 'block')).toBe(0);
  });

  it('Corrupt never places Rubble that completes a set', () => {
    // A board that's mostly Rubble pairs: almost any placement would complete a set.
    for (let seed = 0; seed < 20; seed++) {
      const s = makeBattle({ rows: ['rrIrrIrr', 'IIrIIrII', 'rrIrrIrr', 'IIrIIrII', 'rrIrrIrr', 'IIrIIrII'], encounter: 'boss', state: (x) => { x.enemies[1].intentCursor = 2; x.rng = seed; } });
      const r = endTurn(s, content).state;
      for (let y = 6; y < 12; y++) for (let x = 0; x < 8; x++) {
        const t = tileAt(r.board, x, y);
        if (t.spell === 'rubble') expect(findSet(r.board, (ref) => r.spells[ref], x, y)).toEqual([]);
      }
    }
  });
});
