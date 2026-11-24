// Set-density sim: how easy is it to make sets? The balance bot plays every loadout against each enemy and this
// reports, per enemy:
//   - set-making swaps available at the start of turn 1 (and at the start of every turn)
//   - sets the bot's swap makes, and sets that then form on their own (cascades from refills)
//   - sets that form on their own during the enemy turn (Greed junking, enemy steps)
//   - sets and enemy tiles destroyed per turn
// It repeats this for each mix of junk-type count (extra types are do-nothing tiles like Space) and refill damping
// chance (config.refillNoMatchChance). Goals for these numbers: docs/combat-tuning.md.
// Run it with `pnpm exec vitest run tests/sim/sets --silent=false`
// (options: SEEDS=12, ENEMY=financial_stress, JUNK=2,3,4, REFILL=0,0.7,1).
import { content, type Content } from '../../src/content';
import { createBattle, findSets, tileAt } from '../../src/engine/combat';
import { createPlayer } from '../../src/engine/run';
import type { BattleState, Board, TimedEvent } from '../../src/engine/types';
import { botMove, resolvePlacements } from './bot';

const SEEDS = Number(process.env.SEEDS ?? 12);
const JUNK_COUNTS = (process.env.JUNK ?? '2,3,4').split(',').map(Number);
const REFILLS = (process.env.REFILL ?? String(content.config.refillNoMatchChance)).split(',').map(Number);
const VARIANTS = JUNK_COUNTS.flatMap((junk) => REFILLS.map((refill) => ({ junk, refill })));

/** Content with `n` junk types (Time, Space, then do-nothing copies of Space) and refill damping chance `refill`. */
function variant(n: number, refill: number): Content {
  const junk: Record<string, Content['junk'][string]> = { ...content.junk };
  const ids: string[] = ['time', 'space'];
  for (let i = 2; i < n; i++) {
    const id = `junk${i}`;
    junk[id] = { ...content.junk.space, id, name: `Junk ${i}` };
    ids.push(id);
  }
  return { ...content, junk, config: { ...content.config, junk: ids.slice(0, n), refillNoMatchChance: refill } } as unknown as Content;
}

const setsOn = (s: BattleState, board: Board) => findSets({ ...s, board });

/** Adjacent swaps on the current board that make at least one set right away (any set / a tool set). */
function setSwaps(s: BattleState): { any: number; tool: number; tools: number } {
  const b = s.board;
  let any = 0, tool = 0;
  const fireable = new Set<string>();
  for (let y = 0; y < b.height; y++) for (let x = 0; x < b.width; x++) for (const [dx, dy] of [[1, 0], [0, 1]]) {
    if (x + dx >= b.width || y + dy >= b.height) continue;
    if (!tileAt(b, x, y) || !tileAt(b, x + dx, y + dy)) continue;
    const cells = [...b.cells];
    const ia = y * b.width + x, ib = (y + dy) * b.width + x + dx;
    [cells[ia], cells[ib]] = [cells[ib], cells[ia]];
    const sets = setsOn(s, { ...b, cells });
    if (sets.length) any++;
    if (sets.some((st) => st.key.startsWith('tool:'))) tool++;
    for (const st of sets) if (st.key.startsWith('tool:')) fireable.add(st.key);
  }
  return { any, tool, tools: fireable.size };
}

interface Tally {
  t1Swaps: number; t1ToolSwaps: number; t1N: number;
  turnSwaps: number; turnToolSwaps: number; turnTools: number; turnN: number;
  setMoves: number; playerSets: number; autoSets: number; autoToolSets: number; movesWithCascade: number;
  enemySets: number; enemyToolSets: number;
  turns: number; totalSets: number; enemyKilled: number;
  wins: number; games: number; dmg: number;
}
const blank = (): Tally => ({
  t1Swaps: 0, t1ToolSwaps: 0, t1N: 0, turnSwaps: 0, turnToolSwaps: 0, turnTools: 0, turnN: 0, setMoves: 0, playerSets: 0, autoSets: 0,
  autoToolSets: 0, movesWithCascade: 0, enemySets: 0, enemyToolSets: 0, turns: 0, totalSets: 0, enemyKilled: 0, wins: 0, games: 0, dmg: 0,
});

