import { useId, useLayoutEffect, useRef, useState, type CSSProperties, type InputHTMLAttributes, type RefObject, type TextareaHTMLAttributes } from 'react';
import { createPortal } from 'react-dom';
import { useAutosaveDraft } from './useAutosaveDraft';

type Autosave = { busy: boolean; dirty: boolean; error: string; conflicts: string[]; flush: () => Promise<boolean>; reset: () => void; keepDraft: () => Promise<boolean> };
export function AutosaveStatus({ state, compact = false, anchor }: { state: Autosave; compact?: boolean; anchor?: RefObject<HTMLElement | null> }) {
  const [position, setPosition] = useState<CSSProperties>({visibility: 'hidden'});
  const hasError = !!state.error || state.conflicts.length > 0;
  useLayoutEffect(() => {
    if (!compact || !hasError || !anchor?.current) return;
    const place = () => {
      const rect = anchor.current!.getBoundingClientRect(), width = Math.min(288, window.innerWidth - 16);
      setPosition({position: 'fixed', width, left: Math.max(8, Math.min(rect.left, window.innerWidth - width - 8)), top: Math.max(8, Math.min(rect.bottom + 6, window.innerHeight - 160)), visibility: 'visible'});
    };
    place(); window.addEventListener('resize', place); window.addEventListener('scroll', place, true);
    return () => { window.removeEventListener('resize', place); window.removeEventListener('scroll', place, true); };
  }, [compact, hasError, anchor]);
  const feedback = hasError && <div data-autosave-feedback onPointerDown={event => event.stopPropagation()} onKeyDown={event => event.stopPropagation()} style={compact ? position : undefined} className={'tw:flex tw:flex-wrap tw:items-center tw:gap-2 tw:text-[11px] tw:leading-normal tw:text-[#f0a09c]' + (compact ? ' tw:z-[200] tw:rounded-md tw:border tw:border-solid tw:border-[#494949] tw:bg-[#252525] tw:p-3 tw:shadow-[0_6px_20px_#0006]' : '')}>
    <span role="alert">{state.error || 'This field changed elsewhere. Your draft is kept.'}</span>
    {state.conflicts.length ? <><button type="button" className="secondary-button" disabled={state.busy} onClick={() => { anchor?.current?.focus(); void state.keepDraft(); }}>Keep my edits</button><button type="button" className="secondary-button" disabled={state.busy} onClick={() => { state.reset(); anchor?.current?.focus(); }}>Use saved value</button></> : <button type="button" className="secondary-button" disabled={state.busy} onClick={() => { anchor?.current?.focus(); void state.flush(); }}>Retry saving</button>}
  </div>;
  return <><span className={compact ? 'tw:sr-only' : 'tw:text-[11px] tw:leading-normal tw:text-[#aaa]'} role="status">{state.busy ? 'Saving…' : state.error ? 'Not saved' : state.conflicts.length ? 'Changed elsewhere. Review your draft.' : state.dirty ? 'Saves after typing' : 'Saved automatically'}</span>{compact && feedback ? createPortal(feedback, document.body) : feedback}</>;
}

type SaveProps = { value: string; onSave: (value: string) => unknown | Promise<unknown>; normalize?: (value: string) => string; showStatus?: boolean };
export function AutosaveInput({ value, onSave, normalize, showStatus = false, onKeyDown, ...props }: Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange'> & SaveProps) {
  const identity = useId(), input = useRef<HTMLInputElement>(null);
  const draft = useAutosaveDraft(identity, { value }, () => ({ value: '' }), {
    enabled: !props.readOnly, onSave: next => onSave(next.value), normalize: next => {
      let text = normalize?.(next.value) ?? next.value;
      if (props.required && !text.trim()) throw new Error('This field is required.');
      if (props.type === 'number') {
        if (!text.trim() || !Number.isFinite(Number(text))) throw new Error('Enter a valid number.');
        text = String(Math.max(Number(props.min ?? -Infinity), Math.min(Number(props.max ?? Infinity), Number(text))));
      }
      return { value: text };
    },
  });
  return <><input {...props} ref={input} value={draft.value.value} disabled={props.disabled && !draft.busy} aria-invalid={!!draft.error || draft.conflicts.length > 0 || undefined} aria-busy={draft.busy || undefined} onChange={event => draft.setValue({ value: event.target.value })} onBlur={draft.onBlur} onCompositionStart={draft.onCompositionStart} onCompositionEnd={draft.onCompositionEnd} onKeyDown={event => {
    if (!event.nativeEvent.isComposing && event.nativeEvent.keyCode !== 229) {
      if (event.key === 'Escape') { event.preventDefault(); draft.reset(); }
      if (event.key === 'Enter') { event.preventDefault(); void draft.flush(); }
    }
    onKeyDown?.(event);
  }}/><AutosaveStatus state={draft} compact={!showStatus} anchor={input}/></>;
}
export function AutosaveTextarea({ value, onSave, normalize, showStatus = true, ...props }: Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, 'value' | 'onChange'> & SaveProps) {
  const identity = useId();
  const draft = useAutosaveDraft(identity, { value }, () => ({ value: '' }), { enabled: !props.readOnly, onSave: next => onSave(next.value), normalize: next => ({ value: normalize?.(next.value) ?? next.value }) });
  return <><textarea {...props} value={draft.value.value} readOnly={props.readOnly} disabled={props.disabled && !draft.busy} aria-invalid={!!draft.error || draft.conflicts.length > 0 || undefined} aria-busy={draft.busy || undefined} onChange={event => draft.setValue({ value: event.target.value })} onBlur={draft.onBlur} onCompositionStart={draft.onCompositionStart} onCompositionEnd={draft.onCompositionEnd}/><AutosaveStatus state={draft} compact={!showStatus}/></>;
}
