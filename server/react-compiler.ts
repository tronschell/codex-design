import { createHash } from 'node:crypto';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdir, mkdtemp, readFile, realpath, rename, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import * as nativeCompiler from 'esbuild';
import * as portableCompiler from 'esbuild-wasm';
import type { BuildOptions, BuildResult } from 'esbuild';
import { compile } from 'tailwindcss';
import type { ReactProject, ReactBinding } from '../shared/types';
import { reactExportKey, reactProjectSchema } from '../shared/react-project';

import { selectableReactSource } from './react-selection';

const exec = promisify(execFile);
const inside = (root: string, file: string) => file.startsWith(root + path.sep);
const cssText = async (name: string) => readFile(new URL(`../dist/react-styles/${name}.css`, import.meta.url), 'utf8');

async function bundle(options: BuildOptions): Promise<BuildResult> {
  async function run(compiler: typeof nativeCompiler) {
    const context = await compiler.context(options);
    const timer = setTimeout(() => { void context.cancel(); }, 60_000);
    try { return await context.rebuild(); }
    finally { clearTimeout(timer); await context.dispose(); }
  }
  try { return await run(nativeCompiler); }
  catch (error) {
    if (!/another platform|spawn.*ENOENT|package.*could not be found|native binary/i.test(String(error))) throw error;
    return run(portableCompiler);
  }
}

// A package installation is data for the browser bundler. Lifecycle scripts and project plugins never run.
async function packageDirectory(dependencies: Record<string, string>, cache: string): Promise<string> {
  await mkdir(cache, { recursive: true, mode: 0o700 });
  const sorted = Object.fromEntries(Object.entries(dependencies).sort(([a], [b]) => a.localeCompare(b)));
  const key = createHash('sha256').update(JSON.stringify(sorted)).digest('hex'), destination = path.join(cache, key);
  try { await readFile(path.join(destination, 'ready')); return await realpath(destination); } catch { /* First installation. */ }
  const stage = await mkdtemp(path.join(cache, '.install-'));
  try {
    await writeFile(path.join(stage, 'package.json'), JSON.stringify({ name: 'codex-react-preview', version: '1.0.0', private: true, dependencies: sorted }));
    await exec(process.platform === 'win32' ? 'npm.cmd' : 'npm', ['install', '--ignore-scripts', '--no-audit', '--no-fund', '--omit=dev', '--registry=https://registry.npmjs.org'], {
      cwd: stage, timeout: 120_000, maxBuffer: 2 * 1024 * 1024,
      env: { ...process.env, npm_config_ignore_scripts: 'true', npm_config_audit: 'false', npm_config_fund: 'false', npm_config_cache: path.join(cache, '.npm-cache') },
    });
    await writeFile(path.join(stage, 'ready'), '1');
    try { await rename(stage, destination); }
    catch (error) { try { await readFile(path.join(destination, 'ready')); } catch { throw error; } }
    return await realpath(destination);
  } catch (error) {
    const detail = error as Error & { stderr?: string };
    throw new Error(`Could not install React preview dependencies (installation scripts are disabled). ${detail.stderr?.slice(-3000) || detail.message}`);
  } finally { await rm(stage, { recursive: true, force: true }); }
}

