import { useState } from 'react';
import type { DesignNode, DesignSystem, Operation } from '../shared/types';
import { useAutosaveState } from './useAutosaveDraft';
import SourceCodeEditor from './SourceCodeEditor';

export default function ReactSourceEditor({ node, system, onChange, readOnly = false }: { node: DesignNode; system: DesignSystem; readOnly?: boolean; onChange: (operations: Operation[]) => unknown }) {
  const [chosen, setChosen] = useState(node.react!.entry);
  const saveState = useAutosaveState();
  const app = system.react;
  if (!app) return <p role="alert">React application source is unavailable.</p>;
  const file = Object.hasOwn(app.files, chosen) ? chosen : node.react!.entry;
  return <div className="tw:flex tw:min-h-0 tw:min-w-0 tw:flex-col tw:gap-3 tw:p-4">
    <label className="tw:flex tw:min-w-0 tw:flex-col tw:gap-2 tw:text-xs tw:font-medium">Application source
      <select disabled={saveState !== 'saved'} aria-label="React source file" value={file} onChange={event => setChosen(event.target.value)} className="tw:w-full tw:min-w-0 tw:rounded-md tw:border tw:border-[#3b3b3b] tw:bg-[#292929] tw:px-3 tw:py-2 tw:font-mono tw:text-xs tw:font-normal tw:text-[#ddd] tw:focus-visible:outline tw:focus-visible:outline-[#7db8ff] tw:disabled:opacity-50">
        {Object.keys(app.files).map(path => <option key={path} value={path}>{path}</option>)}
      </select>
    </label>
    <SourceCodeEditor key={file} file={file} readOnly={readOnly} value={app.files[file] ?? ''} onSave={source => onChange([{ type: 'update_react_files', files: { [file]: source } }])}/>
    <p className="tw:m-0! tw:text-xs tw:leading-relaxed tw:text-[#aaa]">Changes update every screen that uses this source.</p>
    <details className="tw:border-t tw:border-white/10 tw:pt-3 tw:text-xs tw:text-[#aaa]"><summary className="tw:cursor-pointer tw:rounded tw:focus-visible:outline tw:focus-visible:outline-[#7db8ff]">Dependencies</summary><pre className="tw:mt-3 tw:overflow-auto tw:font-mono tw:text-[11px] tw:leading-loose">{Object.entries(app.dependencies).map(([name, version]) => `${name} ${version}`).join('\n')}</pre></details>
  </div>;
}
