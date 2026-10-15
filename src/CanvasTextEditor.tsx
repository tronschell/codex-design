import { useEffect, useRef, type CSSProperties } from 'react';
import { createPortal } from 'react-dom';
import type { DesignNode } from '../shared/types';
import { useAutosaveDraft } from './useAutosaveDraft';
import { AutosaveStatus } from './AutosaveFields';

export default function CanvasTextEditor({ node, style, onSave, onFinish }: { node: DesignNode; style?: CSSProperties; onSave: (id: string, value: string) => unknown; onFinish: () => void }) {
  const element = useRef<HTMLDivElement>(null), initial = useRef(node.content ?? '');
  const draft = useAutosaveDraft(node.id, { content: node.content ?? '' }, () => ({ content: '' }), { onSave: value => onSave(node.id, value.content) });
  useEffect(() => {
    const target = element.current;
    if (!target) return;
    target.focus();
    const range = document.createRange(); range.selectNodeContents(target);
    const selection = window.getSelection(); selection?.removeAllRanges(); selection?.addRange(range);
  }, []);
  return <>
    <div ref={element} className="design-node design-node-text is-interactive is-editing" data-node-id={node.id} data-node-type="text" style={style} aria-label={node.name} aria-busy={draft.busy || undefined} aria-invalid={!!draft.error || draft.conflicts.length > 0 || undefined} contentEditable suppressContentEditableWarning
      onPointerDown={event => event.stopPropagation()}
      onInput={event => draft.setValue({ content: event.currentTarget.innerText })}
      onCompositionStart={draft.onCompositionStart} onCompositionEnd={draft.onCompositionEnd}
      onBlur={async () => { draft.onCompositionEnd(); if (await draft.flush()) onFinish(); }}
      onKeyDown={event => {
        event.stopPropagation();
        if (event.nativeEvent.isComposing || event.nativeEvent.keyCode === 229) return;
        if (event.key === 'Escape') { event.preventDefault(); draft.reset(); onFinish(); }
        if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) { event.preventDefault(); event.currentTarget.blur(); }
      }}>{initial.current}</div>
    {(draft.error || draft.conflicts.length > 0) && createPortal(<div className="tw:fixed tw:bottom-4 tw:left-4 tw:z-[200] tw:max-w-sm tw:rounded-md tw:border tw:border-solid tw:border-[#494949] tw:bg-[#252525] tw:p-3"><AutosaveStatus state={draft}/></div>, document.body)}
  </>;
}
