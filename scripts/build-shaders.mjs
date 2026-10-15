import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { build } from 'esbuild';

const root = fileURLToPath(new URL('../', import.meta.url));
const result = await build({
  absWorkingDir: root, entryPoints: ['shared/shaders-com-runtime.ts'], bundle: true, write: false,
  format: 'iife', globalName: 'ShadersCom', platform: 'browser', target: 'es2022',
  minify: true, legalComments: 'inline', metafile: true,
  define: { 'process.env.NODE_ENV': '"production"' },
});
const packages = new Set(Object.keys(result.metafile.inputs).flatMap(input => {
  const parts = input.split('/'), index = parts.lastIndexOf('node_modules');
  return index < 0 ? [] : [parts[index + 1].startsWith('@') ? parts.slice(index + 1, index + 3).join('/') : parts[index + 1]];
}));
const notices = [];
for (const name of packages) {
  let license;
  for (const filename of ['LICENSE', 'LICENSE.txt', 'LICENSE.md', 'license', 'license.md']) {
    license = await readFile(resolve(root, 'node_modules', name, filename), 'utf8').catch(() => undefined);
    if (license) break;
  }
  if (!license) throw new Error(`Missing bundled dependency license: ${name}`);
  notices.push(`${name}\n${license}`);
}
// One trusted closure serves the editor and dependency-free HTML/React exports.
await writeFile(resolve(root, 'shared/shaders-com.generated.js'), `export const shadersComLicense = ${JSON.stringify(notices.join('\n\n'))};\nexport function shadersComRuntime() {\n${result.outputFiles[0].text}\nreturn ShadersCom.createShadersComRenderer;\n}\n`);
console.log('Bundled official shaders.com components and their licenses.');
