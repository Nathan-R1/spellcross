// Statuses (spec §6.6) and spell customisation / icons (spec §9, spells-and-gems §2–3).

import { content } from '../../src/content';
import { createPlayer } from '../../src/engine/run';
import { iconPathFromStats, resolveInstance, resolveJunk } from '../../src/engine/spells';
import { addStatus, applyHit, familyBonus, onTurnEnd, onTurnStart, statusValue } from '../../src/engine/status';
import type { Combatant, GemId, SpellInstance } from '../../src/engine/types';

const dummy = (): Combatant => ({ hp: 50, maxHp: 50, strengthStat: 1, weaknesses: [], resistances: [], statuses: [] });

describe('statuses', () => {
  it('merge by adding values', () => {
    const c = dummy();
    addStatus(c, 'poisoned', 3);
    addStatus(c, 'poisoned', 2);
    expect(statusValue(c, 'poisoned')).toBe(5);
    expect(c.statuses).toHaveLength(1);
  });

  it('Perma Block reduces a hit, then Block absorbs and depletes', () => {
    const c = dummy();
    addStatus(c, 'perma_block', 2);
    addStatus(c, 'block', 5);
    expect(applyHit(c, 10)).toEqual({ dealt: 3, blocked: 7 });
    expect(statusValue(c, 'block')).toBe(0);
    expect(c.statuses.find((s) => s.id === 'block')).toBeUndefined();
    expect(c.hp).toBe(47);
  });

  it('Block partly used keeps the remainder', () => {
    const c = dummy();
    addStatus(c, 'block', 10);
    applyHit(c, 4);
    expect(statusValue(c, 'block')).toBe(6);
    expect(c.hp).toBe(50);
  });

  it('turn start: Block clears (D8) and Poisoned deals its value then drops by 1 (D24), ignoring Block', () => {
    const c = dummy();
    addStatus(c, 'poisoned', 3);
    addStatus(c, 'block', 20);
    expect(onTurnStart(c)).toBe(3);
    expect(c.hp).toBe(47);
    expect(statusValue(c, 'block')).toBe(0);
    expect(statusValue(c, 'poisoned')).toBe(2);
    expect(onTurnStart(c)).toBe(2);
    expect(onTurnStart(c)).toBe(1);
    expect(statusValue(c, 'poisoned')).toBe(0);
    expect(c.statuses).toEqual([]);
    expect(c.hp).toBe(44); // 3 + 2 + 1
  });

  it('Weak ticks down at turn end and expires', () => {
    const c = dummy();
    addStatus(c, 'weakness', 2);
    onTurnEnd(c);
    expect(statusValue(c, 'weakness')).toBe(1);
    onTurnEnd(c);
    expect(c.statuses).toEqual([]);
  });

  it('Charge / Fortify bonuses: generic always, element variants only for matching elements', () => {
    const c = dummy();
    addStatus(c, 'charge', 1);
    addStatus(c, 'charge_fire', 2);
    addStatus(c, 'charge_water', 4);
    addStatus(c, 'fortify_air', 3);
    expect(familyBonus(c, content.statuses, 'charge', ['fire'])).toBe(3);
    expect(familyBonus(c, content.statuses, 'charge', ['fire', 'water'])).toBe(7);
    expect(familyBonus(c, content.statuses, 'charge', ['acid'])).toBe(1);
    expect(familyBonus(c, content.statuses, 'fortify', ['air'])).toBe(3);
    expect(familyBonus(c, content.statuses, 'fortify', ['earth'])).toBe(0);
  });

  it('every element has Charge and Fortify statuses (Chargestone / Stormstone)', () => {
    for (const e of ['fire', 'lightning', 'water', 'earth', 'air', 'acid']) {
      expect(content.statuses[`charge_${e}`]?.family).toBe('charge');
      expect(content.statuses[`fortify_${e}`]?.family).toBe('fortify');
    }
  });
});

const exists = content.assetExists;
const resolve = (inst: SpellInstance) => resolveInstance(inst, content.spells[inst.spellId], content.gems, exists);
function spell(id: string, opts: Partial<SpellInstance> = {}, gems: (GemId | { gem: GemId; secondElement?: SpellInstance['element'] })[] = []): SpellInstance {
  const def = content.spells[id];
  const sockets = [0, 1, 2].map((i) => {
    const g = gems[i];
    if (!g) return null;
    return typeof g === 'string' ? { gem: g } : g;
  }) as SpellInstance['sockets'];
  return { uid: 'x', spellId: id, element: def.element, level: 1, sockets, ...opts };
}

