import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { ProjectStore } from './store.ts';
import { createMcpServer } from './mcp.ts';

const packageRoot = fileURLToPath(new URL('../', import.meta.url));
const dataDirectory = process.env.CODEX_DESIGN_DATA_DIR || (process.env.PLUGIN_DATA ? join(process.env.PLUGIN_DATA, 'projects') : join(packageRoot, 'data'));

try {
  const store = new ProjectStore(dataDirectory);
  await store.init();
  const server = createMcpServer(store, { allowGeneratedImageImport: true, allowExportFiles: true });
  await server.connect(new StdioServerTransport());
} catch (error) {
  console.error('Codex Design MCP failed:', error instanceof Error ? error.message : error);
  process.exitCode = 1;
}
