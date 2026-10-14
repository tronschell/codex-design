import { memo, useEffect, useMemo, useRef, useState } from 'react';
import type { ShaderConfig } from '../shared/types';
import { createShaderRenderer, shaderRuntimeOptions } from '../shared/shaders';

export default memo(function ShaderNode({ shader, name = 'Shader preview', className = '' }: { shader?: ShaderConfig; name?: string; className?: string }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const [error, setError] = useState('');
  const options = useMemo(() => shaderRuntimeOptions(shader), [shader]);
  useEffect(() => {
    setError('');
    if (!canvas.current) return;
    const renderer = createShaderRenderer(canvas.current, options, setError);
    return () => renderer.dispose();
  }, [options]);
  return <><canvas ref={canvas} className={`design-shader ${className}`} role="img" aria-label={name}/>{error && <div className="design-media-status is-error" role="status" title={error}><strong>Shader unavailable</strong><span>{error}</span></div>}</>;
});
