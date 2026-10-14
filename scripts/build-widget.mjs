import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve, sep } from 'node:path';
import { build } from 'esbuild';
import { buildStarters } from './build-starters.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const dist = resolve(root, 'dist');
let html = await readFile(resolve(dist, 'index.html'), 'utf8');

function localAsset(url) {
  const path = resolve(dist, url.replace(/^\//, ''));
  if (!path.startsWith(`${dist}${sep}`)) throw new Error(`Asset escapes dist: ${url}`);
  return path;
}

for (const match of [...html.matchAll(/<script\b([^>]*?)\bsrc="([^"]+)"([^>]*)><\/script>/g)]) {
  const code = await readFile(localAsset(match[2]), 'utf8');
  html = html.replace(match[0], () => `<script type="module">${code.replace(/<\/script/gi, '<\\/script')}</script>`);
}
for (const match of [...html.matchAll(/<link\b[^>]*\brel="stylesheet"[^>]*\bhref="([^"]+)"[^>]*>/g)]) {
  const css = await readFile(localAsset(match[1]), 'utf8');
  html = html.replace(match[0], () => `<style>${css.replace(/<\/style/gi, '<\\/style')}</style>`);
}
html = html.replace(/<link\b[^>]*\brel="modulepreload"[^>]*>/g, '');
html = html.replace(/<link\b[^>]*\brel="icon"[^>]*>/g, '');
html = html.replace('<head>', '<head><script>window.__CODEX_DESIGN_EMBEDDED__=true;</script>');
if (/<(?:script|link)\b[^>]*(?:src|href)="\/?assets\//.test(html)) throw new Error('Widget still references build assets.');
await writeFile(resolve(dist, 'widget.html'), html);
await buildStarters(root);
await build({
  entryPoints: [resolve(root, 'server/jsx-renderer.ts')], outfile: resolve(dist, 'jsx-renderer.mjs'),
  bundle: true, platform: 'node', target: 'node22', format: 'esm',
  banner: { js: "import { createRequire as __createRequire } from 'node:module'; const require = __createRequire(import.meta.url);" },
});

await build({
  entryPoints: [resolve(root, 'server/stdio.ts')], outfile: resolve(dist, 'mcp.mjs'),
  bundle: true, platform: 'node', target: 'node22', format: 'esm',
  banner: { js: "import { createRequire as __createRequire } from 'node:module'; const require = __createRequire(import.meta.url);" },
});
console.log('Built self-contained canvas widget and MCP runtime.');
