import type { CanvasSelection } from '../shared/types';

type DataRecord = Record<string, unknown>;
type ToolResult = { structuredContent?: DataRecord; content?: { type: string; text?: string }[]; isError?: boolean };
type DisplayMode = 'fullscreen' | 'inline' | 'pip';
type HostContext = { availableDisplayModes?: DisplayMode[]; displayMode?: DisplayMode; 'openai/modelContext'?: unknown };
export type CanvasTarget = Pick<CanvasSelection, 'projectId'> & Partial<Omit<CanvasSelection, 'projectId'>>;
export type CanvasLaunch = { selection: CanvasTarget | null; output?: DataRecord };
type CanvasScope = 'thread' | 'library';

declare global {
  interface Window {
    __CODEX_DESIGN_EMBEDDED__?: boolean;
    __CODEX_DESIGN_API_BASE__?: string;
    openai?: {
      callTool?: (name: string, args: DataRecord) => Promise<ToolResult>;
      sendFollowUpMessage?: (args: { prompt: string }) => Promise<void>;
      setWidgetState?: (state: unknown) => void;
      toolOutput?: DataRecord;
      toolResponseMetadata?: DataRecord;
      toolInput?: DataRecord;
      widgetState?: unknown;
    };
  }
}

export const embedded = window.__CODEX_DESIGN_EMBEDDED__ === true || window.parent !== window;
let nextId = 0;
let initialization: Promise<void> | null = null;
let standardBridge = false;
let hostContext: HostContext = {};
const pending = new Map<number, { resolve: (value: any) => void; reject: (error: Error) => void; timer: ReturnType<typeof setTimeout> }>();
const outputListeners = new Set<(value: DataRecord) => void>();
const launchListeners = new Set<(value: CanvasLaunch) => void>();
const launchWaiters = new Set<() => void>();
const isRecord = (value: unknown): value is DataRecord => typeof value === 'object' && value !== null && !Array.isArray(value);
const validId = (value: unknown): value is string => typeof value === 'string' && /^[a-zA-Z0-9][a-zA-Z0-9_-]{0,127}$/.test(value);
let toolInput = window.openai?.toolInput;
let widgetState = window.openai?.widgetState;
let packet = 0, inputPacket = toolInput ? ++packet : 0, outputPacket = 0, handledInput = 0;
let scopedLaunchOutput: DataRecord | undefined;
let activeScope: CanvasScope = 'thread', activeLaunchId: string | undefined, handledLaunchId: string | undefined, launchHydrated = false;

function targetFrom(value: unknown, depth = 0): CanvasTarget | null {
  if (!isRecord(value) || depth > 4) return null;
  if (validId(value.projectId)) return { projectId: value.projectId, ...(validId(value.boardId) ? { boardId: value.boardId } : {}), ...(validId(value.pageId) ? { pageId: value.pageId } : {}) };
  for (const key of ['structuredContent', 'selection', 'modelContent']) {
    const target = targetFrom(value[key], depth + 1);
    if (target) return target;
  }
  return null;
}

function explicitTarget(): Partial<CanvasSelection> | null {
  if (!isRecord(toolInput)) return null;
  const target = Object.fromEntries(['projectId', 'boardId', 'pageId'].filter(key => validId(toolInput![key])).map(key => [key, toolInput![key]]));
  return Object.keys(target).length ? target : null;
}
function matchesExplicit(opened: CanvasTarget | null, explicit: Partial<CanvasSelection> | null) {
  return !!opened && !!explicit && (!explicit.projectId || explicit.projectId === opened.projectId) && (!explicit.boardId || explicit.boardId === opened.boardId) && (!explicit.pageId || explicit.pageId === opened.pageId);
}

function bindingContext(value: unknown, depth = 0): DataRecord | undefined {
  if (!isRecord(value) || depth > 4) return undefined;
  if (validId(value.projectId)) return value;
  for (const key of ['structuredContent', 'modelContent', 'selection']) {
    const context = bindingContext(value[key], depth + 1);
    if (context) return context;
  }
  return undefined;
}

