import express from 'express';
import { spawn } from 'node:child_process';
import { timingSafeEqual } from 'node:crypto';
import { createServer } from 'node:http';
import { mkdir, realpath } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { createApiRouter } from './api.ts';
import { createMcpServer } from './mcp.ts';
import { ProjectStore } from './store.ts';

async function openBrowser(url: string): Promise<boolean> {
  if (process.env.CODEX_DESIGN_OPEN_BROWSER === '0') return false;
  const command = process.platform === 'darwin' ? 'open' : process.platform === 'win32' ? 'rundll32.exe' : 'xdg-open';
  const args = process.platform === 'win32' ? ['url.dll,FileProtocolHandler', url] : [url];
  return new Promise(resolve => {
    const child = spawn(command, args, { stdio: 'ignore', windowsHide: true });
    const timer = setTimeout(() => { child.kill(); resolve(false); }, 5000);
    child.once('error', () => { clearTimeout(timer); resolve(false); });
    child.once('exit', code => { clearTimeout(timer); resolve(code === 0); });
  });
}

let shutdown = () => {};
try {
  const root = fileURLToPath(new URL('../', import.meta.url));
  const dist = await realpath(join(root, 'dist'));
  const dataDirectory = resolve(process.env.CODEX_DESIGN_DATA_DIR || join(homedir(), '.codex-design', 'projects'));
  const port = Number(process.env.CODEX_DESIGN_BROWSER_PORT ?? 0);
  if (!Number.isInteger(port) || port < 0 || port > 65535) throw new Error('CODEX_DESIGN_BROWSER_PORT must be an integer between 0 and 65535.');
  await mkdir(dataDirectory, { recursive: true, mode: 0o700 });
  const canonicalData = await realpath(dataDirectory);
  if (canonicalData === dist || canonicalData.startsWith(dist + sep)) throw new Error('Store designs outside dist so static files cannot expose project data.');
  const store = new ProjectStore(canonicalData);
  await store.init();
  const app = express(), httpServer = createServer(app);
  const token = process.env.CODEX_DESIGN_TOKEN;
  app.disable('x-powered-by');
  app.use((req, res, next) => {
    const localPort = req.socket.localPort;
    const hosts = [`127.0.0.1:${localPort}`, `localhost:${localPort}`];
    if (!hosts.includes(req.get('host') ?? '') || (req.get('origin') && !hosts.some(host => req.get('origin') === `http://${host}`))) {
      res.status(403).json({ error: { message: 'This editor accepts only its own localhost requests.' } }); return;
    }
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'no-referrer');
    if (req.path === '/api' || req.path.startsWith('/api/')) {
      res.setHeader('Cache-Control', 'no-store');
      if (token) {
        const supplied = Buffer.from(req.get('authorization')?.replace(/^Bearer /i, '') || ''), expected = Buffer.from(token);
        if (supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) {
          res.status(401).json({ error: { message: 'A valid bearer token is required.' } }); return;
        }
      }
    }
    next();
  });
  app.use('/api', createApiRouter(store));
  app.use(express.static(dist, { dotfiles: 'deny' }));
  app.use((error: Error, _req: express.Request, res: express.Response, next: express.NextFunction) => {
    console.error('Codex Design browser:', error.message);
    if (res.headersSent) { next(error); return; }
    res.status(500).json({ error: { message: 'The request could not be completed.' } });
  });
  let server: ReturnType<typeof createMcpServer> | undefined, closing = false;
  shutdown = () => {
    if (closing) return;
    closing = true;
    httpServer.close(); httpServer.closeAllConnections();
    void server?.close().catch(error => console.error('Codex Design shutdown:', error.message));
  };
  await new Promise<void>((resolve, reject) => {
    httpServer.once('error', reject);
    httpServer.listen(port, '127.0.0.1', () => { httpServer.off('error', reject); resolve(); });
  });
  const address = httpServer.address();
  if (!address || typeof address === 'string') throw new Error('The local editor could not determine its port.');
  const baseUrl = `http://127.0.0.1:${address.port}`;
  server = createMcpServer(store, { baseUrl, browser: { open: openBrowser } });
  server.server.onclose = shutdown;
  process.stdin.once('end', shutdown);
  process.once('SIGINT', shutdown); process.once('SIGTERM', shutdown);
  await server.connect(new StdioServerTransport());
  console.error(`Codex Design browser ready at ${baseUrl}`);
} catch (error) {
  shutdown();
  console.error('Codex Design browser failed:', error instanceof Error ? error.message : error);
  process.exitCode = 1;
}
