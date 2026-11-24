// Tools, junk tiles and the Stone (docs/tools.md). What each does is its triggers (docs/tile-effects.md); popup text
// is generated from them, so `description` holds only anything else. Art is reused from the old spell icons until drawn.

import type { JunkDef, Pillar, TileDef, ToolDef } from '../engine/types';
import { config } from './config';

const T = { hp: 1, speed: 0 };
const PER_TILE = { perSetTile: 1 };
const SET_SHAPE = { type: 'chooseShape', shape: 'set' } as const;
const parked = (id: string, name: string, pillar: Pillar, icon: string, color: string): ToolDef =>
  ({ id, name, pillar, parked: true, description: 'Parked.', icon, color, ...T, triggers: { setFormed: [{ type: 'clearsSelf' }] } });

export const tools: Record<string, ToolDef> = {
  // Parked 2026-11-24, replaced by Anoint. Its Critical still works if it comes back.
  fasting: { id: 'fasting', name: 'Fasting', pillar: 'discipline', parked: true, description: 'Critical: your next tool set is doubled.', icon: 'tools/acid/poison-1.png', color: '#59ff4d', ...T,
    triggers: { setFormed: [{ type: 'gain', what: 'critical', amount: 1 }] } },
  prayer: { id: 'prayer', name: 'Prayer', pillar: 'faith', description: '', icon: 'tools/fire/dmg-2.png', color: '#ffb3b3', ...T,
    triggers: { setFormed: [{ type: 'attack', targets: SET_SHAPE, dmg: 3 }] } },
  thanksgiving: { id: 'thanksgiving', name: 'Thanksgiving', pillar: 'spirit', description: 'Block absorbs damage to you until your next turn.', icon: 'tools/water/block-1.png', color: '#b366b3', ...T,
    triggers: { setFormed: [{ type: 'gain', what: 'block', amount: PER_TILE }] } },
  word: { id: 'word', name: 'The Word', pillar: 'truth', description: '', icon: 'tools/lightning/dmg-1.png', color: '#ffffb3', ...T,
    triggers: { setFormed: [{ type: 'attack', targets: { type: 'chooseAnywhere', count: PER_TILE }, dmg: 1, onDestroy: { kind: 'stone', id: 'stone' } }] } },
  prophecy: { id: 'prophecy', name: 'Prophecy', pillar: 'truth', description: '', icon: 'tools/lightning/default.png', color: '#e6d27a', ...T,
    triggers: { setFormed: [
      { type: 'attack', targets: SET_SHAPE, dmg: 1, onDestroy: { kind: 'junk', id: 'space' } },
      { type: 'gain', what: 'foresight', amount: PER_TILE },
    ] } },
  worship: { id: 'worship', name: 'Worship', pillar: 'spirit', description: 'Block absorbs damage to you until your next turn.', icon: 'tools/earth/default.png', color: '#c58be0', ...T,
    triggers: {
      setFormed: [{ type: 'gain', what: 'block', amount: PER_TILE }],
      onActivate: [{ type: 'attack', targets: { type: 'adjacent', pick: 'every', filter: ['junk'], ids: ['space'] }, dmg: 1 }],
    } },
  preaching: { id: 'preaching', name: 'Preaching', pillar: 'discipline', description: '', icon: 'tools/water/default.png', color: '#7fc4e8', ...T,
    triggers: { setFormed: [{ type: 'attack', targets: { type: 'chooseAnywhere', count: PER_TILE }, dmg: 0, apply: 'locked' }] } },
  anoint: { id: 'anoint', name: 'Anoint', pillar: 'faith', description: 'A Strengthened tile makes the set it clears in 1 tile bigger per point.', icon: 'tools/fire/default.png', color: '#f2c14e', ...T,
    triggers: { setFormed: [{ type: 'attack', targets: SET_SHAPE, dmg: 0, apply: 'strengthen', applyAmount: 2 }] } },
  // Parked (tools.md §1.2): no effect until redesigned.
  healing: parked('healing', 'Healing', 'love', 'tools/water/healing-1.png', '#b3d9ff'),
  serving: parked('serving', 'Serving', 'love', 'tools/water/dmg-1.png', '#b3d9ff'),
  fellowship: parked('fellowship', 'Fellowship', 'unity', 'tools/earth/dmg-block-1.png', '#bfa680'),
};

export const junk: Record<string, JunkDef> = {
  time: { id: 'time', name: 'Time', description: '', icon: 'junk/time.svg', color: '#a58fc9', ...T,
    triggers: { setFormed: [{ type: 'attack', targets: { type: 'chooseAnywhere', count: 1 }, dmg: 1, dmgPerTiles: 3 }] } },
  // No setFormed: Space never forms sets, so only damage clears it.
  space: { id: 'space', name: 'Space', description: 'Never forms sets. Only damage clears it.', icon: 'junk/space.svg', color: '#9aa3ad', ...T, triggers: {} },
};

/** The Word's Stone: config.stoneHp HP (+ Patience on the tool that made it). */
export const STONE: TileDef = { id: 'stone', name: 'Stone', description: '', icon: 'tools/dud/rubble.png', color: '#7a6a55', hp: config.stoneHp, speed: 0,
  triggers: { setFormed: [{ type: 'clearsSelf' }] } };

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
  prayer: 'praying-hands', thanksgiving: 'thanksgiving', word: 'bible', worship: 'worship-music', preaching: 'pulpit', anoint: 'anoint',
};
for (const [id, glyph] of Object.entries(GLYPH)) tools[id] = { ...tools[id], icon: `tools/svgs/${glyph}.svg`, frame: PILLAR_FRAME[tools[id].pillar] };

export const PILLAR_NAME: Record<Pillar, string> = { faith: 'Faith', truth: 'Truth', love: 'Love', unity: 'Unity', spirit: 'Spirit', discipline: 'Discipline' };
