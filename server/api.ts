import { json, Router, type ErrorRequestHandler } from 'express';
import { z } from 'zod';
import { assetRefSchema, beginAssetUploadSchema, cancelAssetUploadSchema, createProjectSchema, libraryVersionRequestSchema, MAX_INPUT_BYTES, mutateProjectSchema, readAssetChunkSchema, restoreLibraryVersionSchema, restoreProjectVersionSchema, revisionSchema, uploadAssetChunkSchema } from '../shared/validation.ts';
import { ProjectStore, StoreError } from './store.ts';

function parse<T>(schema: z.ZodType<T, z.ZodTypeDef, any>, input: unknown): T {
  const result = schema.safeParse(input);
  if (!result.success) throw new StoreError(400, 'invalid_input', result.error.issues.map((issue) => `${issue.path.join('.') || 'input'}: ${issue.message}`).join('; '), result.error.issues);
  return result.data;
}

export function createApiRouter(store: ProjectStore): Router {
  const router = Router();
  router.use(json({ limit: MAX_INPUT_BYTES }));

  router.get('/health', (_request, response) => { response.json({ ok: true }); });
  router.post('/assets/uploads', async (request, response) => {
    response.status(201).json(await store.beginAssetUpload(parse(beginAssetUploadSchema, request.body)));
  });
  router.post('/assets/uploads/:uploadId/chunks', async (request, response) => {
    const chunk = parse(uploadAssetChunkSchema.omit({ uploadId: true }), request.body);
    response.json(await store.uploadAssetChunk({ ...chunk, uploadId: request.params.uploadId }));
  });
  router.post('/assets/uploads/:uploadId/cancel', async (request, response) => {
    const { uploadId } = parse(cancelAssetUploadSchema, { uploadId: request.params.uploadId });
    response.json(await store.cancelAssetUpload(uploadId));
  });
  router.get('/assets/:hash/chunks', async (request, response) => {
    const number = z.string().regex(/^(0|[1-9]\d*)$/).transform(Number);
    const input = parse(readAssetChunkSchema, {
      ref: `asset:${request.params.hash}`,
      offset: parse(number, request.query.offset),
      ...(request.query.byteLength === undefined ? {} : { byteLength: parse(number, request.query.byteLength) }),
    });
    response.json(await store.readAssetChunk(input));
  });
  router.get('/assets/:hash', async (request, response) => {
    response.json({ asset: await store.getAsset(parse(assetRefSchema, `asset:${request.params.hash}`)) });
  });
  router.get('/projects', async (_request, response) => { response.json({ projects: await store.list() }); });
  router.post('/projects', async (request, response) => {
    const input = parse(createProjectSchema, request.body);
    response.status(201).json(await store.create(input.name, input.template));
  });
  router.post('/projects/import', async (request, response) => {
    const { project } = parse(z.object({ project: z.unknown() }).strict(), request.body);
    response.status(201).json(await store.importProject(project));
  });
  router.get('/projects/:id', async (request, response) => { response.json(await store.get(request.params.id)); });
  router.get('/projects/:id/changes', async (request, response) => {
    const afterRevision = parse(z.string().regex(/^(0|[1-9]\d*)$/).transform(Number).pipe(revisionSchema), request.query.afterRevision);
    const controller = new AbortController();
    const close = () => { if (!response.writableEnded) controller.abort(); };
    response.on('close', close);
    try {
      const project = await store.waitForChange(request.params.id, afterRevision, controller.signal);
      if (!response.destroyed) response.json({ projectId: request.params.id, revision: project?.revision ?? afterRevision, changed: !!project, ...(project ? { project } : {}) });
    } catch (error) { if (!controller.signal.aborted) throw error; }
    finally { response.off('close', close); }
  });
  router.get('/projects/:id/history', async (request, response) => { response.json({ versions: await store.listVersions(request.params.id) }); });
  router.get('/projects/:id/library/history', async (request, response) => {
    const { scope, componentId } = parse(libraryVersionRequestSchema, request.query);
    response.json({ versions: await store.listLibraryVersions(request.params.id, scope, componentId) });
  });
  router.get('/projects/:id/library/history/:revision', async (request, response) => {
    const { scope, componentId } = parse(libraryVersionRequestSchema, request.query);
    const revision = parse(z.string().regex(/^(0|[1-9]\d*)$/).transform(Number).pipe(revisionSchema), request.params.revision);
    response.json(await store.getLibraryVersion(request.params.id, revision, scope, componentId));
  });
  router.post('/projects/:id/library/history/restore', async (request, response) => {
    const { expectedRevision, revision, scope, componentId } = parse(restoreLibraryVersionSchema, request.body);
    response.json(await store.restoreLibraryVersion(request.params.id, expectedRevision, revision, scope, componentId));
  });
  router.get('/projects/:id/history/:revision', async (request, response) => {
    const revision = parse(z.string().regex(/^(0|[1-9]\d*)$/).transform(Number).pipe(revisionSchema), request.params.revision);
    response.json(await store.getVersion(request.params.id, revision));
  });
  router.post('/projects/:id/history/restore', async (request, response) => {
    const { expectedRevision, revision } = parse(restoreProjectVersionSchema, request.body);
    response.json(await store.restoreVersion(request.params.id, expectedRevision, revision));
  });
  router.post('/projects/:id/operations', async (request, response) => {
    const { expectedRevision, operations } = parse(mutateProjectSchema, request.body);
    response.json(await store.mutate(request.params.id, expectedRevision, operations));
  });

  router.get('/events', async (_request, response) => {
    let seen = new Map((await store.list()).map((project) => [project.id, project.revision]));
    if (response.destroyed) return;
    let scanning = false;
    let closed = false;
    response.set({
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    });
    response.flushHeaders();
    response.write(': connected\n\n');
    const scan = async () => {
      if (scanning || closed) return;
      scanning = true;
      try {
        const projects = await store.list();
        if (closed) return;
        for (const project of projects) {
          if (seen.get(project.id) !== project.revision) response.write(`data: ${JSON.stringify({ projectId: project.id })}\n\n`);
        }
        seen = new Map(projects.map((project) => [project.id, project.revision]));
      } catch { /* A temporary read error is retried by the next poll. */ }
      finally { scanning = false; }
    };
    const unsubscribe = store.subscribe(() => { void scan(); });
    // The MCP stdio process uses the same files but cannot share this subscription.
    const poll = setInterval(() => { void scan(); }, 1000);
    const heartbeat = setInterval(() => { if (!closed) response.write(': heartbeat\n\n'); }, 20_000);
    poll.unref();
    heartbeat.unref();
    response.on('close', () => {
      closed = true;
      clearInterval(poll);
      clearInterval(heartbeat);
      unsubscribe();
    });
  });

  const errors: ErrorRequestHandler = (error, _request, response, next) => {
    if (response.headersSent) { next(error); return; }
    if (error instanceof StoreError) {
      response.status(error.status).json({ error: { code: error.code, message: error.message, ...(error.details === undefined ? {} : { details: error.details }) } });
      return;
    }
    if (error?.type === 'entity.too.large') {
      response.status(413).json({ error: { code: 'input_too_large', message: 'Request exceeds the 2 MiB limit' } });
      return;
    }
    if (error instanceof SyntaxError && 'body' in error) {
      response.status(400).json({ error: { code: 'invalid_json', message: 'Request body must be valid JSON' } });
      return;
    }
    console.error('Workspace API error:', error);
    response.status(500).json({ error: { code: 'internal_error', message: 'Unable to read or save the workspace' } });
  };
  router.use(errors);
  return router;
}
