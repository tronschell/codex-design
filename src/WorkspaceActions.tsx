import { useEffect, useRef, useState } from 'react';
import { Pencil, Trash2 } from 'lucide-react';
import type { Operation } from '../shared/types';

export default function WorkspaceActions({ name, revision, boardId, lastBoard, disabled, onAction }: {
  name: string; revision: number; boardId?: string; lastBoard?: boolean; disabled?: boolean;
  onAction: (operations: Operation[] | 'delete', revision: number) => Promise<void>;
}) {
  const [editing, setEditing] = useState<{ action: 'rename' | 'delete'; revision: number; name: string } | null>(null);
  const [value, setValue] = useState(''), [busy, setBusy] = useState(false), [error, setError] = useState('');
  const actions = useRef<HTMLDivElement>(null), returnFocus = useRef(false);
  useEffect(() => {
    if (!editing && returnFocus.current) { actions.current?.querySelector<HTMLButtonElement>('button:not([disabled])')?.focus(); returnFocus.current = false; }
  }, [editing]);
  const kind = boardId ? 'board' : 'project';
  const start = (action: 'rename' | 'delete') => { returnFocus.current = true; setEditing({ action, revision, name }); setValue(action === 'rename' ? name : ''); setError(''); };
  const submit = async () => {
    if (!editing || busy || disabled || (editing.action === 'delete' && value !== editing.name) || !value.trim()) return;
    setBusy(true); setError('');
    try {
      const operations: Operation[] | 'delete' = editing.action === 'rename'
        ? [boardId ? { type: 'update_board', boardId, patch: { name: value.trim() }, userConfirmed: true } : { type: 'rename_project', name: value.trim(), userConfirmed: true }]
        : boardId ? [{ type: 'delete_board', boardId, userConfirmed: true }] : 'delete';
      await onAction(operations, editing.revision); setEditing(null);
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Could not update this item. Your input is kept.'); }
    finally { setBusy(false); }
  };
  return <div ref={actions} className="tw:border-t tw:border-[#414141] tw:p-3">
    {!editing ? <div className="tw:flex tw:justify-end tw:gap-2">
      <button type="button" className="secondary-button tw:inline-flex tw:items-center tw:gap-1" aria-label={`Rename ${kind} ${name}`} disabled={disabled} onClick={() => start('rename')}><Pencil size={12}/>Rename</button>
      <button type="button" className="secondary-button tw:inline-flex tw:items-center tw:gap-1" aria-label={`Delete ${kind} ${name}`} title={lastBoard ? 'Keep at least one board, or delete the project.' : undefined} disabled={disabled || lastBoard} onClick={() => start('delete')}><Trash2 size={12}/>Delete</button>
    </div> : <form onSubmit={event => { event.preventDefault(); void submit(); }} className="tw:flex tw:flex-col tw:gap-2">
      <label className="tw:text-xs tw:leading-5">{editing.action === 'rename' ? `Rename ${kind}` : `Delete ${kind} “${editing.name}”?`}
        <input autoFocus aria-label={editing.action === 'rename' ? `New ${kind} name` : `Type ${kind} name to confirm deletion`} disabled={busy || disabled} required maxLength={160} value={value} onChange={event => setValue(event.target.value)} className="tw:mt-1 tw:block tw:h-9 tw:w-full tw:rounded tw:border tw:border-[#555] tw:bg-[#1e1e1e] tw:px-2 tw:text-[13px]"/>
      </label>
      {editing.action === 'delete' && <p className="tw:m-0! tw:text-xs tw:leading-5 tw:text-[#bbb]">{boardId ? 'Removes this board, its pages and comments. Earlier versions remain in project history.' : 'Removes every board and page from this workspace. A recovery copy stays on this computer.'} Type the exact name to confirm.</p>}
      {error && <p role="alert" className="tw:m-0! tw:text-xs tw:leading-5 tw:text-[#ffb4ad]">{error}</p>}
      <div className="tw:flex tw:justify-end tw:gap-2"><button type="button" className="secondary-button" disabled={busy} onClick={() => setEditing(null)}>Cancel</button><button type="submit" className="primary-button" disabled={busy || disabled || !value.trim() || (editing.action === 'delete' && value !== editing.name)}>{busy ? 'Working…' : editing.action === 'rename' ? 'Rename' : `Delete ${kind}`}</button></div>
    </form>}
  </div>;
}
