import { useCallback, useEffect, useRef, useState } from 'react';
import { Check, Layers, LoaderCircle, RefreshCw, X } from 'lucide-react';
import type { DesignProject, ProjectVersion, ProjectVersionSummary } from '../shared/types';
import { client } from './client';
import './history.css';

export interface HistoryPanelProps {
  project: DesignProject;
  saving: boolean;
  onClose: () => void;
  onPreview: (snapshot: DesignProject, previous: DesignProject | null) => void;
  onApply: (revision: number) => Promise<boolean>;
}

const batchSize = 12;
const previewCacheSize = 8;
const message = (error: unknown, fallback: string) => error instanceof Error ? error.message : fallback;

function versionTime(value: string) {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return { label: 'Date unavailable', full: '' };
  return {
    label: `${date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })} · ${date.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit', second: '2-digit' })}`,
    full: date.toLocaleString(undefined, { dateStyle: 'full', timeStyle: 'long' }),
  };
}

export default function HistoryPanel({ project, saving, onClose, onPreview, onApply }: HistoryPanelProps) {
  const [versions, setVersions] = useState<ProjectVersionSummary[]>([]);
  const [selectedRevision, setSelectedRevision] = useState(project.revision);
  const [readyRevision, setReadyRevision] = useState<number | null>(project.revision);
  const [visibleCount, setVisibleCount] = useState(batchSize);
  const [listLoading, setListLoading] = useState(true);
  const [openingRevision, setOpeningRevision] = useState<number | null>(null);
  const [applying, setApplying] = useState(false);
  const [appliedRevision, setAppliedRevision] = useState<number | null>(null);
  const [listError, setListError] = useState('');
  const [previewError, setPreviewError] = useState('');
  const [applyError, setApplyError] = useState('');
  const [flash, setFlash] = useState<{ revision: number; key: number } | null>(null);
  const cache = useRef(new Map<number, Promise<ProjectVersion>>());
  const listEpoch = useRef(0), previewEpoch = useRef(0), flashKey = useRef(0);
  const mounted = useRef(true), applyingRef = useRef(false);
  const selectedRef = useRef(selectedRevision), liveRef = useRef(project), previewRef = useRef(onPreview);
  const flashTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  selectedRef.current = selectedRevision;
  previewRef.current = onPreview;

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      listEpoch.current++;
      previewEpoch.current++;
      if (flashTimer.current) clearTimeout(flashTimer.current);
    };
  }, []);

  const loadVersions = useCallback(async () => {
    const request = ++listEpoch.current;
    setListLoading(true);
    setListError('');
    try {
      const result = await client.listVersions(project.id);
      if (!mounted.current || request !== listEpoch.current) return;
      const next = [...result].sort((a, b) => b.revision - a.revision);
      setVersions(next);
      const selectedIndex = next.findIndex(version => version.revision === selectedRef.current);
      if (selectedIndex >= 0) setVisibleCount(count => Math.max(count, Math.ceil((selectedIndex + 1) / batchSize) * batchSize));
    } catch (error) {
      if (mounted.current && request === listEpoch.current) setListError(message(error, 'Could not load version history. Try again.'));
    } finally {
      if (mounted.current && request === listEpoch.current) setListLoading(false);
    }
  }, [project.id]);

  useEffect(() => {
    const previousLive = liveRef.current;
    liveRef.current = project;
    if (previousLive.id !== project.id) {
      cache.current = new Map();
      previewEpoch.current++;
      setVersions([]);
      setVisibleCount(batchSize);
      setSelectedRevision(project.revision);
      selectedRef.current = project.revision;
      setReadyRevision(project.revision);
      setOpeningRevision(null);
      setPreviewError('');
      setApplyError('');
      setAppliedRevision(null);
      setFlash(null);
      previewRef.current(project, null);
    } else if (previousLive.revision !== project.revision && selectedRef.current === previousLive.revision) {
      previewEpoch.current++;
      setSelectedRevision(project.revision);
      selectedRef.current = project.revision;
      setReadyRevision(project.revision);
      setOpeningRevision(null);
      setPreviewError('');
      previewRef.current(project, previousLive);
    }
    void loadVersions();
  }, [project.id, project.revision, loadVersions]);

  const getVersion = useCallback((revision: number) => {
    const entries = cache.current;
    const cached = entries.get(revision);
    if (cached) { entries.delete(revision); entries.set(revision, cached); return cached; }
    const request = client.getVersion(project.id, revision).then(version => {
      if (version.project.id !== project.id || version.version.revision !== revision) throw new Error('The server returned a different version. Refresh the history and try again.');
      return version;
    });
    entries.set(revision, request);
    // Keep nearby previews warm without retaining the entire project journal.
    if (entries.size > previewCacheSize) entries.delete(entries.keys().next().value!);
    void request.catch(() => { if (entries.get(revision) === request) entries.delete(revision); });
    return request;
  }, [project.id]);

  const selectVersion = async (revision: number) => {
    if (applyingRef.current) return;
    const request = ++previewEpoch.current;
    selectedRef.current = revision;
    setSelectedRevision(revision);
    setReadyRevision(null);
    setOpeningRevision(revision);
    setPreviewError('');
    setApplyError('');
    setAppliedRevision(null);
    if (flashTimer.current) clearTimeout(flashTimer.current);
    setFlash({ revision, key: ++flashKey.current });
    flashTimer.current = setTimeout(() => { if (mounted.current) setFlash(null); }, 650);
    const index = versions.findIndex(version => version.revision === revision);
    const previous = index >= 0 ? versions[index + 1] : undefined;
    const [snapshot, comparison] = await Promise.allSettled([getVersion(revision), previous ? getVersion(previous.revision) : Promise.resolve(null)]);
    if (!mounted.current || request !== previewEpoch.current) return;
    setOpeningRevision(null);
    if (snapshot.status === 'rejected') {
      setPreviewError(message(snapshot.reason, 'Could not open this version. Try again.'));
      return;
    }
    setReadyRevision(revision);
    previewRef.current(snapshot.value.project, comparison.status === 'fulfilled' ? comparison.value?.project ?? null : null);
    if (comparison.status === 'rejected') setPreviewError('Preview opened. The previous version could not be loaded for comparison.');
  };

  const applyVersion = async () => {
    if (applyingRef.current || saving || listLoading || openingRevision !== null || readyRevision !== selectedRevision || selectedRevision === project.revision || appliedRevision === selectedRevision) return;
    const applyingProjectId = project.id;
    applyingRef.current = true;
    setApplying(true);
    setApplyError('');
    try {
      const applied = await onApply(selectedRevision);
      if (!mounted.current || liveRef.current.id !== applyingProjectId) return;
      if (applied) setAppliedRevision(selectedRevision);
      else setApplyError('Could not apply this version. Try again.');
    } catch (error) {
      if (mounted.current && liveRef.current.id === applyingProjectId) setApplyError(message(error, 'Could not apply this version. Try again.'));
    } finally {
      applyingRef.current = false;
      if (mounted.current) setApplying(false);
    }
  };

  const problem = applyError || previewError || listError;
  const current = selectedRevision === project.revision;
  const pending = applying ? `Applying v${selectedRevision}…` : openingRevision !== null ? `Opening v${openingRevision}…` : listLoading ? versions.length ? 'Refreshing history…' : 'Loading history…' : '';
  const retry = !applyError && previewError ? () => { void selectVersion(selectedRevision); } : !applyError && listError ? () => { void loadVersions(); } : null;
  const canApply = !current && !saving && !listLoading && !applying && openingRevision === null && readyRevision === selectedRevision && appliedRevision !== selectedRevision;
  const boards = project.boards.length;

  return <aside className="history-panel" aria-label="Version history">
    <header className="history-header">
      <h2>Version history</h2>
      <button className="history-icon-button" aria-label="Refresh version history" title="Refresh version history" disabled={listLoading || applying} onClick={() => { void loadVersions(); }}><RefreshCw size={14}/></button>
      <button className="history-icon-button" aria-label="Close version history" title="Close version history" disabled={applying} onClick={onClose}><X size={15}/></button>
    </header>
    <div className="history-scope"><Layers size={13}/><span>All {boards} {boards === 1 ? 'board' : 'boards'}</span><small title={project.name}>{project.name}</small></div>
    {pending && <div className="history-status" role="status"><LoaderCircle size={13} className="history-spinner"/><span>{pending}</span></div>}
    {problem && <div className="history-status history-error" role="alert"><span>{problem}</span>{retry && <button onClick={retry} disabled={applying}>Retry</button>}</div>}
    {appliedRevision !== null && !problem && !pending && <div className="history-status" role="status"><Check size={13}/><span>Version applied.</span></div>}
    <div className="history-scroll">
      <ol className="history-list" aria-label="Project versions">
        {versions.slice(0, visibleCount).map(version => {
          const selected = version.revision === selectedRevision;
          const date = versionTime(version.createdAt);
          return <li key={version.revision}>
            <button className={`history-version${selected ? ' is-selected' : ''}${flash?.revision === version.revision ? ' is-flashing' : ''}`} aria-pressed={selected} aria-label={`Preview v${version.revision}: ${version.label || 'Saved version'}${version.revision === project.revision ? ', current version' : ''}. ${date.label}${version.restoredFrom !== undefined ? `. Restored from v${version.restoredFrom}` : ''}`} disabled={applying} onClick={() => { void selectVersion(version.revision); }}>
              <span className="history-version-top"><span className="history-revision">v{version.revision}</span><span className="history-version-label" title={version.label}>{version.label || 'Saved version'}</span>{version.revision === project.revision && <span className="history-current">Current</span>}</span>
              <span className="history-version-meta"><time dateTime={version.createdAt} title={date.full}>{date.label}</time>{version.restoredFrom !== undefined && <span>From v{version.restoredFrom}</span>}</span>
              {flash?.revision === version.revision && <span key={flash.key} className="history-selection-flash" aria-hidden="true"/>}
            </button>
          </li>;
        })}
      </ol>
      {!listLoading && !versions.length && !listError && <p className="history-empty">No saved versions are available yet.</p>}
      {visibleCount < versions.length && <button className="history-load-more" disabled={listLoading || applying} onClick={() => setVisibleCount(count => count + batchSize)}>Load more <small>{versions.length - visibleCount} remaining</small></button>}
    </div>
    <footer className="history-footer">
      <div className="history-preview-label">{current ? `Current version · v${selectedRevision}` : openingRevision !== null ? `Opening v${selectedRevision}…` : readyRevision === selectedRevision ? `Previewing v${selectedRevision}` : `Selected v${selectedRevision}`}{saving && <span>Saving…</span>}</div>
      <p>Applying replaces the current project across all boards. All saved versions remain available.</p>
      <button className="history-apply" disabled={!canApply} onClick={() => { void applyVersion(); }}>{applying && <LoaderCircle size={13} className="history-spinner"/>}{applying ? 'Applying…' : appliedRevision === selectedRevision ? 'Applied' : 'Apply version'}</button>
    </footer>
  </aside>;
}
