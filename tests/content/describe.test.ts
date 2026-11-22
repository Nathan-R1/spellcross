import { abilities } from '../../src/content/abilities';
import { describeAbility, poisonTotal } from '../../src/content/describe';

describe('ability descriptions', () => {
  it('every ability gets concrete numbers', () => {
    for (const def of Object.values(abilities)) {
      const d = describeAbility(def);
      expect(d.summary.length).toBeGreaterThan(3);
      expect(d.lines.length).toBeGreaterThanOrEqual(2);
      expect(d.lines.join(' ')).toMatch(/\d/);
    }
  });

  it('says exactly what each kind of ability does', () => {
    expect(describeAbility(abilities.low_blow).lines[0]).toContain('6 damage at the start of its turn, then 1 less each turn (21 damage in total)');
    expect(describeAbility(abilities.crane_stance).summary).toBe('+20 Block');
    expect(describeAbility(abilities.finisher).lines[0]).toBe('Deal 15 Fire damage to your target. Its Block absorbs damage first.');
    expect(describeAbility(abilities.fuel_of_stone).lines[0]).toContain('your Earth spells deal +2 damage per tile matched');
    expect(describeAbility(abilities.bulwark_of_ice).lines[0]).toContain('every time you cast a Water spell, gain 1 Block per tile matched');
    expect(describeAbility(abilities.sicken).summary).toBe("Triple target's Poison");
    expect(describeAbility(abilities.bulwark_of_stone).lines[0]).toContain('every time you cast an Earth spell');
    expect(poisonTotal(18)).toBe(171);
  });
});
