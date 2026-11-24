// Ability descriptions are generated from the data, so the text always matches what they do.

import { abilities } from '../../src/content/abilities';
import { describeAbility, describeTile } from '../../src/content/describe';
import { statuses } from '../../src/content/statuses';
import type { BattleState, Tile } from '../../src/engine/types';

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

describe('statuses in tile text', () => {
  const rowsOf = (id: string) => describeTile({ kind: 'tool', id }).attrs;

  it('Gains of a status show its icon and "N/tile": Gain: [Block], 1/tile', () => {
    expect(rowsOf('thanksgiving')).toContainEqual({ depth: 1, label: 'Gain', parts: [{ status: 'block' }, ', 1/tile'] });
    expect(rowsOf('prophecy')).toContainEqual({ depth: 1, label: 'Gain', parts: [{ status: 'foresight' }, ', 1/tile'] });
  });

  it('Apply shows the status icon: +1 [Strengthen], [Locked]', () => {
    expect(rowsOf('anoint')).toContainEqual({ depth: 2, label: 'Apply', parts: ['+1 ', { status: 'strengthen' }] });
    expect(rowsOf('preaching')).toContainEqual({ depth: 2, label: 'Apply', parts: [{ status: 'locked' }] });
  });

  it('a board tile lists its statuses first', () => {
    const live = { uid: 1, kind: 'junk', id: 'time', hp: 1, maxHp: 1, strength: 2, lockedUntil: 3 } as unknown as Tile;
    const battle = { round: 3 } as BattleState;
    expect(describeTile({ kind: 'junk', id: 'time' }, { battle }, live).attrs[0])
      .toEqual({ depth: 0, label: 'Status', parts: [{ status: 'locked' }, ' +2 ', { status: 'strengthen', value: 2 }] });
  });

  it('every status referenced in text exists', () => {
    for (const id of ['block', 'critical', 'foresight', 'locked', 'strengthen']) expect(statuses[id]?.icon).toBeTruthy();
  });
});
