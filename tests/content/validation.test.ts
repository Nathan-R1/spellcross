// Content validation (doc 04 "Validation at boot"): references resolve, rules hold, art exists.

import { content } from '../../src/content';
import { genCell, generatorEnemyTiles } from '../../src/content/enemies';
import { events as eventNodes, RANDOM_EVENTS, STOP_EVENTS } from '../../src/content/events';
import { FRUIT_IDS } from '../../src/content/fruits';
import { STONE } from '../../src/content/tools';

const c = content;

describe('content validation', () => {
  it('every enemy generator names real enemy tiles and starts with at least one on the board', () => {
    for (const e of Object.values(c.enemies)) {
      const ids = (rows: typeof e.generator) => rows.flatMap((r) => [0, 1, 2, 3, 4, 5, 6, 7].map((x) => genCell(r, x)).filter((id): id is string => !!id));
      for (const id of ids(e.generator)) expect(c.enemyTiles[id], id).toBeDefined();
      expect(ids(e.generator.slice(0, c.config.board.height)).length, e.id).toBeGreaterThan(0);
      for (const r of e.generator) if (typeof r === 'object' && 'cells' in r) expect(r.cells).toHaveLength(c.config.board.width);
    }
  });

  it("every enemy's setup description states its enemy-tile total", () => {
    for (const e of Object.values(c.enemies)) expect(e.description).toContain(String(generatorEnemyTiles(e, c.config.board.width)));
    expect(generatorEnemyTiles(c.enemies.hard_choices)).toBe(32);
    expect(generatorEnemyTiles(c.enemies.financial_stress)).toBe(32);
  });

  it('starting tools exist and are not parked; there are 9 fruit', () => {
    for (const id of c.config.startingTools) {
      expect(c.tools[id]).toBeDefined();
      expect(c.tools[id].parked).toBeFalsy();
    }
    expect(FRUIT_IDS).toHaveLength(9);
  });

  it('every icon, portrait and event image exists in the asset manifest', () => {
    const paths = [
      ...Object.values(c.tools).map((t) => t.icon), ...Object.values(c.junk).map((j) => j.icon), STONE.icon,
      ...Object.values(c.fruits).map((f) => f.icon), ...Object.values(c.abilities).map((a) => a.icon),
      ...Object.values(c.statuses).map((s) => s.icon), ...Object.values(c.enemyTiles).map((t) => t.icon),
      ...Object.values(c.enemies).map((e) => e.portrait!), ...Object.values(eventNodes).map((n) => n.image),
    ];
    for (const p of paths) expect(c.assetExists(p), p).toBe(true);
  });

  it('stop and random events exist', () => {
    for (const id of RANDOM_EVENTS) expect(eventNodes[id]).toBeDefined();
    for (const id of Object.values(STOP_EVENTS)) if (id) expect(eventNodes[id]).toBeDefined();
  });

  it('config matches the docs', () => {
    expect(c.config.player).toMatchObject({ hp: 20, movesPerTurn: 3, maxAbilities: 5 });
    expect(c.config.board).toEqual({ width: 8, height: 8 });
    expect(c.config.loadoutSize).toBe(3);
    expect(c.config.stoneHp).toBe(2);
    expect(c.config.pool.tools + c.config.pool.junk).toBeCloseTo(1);
  });
});