export async function compileReactProject(app: ReactProject, bindings: ReactBinding[], cache: string): Promise<ReactProject> {
  reactProjectSchema.parse(app);
  const unique = [...new Map(bindings.map(binding => [reactExportKey(binding), binding])).values()];
  const entries = [...new Set(unique.map(binding => binding.entry))].sort();
  for (const entry of entries) if (!Object.hasOwn(app.files, entry)) throw new Error(`Missing React entry: ${entry}`);
  if (!entries.length) return { ...app, entryPoints: [], exports: [], javascript: '', css: '' };
  const packages = await packageDirectory(app.dependencies, cache);
  const workspace = await realpath(await mkdtemp(path.join(tmpdir(), 'codex-react-build-')));
  try {
    for (const [file, source] of Object.entries(app.files)) {
      const filename = path.join(workspace, file);
      await mkdir(path.dirname(filename), { recursive: true }); await writeFile(filename, selectableReactSource(source, file, unique.filter(binding => binding.entry === file)));
    }
    const imports = unique.map((binding, index) => `import { ${binding.exportName} as Entry${index} } from ${JSON.stringify('./' + binding.entry)};`).join('\n');
    const entryMap = unique.map((binding, index) => `${JSON.stringify(reactExportKey(binding))}:Entry${index}`).join(',');
    const source = `import React from 'react';\nimport { createRoot } from 'react-dom/client';\n${imports}\nconst entries={${entryMap}};\nclass Boundary extends React.Component { state={error:null}; static getDerivedStateFromError(error){return {error:String(error)}} render(){return this.state.error ? React.createElement('pre',{role:'alert',style:{padding:16,whiteSpace:'pre-wrap',color:'#ef4444'}},this.state.error) : this.props.children} }\nexport function mount(entry,name,props){const Component=entries[JSON.stringify([entry,name])];if(!Component)throw new Error('Missing React export '+name+' in '+entry);createRoot(document.getElementById('root')).render(React.createElement(Boundary,null,React.createElement(Component,props)));}\n`;
    const result = await bundle({
      absWorkingDir: workspace, stdin: { contents: source, resolveDir: workspace, sourcefile: '__canvas_entry.tsx', loader: 'tsx' },
      bundle: true, write: false, outdir: path.join(workspace, '.build'), platform: 'browser', format: 'iife', globalName: 'CodexReact', target: 'es2022',
      jsx: 'automatic', tsconfigRaw: { compilerOptions: { jsx: 'react-jsx' } }, minify: true, legalComments: 'inline', logLevel: 'silent',
      define: { 'process.env.NODE_ENV': '"production"' }, nodePaths: [path.join(packages, 'node_modules')],
      alias: { '@': path.join(workspace, 'src') },
      loader: { '.svg': 'dataurl', '.png': 'dataurl', '.jpg': 'dataurl', '.jpeg': 'dataurl', '.gif': 'dataurl', '.webp': 'dataurl', '.woff': 'dataurl', '.woff2': 'dataurl' },
      plugins: [{ name: 'preview-boundary', setup(builder) {
        builder.onResolve({ filter: /.*/ }, async args => {
          if (args.path.startsWith('data:')) return { path: args.path, external: true };
          if (/^(?:https?:|file:|node:|\/|[a-zA-Z]:|\\)/.test(args.path)) throw new Error(`External URLs, absolute imports and Node builtins are unavailable in previews: ${args.path}`);
          // Let esbuild resolve normally; onLoad validates every resolved file before it is read.
          // A nested build.resolve here would re-enter the same plugin for every dependency edge.
        });
        builder.onLoad({ filter: /.*/ }, async args => {
          const filename = await realpath(args.path);
          if (!inside(workspace, filename) && !inside(path.join(packages, 'node_modules'), filename)) throw new Error('Module is outside the React application.');
          if (filename.endsWith('.css')) return { contents: (await readFile(filename, 'utf8')).replace(/@import\s+["']tailwindcss["']\s*;/g, ''), loader: filename.endsWith('.module.css') ? 'local-css' : 'css', resolveDir: path.dirname(filename) };
        });
      } }],
    });
    const javascript = result.outputFiles?.find(file => file.path.endsWith('.js'))?.text;
    if (!javascript) throw new Error('React compilation produced no JavaScript.');
    // Tailwind runs against source strings, with no config/plugin execution or arbitrary file reads.
    const tailwindSource = `@layer theme, base, components, utilities;\n@layer theme {${await cssText('theme')}}\n@layer base {${await cssText('preflight')}}\n@tailwind utilities;\n`;
    const authoredCss = result.outputFiles?.find(file => file.path.endsWith('.css'))?.text ?? '';
    const compiler = await compile(tailwindSource + authoredCss, {
      loadModule: async () => { throw new Error('Tailwind JS plugins/configs cannot run in the preview compiler. Use CSS @theme and @utility.'); },
      loadStylesheet: async id => { throw new Error(`CSS @import ${id} must be imported through a React module or inlined. Tailwind itself is included automatically.`); },
    });
    const candidates = [...new Set(Object.values(app.files).flatMap(source => source.match(/[^\s"'`<>]+/g) ?? []))];
    const css = compiler.build(candidates);
    return reactProjectSchema.parse({ ...app, entryPoints: entries, exports: unique.map(reactExportKey), javascript, css });
  } finally { await rm(workspace, { recursive: true, force: true }); }
}
