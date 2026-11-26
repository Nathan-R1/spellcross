// Tools, junk tiles and the Stone (docs/tools.md). What each does is its triggers (docs/tile-effects.md); popup text
// is generated from them, so `description` holds only anything else. Art is reused from the old spell icons until drawn.

import type { JunkDef, Pillar, TileDef, ToolDef, ToolRole } from '../engine/types';
import { config } from './config';

const T = { hp: 1, speed: 0 };
const PER_TILE = { perSetTile: 1 };
const SET_SHAPE = { type: 'chooseShape', shape: 'set' } as const;
/**
 * Tile colour by role, so tools of the same pillar (which share a frame) still look very different on the board:
 * attack pale red, defense brownish grey, control blue, support yellow. Shown as a tint over the dark card brown:
 * 20% by default, or the colour's own opacity when it has one (#rrggbbaa; attack and support are 45% so they read light, not dark).
 */
export const ROLE_COLOR: Record<ToolRole, string> = { attack: '#ff6b6b73', defense: '#ad9e88', control: '#7fc4e8', support: '#ffd96673' };
export const ROLE_NAME: Record<ToolRole, string> = { attack: 'Attack', defense: 'Defense', control: 'Control', support: 'Support' };

const parked = (id: string, name: string, pillar: Pillar, icon: string, color: string): ToolDef =>
  ({ id, name, pillar, parked: true, description: 'Parked.', icon, color, ...T, triggers: { setFormed: [{ type: 'clearsSelf' }] } });

export const tools: Record<string, ToolDef> = {
  // Parked 2026-11-24, replaced by Anoint. Its Critical still works if it comes back.
  fasting: { id: 'fasting', name: 'Fasting', pillar: 'discipline', parked: true, description: 'Critical: your next tool set is doubled.', icon: 'tools/acid/poison-1.png', color: '#59ff4d', ...T,
    triggers: { setFormed: [{ type: 'gain', what: 'critical', amount: 1 }] } },
  prayer: { id: 'prayer', name: 'Prayer', pillar: 'faith', description: '', icon: 'tools/fire/dmg-2.png', role: 'attack', color: ROLE_COLOR.attack, ...T,
    triggers: { setFormed: [{ type: 'attack', targets: SET_SHAPE, dmg: 3 }] } },
  thanksgiving: { id: 'thanksgiving', name: 'Thanksgiving', pillar: 'spirit', description: 'Block absorbs damage to you until your next turn.', icon: 'tools/water/block-1.png', role: 'defense', color: ROLE_COLOR.defense, ...T,
    triggers: { setFormed: [{ type: 'gain', what: 'block', amount: PER_TILE }] } },
  word: { id: 'word', name: 'The Word', pillar: 'truth', description: '', icon: 'tools/lightning/dmg-1.png', role: 'control', color: ROLE_COLOR.control, ...T,
    triggers: { setFormed: [{ type: 'attack', targets: { type: 'chooseAnywhere', count: PER_TILE }, dmg: 1, onDestroy: { kind: 'stone', id: 'stone' } }] } },
  prophecy: { id: 'prophecy', name: 'Prophecy', pillar: 'truth', description: '', icon: 'tools/lightning/default.png', role: 'attack', color: ROLE_COLOR.attack, ...T,
    triggers: { setFormed: [
      { type: 'attack', targets: SET_SHAPE, dmg: 1, onDestroy: { kind: 'junk', id: 'space' } },
      { type: 'gain', what: 'foresight', amount: PER_TILE },
    ] } },
  worship: { id: 'worship', name: 'Worship', pillar: 'spirit', description: '', icon: 'tools/earth/default.png', role: 'support', color: ROLE_COLOR.support, ...T,
    triggers: { setFormed: [{ type: 'attack', targets: { type: 'chooseShape', shape: 'square', filter: ['junk'] }, dmg: 1 }] } },
  preaching: { id: 'preaching', name: 'Preaching', pillar: 'discipline', description: '', icon: 'tools/water/default.png', role: 'control', color: ROLE_COLOR.control, ...T,
    triggers: { setFormed: [{ type: 'attack', targets: { type: 'chooseAnywhere', count: PER_TILE }, dmg: 1, apply: 'locked' }] } },
  anoint: { id: 'anoint', name: 'Anoint', pillar: 'faith', description: 'A Strengthened tile makes the set it clears in 1 tile bigger per point.', icon: 'tools/fire/default.png', role: 'support', color: ROLE_COLOR.support, ...T,
    triggers: { setFormed: [{ type: 'attack', targets: SET_SHAPE, dmg: 0, apply: 'strengthen', applyAmount: 2 }] } },
  fellowship: { id: 'fellowship', name: 'Fellowship', pillar: 'discipline', description: '', icon: 'tools/svgs/fellowship.svg', role: 'defense', color: ROLE_COLOR.defense, ...T,
    triggers: { setFormed: [{ type: 'becomes', what: { kind: 'junk', id: 'community' } }] } },
  // Parked (tools.md §1.2): no effect until redesigned.
  healing: parked('healing', 'Healing', 'love', 'tools/water/healing-1.png', '#b3d9ff'),
  serving: parked('serving', 'Serving', 'love', 'tools/water/dmg-1.png', '#b3d9ff'),
};