/** Classify the sets in one bot move's events. */
function tallyEvents(start: BattleState, events: TimedEvent[], t: Tally) {
  let board = start.board;
  let wave = 0; // matched waves since the swap
  let enemyPhase = false;
  let movePlayer = 0, moveAuto = 0;
  for (const { event, after } of events) {
    switch (event.type) {
      case 'swapped': wave = 0; break;
      case 'shining': case 'enemyTurn': case 'enemyStep': case 'playerHit': enemyPhase = true; break;
      case 'turnStart': enemyPhase = false; break;
      case 'damaged': {
        const kinds = new Map(board.cells.filter(Boolean).map((tl) => [tl!.uid, tl!.kind]));
        t.enemyKilled += event.deleted.filter((u) => kinds.get(u) === 'enemy').length;
        break;
      }
      case 'matched': {
        const sets = setsOn(start, board);
        const tools = sets.filter((st) => st.key.startsWith('tool:')).length;
        t.totalSets += sets.length;
        if (enemyPhase) { t.enemySets += sets.length; t.enemyToolSets += tools; }
        else if (wave === 0) { movePlayer += sets.length; }
        else { moveAuto += sets.length; t.autoToolSets += tools; }
        wave++;
        break;
      }
    }
    board = after.board;
  }
  if (movePlayer > 0) {
    t.setMoves++;
    t.playerSets += movePlayer;
    t.autoSets += moveAuto;
    if (moveAuto > 0) t.movesWithCascade++;
  }
}

function run(c: Content, enemyId: string, loadout: string[], seed: number, t: Tally) {
  const p = createPlayer(c);
  let s = createBattle({ player: p, enemyId, loadout, seed }, c).state;
  let r = seed;
  const rnd = () => ((r = (r * 1103515245 + 12345) % 2147483648) / 2147483648);
  let lastRound = 0, turns = 0;
  while (!s.outcome && turns < 40) {
    if (s.phase === 'placing') { s = resolvePlacements(s, c); continue; }
    if (s.round !== lastRound) {
      const sw = setSwaps(s);
      if (s.round === 1) { t.t1Swaps += sw.any; t.t1ToolSwaps += sw.tool; t.t1N++; }
      t.turnSwaps += sw.any; t.turnToolSwaps += sw.tool; t.turnTools += sw.tools; t.turnN++;
      lastRound = s.round;
    }
    const events: TimedEvent[] = [];
    const before = s;
    s = botMove(s, rnd, c, events);
    tallyEvents(before, events, t);
    if (s.round !== before.round) turns++;
  }
  t.turns += turns + (s.outcome ? 1 : 0);
  t.games++;
  if (s.outcome === 'victory') t.wins++;
  t.dmg += p.hp - s.player.hp;
}

it('sets', () => {
  // Every 3 of the starting tools (createPlayer gives them uids t1, t2, … in order).
  const uids = content.config.startingTools.map((_, i) => `t${i + 1}`);
  const n = uids.length;
  const combos: string[][] = [];
  for (let a = 0; a < n; a++) for (let b = a + 1; b < n; b++) for (let d = b + 1; d < n; d++) combos.push([uids[a], uids[b], uids[d]]);
  const f = (n: number, d = 2) => n.toFixed(d);
  const lines: string[] = [];
  for (const enemyId of Object.keys(content.enemies).filter((e) => !process.env.ENEMY || e === process.env.ENEMY)) {
    lines.push(`\n== ${content.enemies[enemyId].name} (${combos.length} loadouts × ${SEEDS} seeds) ==`);
    lines.push('junk types                         ' + VARIANTS.map((v) => String(v.junk).padStart(8)).join(''));
    lines.push('refill damping                     ' + VARIANTS.map((v) => String(v.refill).padStart(8)).join(''));
    const rows: [string, (t: Tally) => string][] = [
      ['T1: set-making swaps', (t) => f(t.t1Swaps / t.t1N, 1)],
      ['T1: tool-set swaps', (t) => f(t.t1ToolSwaps / t.t1N, 1)],
      ['any turn: set-making swaps', (t) => f(t.turnSwaps / t.turnN, 1)],
      ['any turn: tools you can fire (of 3)', (t) => f(t.turnTools / t.turnN, 1)],
      ['sets made by a swap', (t) => f(t.playerSets / t.setMoves)],
      ['auto sets per set-making swap', (t) => f(t.autoSets / t.setMoves)],
      ['  of which tool sets', (t) => f(t.autoToolSets / t.setMoves)],
      ['% swaps that cascade', (t) => f((100 * t.movesWithCascade) / t.setMoves, 0)],
      ['auto sets in enemy turn / turn', (t) => f(t.enemySets / t.turns)],
      ['sets per turn (all)', (t) => f(t.totalSets / t.turns, 1)],
      ['enemy tiles killed per turn', (t) => f(t.enemyKilled / t.turns, 1)],
      ['turns', (t) => f(t.turns / t.games, 1)],
      ['win %', (t) => f((100 * t.wins) / t.games, 0)],
      ['avg damage taken', (t) => f(t.dmg / t.games, 1)],
    ];
    const tallies = VARIANTS.map(({ junk, refill }) => {
      const c = variant(junk, refill);
      const t = blank();
      for (const lo of combos) for (let i = 0; i < SEEDS; i++) run(c, enemyId, lo, 1000 + i * 7919, t);
      return t;
    });
    for (const [label, fn] of rows) lines.push(label.padEnd(35) + tallies.map((t) => fn(t).padStart(8)).join(''));
  }
  console.log(lines.join('\n'));
}, 3_600_000);
