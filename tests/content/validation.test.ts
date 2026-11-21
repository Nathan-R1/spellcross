// Content validation (doc 04 "Validation at boot"): references resolve, rules hold, art exists.

import { content, flattenIntent } from '../../src/content';
import { events as eventNodes, RANDOM_EVENTS, STOP_EVENTS } from '../../src/content/events';
import { STARTING_SPELLS } from '../../src/content/spells';

const c = content;

describe('content validation', () => {
  it('every named intent flattens without cycles', () => {
    for (const id of Object.keys(c.intents)) expect(flattenIntent(id, c.intents).length).toBeGreaterThan(0);
  });

  it('every enemy has at least one intent; board intents only on elites and bosses', () => {
    for (const e of Object.values(c.enemies)) {
      const parts = c.enemyIntents[e.id].flatMap((i) => i.parts);
      expect(parts.length).toBeGreaterThan(0);
      if (e.tier === 'normal') expect(parts.some((p) => p.type === 'lock' || p.type === 'addTiles')).toBe(false);
    }
  });

  it('encounters have 1–4 known enemies and every tier is covered', () => {
    for (const enc of Object.values(c.encounters)) {
      expect(enc.enemies.length).toBeGreaterThanOrEqual(1);
      expect(enc.enemies.length).toBeLessThanOrEqual(4);
      for (const id of enc.enemies) expect(c.enemies[id]).toBeDefined();
    }
    for (const tier of ['normal', 'elite', 'boss']) expect(Object.values(c.encounters).some((e) => e.tier === tier)).toBe(true);
  });

  it('every status referenced by spells, abilities and intents exists', () => {
    const refs = [
      ...Object.values(c.spells).flatMap((s) => s.statuses.map((x) => x.status)),
      ...Object.values(c.abilities).flatMap((a) => a.statuses.map((x) => x.status)),
      ...Object.values(c.enemyIntents).flat().flatMap((i) => i.parts.flatMap((p) => ('status' in p ? [p.status] : []))),
    ];
    for (const r of refs) expect(c.statuses[r], r).toBeDefined();
  });

  it('every addTiles intent names a junk spell', () => {
    for (const i of Object.values(c.enemyIntents).flat()) for (const p of i.parts) if (p.type === 'addTiles') expect(['dud', 'nova']).toContain(c.spells[p.spell].spellClass);
  });

  it('every fixed icon and portrait exists in the asset manifest (except known art gaps)', () => {
    const known = new Set(['spider']); // U5: no Spellford spider art
    for (const s of Object.values(c.spells)) if (s.icon) expect(c.assetExists(s.icon), s.icon).toBe(true);
    for (const a of Object.values(c.abilities)) expect(c.assetExists(a.icon), a.icon).toBe(true);
    for (const e of Object.values(c.enemies)) if (!known.has(e.id)) expect(c.assetExists(e.portrait!), e.id).toBe(true);
    for (const s of Object.values(c.statuses)) expect(c.assetExists(s.icon), s.icon).toBe(true);
    for (const n of Object.values(eventNodes)) expect(c.assetExists(n.image), n.image).toBe(true);
  });

  it('gems: effect gems have 5 values by spell level; Weight and Sunstone have none', () => {
    for (const g of Object.values(c.gems)) {
      if (g.id === 'weight' || g.id === 'sunstone') expect(g.values).toBeUndefined();
      else expect(g.values).toHaveLength(5);
    }
    expect(Object.keys(c.gems)).not.toContain('trapstone'); // G3: cut
  });

  it('starting spells are upgradable player spells', () => {
    for (const id of STARTING_SPELLS) {
      expect(c.spells[id].spellClass).toBe('player');
      expect(c.spells[id].upgradable).toBe(true);
    }
  });

  it('stop and random events exist', () => {
    for (const id of RANDOM_EVENTS) expect(eventNodes[id]).toBeDefined();
    for (const id of Object.values(STOP_EVENTS)) if (id) expect(eventNodes[id]).toBeDefined();
  });

  it('config matches the spec', () => {
    expect(c.config.player).toMatchObject({ hp: 100, movesPerTurn: 3, maxAbilities: 5 });
    expect(c.config.board).toEqual({ width: 8, visibleRows: 6, bufferRows: 6 });
    expect(c.config.loadoutSlots).toEqual({ normal: 3, elite: 4, boss: 4 });
    expect(c.config.pool.loadout + c.config.pool.duds + c.config.pool.novas).toBeCloseTo(1);
  });
});
