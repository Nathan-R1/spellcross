// Spell instances, final stats and stat-based icons (spec §9, spells-and-gems §2–3).

import type { Element, GemDef, GemId, Player, ResolvedSpell, SpellDef, SpellInstance, SpellStatus } from './types';

export function gemValue(gem: GemDef, level: number): number {
  return gem.values ? gem.values[Math.min(5, Math.max(1, level)) - 1] : 0;
}

export type IconCategory = 'dmg' | 'healing' | 'block' | 'poison' | 'chaos';
const PRIORITY: IconCategory[] = ['dmg', 'healing', 'block', 'poison', 'chaos'];

export function newSpellInstance(player: Pick<Player, 'nextSpellUid'>, def: SpellDef): SpellInstance {
  const uid = `s${player.nextSpellUid++}`;
  return { uid, spellId: def.id, element: def.element, level: 1, sockets: [null, null, null] };
}

function addStatus(list: SpellStatus[], s: SpellStatus) {
  const existing = list.find((x) => x.status === s.status && x.self === s.self && x.perTile === s.perTile);
  if (existing) existing.value += s.value;
  else list.push({ ...s });
}

/** Final stats for a spell instance: base + each gem's value at the spell's level. */
export function resolveInstance(inst: SpellInstance, def: SpellDef, gemDefs: Record<GemId, GemDef>, iconExists: (path: string) => boolean): ResolvedSpell {
  const level = inst.level;
  const elements: Element[] = [inst.element];
  let damage = def.damage;
  let healing = def.healing;
  let chaos = 0;
  let selfDamage = 0;
  let extraMove = false;
  let weight = def.weight;
  const statuses: SpellStatus[] = def.statuses.map((s) => ({ ...s }));
  const gemIds: GemId[] = [];

  for (const socket of inst.sockets) {
    if (socket?.gem === 'sunstone' && socket.secondElement && !elements.includes(socket.secondElement)) elements.push(socket.secondElement);
  }
  for (const socket of inst.sockets) {
    if (!socket) continue;
    gemIds.push(socket.gem);
    const v = gemValue(gemDefs[socket.gem], level);
    switch (socket.gem) {
      case 'strikecut': damage += v; break;
      case 'lifelink': healing += v; break;
      case 'walled': addStatus(statuses, { status: 'block', value: v, self: true, perTile: true }); break;
      case 'toxicut': addStatus(statuses, { status: 'poisoned', value: v, self: false, perTile: true }); break;
      case 'cracked': chaos += v; break;
      case 'weight': weight += 0.2; break;
      case 'chargestone': for (const e of elements) addStatus(statuses, { status: `charge_${e}`, value: v, self: true, perTile: false }); break;
      case 'stormstone': for (const e of elements) addStatus(statuses, { status: `fortify_${e}`, value: v, self: true, perTile: false }); break;
      case 'darkstone': selfDamage += v; extraMove = true; break;
      case 'sunstone': break;
    }
  }

  const resolved: ResolvedSpell = {
    ref: inst.uid, spellId: def.id, name: def.name, description: def.description, elements, level,
    damage, healing, chaos, statuses, selfDamage, extraMove, weight,
    spellClass: def.spellClass, linked: def.linked, linkBehaviour: def.linkBehaviour,
    // A spell that gained damage from gems but was 'self' still targets the current enemy.
    target: def.target === 'self' && (damage > 0 || chaos > 0) ? 'single' : def.target,
    color: def.color, icon: '', hiddenCategories: 0, gems: gemIds,
  };
  const { icon, hidden } = iconForSpell(resolved, iconExists);
  resolved.icon = icon;
  resolved.hiddenCategories = hidden;
  return resolved;
}

/** Junk and nova tiles keyed by their SpellId. */
export function resolveJunk(def: SpellDef): ResolvedSpell {
  return {
    ref: def.id, spellId: def.id, name: def.name, description: def.description, elements: [def.element], level: 1,
    damage: def.damage, healing: def.healing, chaos: 0, statuses: def.statuses.map((s) => ({ ...s })), selfDamage: 0, extraMove: false,
    weight: def.weight, spellClass: def.spellClass, linked: def.linked, linkBehaviour: def.linkBehaviour, target: def.target,
    color: def.color, icon: def.icon ?? '', hiddenCategories: 0, gems: [],
  };
}

export function categoryValues(s: Pick<ResolvedSpell, 'damage' | 'healing' | 'statuses' | 'chaos'>): Record<IconCategory, number> {
  const sum = (id: string) => s.statuses.filter((x) => x.status === id).reduce((a, x) => a + x.value, 0);
  return { dmg: s.damage, healing: s.healing, block: sum('block'), poison: sum('poisoned'), chaos: s.chaos };
}

export const tierOf = (v: number) => (v >= 8 ? 3 : v >= 4 ? 2 : v >= 1 ? 1 : 0);

/**
 * Spellford `getIconPathFromStats`: tier each category, keep the first two by priority (a later one
 * replaces the lowest-tier kept one only if strictly higher), name the file by priority order and max
 * tier, then fall back to the element's default.png. Returns the number of categories it couldn't show.
 */
export function iconPathFromStats(s: Pick<ResolvedSpell, 'damage' | 'healing' | 'statuses' | 'chaos' | 'elements'>): { path: string; hidden: number } {
  const values = categoryValues(s);
  const all = PRIORITY.map((c) => [c, tierOf(values[c])] as const).filter(([, t]) => t > 0);
  const kept: (readonly [IconCategory, number])[] = [];
  for (const cat of all) {
    if (kept.length < 2) kept.push(cat);
    else {
      const lowest = Math.min(...kept.map((k) => k[1]));
      if (cat[1] > lowest) {
        let i = -1;
        kept.forEach((k, j) => { if (k[1] === lowest) i = j; });
        kept[i] = cat;
      }
    }
  }
  if (kept.length === 0) kept.push(['dmg', 0]);
  kept.sort((a, b) => PRIORITY.indexOf(a[0]) - PRIORITY.indexOf(b[0]));
  const maxTier = Math.max(...kept.map((k) => k[1]));
  const name = kept.length === 2 ? `${kept[0][0]}-${kept[1][0]}-${maxTier}` : `${kept[0][0]}-${maxTier}`;
  return { path: `spells/${s.elements[0]}/${name}.png`, hidden: Math.max(0, all.length - 2) };
}

export function iconForSpell(s: ResolvedSpell, iconExists: (path: string) => boolean): { icon: string; hidden: number } {
  const { path, hidden } = iconPathFromStats(s);
  if (iconExists(path)) return { icon: path, hidden };
  const fallback = `spells/${s.elements[0]}/default.png`;
  return { icon: iconExists(fallback) ? fallback : '', hidden };
}
