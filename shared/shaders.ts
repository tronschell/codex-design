import type { ShaderConfig } from './types.js';

export const shaderPresets = [
  { id: 'mesh', name: 'Mesh', description: 'Soft flowing color fields' },
  { id: 'waves', name: 'Waves', description: 'Layered ribbons of color' },
  { id: 'grain', name: 'Grain', description: 'A fine, seeded color texture' },
  { id: 'custom', name: 'Custom GLSL', description: 'Your own fragment shader' },
] as const;

const uniforms = `#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif
uniform vec2 u_resolution;
uniform float u_time;
uniform float u_scale;
uniform float u_seed;
uniform vec4 u_color1;
uniform vec4 u_color2;
uniform vec4 u_color3;
uniform vec4 u_color4;
`;

const fragments = {
  mesh: `${uniforms}
void main() {
  vec2 p = gl_FragCoord.xy / max(u_resolution, vec2(1.0));
  p.x *= u_resolution.x / max(u_resolution.y, 1.0);
  p = (p - 0.5) * u_scale;
  float t = u_time * 0.28 + u_seed * 0.013;
  float a = 0.5 + 0.5 * sin(p.x * 3.3 + sin(p.y * 2.6 + t) + t);
  float b = 0.5 + 0.5 * cos(p.y * 3.1 + sin(p.x * 2.2 - t) - t * 0.8);
  vec4 color = mix(u_color1, u_color2, smoothstep(0.0, 1.0, a));
  color = mix(color, u_color3, b * 0.7);
  gl_FragColor = mix(color, u_color4, pow(a * b, 2.0) * 0.45);
}`,
  waves: `${uniforms}
void main() {
  vec2 p = gl_FragCoord.xy / max(u_resolution, vec2(1.0));
  p.x *= u_resolution.x / max(u_resolution.y, 1.0);
  p *= u_scale;
  float t = u_time * 0.4 + u_seed * 0.017;
  float bend = sin(p.x * 3.5 + t) * 0.12 + sin(p.x * 7.0 - t * 0.7) * 0.04;
  float bands = 0.5 + 0.5 * sin((p.y + bend) * 13.0 + t);
  vec4 color = mix(u_color1, u_color2, smoothstep(0.12, 0.7, bands));
  color = mix(color, u_color3, smoothstep(0.65, 1.0, bands));
  gl_FragColor = mix(color, u_color4, (0.5 + 0.5 * sin(p.x * 2.0 - t)) * 0.14);
}`,
  grain: `${uniforms}
float noise(vec2 p) {
  p = fract(p * vec2(0.1031, 0.11369));
  p += dot(p, p.yx + 19.19);
  return fract((p.x + p.y) * p.x);
}
void main() {
  vec2 p = gl_FragCoord.xy / max(u_resolution, vec2(1.0));
  vec2 cell = floor(gl_FragCoord.xy / max(0.65, u_scale));
  float n = noise(cell + vec2(mod(u_seed, 977.0), floor(mod(u_time, 300.0) * 12.0)));
  vec4 color = mix(u_color1, u_color2, p.x);
  color = mix(color, u_color3, p.y * 0.5);
  color = mix(color, u_color4, n * 0.1);
  gl_FragColor = vec4(clamp(color.rgb + (n - 0.5) * 0.16, 0.0, 1.0), color.a);
}`,
  custom: `${uniforms}
void main() {
  vec2 uv = gl_FragCoord.xy / max(u_resolution, vec2(1.0));
  float wave = 0.5 + 0.5 * sin((uv.x + uv.y) * 6.0 * u_scale + u_time);
  gl_FragColor = mix(u_color1, u_color2, wave);
}`,
};

export function defaultShader(preset: ShaderConfig['preset'] = 'mesh'): ShaderConfig {
  return { preset, colors: ['#4497ff', '#a58eff', '#f2a986'], speed: 1, scale: 1, seed: 1, animate: false, ...(preset === 'custom' ? { fragment: fragments.custom } : {}) };
}

export function shaderFragmentSource(shader?: ShaderConfig): string {
  const preset = shader?.preset ?? 'mesh';
  return preset === 'custom' ? shader?.fragment ?? fragments.custom : fragments[preset];
}

export interface ShaderRuntimeOptions {
  fragmentSource: string;
  colors: string[];
  speed: number;
  scale: number;
  seed: number;
  animate: boolean;
  capture?: { width: number; height: number };
}

