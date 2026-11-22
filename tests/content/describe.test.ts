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
    expect(describeAbility(abilities.crane_stance).summary).toBe('+20 Shield of Faith');
    expect(describeAbility(abilities.finisher).lines[0]).toBe('Deal 15 Faith damage to your target. Its Shield of Faith absorbs damage first.');
    expect(describeAbility(abilities.fuel_of_stone).lines[0]).toContain('your Unity tools deal +2 damage per tile matched');
    expect(describeAbility(abilities.bulwark_of_ice).lines[0]).toContain('every time you use a Love tool, gain 1 Shield of Faith per tile matched');
    expect(describeAbility(abilities.sicken).summary).toBe("Triple target's Withering");
    expect(describeAbility(abilities.bulwark_of_stone).lines[0]).toContain('every time you use a Unity tool');
    expect(poisonTotal(18)).toBe(171);
  });
});
