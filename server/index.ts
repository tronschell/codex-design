import express from 'express';
import { createServer as createHttpServer } from 'node:http';
import { readFile, realpath } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve, sep } from 'node:path';
import { timingSafeEqual } from 'node:crypto';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { ProjectStore } from './store.ts';
import { createApiRouter } from './api.ts';
import { createMcpServer } from './mcp.ts';

const root = fileURLToPath(new URL('../', import.meta.url));
const port = Number(process.env.PORT || 4310), host = process.env.CODEX_DESIGN_HOST || '127.0.0.1';
const token = process.env.CODEX_DESIGN_TOKEN;
if (!['127.0.0.1', 'localhost', '::1'].includes(host) && !token) throw new Error('Set CODEX_DESIGN_TOKEN before binding outside localhost.');
const baseUrl = process.env.CODEX_DESIGN_BASE_URL || `http://${host === '::1' ? '[::1]' : host}:${port}`;
const dataDir = resolve(process.env.CODEX_DESIGN_DATA_DIR || resolve(root, 'data'));
let canonicalDataDir = dataDir;
const inside = (filename: string, directory: string) => filename === directory || filename.startsWith(`${directory}${sep}`);
const app = express();
app.disable('x-powered-by');
const origins = new Set([new URL(baseUrl).origin, `http://127.0.0.1:${port}`, `http://localhost:${port}`]);
app.use(async (req, res, next) => {
  const origin = req.get('origin');
  const requestHost = req.get('host');
  if (!requestHost || (!token && !new Set([`127.0.0.1:${port}`, `localhost:${port}`, `[::1]:${port}`]).has(requestHost))) { res.status(403).json({ error: { message: 'This local editor only accepts localhost requests.' } }); return; }
  if (origin && !origins.has(origin)) { res.status(403).json({ error: { message: 'This request origin is not allowed.' } }); return; }
  if (req.path !== '/mcp' && req.path !== '/api' && !req.path.startsWith('/api/')) {
    let pathname: string;
    try { pathname = decodeURIComponent(req.path); }
    catch { res.status(400).json({ error: { message: 'The request path is invalid.' } }); return; }
    const filename = pathname.startsWith('/@fs/') ? resolve('/', pathname.slice('/@fs/'.length)) : resolve(root, `.${pathname}`);
    const canonical = await realpath(filename).catch(() => filename);
    if (inside(filename, dataDir) || inside(canonical, canonicalDataDir)) { res.status(404).end(); return; }
  }
  if (req.path.startsWith('/api') || req.path === '/mcp') {
    res.setHeader('Cache-Control', 'no-store');
    if (token) {
      const supplied = Buffer.from(req.get('authorization')?.replace(/^Bearer /i, '') || ''), expected = Buffer.from(token);
      if (supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) { res.status(401).json({ error: { message: 'A valid bearer token is required.' } }); return; }
    }
  }
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'no-referrer');
  next();
});
const store = new ProjectStore(dataDir);
await store.init();
canonicalDataDir = await realpath(dataDir);
app.use('/api', createApiRouter(store));
app.post('/mcp', express.json({ limit: '2mb' }), async (req, res) => {
  const server = createMcpServer(store, { baseUrl });
  const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
  res.on('close', () => { void transport.close(); void server.close(); });
  try { await server.connect(transport); await transport.handleRequest(req, res, req.body); }
  catch (error) { console.error('MCP request failed:', (error as Error).message); if (!res.headersSent) res.status(500).json({ jsonrpc: '2.0', error: { code: -32603, message: 'The MCP request could not be completed.' }, id: null }); }
});
app.all('/mcp', (_req, res) => { res.status(405).setHeader('Allow', 'POST').json({ error: 'Use MCP Streamable HTTP POST requests.' }); });

const httpServer = createHttpServer(app);
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(resolve(root, 'dist')));
  app.use(async (_req, res, next) => { try { res.type('html').send(await readFile(resolve(root, 'dist/index.html'), 'utf8')); } catch (error) { next(error); } });
} else {
  const { createServer } = await import('vite');
  const vite = await createServer({ root, server: {
    middlewareMode: true, hmr: { server: httpServer },
    fs: { deny: ['.env', '.env.*', '*.{crt,pem}', '**/.git/**', '**/data/**', `${dataDir.replaceAll('\\', '/')}/**`, `${canonicalDataDir.replaceAll('\\', '/')}/**`] },
  }, appType: 'spa' });
  app.use(vite.middlewares);
}
app.use((error: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => { console.error(error.message); res.status(500).json({ error: { message: 'The request could not be completed.' } }); });
httpServer.listen(port, host, () => console.log(`Codex Design is running at ${baseUrl}\nMCP endpoint: ${baseUrl}/mcp`));
const shutdown = () => { httpServer.close(); setTimeout(() => process.exit(0), 100).unref(); };
process.on('SIGINT', shutdown); process.on('SIGTERM', shutdown);
