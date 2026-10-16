import { useEffect, useRef } from 'react';
import { ArrowLeft } from 'lucide-react';
import type { DesignProject, NativeComponentDefinition, Operation } from '../shared/types';
import { NodeView } from './DesignNode';
import ReactSourceEditor from './ReactSourceEditor';
import { useAutosaveState } from './useAutosaveDraft';
import { usePanelResize } from './usePanelResize';

export default function ReactComponentEditor({ project, definition, readOnly, onChange, onBack, onClose }: {
  project: DesignProject; definition: NativeComponentDefinition; readOnly: boolean;
  onChange: (operations: Operation[]) => Promise<DesignProject | null>; onBack: () => void; onClose: () => void;
}) {
  const root = definition.nodes.find(node => node.id === definition.rootNodeId)!;
  const heading = useRef<HTMLHeadingElement>(null), saveState = useAutosaveState();
  const sourcePanel = usePanelResize('codex-component-source-width', 520, 'Component source editor width');
  const unsaved = saveState !== 'saved';
  useEffect(() => { heading.current?.focus(); }, [definition.id]);
  return <section className="project-library tw:flex tw:flex-col" aria-label={`Edit ${definition.name}`} onKeyDown={event => {
    event.stopPropagation();
    if (event.key === 'Escape' && !unsaved && !(event.target as Element).closest('input, textarea, select, [contenteditable]')) { event.preventDefault(); onBack(); }
  }} onKeyUp={event => event.stopPropagation()}>
    <header className="tw:flex tw:items-center tw:gap-4 tw:border-b tw:border-white/10 tw:px-4 tw:py-3">
      <button type="button" className="library-button" disabled={unsaved} onClick={onBack}><ArrowLeft size={14}/>Components</button>
      <h2 ref={heading} tabIndex={-1} className="tw:min-w-0 tw:flex-1 tw:truncate tw:text-sm tw:font-medium tw:outline-none">{definition.name}</h2>
      <button type="button" className="library-button" disabled={unsaved} onClick={onClose}>Back to canvas</button>
    </header>
    <div className="tw:flex tw:min-h-0 tw:flex-1">
      <div className="tw:grid tw:min-w-0 tw:flex-1 tw:place-items-center tw:overflow-auto tw:p-8" aria-label="Component preview">
        <div className="tw:relative tw:shrink-0" style={{width:root.width,height:root.height}}><NodeView node={root} nodes={definition.nodes} designSystem={project.designSystem} interactive={false} preview/></div>
      </div>
      <aside ref={sourcePanel.ref} style={sourcePanel.style} className="tw:relative tw:shrink-0 tw:border-l tw:border-white/10 tw:bg-[#202020]" aria-label="Component source editor">
        <div {...sourcePanel.handleProps}/>
        <div className="tw:h-full tw:overflow-auto">
        <ReactSourceEditor key={`${project.id}/${definition.id}`} node={root} system={project.designSystem} readOnly={readOnly} onChange={onChange}/>
        {unsaved && <p className="tw:px-3 tw:text-xs tw:text-[#a8a8a8]">Save or resolve the current draft before leaving this component.</p>}
        </div>
      </aside>
    </div>
  </section>;
}
