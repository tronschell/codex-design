import { Code2, ImagePlus } from 'lucide-react';
import { shortcut } from './shortcuts';
import type { ShaderConfig } from '../shared/types';
import { defaultShader, shaderPresets } from '../shared/shaders';
import ShaderNode from './ShaderNode';

const previews = shaderPresets.filter(preset => preset.id !== 'custom').map(preset => ({ ...preset, shader: defaultShader(preset.id) }));

export default function InsertMenu({ onPickMedia, onAddShader, disabled }: { onPickMedia: () => void; onAddShader: (shader: ShaderConfig) => void; disabled: boolean }) {
  return <div className="dropdown insert-menu" aria-label="Insert media and effects">
    <button className="dropdown-item" disabled={disabled} onClick={onPickMedia}><ImagePlus size={17}/><span>Image or video…</span><kbd>{shortcut('Ctrl+I')}</kbd></button>
    <div className="menu-divider"/>
    <div className="menu-heading">Shader effects</div>
    {previews.map(preset => <button key={preset.id} className="shader-option" disabled={disabled} onClick={() => onAddShader(defaultShader(preset.id))}>
      <span className="shader-thumbnail" aria-hidden="true"><ShaderNode shader={preset.shader} name={preset.name}/></span>
      <span><strong>{preset.name}</strong><small>{preset.description}</small></span>
    </button>)}
    <button className="dropdown-item" disabled={disabled} onClick={() => onAddShader(defaultShader('custom'))}><Code2 size={17}/><span>Custom GLSL shader</span></button>
  </div>;
}
