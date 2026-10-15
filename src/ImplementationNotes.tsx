import { useId } from 'react';
import { AutosaveTextarea } from './AutosaveFields';

const fieldClass = 'tw:box-border tw:block tw:min-h-[112px] tw:w-full tw:resize-y tw:rounded-[4px] tw:border tw:border-solid tw:border-[#494949] tw:bg-[#252525] tw:px-2 tw:py-1.5 tw:text-[12px] tw:leading-[1.5] tw:text-[#eee] tw:placeholder:text-[#999] tw:focus-visible:border-[#6ba6ff] tw:focus-visible:outline-none';
export default function ImplementationNotes({ value = '', disabled, onSave }: { value?: string; disabled: boolean; onSave: (notes: string) => Promise<boolean> }) {
  const hintId = useId();
  return <div className="tw:flex tw:min-w-0 tw:flex-col tw:gap-2" onKeyDown={event => event.stopPropagation()}>
    <p id={hintId} className="tw:m-0 tw:text-[11px] tw:leading-[1.5] tw:text-[#aaa]">Codex reads these during implementation. Describe behavior, materials or preferred libraries the canvas cannot show.</p>
    <AutosaveTextarea className={fieldClass} aria-label="Implementation notes" aria-describedby={hintId} value={value} onSave={onSave} maxLength={5000} rows={6} disabled={disabled} placeholder="Use native Liquid Glass buttons. Prefer the platform library over a custom approximation."/>
  </div>;
}
