import { cp, mkdir, mkdtemp, readFile, rm } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { join, resolve } from 'node:path';

const root = fileURLToPath(new URL('../', import.meta.url));
const manifest = JSON.parse(await readFile(join(root, 'plugin.json'), 'utf8'));
const build = spawnSync('npm', ['run', 'build'], { cwd: root, stdio: 'inherit' });
if (build.status !== 0) process.exit(build.status ?? 1);

const releases = join(root, 'releases');
await mkdir(releases, { recursive: true });
const temporaryDirectory = await mkdtemp(join(tmpdir(), 'codex-design-plugin-'));
const packageDirectory = join(temporaryDirectory, manifest.name);
const output = resolve(releases, `${manifest.name}-${manifest.version}.zip`);
try {
  await mkdir(packageDirectory);
  for (const entry of ['plugin.json', 'mcp.json', 'package.json', 'package-lock.json', 'README.md', 'PRODUCT.md', 'DESIGN.md', 'AGENTS.md', 'assets', 'docs', 'skills', 'dist', 'server', 'shared', 'src', 'public', 'scripts', 'index.html', 'vite.config.ts', 'tsconfig.json', '.agents/plugins/marketplace.json']) {
    await cp(join(root, entry), join(packageDirectory, entry), { recursive: true });
  }
  await rm(output, { force: true });
  const zip = spawnSync('zip', ['-qr', output, manifest.name], { cwd: temporaryDirectory, stdio: 'inherit' });
  if (zip.status !== 0) throw new Error('ZIP packaging failed; install the zip command and retry.');
  console.log(`Packaged ${output}`);
} finally {
  await rm(temporaryDirectory, { recursive: true, force: true });
}
