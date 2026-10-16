import { createPortal } from 'react-dom';
import ExportPanel from './ExportPanel';
import { libraryProject } from '../shared/library-export';
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { ArrowLeft, Check, Component, Download, Plus, RefreshCw, Unlink } from 'lucide-react';
import type { DesignProject, LibraryScope, Operation } from '../shared/types';
import { uid } from './editor-utils';
import LibraryVersions from './LibraryVersions';
import ImplementationNotes from './ImplementationNotes';
import { useLocalDraft } from './useLocalDraft';


interface ComponentEditorProps {
  discovery: ReactNode;
  project: DesignProject;
  pageId?: string;
  selectedNodeId?: string;
  componentId: string;
  disabled: boolean;
  position: { x: number; y: number };
  onSelect: (id: string) => void;
  onExport: (componentId?: string) => void;
  exportDisabled: boolean;
  onChange: (operations: Operation[]) => Promise<DesignProject | null>;
  onApply: (revision: number, scope: LibraryScope, componentId?: string) => Promise<DesignProject | null>;
  onNotify: (message: string) => void;
  onReturn: () => void;
  onInserted: (nodeId: string) => void;
}

export default function ComponentEditor({ discovery, project, pageId, selectedNodeId, componentId, disabled, position, onSelect, onExport, exportDisabled, onChange, onApply, onNotify, onReturn, onInserted }: ComponentEditorProps) {
  const page = project.pages.find(item => item.id === pageId), selected = page?.nodes.find(node => node.id === selectedNodeId);
  const instance = page?.nodes.find(node => node.componentInstance && Object.values(node.componentInstance.nodeMap).includes(selectedNodeId ?? ''));
  const definition = project.designSystem.components.find(item => item.id === componentId);
  const [imageExport, setImageExport] = useState(false);
  useEffect(()=>setImageExport(false),[componentId]);
  const imageProject=useMemo(()=>{if(!definition)return null;const scoped=libraryProject(project,definition.id);return {...scoped,pages:[{...scoped.pages[0],nodes:definition.nodes}]};},[project,definition]);
  const local = useLocalDraft(`${project.id}/${pageId ?? ''}/${selectedNodeId ?? ''}/${componentId}/component-actions`, {name: selected?.name ?? '', description: '', label: ''});
  const {name, description, label} = local.value;
  const setName = (name: string) => local.setValue({name}), setDescription = (description: string) => local.setValue({description}), setLabel = (label: string) => local.setValue({label});
  const [busy, setBusy] = useState(false), [error, setError] = useState('');
  const guard = useRef(false), mounted = useRef(true);
  const identity = `${project.id}/${pageId ?? ''}/${selectedNodeId ?? ''}/${componentId}`;
  const context = useRef(identity); context.current = identity;
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  const run = async (operations: Operation[], success: (next: DesignProject) => void) => {
    if (guard.current || disabled) return false;
    const owner = context.current;
    guard.current = true; setBusy(true); setError('');
    try {
      const next = await onChange(operations);
      if (!next) throw new Error('The component was not saved. Review the error and try again.');
      if (mounted.current && context.current === owner) success(next);
      return true;
    } catch (failure) { if (mounted.current && context.current === owner) setError(failure instanceof Error ? failure.message : 'Could not save the component.'); return false; }
    finally { guard.current = false; if (mounted.current) setBusy(false); }
  };
  const locked = disabled || busy;
  const instances = definition ? project.pages.flatMap(item => item.nodes.filter(node => node.componentInstance?.componentId === definition.id).map(node => ({ page: item, node }))) : [];

  return <div className="library-panel-scroll" aria-busy={busy} onBlurCapture={local.onBlur} onCompositionStartCapture={local.onCompositionStart} onCompositionEndCapture={local.onCompositionEnd}>
    {imageExport && imageProject && definition && createPortal(<ExportPanel key={definition.id} project={imageProject} componentId={definition.id} boardId={imageProject.boards[0].id} pageId={imageProject.pages[0].id} selectedIds={[]} savePending={busy||exportDisabled||disabled} onClose={()=>setImageExport(false)} onNotify={onNotify}/>,document.body)}
    {discovery}
    <section className="library-section"><h3>Export library</h3><p className="library-field-note">Markdown, React, CSS and editable definitions.</p><div className="library-button-row"><button type="button" className="library-button" disabled={busy || exportDisabled} onClick={() => onExport()}><Download size={13}/>Download library</button>{definition && <button type="button" className="library-button" disabled={busy || exportDisabled} onClick={() => onExport(definition.id)}><Download size={13}/>Download .cxdp</button>}{definition && <button type="button" className="library-button" disabled={busy || exportDisabled || disabled} onClick={()=>setImageExport(true)}><Download size={13}/>Export image…</button>}</div></section>
    <section className="library-section library-editor-form">
      <h3>Create a component</h3>
      {selected && !instance ? <form onSubmit={event => {
        event.preventDefault(); const id = uid();
        void run([{ type: 'capture_component', pageId: page!.id, nodeId: selected.id, componentId: id, name: name.trim(), description: description.trim() }], () => { onSelect(id); onNotify('Component created. This object is its first linked instance.'); });
      }}>
        <p className="library-field-note">From canvas selection: {selected.name}. Includes its children.</p>
        <label>Component name<input value={name} maxLength={160} required readOnly={locked} onChange={event => setName(event.target.value)}/></label>
        <label>Description<textarea value={description} maxLength={5000} rows={2} readOnly={locked} placeholder="When and how to use this component" onChange={event => setDescription(event.target.value)}/></label>
        <button className="library-button library-primary" disabled={locked || !name.trim()}><Component size={13}/>Create from selection</button>
      </form> : <p className="library-field-note">{instance ? 'The selected object already belongs to a linked component.' : 'Select one object or container on the design canvas, then return here to define it as a component.'}</p>}
      <button type="button" className="library-button" disabled={busy} onClick={onReturn}><ArrowLeft size={13}/>Return to canvas</button>
    </section>
    {instance && <section className="library-section library-editor-form">
      <h3>Selected instance</h3>
      <p className="library-field-note">{project.designSystem.components.find(item => item.id === instance.componentInstance!.componentId)?.name ?? instance.name} · v{instance.componentInstance!.version}</p>
      <p className="library-field-note">Edit this instance on the canvas, then release it to share its changes. Local overrides stay local when updating.</p>
      <form onSubmit={event => { event.preventDefault(); void run([{ type: 'release_component', pageId: page!.id, nodeId: instance.id, label: label.trim() }], () => { setLabel(''); onSelect(instance.componentInstance!.componentId); onNotify('New component version released. Other instances keep their saved version.'); }); }}>
        <label>Release message<input value={label} maxLength={160} required readOnly={locked} placeholder="Describe what changed" onChange={event => setLabel(event.target.value)}/></label>
        <button className="library-button library-primary" disabled={locked || !label.trim()}><Check size={13}/>Release selected instance</button>
      </form>
      <div className="library-button-row">
        <button type="button" className="library-button" disabled={locked} onClick={() => void run([{ type: 'update_component_instance', pageId: page!.id, nodeId: instance.id }], () => onNotify('Instance updated. Local overrides retained.'))}><RefreshCw size={13}/>Update to current</button>
        <button type="button" className="library-button" disabled={locked} onClick={() => void run([{ type: 'detach_component_instance', pageId: page!.id, nodeId: instance.id }], () => onNotify('Instance detached. Its objects and comments remain.'))}><Unlink size={13}/>Detach</button>
      </div>
    </section>}
    {definition ? <>
      <section className="library-section library-editor-form">
        <h3>{definition.name}<span className="library-version-number">v{definition.version}</span></h3>
        <p className="library-field-note">{definition.description || 'Reusable throughout this project.'}</p>
        <p className="library-field-note">{definition.nodes.length} layers · {instances.length} linked {instances.length === 1 ? 'instance' : 'instances'}</p>
        <button type="button" className="library-button library-primary" disabled={locked || !page} onClick={() => {
          const id = uid();
          void run([{ type: 'instantiate_component', componentId: definition.id, pageId: page!.id, nodeId: id, x: position.x, y: position.y }], () => { onNotify('Linked instance added to the current page.'); onInserted(id); });
        }}><Plus size={13}/>Place on canvas</button>
        {selected && !instance && <form onSubmit={event => { event.preventDefault(); void run([{ type: 'release_component', componentId: definition.id, pageId: page!.id, nodeId: selected.id, label: label.trim() }], () => { setLabel(''); onNotify('Selection released as a new version of this component.'); }); }}>
          <p className="library-field-note">Replace this definition using the selected canvas subtree: {selected.name}. Existing instances remain on their saved version.</p>
          <label>Release message<input value={label} maxLength={160} required readOnly={locked} placeholder="Describe the structural change" onChange={event => setLabel(event.target.value)}/></label>
          <button className="library-button" disabled={locked || !label.trim()}><Check size={13}/>Release selection to this component</button>
        </form>}
      </section>
      <section className="library-section"><h3>Implementation notes</h3><ImplementationNotes key={`${project.id}/${definition.id}`} value={definition.nodes.find(node => node.id === definition.rootNodeId)?.notes} disabled={locked} onSave={notes => onChange([{ type: 'set_component_notes', componentId: definition.id, notes }]).then(Boolean)}/><p className="library-field-note">Saved with the component release. Existing instances keep their version; instance-specific notes remain local.</p></section>
      {instances.length > 0 && <section className="library-section"><h3>Instances</h3><ul className="library-instance-list">{instances.map(({ page: owner, node }) => <li key={node.id}><span title={`${owner.name} · ${node.name}`}><strong>{node.name}</strong><small>{owner.name} · v{node.componentInstance!.version}</small></span>{node.componentInstance!.version !== definition.version && <button type="button" className="library-button" disabled={locked} onClick={() => void run([{ type: 'update_component_instance', pageId: owner.id, nodeId: node.id }], () => onNotify('Instance updated. Local overrides retained.'))}>Update</button>}</li>)}</ul></section>}
      <LibraryVersions key={definition.id} project={project} scope="component" componentId={definition.id} disabled={locked} onChange={onChange} onApply={onApply} onNotify={onNotify}/>
    </> : <p className="library-note">{project.designSystem.components.length ? 'Choose a component on the library canvas to place it or review its versions.' : 'Find components from your app, or create one from an existing canvas object.'}</p>}
    {error && <p className="library-note library-action-error" role="alert">{error}</p>}
    {busy && <p className="library-note" role="status">Saving component…</p>}
  </div>;
}