function launchTarget(): CanvasTarget | null {
  const model = bindingContext(hostContext['openai/modelContext']), widget = bindingContext(widgetState);
  const scope: CanvasScope = scopedLaunchOutput?.canvasScope === 'library' ? 'library' : scopedLaunchOutput?.canvasScope === 'thread' ? 'thread' : (model?.canvasScope ?? widget?.canvasScope) === 'library' ? 'library' : 'thread';
  const sameScope = (context?: DataRecord) => context && (context.canvasScope ?? 'thread') === scope;
  const restored = sameScope(model) ? model : sameScope(widget) ? widget : undefined;
  const launchId = validId(scopedLaunchOutput?.canvasLaunchId) ? scopedLaunchOutput.canvasLaunchId : undefined;
  activeScope = scope;
  activeLaunchId = launchId || (validId(restored?.canvasLaunchId) ? restored.canvasLaunchId : undefined);
  handledLaunchId = launchId;
  // A remount retains the original tool input; its handled launch must not undo a later UI choice.
  if (restored && launchId && restored.canvasLaunchId === launchId) return targetFrom(restored);
  const opened = targetFrom(scopedLaunchOutput), input = scope === 'thread' ? explicitTarget() : null;
  if (launchId && scopedLaunchOutput?.canvasTargetExplicit === true && opened) return matchesExplicit(opened, input) ? { ...opened, ...input } : opened;
  if (scopedLaunchOutput?.canvasTargetExplicit === false) return targetFrom(restored) || opened;
  const explicit = !scopedLaunchOutput || matchesExplicit(opened, input) ? input : null;
  if (explicit?.projectId) return { ...(opened?.projectId === explicit.projectId ? opened : {}), ...explicit, projectId: explicit.projectId };
  if (matchesExplicit(opened, explicit)) return { ...opened!, ...explicit };
  return targetFrom(restored) || opened;
}

function announceLaunch() {
  for (const ready of launchWaiters) ready();
  if (!launchHydrated) return;
  const explicit = explicitTarget(), opened = targetFrom(scopedLaunchOutput);
  if (!matchesExplicit(opened, explicit) || scopedLaunchOutput?.canvasScope !== activeScope || scopedLaunchOutput.canvasTargetExplicit === false || inputPacket <= handledInput) return;
  const launchId = validId(scopedLaunchOutput.canvasLaunchId) ? scopedLaunchOutput.canvasLaunchId : undefined;
  if (launchId && launchId === handledLaunchId) return;
  if (outputPacket <= inputPacket && !(launchId && scopedLaunchOutput.canvasTargetExplicit === true)) return;
  handledInput = inputPacket;
  handledLaunchId = launchId;
  for (const listener of launchListeners) listener({ selection: { ...opened!, ...explicit }, output: scopedLaunchOutput });
}

function captureInput(value: unknown) {
  if (!isRecord(value)) return;
  toolInput = value;
  inputPacket = ++packet;
  announceLaunch();
}

function projectOutput(value: unknown, depth = 0): DataRecord | undefined {
  if (!isRecord(value) || depth > 5 || value.isError === true || value.historyPreview === true) return undefined;
  if (isRecord(value.project) || value.canvasScope === 'thread' || value.canvasScope === 'library') return value;
  for (const key of ['structuredContent', 'result', 'call_tool_result', 'mcp_tool_result']) {
    const output = projectOutput(value[key], depth + 1);
    if (output) return output;
  }
  return undefined;
}

let lastOpenAiOutput = window.openai?.toolOutput;
let latestToolResult = projectOutput(lastOpenAiOutput) ?? projectOutput(window.openai?.toolResponseMetadata);
if (latestToolResult?.canvasScope === 'thread' || latestToolResult?.canvasScope === 'library') { scopedLaunchOutput = latestToolResult; outputPacket = ++packet; }

