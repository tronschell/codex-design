import { build } from 'esbuild';
import { fileURLToPath } from 'node:url';
const root=fileURLToPath(new URL('../',import.meta.url));
await build({entryPoints:[root+'server/diagram-layout-worker.ts'],outfile:root+'dist/diagram-layout-worker.mjs',bundle:true,platform:'node',target:'node22',format:'esm',banner:{js:"import { createRequire as __createRequire } from 'node:module'; const require = __createRequire(import.meta.url);"}});
