// Gems (spec §9.3, spells-and-gems §3.2). Values are indexed by the level of the spell (1–5).
// dropWeight: relative chance in drops and shop offers. Weight and Cracked are the most common.

import type { GemDef, GemId } from '../engine/types';

export const gems: Record<GemId, GemDef> = {
  strikecut: { id: 'strikecut', name: 'Courageous', tier: 1, description: '+Damage per tile', values: [2, 2, 3, 4, 5], dropWeight: 4, color: '#e0503c' },
  lifelink: { id: 'lifelink', name: 'Compassionate', tier: 1, description: '+Healing per tile', values: [1, 1, 2, 3, 4], dropWeight: 4, color: '#58c46a' },
  walled: { id: 'walled', name: 'Enduring', tier: 1, description: '+Shield of Faith per tile', values: [2, 2, 3, 3, 4], dropWeight: 4, color: '#8a9bb0' },
  toxicut: { id: 'toxicut', name: 'Temperate', tier: 1, description: '+Withering per tile', values: [1, 1, 1, 2, 3], dropWeight: 4, color: '#8fd13f' },
  cracked: { id: 'cracked', name: 'Joyful', tier: 1, description: '+Chaos per tile: each use becomes damage, Shield of Faith or healing', values: [2, 2, 2, 4, 4], dropWeight: 6, color: '#c86ee0' },
  weight: { id: 'weight', name: 'Devoted', tier: 1, description: '+20% chance for this tool to appear', dropWeight: 6, color: '#c9a24a' },
  chargestone: { id: 'chargestone', name: 'Fervent', tier: 2, description: "Each use: Kindled in the tool's pillar", values: [1, 1, 1, 2, 3], dropWeight: 2, color: '#f2d64b' },
  stormstone: { id: 'stormstone', name: 'Persevering', tier: 2, description: "Each use: Steadfast in the tool's pillar", values: [1, 1, 1, 2, 3], dropWeight: 2, color: '#5bb7e6' },
  darkstone: { id: 'darkstone', name: 'Sacrificial', tier: 3, description: 'Each use: take self-damage. +1 move (once per turn)', values: [3, 3, 4, 4, 5], dropWeight: 1, color: '#4a3a5c' },
  sunstone: { id: 'sunstone', name: 'Gracious', tier: 3, description: 'The tool stands on a second pillar', dropWeight: 1, color: '#ffb340' },
};

export const GEM_IDS = Object.keys(gems) as GemId[];