function captureOutput(value: unknown, notify = true) {
  const output = projectOutput(value);
  if (!output) return;
  latestToolResult = output;
  if (output.canvasScope === 'thread' || output.canvasScope === 'library') { scopedLaunchOutput = output; outputPacket = ++packet; announceLaunch(); }
  if (notify) for (const listener of outputListeners) listener(output);
}

window.addEventListener('message', (event) => {
  if (event.source !== window.parent || !event.data || event.data.jsonrpc !== '2.0') return;
  const message = event.data;
  if (typeof message.id === 'number' && pending.has(message.id) && ('result' in message || 'error' in message)) {
    const item = pending.get(message.id)!;
    clearTimeout(item.timer); pending.delete(message.id);
    if (message.error) item.reject(new Error(message.error.message || 'The host could not complete this action.'));
    else item.resolve(message.result);
  }
  if (message.method === 'ui/notifications/tool-result') captureOutput(message.params);
  if (message.method === 'ui/notifications/tool-input') captureInput(message.params?.arguments);
  if (message.method === 'ui/notifications/host-context-changed') hostContext = { ...hostContext, ...message.params };
  if ((message.method === 'ping' || message.method === 'ui/resource-teardown') && message.id !== undefined) {
    window.parent.postMessage({ jsonrpc: '2.0', id: message.id, result: {} }, '*');
  }
});

window.addEventListener('openai:set_globals', (event) => {
  const globals = (event as CustomEvent<{ globals?: { toolOutput?: unknown; toolResponseMetadata?: unknown; toolInput?: unknown; widgetState?: unknown } }>).detail?.globals;
  if (globals?.toolInput !== undefined) captureInput(globals.toolInput);
  if (globals?.widgetState !== undefined) widgetState = globals.widgetState;
  if (globals?.toolOutput !== undefined) {
    lastOpenAiOutput = window.openai?.toolOutput;
    captureOutput(globals.toolOutput);
  } else if (globals?.toolResponseMetadata !== undefined) captureOutput(globals.toolResponseMetadata);
});

function request(method: string, params: DataRecord, timeout = 15000): Promise<any> {
  const id = ++nextId;
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => { pending.delete(id); reject(new Error('The host did not respond. Reopen the canvas from the plugin and try again.')); }, timeout);
    pending.set(id, { resolve, reject, timer });
    window.parent.postMessage({ jsonrpc: '2.0', id, method, params }, '*');
  });
}

export function initializeBridge(): Promise<void> {
  if (!embedded) return Promise.resolve();
  if (!initialization) initialization = request('ui/initialize', {
    appInfo: { name: 'Codex Design', version: '0.1.0' },
    appCapabilities: { availableDisplayModes: ['inline', 'fullscreen'] }, protocolVersion: '2026-01-26',
  }, 5000).then((result) => {
    standardBridge = true;
    hostContext = result?.hostContext ?? {};
    window.parent.postMessage({ jsonrpc: '2.0', method: 'ui/notifications/initialized', params: {} }, '*');
  }).catch((error) => {
    if (!window.openai?.callTool) { initialization = null; throw error; }
  });
  return initialization;
}

export async function callTool(name: string, args: DataRecord = {}): Promise<DataRecord> {
  await initializeBridge();
  const result: ToolResult = standardBridge
    ? await request('tools/call', { name, arguments: args })
    : await window.openai!.callTool!(name, args);
  if (result.isError) throw new Error(result.content?.find((item) => item.type === 'text')?.text || 'The tool could not complete the action.');
  if (result.structuredContent) {
    captureOutput(result, false);
    return result.structuredContent;
  }
  const text = result.content?.find((item) => item.type === 'text')?.text;
  if (text) {
    let parsed: unknown;
    try { parsed = JSON.parse(text); } catch { throw new Error(text); }
    if (isRecord(parsed)) { captureOutput(parsed, false); return parsed; }
  }
  throw new Error('The plugin returned an empty result.');
}

