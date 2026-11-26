// The content registry passed to the engine (doc 04).

import manifest from './assets.manifest.json';
import { abilities } from './abilities';
import { config } from './config';
import { enemies, enemyTiles } from './enemies';
import { fruits } from './fruits';
import { statuses } from './statuses';
import { blessings, junk, tools } from './tools';

const manifestPaths = new Set(Object.keys(manifest as Record<string, unknown>));
export const assetExists = (path: string) => manifestPaths.has(path);

export function buildContent() {
  return { tools, junk, blessings, fruits, abilities, statuses, enemies, enemyTiles, config, assetExists };
}

export type Content = ReturnType<typeof buildContent>;
export const content: Content = buildContent();
