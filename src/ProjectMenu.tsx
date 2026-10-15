import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Check, ChevronDown, ChevronRight, LayoutTemplate, LoaderCircle, Plus, Search, Upload } from 'lucide-react';
import type { DesignProject, ProjectSummary } from '../shared/types';
import { useLocalDraft } from './useLocalDraft';

const batchSize = 6;

type Props = {
  project: DesignProject | null;
  projects: ProjectSummary[];
  boardId?: string;
  open: boolean;
  readOnly?: boolean;
  onToggle: () => void;
  onSelectProject: (id: string) => void;
  onSelectBoard: (id: string) => void;
  onCreateProject: (name: string, template: 'blank' | 'demo') => Promise<boolean>;
  onCreateBoard: (name: string) => Promise<boolean>;
  onImport: () => void;
};

export default function ProjectMenu({ project, projects, boardId, open, readOnly, onToggle, onSelectProject, onSelectBoard, onCreateProject, onCreateBoard, onImport }: Props) {
  const [view, setView] = useState<'boards' | 'projects'>('boards');
  const [search, setSearch] = useState('');
  const local = useLocalDraft(view === 'boards' && project ? `${project.id}/new-board` : 'new-project', {name: ''});
  const name = local.value.name, setName = (name: string) => local.setValue({name});
  const [visibleCount, setVisibleCount] = useState(batchSize), [busy, setBusy] = useState(false);
  const board = project?.boards.find(item => item.id === boardId);
  const showingBoards = view === 'boards' && !!project;
  const boards = useMemo(() => (project?.boards || [])
    .filter(item => item.name.toLocaleLowerCase().includes(search.toLocaleLowerCase()))
    .sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt) || a.id.localeCompare(b.id)), [project?.boards, search]);
  const matchingProjects = projects.filter(item => item.name.toLocaleLowerCase().includes(search.toLocaleLowerCase()));

  useEffect(() => {
    if (open) { setView(project ? 'boards' : 'projects'); setSearch(''); setVisibleCount(batchSize); }
  }, [open, project?.id]);
  useEffect(() => { setVisibleCount(batchSize); }, [search]);

  const switchView = (next: 'boards' | 'projects') => { setView(next); setSearch(''); setVisibleCount(batchSize); };
  const create = async (template: 'blank' | 'demo' = 'blank') => {
    if (busy) return;
    setBusy(true);
    try {
      const created = showingBoards ? await onCreateBoard(name) : await onCreateProject(name, template);
      if (created) setName('');
    } finally { setBusy(false); }
  };

  return <div className="project-switch">
    <button className={`project-trigger ${open ? 'open' : ''}`} onClick={onToggle} aria-label={board ? `${project?.name} / ${board.name} · Switch board or project` : 'Switch project'} aria-expanded={open}>
      <span className="project-title">{project?.name || 'Codex Design'}</span>
      {board && <><ChevronRight className="project-path-separator" size={12}/><span className="board-title">{board.name}</span></>}
      <ChevronDown size={14}/>
    </button>
    {open && <div className="dropdown project-menu">
      <div className="board-menu-context">
        {showingBoards ? <><span title={project.name}>{project.name}</span><button type="button" disabled={readOnly} onClick={() => switchView('projects')}><LayoutTemplate size={13}/>Projects<ChevronRight size={12}/></button></> : <>{project && <button type="button" onClick={() => switchView('boards')} aria-label="Back to boards"><ArrowLeft size={13}/>Boards</button>}<span>Projects</span><LayoutTemplate size={14}/></>}
      </div>
      <label className="menu-search" key={showingBoards ? 'boards' : 'projects'}><Search size={14}/><input autoFocus aria-label={showingBoards ? 'Search boards' : 'Search projects'} placeholder={showingBoards ? 'Find a board…' : 'Find a project…'} value={search} onChange={event => setSearch(event.target.value)}/></label>
      {showingBoards && <div className="board-list-heading"><span>{search ? 'Boards' : 'Recent boards'}</span><small>Last edited</small></div>}
      <div className="project-list" aria-label={showingBoards ? `Boards in ${project.name}` : 'Projects'}>
        {showingBoards ? boards.slice(0, visibleCount).map(item => {
          const pages = project.pages.filter(page => page.boardId === item.id);
          const frames = pages.reduce((count, page) => count + page.nodes.filter(node => node.type === 'frame' && !node.parentId).length, 0);
          return <button className={`dropdown-item ${item.id === boardId ? 'current' : ''}`} key={item.id} onClick={() => onSelectBoard(item.id)}>
            <div><strong>{item.name}</strong><small>{pages.length} {pages.length === 1 ? 'page' : 'pages'} · {frames} {frames === 1 ? 'frame' : 'frames'}</small></div>
            <time className="board-edited" dateTime={item.updatedAt} title={new Date(item.updatedAt).toLocaleString()}>{new Date(item.updatedAt).toLocaleDateString([], { month: 'short', day: 'numeric' })}</time>
            {item.id === boardId && <Check size={15}/>}
          </button>;
        }) : matchingProjects.map(item => <button className={`dropdown-item ${item.id === project?.id ? 'current' : ''}`} key={item.id} onClick={() => onSelectProject(item.id)}>
          <div><strong>{item.name}</strong><small>{item.boardCount ?? 1} {(item.boardCount ?? 1) === 1 ? 'board' : 'boards'} · {item.screenCount} {item.screenCount === 1 ? 'frame' : 'frames'}</small></div>{item.id === project?.id && <Check size={15}/>}
        </button>)}
        {(showingBoards ? boards : matchingProjects).length === 0 && <p className="menu-empty">No {showingBoards ? 'boards' : 'projects'} found.</p>}
      </div>
      {showingBoards && visibleCount < boards.length && <button className="dropdown-item load-more-boards" onClick={() => setVisibleCount(count => count + batchSize)}><ChevronDown size={14}/><span>Load more</span><small>{visibleCount} of {boards.length}</small></button>}
      <div className="menu-divider"/>
      {!readOnly && <form className="new-project-form" onBlurCapture={local.onBlur} onCompositionStartCapture={local.onCompositionStart} onCompositionEndCapture={local.onCompositionEnd} onSubmit={event => { event.preventDefault(); void create(); }}>
        <input aria-label={showingBoards ? 'New board name' : 'New project name'} placeholder={showingBoards ? 'New board name' : 'New project name'} value={name} maxLength={160} onChange={event => setName(event.target.value)}/>
        <button className="primary-button" disabled={busy} type="submit">{busy ? <LoaderCircle size={14} className="spin"/> : <Plus size={14}/>} {busy ? 'Creating…' : showingBoards ? 'New board' : 'New project'}</button>
      </form>}
      {!showingBoards && !readOnly && <><button className="dropdown-item subdued" disabled={busy} onClick={() => { void create('demo'); }}><LayoutTemplate size={15}/>Start with the GaugeReel example</button><button className="dropdown-item subdued" onClick={onImport}><Upload size={15}/>Import a project…</button></>}
    </div>}
  </div>;
}
