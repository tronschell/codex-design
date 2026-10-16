import { fileExportSchema, prepareFileExport, estimateFileExport, readExportChunk } from './file-exports';
import { layoutDiagram } from './diagram-layout.ts';
import { json, Router, type ErrorRequestHandler } from 'express';
import { z } from 'zod';
import { assetRefSchema, beginAssetUploadSchema, cancelAssetUploadSchema, createProjectSchema, deleteProjectSchema, libraryVersionRequestSchema, MAX_DOCUMENT_BYTES, MAX_INPUT_BYTES, documentLimitLabel, mutateProjectSchema, readAssetChunkSchema, restoreLibraryVersionSchema, restoreProjectVersionSchema, revisionSchema, uploadAssetChunkSchema } from '../shared/validation.ts';
import { ProjectStore, StoreError } from './store.ts';

function parse<T>(schema: z.ZodType<T, z.ZodTypeDef, any>, input: unknown): T {
  const result = schema.safeParse(input);
  if (!result.success) throw new StoreError(400, 'invalid_input', result.error.issues.map((issue) => `${issue.path.join('.') || 'input'}: ${issue.message}`).join('; '), result.error.issues);
  return result.data;
}

export function createApiRouter(store: ProjectStore): Router {
  const router = Router();
  // A whole-document import gets the document limit; every other request keeps the smaller transaction limit.
  router.post('/projects/import', json({ limit: MAX_DOCUMENT_BYTES + 64 * 1024 }), async (request, response) => {
    const { project } = parse(z.object({ project: z.unknown() }).strict(), request.body);
    response.status(201).json(await store.importProject(project));
  });
  router.use(json({ limit: MAX_INPUT_BYTES }));

  router.post('/exports/prepare', async (request, response) => { response.json(await prepareFileExport(store, parse(fileExportSchema, request.body))); });
  router.post('/exports/estimate', async (request, response) => { response.json(await estimateFileExport(store, parse(fileExportSchema, request.body))); });
  router.post('/exports/chunk', async (request, response) => { const {exportId,offset}=parse(z.object({exportId:z.string().uuid(),offset:z.number().int().nonnegative()}).strict(),request.body); response.json(readExportChunk(exportId,offset)); });
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
    response.status(201).json(await store.create(input.name));
  });
  router.post('/projects/:id/delete', async (request, response) => {
    response.json(await store.deleteProject(parse(deleteProjectSchema, { ...request.body, projectId: request.params.id })));
  });
  router.get('/projects/:id', async (request, response) => { response.json(await store.get(request.params.id)); });
  router.post('/projects/:id/diagram-layout', async (request, response) => {
    const { pageId, frameId } = parse(z.object({pageId:z.string().min(1).max(128),frameId:z.string().min(1).max(128)}).strict(), request.body);
    const controller = new AbortController(); response.on('close', () => { if (!response.writableEnded) controller.abort(); });
    try { response.json(await layoutDiagram(await store.get(request.params.id), pageId, frameId, controller.signal)); }
    catch (error) { if (!controller.signal.aborted) throw new StoreError(400, 'invalid_diagram_layout', error instanceof Error ? error.message : 'Layout failed.'); }
  });
  router.get('/projects/:id/changes', async (request, response) => {
    const afterRevision = parse(z.string().regex(/^(0|[1-9]\d*)$/).transform(Number).pipe(revisionSchema), request.query.afterRevision);
    const controller = new AbortController();
    const close = () => { if (!response.writableEnded) controller.abort(); };
    response.on('close', close);
    try {
      const project = await store.waitForChange(request.params.id, afterRevision, controller.signal);
      const delta = project && request.query.delta === '1' ? await store.projectDelta(project, afterRevision) : undefined;
      if (!response.destroyed) response.json({ projectId: request.params.id, revision: project?.revision ?? afterRevision, changed: !!project, ...(delta ? { delta } : project ? { project } : {}) });
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
    const project = await store.mutate(request.params.id, expectedRevision, operations);
    // ?delta=1 callers hold expectedRevision, so unchanged pages travel as id references.
    if (request.query.delta !== '1') { response.json(project); return; }
    const delta = await store.projectDelta(project, expectedRevision);
    response.json(delta ? { delta } : { project });
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
        for (const id of seen.keys()) if (!projects.some(project => project.id === id)) response.write(`data: ${JSON.stringify({ projectId: id, deleted: true })}\n\n`);
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

  const errors: ErrorRequestHandler = (error, request, response, next) => {
    if (response.headersSent) { next(error); return; }
    if (error instanceof StoreError) {
      response.status(error.status).json({ error: { code: error.code, message: error.message, ...(error.details === undefined ? {} : { details: error.details }) } });
      return;
    }
    if (error?.type === 'entity.too.large') {
      response.status(413).json({ error: { code: 'input_too_large', message: request.path === '/projects/import' ? `Project exceeds the ${documentLimitLabel} limit` : 'Request exceeds the 2 MiB limit' } });
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