export const junk: Record<string, JunkDef> = {
  time: { id: 'time', name: 'Time', description: '', icon: 'junk/time.svg', color: '#a58fc9', ...T,
    triggers: { setFormed: [{ type: 'attack', targets: { type: 'chooseAnywhere', count: 1 }, dmg: 1, dmgPerTiles: 3 }] } },
  // No setFormed: Space never forms sets, so only damage clears it.
  // Only Fellowship makes it (not in config.junk, so never in refills). No setFormed: it never forms sets.
  community: { id: 'community', name: 'Community', description: 'Never forms sets. Only damage clears it. Strengthen counts in a line: +1 Block per point, used up when it activates.', icon: 'junk/community.svg', color: '#8fb38a', ...T,
    triggers: { turnEnd: [{ type: 'gain', what: 'block', amount: 1, inLine: true }] } },
  space: { id: 'space', name: 'Space', description: 'Never forms sets. Only damage clears it.', icon: 'junk/space.svg', color: '#9aa3ad', ...T, triggers: {} },
};

/** The Word's Stone: config.stoneHp HP (+ Patience on the tool that made it). */
export const STONE: TileDef = { id: 'stone', name: 'Stone', description: 'Never forms sets. Only damage clears it.', icon: 'tools/dud/rubble.png', color: '#7a6a55', hp: config.stoneHp, speed: 0,
  triggers: {} };

/**
 * Tool art: each pillar has a frame, and a tool's own SVG glyph is drawn inside it (the Word: a Bible in the Truth
 * frame). Tools without a glyph yet keep their old spell art, unframed.
 */
export const PILLAR_FRAME: Record<Pillar, string> = {
  faith: 'tools/frames/temp-yellow.png',
  truth: 'tools/frames/temp-brown.png',
  spirit: 'tools/frames/temp-purple.png',
  discipline: 'tools/frames/temp-blue.png',
  love: 'tools/frames/temp-pink.png',
  unity: 'tools/frames/temp-green.png',
};

const GLYPH: Record<string, string> = {
  prayer: 'praying-hands', thanksgiving: 'thanksgiving', word: 'bible', prophecy: 'prophecy', worship: 'worship-music', preaching: 'pulpit', anoint: 'anoint', fellowship: 'fellowship',
};
for (const [id, glyph] of Object.entries(GLYPH)) tools[id] = { ...tools[id], icon: `tools/svgs/${glyph}.svg`, frame: PILLAR_FRAME[tools[id].pillar] };

export const PILLAR_NAME: Record<Pillar, string> = { faith: 'Faith', truth: 'Truth', love: 'Love', unity: 'Unity', spirit: 'Spirit', discipline: 'Discipline' };