export function shaderRuntimeOptions(shader?: ShaderConfig): ShaderRuntimeOptions {
  return {
    fragmentSource: shaderFragmentSource(shader), colors: shader?.colors ?? defaultShader().colors!,
    speed: Math.max(0, Math.min(5, shader?.speed ?? 1)), scale: Math.max(0.1, Math.min(10, shader?.scale ?? 1)),
    seed: Math.max(0, Math.min(10000, shader?.seed ?? 1)), animate: shader?.animate === true,
  };
}

// Keep this runtime self-contained: source exports embed this fixed function, never user JavaScript.
export function createShaderRenderer(canvas: HTMLCanvasElement, options: ShaderRuntimeOptions, onError?: (message: string) => void): { dispose: () => void } {
  const doc = canvas.ownerDocument, win = doc.defaultView!;
  const motion = win.matchMedia('(prefers-reduced-motion: reduce)');
  let gl: WebGLRenderingContext | null = null, program: WebGLProgram | null = null, buffer: WebGLBuffer | null = null;
  const capture = options.capture;
  let disposed = false, failed = false, visible = !!capture || typeof IntersectionObserver === 'undefined', frame = 0;
  let elapsed = 0, previousTime = 0, previousPaint = -Infinity;
  let vertex: WebGLShader | null = null, fragment: WebGLShader | null = null;
  const locations = new Map<string, WebGLUniformLocation | null>();
  const colors = options.colors.map(value => {
    let hex = value.replace(/^#/, '');
    if (hex.length === 3 || hex.length === 4) hex = [...hex].map(c => c + c).join('');
    return [0, 2, 4, 6].map((offset, channel) => channel === 3 && hex.length === 6 ? 1 : parseInt(hex.slice(offset, offset + 2), 16) / 255);
  });
  function stop() { if (frame) win.cancelAnimationFrame(frame); frame = 0; previousTime = 0; }
  function fail(message: string) {
    failed = true; stop();
    canvas.dataset.shaderError = message;
    canvas.setAttribute('aria-label', `Shader unavailable. ${message}`);
    onError?.(message);
  }
  function compile(type: number, source: string): WebGLShader {
    const shader = gl!.createShader(type);
    if (!shader) throw new Error('The graphics driver could not create a shader.');
    gl!.shaderSource(shader, source);
    gl!.compileShader(shader);
    if (!gl!.getShaderParameter(shader, gl!.COMPILE_STATUS)) {
      const message = gl!.getShaderInfoLog(shader)?.trim() || 'The GLSL source did not compile.';
      gl!.deleteShader(shader);
      throw new Error(message);
    }
    return shader;
  }
  function initialize(): boolean {
    if (gl) return true;
    try {
      if (capture && (!Number.isInteger(capture.width) || !Number.isInteger(capture.height) || capture.width < 1 || capture.height < 1 || capture.width > 16_384 || capture.height > 16_384 || capture.width * capture.height > 64_000_000)) throw new Error('Shader captures are limited to 16,384 pixels per side and 64 megapixels.');
      gl = canvas.getContext('webgl', { alpha: true, antialias: false, depth: false, stencil: false, powerPreference: 'low-power', preserveDrawingBuffer: !!capture });
      if (!gl) throw new Error('WebGL is unavailable. Enable hardware acceleration or use another browser.');
      vertex = compile(gl.VERTEX_SHADER, 'attribute vec2 a_position; void main() { gl_Position = vec4(a_position, 0.0, 1.0); }');
      fragment = compile(gl.FRAGMENT_SHADER, options.fragmentSource);
      program = gl.createProgram();
      if (!program) throw new Error('The graphics driver could not create a shader program.');
      gl.attachShader(program, vertex); gl.attachShader(program, fragment); gl.linkProgram(program);
      if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(program)?.trim() || 'The shader uniforms or attributes could not be linked.');
      gl.useProgram(program);
      buffer = gl.createBuffer();
      if (!buffer) throw new Error('The graphics driver could not allocate a shader buffer.');
      gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]), gl.STATIC_DRAW);
      const position = gl.getAttribLocation(program, 'a_position');
      if (position >= 0) { gl.enableVertexAttribArray(position); gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0); }
      for (const name of ['u_resolution', 'u_time', 'u_scale', 'u_seed', 'u_color1', 'u_color2', 'u_color3', 'u_color4']) locations.set(name, gl.getUniformLocation(program, name));
      gl.uniform1f(locations.get('u_scale')!, options.scale); gl.uniform1f(locations.get('u_seed')!, options.seed);
      for (let i = 0; i < 4; i++) gl.uniform4fv(locations.get(`u_color${i + 1}`)!, colors[Math.min(i, colors.length - 1)] ?? [0, 0, 0, 1]);
      delete canvas.dataset.shaderError;
      return true;
    } catch (error) { fail(error instanceof Error ? error.message : 'The shader could not be rendered.'); return false; }
  }
  function draw() {
    if (!gl || !program) return;
    const ratio = Math.min(win.devicePixelRatio || 1, 1.5);
    const width = Math.max(1, canvas.clientWidth), height = Math.max(1, canvas.clientHeight);
    const limit = Math.min(ratio, 2048 / Math.max(width, height), Math.sqrt(1000000 / (width * height)));
    const pixelWidth = capture?.width ?? Math.max(1, Math.floor(width * limit)), pixelHeight = capture?.height ?? Math.max(1, Math.floor(height * limit));
    if (capture && (pixelWidth > gl.getParameter(gl.MAX_RENDERBUFFER_SIZE) || pixelHeight > gl.getParameter(gl.MAX_RENDERBUFFER_SIZE))) { fail('This shader capture exceeds the graphics driver limit. Choose a lower export scale.'); return; }
    if (canvas.width !== pixelWidth || canvas.height !== pixelHeight) { canvas.width = pixelWidth; canvas.height = pixelHeight; }
    gl.viewport(0, 0, pixelWidth, pixelHeight);
    gl.uniform2f(locations.get('u_resolution')!, pixelWidth, pixelHeight);
    gl.uniform1f(locations.get('u_time')!, elapsed * options.speed);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
    if (capture && gl.getError() !== gl.NO_ERROR) fail('The graphics driver could not render this shader still. Choose a lower export scale.');
  }
  function canDraw() { return !disposed && !failed && visible && (!!capture || !doc.hidden); }
  function canAnimate() { return !capture && canDraw() && options.animate && options.speed > 0 && !motion.matches; }
  function tick(time: number) {
    frame = 0;
    if (!canAnimate()) { previousTime = 0; return; }
    if (time - previousPaint >= 1000 / 30 - 0.5) {
      if (previousTime) elapsed += Math.min((time - previousTime) / 1000, 0.1);
      previousTime = time; previousPaint = time; draw();
    }
    frame = win.requestAnimationFrame(tick);
  }
  function sync() {
    stop();
    if (!canDraw() || !initialize()) return;
    draw();
    previousPaint = -Infinity;
    if (canAnimate()) frame = win.requestAnimationFrame(tick);
  }
  function contextLost(event: Event) { event.preventDefault(); stop(); fail('The graphics context was lost. Reload the canvas to restore this shader.'); }
  const intersection = capture || typeof IntersectionObserver === 'undefined' ? null : new IntersectionObserver(entries => { visible = entries.some(entry => entry.isIntersecting && entry.intersectionRatio > 0); sync(); });
  const resize = capture || typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(sync);
  intersection?.observe(canvas); resize?.observe(canvas);
  doc.addEventListener('visibilitychange', sync); motion.addEventListener('change', sync);
  win.addEventListener('resize', sync); canvas.addEventListener('webglcontextlost', contextLost);
  sync();
  return { dispose() {
    disposed = true; stop(); intersection?.disconnect(); resize?.disconnect();
    doc.removeEventListener('visibilitychange', sync); motion.removeEventListener('change', sync);
    win.removeEventListener('resize', sync); canvas.removeEventListener('webglcontextlost', contextLost);
    if (gl) { if (buffer) gl.deleteBuffer(buffer); if (program) gl.deleteProgram(program); if (vertex) gl.deleteShader(vertex); if (fragment) gl.deleteShader(fragment); if (capture) gl.getExtension('WEBGL_lose_context')?.loseContext(); }
  } };
}

export function shaderRuntimeSource(): string {
  const source = createShaderRenderer.toString();
  // tsx preserves nested function names through a helper absent from a standalone export.
  return source.includes('__name(') ? `((__name)=>(${source}))((value)=>value)` : `(${source})`;
}
