// Ability descriptions are generated from the data, so the text always matches what they do.

import { abilities } from '../../src/content/abilities';
import { describeAbility } from '../../src/content/describe';

describe('ability descriptions', () => {
  it('every ability has a summary and lines with a number in them', () => {
    for (const a of Object.values(abilities)) {
      const d = describeAbility(a);
      expect(d.summary.length).toBeGreaterThan(0);
      expect(d.lines.join(' ')).toMatch(/\d/);
    }
  });

  it('says exactly what each ability does', () => {
    expect(describeAbility(abilities.abstain).summary).toBe('10 damage to 1 tile');
    expect(describeAbility(abilities.stand_firm).summary).toBe('+5 Block');
    expect(describeAbility(abilities.many_fish).summary).toBe('1 damage to 3 in a line');
    expect(describeAbility(abilities.revival).summary).toBe('+3 moves');
  });
});
