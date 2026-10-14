import type { ProfilerOnRenderCallback } from 'react';
import type { Viewport } from '../shared/types';

export const canvasProfilingEnabled = (import.meta as ImportMeta & { env?: { DEV?: boolean } }).env?.DEV === true && new URLSearchParams(location.search).get('profile') === '1';
type Work = 'nodeRenders' | 'treeIndexes' | 'vectorParses' | 'htmlDocuments' | 'inspectorRows' | 'codeExports' | 'codeFormats' | 'projectReads' | 'projectLists';
const work: Record<Work, number> = { nodeRenders: 0, treeIndexes: 0, vectorParses: 0, htmlDocuments: 0, inspectorRows: 0, codeExports: 0, codeFormats: 0, projectReads: 0, projectLists: 0 };
const camera = { commits: 0, renderMs: 0, nodeRenders: 0, treeIndexes: 0, vectorParses: 0, htmlDocuments: 0, inspectorRows: 0, codeExports: 0, codeFormats: 0, durations: [] as number[] };
let previous = { ...work }, view = '', committedView = '', commits = 0, renderMs = 0, firstCanvasReadyMs: number | null = null, publishFrame = 0;

function publish() {
  if (publishFrame) return;
  publishFrame = requestAnimationFrame(() => {
    publishFrame = 0;
    document.getElementById('root')?.setAttribute('data-canvas-profile', JSON.stringify({ work, camera, commits, renderMs, firstCanvasReadyMs }));
  });
}

export function recordCanvasWork(name: Work) { if (canvasProfilingEnabled) work[name]++; }
export function recordCanvasView(value: Viewport) { if (canvasProfilingEnabled) view = `${value.x}/${value.y}/${value.zoom}`; }
export function recordCanvasReady() {
  if (!canvasProfilingEnabled || firstCanvasReadyMs !== null) return;
  requestAnimationFrame(() => { if (firstCanvasReadyMs === null) firstCanvasReadyMs = performance.now(); publish(); });
}
export const recordCanvasCommit: ProfilerOnRenderCallback = (_id, phase, duration) => {
  if (!canvasProfilingEnabled) return;
  commits++; renderMs += duration;
  if (phase !== 'mount' && committedView && view !== committedView) {
    camera.commits++; camera.renderMs += duration;
    for (const name of ['nodeRenders', 'treeIndexes', 'vectorParses', 'htmlDocuments', 'inspectorRows', 'codeExports', 'codeFormats'] as const) camera[name] += work[name] - previous[name];
    camera.durations.push(duration);
    if (camera.durations.length > 64) camera.durations.shift();
  }
  previous = { ...work }; committedView = view;
  publish();
};
