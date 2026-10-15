import { useLocalDraft } from './useLocalDraft';
import { useEffect, useRef, useState } from 'react';
import { Check, Download, History, LoaderCircle } from 'lucide-react';
import type { DesignProject, LibraryScope, LibraryVersion, Operation, ProjectVersionSummary } from '../shared/types';
import { client } from './client';
import ComponentPreview from './ComponentPreview';

interface LibraryVersionsProps {
  project: DesignProject;
  scope: LibraryScope;
  componentId?: string;
  disabled: boolean;
  onChange: (operations: Operation[]) => Promise<DesignProject | null>;
  onApply: (revision: number, scope: LibraryScope, componentId?: string) => Promise<DesignProject | null>;
  onNotify: (message: string) => void;
}

export default function LibraryVersions({ project, scope, componentId, disabled, onChange, onApply, onNotify }: LibraryVersionsProps) {
  const [versions, setVersions] = useState<ProjectVersionSummary[]>([]), [count, setCount] = useState(8);
  const [snapshot, setSnapshot] = useState<LibraryVersion | null>(null), [selected, setSelected] = useState<number | null>(null);
  const local = useLocalDraft(`${project.id}/${scope}/${componentId ?? ''}/release`, {label: ''});
  const label = local.value.label, setLabel = (label: string) => local.setValue({label}), [busy, setBusy] = useState(''), [error, setError] = useState(''), [loading, setLoading] = useState(true);
  const epoch = useRef(0), listEpoch = useRef(0), mounted = useRef(true), busyRef = useRef(false);
  const identity = `${project.id}/${scope}/${componentId ?? ''}`;
  const context = useRef({ identity, revision: project.revision }); context.current = { identity, revision: project.revision };
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; epoch.current++; listEpoch.current++; }; }, []);
  useEffect(() => {
    const request = ++listEpoch.current; epoch.current++; setLoading(true); setError(''); setSnapshot(null); setSelected(null);
    void client.listLibraryVersions(project.id, scope, componentId).then(result => {
      if (mounted.current && request === listEpoch.current) setVersions(result);
    }).catch(failure => { if (mounted.current && request === listEpoch.current) setError(failure instanceof Error ? failure.message : 'Versions could not be loaded.'); }).finally(() => { if (mounted.current && request === listEpoch.current) setLoading(false); });
  }, [identity, project.revision]);
  const choose = async (revision: number) => {
    if (busyRef.current) return;
    const request = ++epoch.current; setSelected(revision); setSnapshot(null); setError('');
    try {
      const next = await client.getLibraryVersion(project.id, revision, scope, componentId);
      if (mounted.current && request === epoch.current) setSnapshot(next);
    } catch (failure) { if (mounted.current && request === epoch.current) setError(failure instanceof Error ? failure.message : 'This version could not be opened.'); }
  };
  const save = async (apply: boolean) => {
    if (disabled || busyRef.current || apply && !snapshot) return;
    const owner = { ...context.current }, revision = snapshot?.version.revision;
    busyRef.current = true; setBusy(apply ? 'Applying version…' : 'Saving release…'); setError('');
    const current = () => mounted.current && context.current.identity === owner.identity;
    try {
      const next = apply ? await onApply(revision!, scope, componentId) : await onChange([{ type: 'release_design_system', label: label.trim() }]);
      if (!next) throw new Error('The version was not saved. Refresh and try again.');
      if (current()) { setLabel(''); onNotify(apply ? 'Version applied. Previous versions remain available; instances keep their saved versions.' : 'Design system release saved.'); }
    } catch (failure) { if (current()) setError(failure instanceof Error ? failure.message : 'Could not save this version.'); }
    finally { busyRef.current = false; if (mounted.current) setBusy(''); }
  };
  const oldTokens = snapshot?.designSystem.tokens ?? [], live = project.designSystem;
  const changes = snapshot ? scope === 'component' ? (() => {
    const before = snapshot.component, after = live.components.find(item => item.id === componentId);
    if (!before || !after) return ['Component availability differs'];
    const saved = new Map(before.nodes.map(node => [node.id, node])), current = new Map(after.nodes.map(node => [node.id, node]));
    const added = after.nodes.filter(node => !saved.has(node.id)).length, removed = before.nodes.filter(node => !current.has(node.id)).length;
    const changed = before.nodes.filter(node => current.has(node.id) && JSON.stringify(node) !== JSON.stringify(current.get(node.id))).length;
    return [`Compared with current: ${added} added, ${removed} removed, ${changed} changed layers`];
  })() : [
    `${oldTokens.filter(token => !live.tokens.some(item => item.id === token.id)).length} tokens would return`,
    `${live.tokens.filter(token => !oldTokens.some(item => item.id === token.id)).length} tokens would be removed`,
    `${oldTokens.filter(token => { const current = live.tokens.find(item => item.id === token.id); return current && JSON.stringify(current) !== JSON.stringify(token); }).length} token values or descriptions differ`,
    ...(snapshot.designSystem.documentation !== live.documentation ? ['Documentation differs'] : []),
    ...(JSON.stringify(snapshot.designSystem.components) !== JSON.stringify(live.components) ? ['Component definitions differ'] : []),
  ] : [];
  return <section className="library-section library-versions" aria-busy={!!busy}>
    <h3><span><History size={13}/>Versions</span><small>Project revisions</small></h3>
    {scope === 'system' && <form className="library-editor-form" onBlurCapture={local.onBlur} onCompositionStartCapture={local.onCompositionStart} onCompositionEndCapture={local.onCompositionEnd} onSubmit={event => { event.preventDefault(); void save(false); }}><label>Release message<input value={label} maxLength={160} required readOnly={disabled || !!busy} placeholder="e.g. Approved brand palette" onChange={event => setLabel(event.target.value)}/></label><button className="library-button" disabled={disabled || !!busy || !label.trim()}><Check size={13}/>Save named release</button></form>}
    <p className="library-field-note">Browse saved versions without changing the project. Apply restores only this {scope === 'system' ? 'design system' : 'component definition'}.</p>
    {loading ? <p className="library-field-note" role="status">Loading versions…</p> : <ul className="library-version-list">{versions.slice(0, count).map(version => <li key={version.revision}><button type="button" disabled={!!busy} aria-pressed={selected === version.revision} onClick={() => void choose(version.revision)}><strong>v{version.revision} · {version.label}</strong><time dateTime={version.createdAt}>{new Date(version.createdAt).toLocaleString()}</time></button></li>)}</ul>}
    {!loading && !versions.length && !error && <p className="library-field-note">No recorded versions are available for this component.</p>}
    {count < versions.length && <button type="button" className="library-button" disabled={!!busy} onClick={() => setCount(value => value + 8)}>Load more</button>}
    {selected !== null && !snapshot && !error && <p className="library-field-note" role="status">Opening v{selected}…</p>}
    {snapshot && <div className="library-version-preview">
      <h4>Preview v{snapshot.version.revision}</h4>
      {snapshot.component ? <ComponentPreview definition={snapshot.component} system={snapshot.designSystem}/> : <div className="library-version-colors">{oldTokens.filter(token => token.kind === 'color').slice(0, 24).map(token => <span key={token.id} title={`${token.name} · ${token.value}`} style={{ background: String(token.value) }}/>)}</div>}
      <ul>{changes.map(change => <li key={change}>{change}</li>)}</ul>
      <p className="library-field-note">{scope === 'system' ? 'Other canvas objects and conversations remain. Linked token values may change; removed tokens freeze to their current value.' : 'Existing instances keep their version until you update them. Canvas objects and conversations remain.'}</p>
      <details><summary>Snapshot source</summary><pre>{JSON.stringify(snapshot.component ?? snapshot.designSystem, null, 2).slice(0, 16000)}</pre><button type="button" className="library-button" disabled={!!busy} onClick={() => {
        const url = URL.createObjectURL(new Blob([JSON.stringify(snapshot.component ?? snapshot.designSystem, null, 2)], { type: 'application/json' }));
        const anchor = document.createElement('a'); anchor.href = url; anchor.download = `${scope}-v${snapshot.version.revision}.json`; anchor.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
      }}><Download size={13}/>Download full snapshot</button></details>
      <button type="button" className="library-button library-primary" disabled={disabled || !!busy || snapshot.version.revision === project.revision} onClick={() => void save(true)}><Check size={13}/>Apply v{snapshot.version.revision}</button>
    </div>}
    {busy && <p className="library-field-note" role="status"><LoaderCircle size={13} className="library-spinner"/>{busy}</p>}
    {error && <p className="library-field-note library-action-error" role="alert">{error}</p>}
  </section>;
}
