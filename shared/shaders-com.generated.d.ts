import type { ShaderRenderer, ShaderRuntimeOptions } from './shaders';

export const shadersComLicense: string;
export function shadersComRuntime(): (canvas: HTMLCanvasElement, options: ShaderRuntimeOptions, onError?: (message: string) => void) => ShaderRenderer;