export function getLatestToolResult(): DataRecord | undefined {
  const current = window.openai?.toolOutput;
  if (current !== lastOpenAiOutput) { lastOpenAiOutput = current; captureOutput(current, false); }
  return latestToolResult;
}

export async function getCanvasLaunch(): Promise<CanvasLaunch> {
  await initializeBridge();
  getLatestToolResult();
  const hasLaunch = () => {
    if (!scopedLaunchOutput) return false;
    const explicit = explicitTarget(), opened = targetFrom(scopedLaunchOutput);
    return scopedLaunchOutput.canvasScope === 'library' || typeof scopedLaunchOutput.canvasTargetExplicit === 'boolean' || !explicit || matchesExplicit(opened, explicit);
  };
  if (standardBridge && !hasLaunch()) await new Promise<void>(resolve => {
    const finish = () => { clearTimeout(timer); launchWaiters.delete(check); resolve(); };
    const check = () => { if (hasLaunch()) finish(); };
    const timer = setTimeout(finish, 5000);
    launchWaiters.add(check);
    check();
  });
  handledInput = inputPacket;
  const launch = { selection: launchTarget(), output: scopedLaunchOutput };
  launchHydrated = true;
  return launch;
}

export function acceptCanvasLaunch(launch: CanvasLaunch) {
  const output = launch.output;
  if (output?.canvasScope !== 'thread' && output?.canvasScope !== 'library') return;
  activeScope = output.canvasScope;
  activeLaunchId = validId(output.canvasLaunchId) ? output.canvasLaunchId : undefined;
}

export function onCanvasLaunch(listener: (launch: CanvasLaunch) => void) {
  launchListeners.add(listener);
  return () => { launchListeners.delete(listener); };
}

export function onToolResult(listener: (result: DataRecord) => void) {
  outputListeners.add(listener);
  return () => { outputListeners.delete(listener); };
}

export async function sendFollowUp(prompt: string): Promise<boolean> {
  if (!embedded) return false;
  await initializeBridge();
  if (standardBridge) await request('ui/message', { role: 'user', content: [{ type: 'text', text: prompt }] });
  else if (window.openai?.sendFollowUpMessage) await window.openai.sendFollowUpMessage({ prompt });
  else throw new Error('This host cannot send a follow-up. Copy the queued request into your chat.');
  return true;
}

let contextQueue = Promise.resolve(), contextEpoch = 0, selectionQueue = Promise.resolve(), lastSelectionKey = '', selectionToolUnavailable = false;
export function updateModelContext(context: DataRecord) {
  const target = targetFrom(context);
  if (!embedded || context.readOnlyPreview === true || !target?.boardId) return;
  const epoch = ++contextEpoch;
  contextQueue = contextQueue.catch(() => {}).then(async () => {
    await initializeBridge();
    if (epoch !== contextEpoch) return;
    const paneContext = { ...context, canvasScope: activeScope, ...(activeLaunchId ? { canvasLaunchId: activeLaunchId } : {}) };
    hostContext['openai/modelContext'] = { structuredContent: paneContext };
    widgetState = { ...(isRecord(widgetState) ? widgetState : {}), modelContent: paneContext };
    try { window.openai?.setWidgetState?.(widgetState); } catch { /* Model context remains available when legacy widget storage is unavailable. */ }
    const key = JSON.stringify([target.projectId, target.boardId, target.pageId ?? '']);
    if (key !== lastSelectionKey) {
      lastSelectionKey = key;
      selectionQueue = selectionQueue.catch(() => {}).then(async () => {
        if (lastSelectionKey === key && !selectionToolUnavailable) await callTool('canvas_set_selection', { ...target });
      }).catch(error => { if (/unknown tool|not found|not registered|unrecognized tool|does not exist/i.test(String(error))) selectionToolUnavailable = true; });
    }
    if (standardBridge) await request('ui/update-model-context', { structuredContent: paneContext });
  }).catch(() => { /* The explicit follow-up still includes the project and anchor. */ });
}
