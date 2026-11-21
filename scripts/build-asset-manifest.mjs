// Generates src/content/assets.manifest.json: every file under public/assets, with PNG dimensions.
// Used by the content validator (icons must resolve) and the icon-from-stats fallback chain.
import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';

const root = new URL('../public/assets/', import.meta.url).pathname;
const out = new URL('../src/content/assets.manifest.json', import.meta.url).pathname;

function walk(dir) {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    return statSync(p).isDirectory() ? walk(p) : [p];
  });
}

function pngSize(file) {
  const buf = readFileSync(file);
  if (buf.length < 24 || buf.toString('ascii', 1, 4) !== 'PNG') return null;
  return { w: buf.readUInt32BE(16), h: buf.readUInt32BE(20) };
}

const manifest = {};
for (const file of walk(root).sort()) {
  const rel = relative(root, file).split('\\').join('/');
  manifest[rel] = file.endsWith('.png') ? pngSize(file) : {};
}
writeFileSync(out, JSON.stringify(manifest, null, 1) + '\n');
console.log(`asset manifest: ${Object.keys(manifest).length} files → src/content/assets.manifest.json`);
