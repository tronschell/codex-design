import { createGpuUniformsMap, rootPassthrough, shaderRendererGPU, type ComponentConfig, type GpuShaderDefinition } from 'shaders/core';
import MeshGradient from 'shaders/core/MeshGradient';
import SineWave from 'shaders/core/SineWave';
import FilmGrain from 'shaders/core/FilmGrain';
import LinearGradient from 'shaders/core/LinearGradient';
import type { ShaderRenderer, ShaderRuntimeOptions } from './shaders';

const definitions: Record<string, GpuShaderDefinition> = { MeshGradient, SineWave, FilmGrain, LinearGradient };

export function createShadersComRenderer(canvas: HTMLCanvasElement, options: ShaderRuntimeOptions, onError?: (message: string) => void): ShaderRenderer {
  const doc = canvas.ownerDocument, win = doc.defaultView!, renderer = shaderRendererGPU();
  const motion = win.matchMedia('(prefers-reduced-motion: reduce)'), capture = options.capture;
  let disposed = false, failed = false, started = false, initialized = false, visible = !!capture, timer = 0;
  let finish!: () => void;
  const ready = new Promise<void>(resolve => { finish = resolve; });
  const fail = (message: string) => {
    if (disposed || failed) return;
    failed = true; win.clearTimeout(timer);
    renderer.cleanup(); canvas.dataset.shaderError = message;
    canvas.setAttribute('aria-label', `Shader unavailable. ${message}`);
    finish(); onError?.(message);
  };
  const resize = () => {
    if (!renderer.isInitialized()) return;
    const width = Math.max(1, canvas.clientWidth), height = Math.max(1, canvas.clientHeight);
    const scale = Math.min(win.devicePixelRatio || 1, 1.5, 1536 / Math.max(width, height));
    const pixelWidth = capture?.width ?? Math.max(1, Math.floor(width * scale));
    const pixelHeight = capture?.height ?? Math.max(1, Math.floor(height * scale));
    const limit = renderer.getInternalRenderer()?.device.limits.maxTextureDimension2D ?? 0;
    if (pixelWidth > limit || pixelHeight > limit) throw new Error('This shader exceeds the graphics driver limit. Choose a lower export scale.');
    renderer.beginRecordingResolution(pixelWidth, pixelHeight, 1);
  };
  const sync = () => {
    if (disposed || failed) return;
    if (!started && visible && (capture || !doc.hidden)) { void initialize(); return; }
    if (!renderer.isInitialized()) return;
    renderer.stopAnimation();
    if (!visible || (!capture && doc.hidden)) return;
    if (!initialized) { renderer.startAnimation(); return; }
    const animate = !capture && options.animate && options.speed > 0 && !motion.matches;
    renderer.setFrameLocked(!animate);
    if (animate) renderer.startAnimation();
    else void renderer.renderAndWait().catch(error => fail(error.message));
  };
  const register = (component: ComponentConfig, parentId: string, index: number) => {
    const definition = definitions[component.type];
    if (!definition) throw new Error(`Unsupported shaders.com component: ${component.type}`);
    const id = `${parentId}-${index}`;
    const props = Object.fromEntries(Object.entries(definition.props).map(([key, prop]) => [key, component.props?.[key] === undefined ? prop.default : component.props[key]]));
    renderer.registerNode(id, definition.fragment, parentId, { renderOrder: index, blendMode: 'normal', opacity: undefined, transform: component.props?.transform }, createGpuUniformsMap(definition, props, id), definition);
    component.children?.forEach((child, childIndex) => register(child, id, childIndex));
  };
  async function initialize() {
    started = true;
    if (capture) timer = win.setTimeout(() => fail('The shaders.com effect took too long to render. Try again or use a smaller frame.'), 30_000);
    try {
      if (capture && (!Number.isInteger(capture.width) || !Number.isInteger(capture.height) || capture.width < 1 || capture.height < 1 || capture.width > 16_384 || capture.height > 16_384 || capture.width * capture.height > 64_000_000)) throw new Error('Shader captures are limited to 16,384 pixels per side and 64 megapixels.');
      renderer.setOnUnavailable(reason => fail(`Shaders.com requires WebGPU. ${reason === 'unsupported' ? 'Enable hardware acceleration or use a WebGPU-capable browser.' : `The GPU could not render this effect (${reason}).`}`));
      await renderer.initialize({ canvas, resizeTarget: canvas, observeElement: false, colorSpace: 'srgb', toneMapping: 'linear' });
      if (disposed || failed) { renderer.cleanup(); return; }
      renderer.setFrameRateCap(30);
      renderer.registerNode('root', rootPassthrough.fragment, null, null, {}, rootPassthrough);
      options.components?.forEach((component, index) => register(component, 'root', index));
      resize();
      renderer.setOnReady(() => {
        if (disposed || failed) return;
        initialized = true; win.clearTimeout(timer); delete canvas.dataset.shaderError;
        renderer.stopAnimation();
        if (capture || !options.animate || motion.matches) {
          renderer.setFrameLocked(true);
          void renderer.renderAndWait().then(finish).catch(error => fail(error.message));
        } else { finish(); sync(); }
      });
      sync();
    } catch (error) { fail(error instanceof Error ? error.message : 'The shaders.com effect could not be rendered.'); }
  }
  const intersection = capture ? null : new IntersectionObserver(entries => { visible = entries.some(entry => entry.isIntersecting); sync(); });
  const observer = capture ? null : new ResizeObserver(() => {
    if (disposed || failed) return;
    try { resize(); sync(); } catch (error) { fail((error as Error).message); }
  });
  intersection?.observe(canvas); observer?.observe(canvas);
  doc.addEventListener('visibilitychange', sync); motion.addEventListener('change', sync);
  sync();
  return { ready, dispose() {
    if (disposed) return;
    disposed = true; win.clearTimeout(timer); finish();
    intersection?.disconnect(); observer?.disconnect();
    doc.removeEventListener('visibilitychange', sync); motion.removeEventListener('change', sync);
    renderer.cleanup();
  } };
}
