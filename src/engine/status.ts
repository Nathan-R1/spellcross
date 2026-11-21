// Status behaviours (spec §6.6). Status *data* lives in content/statuses.ts; behaviour is keyed by family.

import type { Combatant, Element, StatusDef, StatusInstance } from './types';

export type StatusDefs = Record<string, StatusDef>;

export function statusValue(c: Combatant, id: string): number {
  return c.statuses.find((s) => s.id === id)?.value ?? 0;
}

/** Merge a status: values add (Weak's value is its remaining turns). Non-positive totals expire. */
export function addStatus(c: Combatant, id: string, value: number): void {
  if (value === 0) return;
  const existing = c.statuses.find((s) => s.id === id);
  if (existing) existing.value += value;
  else c.statuses.push({ id, value });
  c.statuses = c.statuses.filter((s) => s.value > 0);
}

export function setStatus(c: Combatant, id: string, value: number): void {
  const existing = c.statuses.find((s) => s.id === id);
  if (value <= 0) c.statuses = c.statuses.filter((s) => s.id !== id);
  else if (existing) existing.value = value;
  else c.statuses.push({ id, value });
}

export function removeStatus(c: Combatant, id: string): void {
  c.statuses = c.statuses.filter((s) => s.id !== id);
}

/** Sum of a family's values that apply to a spell with these elements (generic + matching element variants). */
export function familyBonus(c: Combatant, defs: StatusDefs, family: 'charge' | 'fortify', elements: Element[]): number {
  let total = 0;
  for (const s of c.statuses) {
    const def = defs[s.id];
    if (!def || def.family !== family) continue;
    if (!def.element || elements.includes(def.element)) total += s.value;
  }
  return total;
}

export interface DamageOutcome {
  dealt: number;
  blocked: number;
}

/**
 * One hit of damage against a combatant: Perma Block reduces it, then Block absorbs what it can and
 * loses that much (expiring at 0). Poison and self-damage bypass this (Spellford `takeDamage`).
 */
export function applyHit(c: Combatant, amount: number): DamageOutcome {
  let dmg = Math.max(0, Math.floor(amount));
  const perma = statusValue(c, 'perma_block');
  let blocked = Math.min(dmg, perma);
  dmg -= blocked;
  const block = statusValue(c, 'block');
  const absorbed = Math.min(dmg, block);
  if (absorbed > 0) setStatus(c, 'block', block - absorbed);
  dmg -= absorbed;
  blocked += absorbed;
  c.hp = Math.max(0, c.hp - dmg);
  return { dealt: dmg, blocked };
}

export function applyUnblockable(c: Combatant, amount: number): number {
  const dmg = Math.max(0, Math.floor(amount));
  c.hp = Math.max(0, c.hp - dmg);
  return dmg;
}

export function heal(c: Combatant, amount: number): number {
  const before = c.hp;
  c.hp = Math.min(c.maxHp, c.hp + Math.max(0, Math.floor(amount)));
  return c.hp - before;
}

/** Owner's turn start: Block clears (D8), then Poisoned deals its value and halves. Returns poison damage. */
export function onTurnStart(c: Combatant): number {
  removeStatus(c, 'block');
  const poison = statusValue(c, 'poisoned');
  if (poison > 0) {
    applyUnblockable(c, poison);
    setStatus(c, 'poisoned', Math.floor(poison / 2));
  }
  return poison;
}

/** Owner's turn end: Weak loses a turn. */
export function onTurnEnd(c: Combatant): void {
  const weak = statusValue(c, 'weakness');
  if (weak > 0) setStatus(c, 'weakness', weak - 1);
}

export const isWeak = (c: Combatant) => statusValue(c, 'weakness') > 0;
export const weakAdjust = (c: Combatant, dmg: number) => (isWeak(c) ? Math.floor(dmg * 0.75) : dmg);

export function cloneStatuses(list: StatusInstance[]): StatusInstance[] {
  return list.map((s) => ({ ...s }));
}
