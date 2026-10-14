import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { build } from 'esbuild';

export async function buildStarters(root) {
  const families = ['ios-frame', 'android-frame', 'macos-window', 'browser-window'];
  const modules = await Promise.all(families.map(async name => {
    const source = await readFile(resolve(root, 'skills/codex-design/starter-components', `${name}.jsx`), 'utf8');
    // Only these reviewed packaged files run; author-supplied JSX is parsed as data.
    return `${JSON.stringify(name)}: (() => { const window = {};\n${source}\nreturn window; })()`;
  }));
  await build({
    stdin: { contents: `import * as React from 'react';\nexport const families = {${modules.join(',\n')}};`, loader: 'jsx', resolveDir: root },
    outfile: resolve(root, 'dist/starters.mjs'), bundle: true, platform: 'node', target: 'node22', format: 'esm',
    jsxFactory: 'React.createElement', jsxFragment: 'React.Fragment',
  });
}
