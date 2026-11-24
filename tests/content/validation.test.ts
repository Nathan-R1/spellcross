// Content validation (doc 04 "Validation at boot"): references resolve, rules hold, art exists.

import { content } from '../../src/content';
import { genCell, generatorEnemyTiles } from '../../src/content/enemies';
import { events as eventNodes, RANDOM_EVENTS, STOP_EVENTS } from '../../src/content/events';
import { FRUIT_IDS } from '../../src/content/fruits';
import { STONE } from '../../src/content/tools';
import { describeAbility, describeTile, effectRows } from '../../src/content/describe';
import { TRIGGERS, type Effect, type TileDef, type TileRef } from '../../src/engine/types';

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

  it('every trigger and effect is valid and has text (tile-effects.md)', () => {
    const tiles: [TileRef, TileDef][] = [
      ...Object.values(c.tools).map((d): [TileRef, TileDef] => [{ kind: 'tool', id: d.id }, d]),
      ...Object.values(c.junk).map((d): [TileRef, TileDef] => [{ kind: 'junk', id: d.id }, d]),
      [{ kind: 'stone', id: 'stone' }, STONE],
      ...Object.values(c.enemyTiles).map((d): [TileRef, TileDef] => [{ kind: 'enemy', id: d.id }, d]),
    ];
    const refExists = (r: TileRef) => (r.kind === 'tool' ? !!c.tools[r.id] : r.kind === 'junk' ? !!c.junk[r.id] : r.kind === 'enemy' ? !!c.enemyTiles[r.id] : r.id === 'stone');
    const check = (e: Effect, where: string, trigger: string) => {
      expect(effectRows(e, 1).length, where).toBeGreaterThan(0);
      if (e.type === 'attack' && e.onDestroy) expect(refExists(e.onDestroy), `${where} onDestroy`).toBe(true);
      if (e.type === 'create' && e.what.kind !== 'randomJunk') expect(refExists(e.what), `${where} create`).toBe(true);
      // Tiles you aim only make sense when you act (Set formed, On use); the game picks targets for enemy triggers.
      const aimed = 'targets' in e && (e.targets.type === 'chooseAnywhere' || e.targets.type === 'chooseShape');
      if (aimed) expect(['setFormed', 'onUse'], `${where}: aimed targets in ${trigger}`).toContain(trigger);
      if (e.type === 'gain' && typeof e.amount !== 'number') expect(trigger, `${where}: per tile in the set`).toBe('setFormed');
    };
    for (const [ref, d] of tiles) {
      for (const t of Object.keys(d.triggers)) expect(TRIGGERS, `${d.id}: ${t}`).toContain(t);
      for (const [t, effects] of Object.entries(d.triggers)) for (const e of effects ?? []) check(e, d.id, t);
      if (d.triggers.eachStep) expect(d.speed, `${d.id} has Each step but never moves`).toBeGreaterThan(0);
      expect(describeTile(ref).attrs.length + describeTile(ref).description.length, `${d.id} has no text`).toBeGreaterThan(0);
    }
    for (const t of Object.values(c.tools)) expect(t.triggers.setFormed, `${t.id} has no Set formed`).toBeDefined();
    for (const a of Object.values(c.abilities)) {
      for (const e of a.onUse) check(e, a.id, 'onUse');
      expect(describeAbility(a).summary, a.id).not.toBe('');
    }
  });

  it('Worship names its targets with a tile icon: "Every adjacent [Space]"', () => {
    const rows = describeTile({ kind: 'tool', id: 'worship' }).attrs;
    const targets = rows.filter((r) => r.label === 'Targets').at(-1)!;
    expect(targets.parts).toEqual(['Every adjacent ', { kind: 'junk', id: 'space' }]);
  });

  it("every enemy's setup description states its enemy-tile total", () => {
    for (const e of Object.values(c.enemies)) expect(e.description).toContain(String(generatorEnemyTiles(e, c.config.board.width)));
    expect(generatorEnemyTiles(c.enemies.hard_choices)).toBe(32);
    expect(generatorEnemyTiles(c.enemies.financial_stress)).toBe(32);
    expect(generatorEnemyTiles(c.enemies.all_quiet)).toBe(8);
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