describe('spell instances and gems', () => {
  it('starting spells resolve to their base stats', () => {
    const p = createPlayer(content);
    const r = p.spells.map(resolve);
    expect(r.map((s) => s.name)).toEqual(['Scorch', 'Restore', 'Strike', 'Ice Bolt', 'Venom', 'Shield']);
    expect(r[0].damage).toBe(4);
    expect(r[1].healing).toBe(2);
    expect(r[1].elements).toEqual(['water']); // D3
    expect(r[5].statuses).toEqual([{ status: 'block', value: 2, self: true, perTile: true }]);
  });

  it('gem values come from the spell level (G1): Strikecut +2 at Lv1, +4 at Lv4', () => {
    expect(resolve(spell('strike', {}, ['strikecut'])).damage).toBe(4); // "a dmg 2 spell now does dmg 4"
    expect(resolve(spell('strike', { level: 4 }, ['strikecut'])).damage).toBe(6);
    expect(resolve(spell('strike', { level: 5 }, ['strikecut', 'strikecut'])).damage).toBe(12);
  });

  it('a spell level alone changes nothing but gem values (G7)', () => {
    const base = resolve(spell('scorch'));
    const lv5 = resolve(spell('scorch', { level: 5 }));
    expect(lv5.damage).toBe(base.damage);
    expect(lv5.level).toBe(5);
  });

  it('Walled adds Block per tile, Toxicut Poisoned per tile, Lifelink healing', () => {
    const s = resolve(spell('ice_bolt', { level: 3 }, ['walled', 'toxicut', 'lifelink']));
    expect(s.statuses).toContainEqual({ status: 'block', value: 3, self: true, perTile: true });
    expect(s.statuses).toContainEqual({ status: 'poisoned', value: 1, self: false, perTile: true });
    expect(s.healing).toBe(2);
  });

  it('Walled stacks with a base Block (Shield)', () => {
    expect(resolve(spell('shield', {}, ['walled'])).statuses).toEqual([{ status: 'block', value: 4, self: true, perTile: true }]);
  });

  it('Cracked adds Chaos; Weight adds 0.2 weight each', () => {
    const s = resolve(spell('scorch', { level: 4 }, ['cracked', 'weight', 'weight']));
    expect(s.chaos).toBe(4);
    expect(s.weight).toBeCloseTo(1.4);
  });

  it('Chargestone / Stormstone give element statuses (both elements with Sunstone)', () => {
    const s = resolve(spell('scorch', {}, [{ gem: 'sunstone', secondElement: 'water' }, 'chargestone', 'stormstone']));
    expect(s.elements).toEqual(['fire', 'water']);
    expect(s.statuses).toContainEqual({ status: 'charge_fire', value: 1, self: true, perTile: false });
    expect(s.statuses).toContainEqual({ status: 'charge_water', value: 1, self: true, perTile: false });
    expect(s.statuses).toContainEqual({ status: 'fortify_water', value: 1, self: true, perTile: false });
  });

  it('Darkstone: self-damage by level and an extra move', () => {
    const s = resolve(spell('scorch', { level: 3 }, ['darkstone']));
    expect(s.selfDamage).toBe(4);
    expect(s.extraMove).toBe(true);
  });

  it('a self-target spell that gains damage targets enemies', () => {
    expect(resolve(spell('restore')).target).toBe('self');
    expect(resolve(spell('restore', {}, ['strikecut'])).target).toBe('single');
  });

  it('no cap on effect types (G6): a spell can do everything', () => {
    const s = resolve(spell('ice_bolt', {}, ['walled', 'lifelink', 'toxicut']));
    expect(s.damage).toBe(3);
    expect(s.healing).toBe(1);
    expect(s.hiddenCategories).toBe(2);
  });
});

describe('icons from stats (Spellford getIconPathFromStats)', () => {
  it('resolves the starting spells to existing art', () => {
    const p = createPlayer(content);
    expect(p.spells.map((x) => resolve(x).icon)).toEqual([
      'spells/fire/dmg-2.png',
      'spells/water/healing-1.png',
      'spells/lightning/dmg-1.png',
      'spells/water/dmg-1.png',
      'spells/acid/poison-1.png',
      'spells/earth/dmg-block-1.png',
    ]);
  });

  it('Wind Wall has no categories and no air art: empty icon (placeholder in the UI)', () => {
    expect(resolve(spell('wind_wall')).icon).toBe('');
  });

  it('falls back to the element default.png when the exact file is missing', () => {
    expect(resolve(spell('scorch', { element: 'earth' })).icon).toBe('spells/earth/default.png');
  });

  it('shows the higher tier of two categories', () => {
    const base = { healing: 0, chaos: 0, elements: ['fire' as const] };
    expect(iconPathFromStats({ ...base, damage: 8, statuses: [{ status: 'block', value: 1, self: true, perTile: true }] }).path).toBe('spells/fire/dmg-block-3.png');
  });

  it('a third category replaces the lowest only when strictly higher', () => {
    const base = { healing: 0, chaos: 0, elements: ['fire' as const] };
    const r = iconPathFromStats({ ...base, damage: 1, statuses: [{ status: 'block', value: 1, self: true, perTile: true }, { status: 'poisoned', value: 4, self: false, perTile: true }] });
    expect(r.path).toBe('spells/fire/dmg-poison-2.png');
    expect(r.hidden).toBe(1);
    const tie = iconPathFromStats({ ...base, damage: 1, statuses: [{ status: 'block', value: 1, self: true, perTile: true }, { status: 'poisoned', value: 1, self: false, perTile: true }] });
    expect(tie.path).toBe('spells/fire/dmg-block-1.png');
  });

  it('Chaos counts as the chaos category', () => {
    expect(iconPathFromStats({ damage: 0, healing: 0, chaos: 2, statuses: [], elements: ['fire'] }).path).toBe('spells/fire/chaos-1.png');
  });

  it('junk keeps its fixed icon', () => {
    expect(resolveJunk(content.spells.ash).icon).toBe('spells/dud/ash.png');
  });
});

describe('review fixes (spells)', () => {
  it('M5: a self spell with Chaos targets an enemy, since Chaos can roll damage', () => {
    expect(resolve(spell('restore', {}, ['cracked'])).target).toBe('single');
  });
});
