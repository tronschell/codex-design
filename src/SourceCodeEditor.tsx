import { useId, useLayoutEffect, useRef, useState } from 'react';
import { basicSetup } from 'codemirror';
import { Compartment, EditorState, Transaction } from '@codemirror/state';
import { EditorView, keymap } from '@codemirror/view';
import { indentWithTab } from '@codemirror/commands';
import { indentUnit } from '@codemirror/language';
import { javascript } from '@codemirror/lang-javascript';
import { css } from '@codemirror/lang-css';
import { json } from '@codemirror/lang-json';
import { oneDark } from '@codemirror/theme-one-dark';
import { useAutosaveDraft } from './useAutosaveDraft';
import { AutosaveStatus } from './AutosaveFields';

export default function SourceCodeEditor({ file, value, readOnly, onSave }: { file: string; value: string; readOnly: boolean; onSave: (source: string) => unknown }) {
  const identity = useId(), host = useRef<HTMLDivElement>(null), view = useRef<EditorView | null>(null);
  const [editable] = useState(() => new Compartment());
  const draft = useAutosaveDraft(identity, { value }, () => ({ value: '' }), {
    enabled: !readOnly, onSave: next => onSave(next.value), normalize: next => {
      if (next.value.length > 500000) throw new Error('Source must be under 500,000 characters. Shorten this draft to save it.');
      return next;
    },
  });
  const current = useRef(draft); current.current = draft;
  useLayoutEffect(() => {
    const language = file.endsWith('.css') ? css() : file.endsWith('.json') ? json() : javascript({ jsx: /\.[jt]sx$/.test(file), typescript: /\.tsx?$/.test(file) });
    const editor = new EditorView({
      parent: host.current!, doc: current.current.value.value,
      extensions: [basicSetup, oneDark, language, EditorView.lineWrapping, indentUnit.of('  '), EditorState.tabSize.of(2), keymap.of([indentWithTab]),
        editable.of(EditorState.readOnly.of(readOnly)),
        EditorView.contentAttributes.of({ 'aria-label': 'React module source', 'aria-describedby': `${identity}-help`, spellcheck: 'false' }),
        EditorView.updateListener.of(update => {
          if (update.docChanged && !update.transactions.some(transaction => transaction.annotation(Transaction.remote))) current.current.setValue({ value: update.state.doc.toString() });
        }),
      ],
    });
    view.current = editor;
    return () => { editor.destroy(); view.current = null; };
  }, [file, identity, editable]);
  useLayoutEffect(() => {
    const editor = view.current;
    if (!editor) return;
    if (editor.state.doc.toString() !== draft.value.value) editor.dispatch({
      changes: { from: 0, to: editor.state.doc.length, insert: draft.value.value },
      annotations: [Transaction.remote.of(true), Transaction.addToHistory.of(false)],
    });
  }, [draft.value.value]);
  useLayoutEffect(() => {
    view.current?.dispatch({ effects: editable.reconfigure(EditorState.readOnly.of(readOnly)) });
  }, [readOnly, editable]);
  return <>
    <div className="tw:overflow-hidden tw:rounded-md tw:border tw:border-[#3b3b3b] tw:bg-[#1b1b1b] tw:focus-within:border-[#7db8ff]">
      <div ref={host} onBlur={draft.onBlur} onCompositionStart={draft.onCompositionStart} onCompositionEnd={draft.onCompositionEnd}
        className="tw:[&_.cm-editor]:h-[clamp(18rem,52vh,44rem)] tw:[&_.cm-editor]:bg-[#1b1b1b]! tw:[&_.cm-editor]:text-[#ddd]! tw:[&_.cm-focused]:outline-none! tw:[&_.cm-scroller]:overflow-auto tw:[&_.cm-scroller]:font-mono! tw:[&_.cm-scroller]:text-[13px]! tw:[&_.cm-scroller]:leading-[1.7]! tw:[&_.cm-content]:py-3! tw:[&_.cm-line]:px-3! tw:[&_.cm-gutters]:border-r! tw:[&_.cm-gutters]:border-[#303030]! tw:[&_.cm-gutters]:bg-[#1b1b1b]! tw:[&_.cm-gutters]:text-[#929292]! tw:[&_.cm-activeLineGutter]:bg-[#2b2b2b]! tw:[&_.cm-activeLine]:bg-white/[.035]! tw:[&_.cm-selectionBackground]:bg-[#365477]! tw:[&_.cm-cursor]:border-l-[#b5d5ff]!"/>
      <div className="tw:flex tw:flex-wrap tw:items-center tw:justify-between tw:gap-2 tw:border-t tw:border-white/10 tw:bg-[#242424] tw:px-3 tw:py-2 tw:text-[11px] tw:text-[#aaa]">
        <span>{file.split('.').pop()?.toUpperCase()} · 2 spaces{readOnly ? ' · Read only' : ''}</span>
        <AutosaveStatus state={draft}/>
      </div>
    </div>
    <p id={`${identity}-help`} className="tw:m-0! tw:text-[11px] tw:leading-relaxed tw:text-[#aaa]">Tab to indent · Escape, then Tab to leave the editor</p>
  </>;
}
