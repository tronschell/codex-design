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
const installDirectory = join(releases, manifest.name);
try {
  await mkdir(packageDirectory);
  for (const entry of ['plugin.json', 'mcp.json', 'package.json', 'package-lock.json', 'README.md', 'LICENSE', 'THIRD_PARTY_NOTICES.md', 'PRODUCT.md', 'DESIGN.md', 'AGENTS.md', 'assets', 'docs', 'examples', 'skills', 'dist', 'server', 'shared', 'src', 'public', 'scripts', 'index.html', 'vite.config.ts', 'tsconfig.json', '.agents/plugins/marketplace.json']) {
    await cp(join(root, entry), join(packageDirectory, entry), { recursive: true });
  }
  await rm(output, { force: true });
  const zip = spawnSync('zip', ['-qr', output, manifest.name], { cwd: temporaryDirectory, stdio: 'inherit' });
  if (zip.status !== 0) throw new Error('ZIP packaging failed; install the zip command and retry.');
  await rm(installDirectory, { recursive: true, force: true });
  await cp(packageDirectory, installDirectory, { recursive: true });
  console.log(`Packaged ${output}`);
  console.log(`Local marketplace: ${installDirectory}`);
} finally {
  await rm(temporaryDirectory, { recursive: true, force: true });
}
