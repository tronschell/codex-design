import { useEffect, useId, useLayoutEffect, useRef, useState, type CSSProperties, type KeyboardEvent, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Check, ChevronDown } from 'lucide-react';
import './select.css';

export type SelectOption = { value: string; label: string; color?: string; disabled?: boolean };
type Props = {
  options: SelectOption[];
  value: string;
  onChange: (value: string) => void;
  label: string;
  disabled?: boolean;
  className?: string;
  placeholder?: string;
  triggerContent?: ReactNode;
};

function Swatch({ color }: { color?: string }) {
  return color ? <span className="select-swatch" aria-hidden="true"><span style={{ backgroundColor: color }}/></span> : null;
}

export function Select({ options, value, onChange, label, disabled, className = '', placeholder = 'Choose…', triggerContent }: Props) {
  const id = useId();
  const trigger = useRef<HTMLButtonElement>(null), popup = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false), [active, setActive] = useState(-1);
  const [position, setPosition] = useState<CSSProperties>({ visibility: 'hidden' });
  const search = useRef({ text: '', time: 0 });
  const selected = options.find(option => option.value === value);
  const available = options.map((option, index) => option.disabled ? -1 : index).filter(index => index !== -1);

  const close = (restoreFocus = false) => {
    setOpen(false); search.current.text = '';
    if (restoreFocus) trigger.current?.focus({ preventScroll: true });
  };
  const show = (last = false) => {
    if (disabled || !available.length) return;
    const selectedIndex = options.findIndex(option => option.value === value && !option.disabled);
    setActive(selectedIndex >= 0 ? selectedIndex : available[last ? available.length - 1 : 0]);
    setPosition({ visibility: 'hidden' }); setOpen(true);
  };
  const choose = (index: number) => {
    const option = options[index];
    if (!option || option.disabled) return;
    close(true);
    if (option.value !== value) onChange(option.value);
  };

  useEffect(() => { if (disabled) setOpen(false); }, [disabled]);
  useLayoutEffect(() => {
    if (!open) return;
    if (!available.length) { setOpen(false); return; }
    if (!options[active] || options[active].disabled) setActive(available[0]);
  }, [open, options, active]);
  useLayoutEffect(() => {
    if (!open || !available.length || !popup.current) return;
    const menu = popup.current, previousWidth = menu.style.width, previousMaxWidth = menu.style.maxWidth;
    // Measure the natural border box, never feed the constrained scrollWidth back into placement.
    menu.style.width = 'max-content'; menu.style.maxWidth = 'none';
    const naturalWidth = menu.getBoundingClientRect().width;
    menu.style.width = previousWidth; menu.style.maxWidth = previousMaxWidth;
    const place = () => {
      const button = trigger.current, menu = popup.current;
      if (!button || !menu) return;
      const rect = button.getBoundingClientRect(), inset = 8, gap = 4;
      const viewport = window.visualViewport;
      const left = viewport?.offsetLeft ?? 0, top = viewport?.offsetTop ?? 0;
      const viewportWidth = viewport?.width ?? window.innerWidth, viewportHeight = viewport?.height ?? window.innerHeight;
      const bottom = top + viewportHeight;
      if (rect.bottom < top || rect.top > bottom || rect.right < left || rect.left > left + viewportWidth) { setOpen(false); return; }
      const width = Math.min(Math.max(rect.width, Math.min(naturalWidth, 320)), Math.max(0, viewportWidth - inset * 2));
      const below = Math.max(0, bottom - rect.bottom - gap - inset), above = Math.max(0, rect.top - top - gap - inset);
      const desired = Math.min(288, menu.scrollHeight + 2);
      const upwards = below < desired && above > below;
      const maxHeight = Math.min(288, upwards ? above : below), height = Math.min(desired, maxHeight);
      setPosition({ position: 'fixed', left: Math.max(left + inset, Math.min(rect.left, left + viewportWidth - width - inset)), top: upwards ? rect.top - height - gap : rect.bottom + gap, width, maxHeight, visibility: 'visible' });
    };
    place();
    const outside = (event: PointerEvent) => {
      if (!trigger.current?.contains(event.target as Node) && !popup.current?.contains(event.target as Node)) close();
    };
    const scroll = (event: Event) => { if (!popup.current?.contains(event.target as Node)) place(); };
    const observer = new ResizeObserver(place);
    if (trigger.current) observer.observe(trigger.current);
    window.addEventListener('resize', place);
    window.addEventListener('scroll', scroll, true);
    window.addEventListener('pointerdown', outside, true);
    window.visualViewport?.addEventListener('resize', place);
    window.visualViewport?.addEventListener('scroll', place);
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', place);
      window.removeEventListener('scroll', scroll, true);
      window.removeEventListener('pointerdown', outside, true);
      window.visualViewport?.removeEventListener('resize', place);
      window.visualViewport?.removeEventListener('scroll', place);
    };
  }, [open, options]);
  useLayoutEffect(() => {
    const menu = popup.current, row = menu?.querySelector<HTMLElement>(`[data-option-index="${active}"]`);
    if (!open || !menu || !row) return;
    if (row.offsetTop < menu.scrollTop) menu.scrollTop = row.offsetTop;
    else if (row.offsetTop + row.offsetHeight > menu.scrollTop + menu.clientHeight) menu.scrollTop = row.offsetTop + row.offsetHeight - menu.clientHeight;
  }, [open, active, position.maxHeight]);

  const keyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (event.key === 'Tab') { close(); return; }
    if (event.key === 'Escape') { if (open) { event.preventDefault(); event.stopPropagation(); close(true); } return; }
    event.stopPropagation();
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault(); search.current.text = '';
      if (!open) { show(event.key === 'ArrowUp'); return; }
      if (event.altKey && event.key === 'ArrowUp') { close(true); return; }
      const step = event.key === 'ArrowDown' ? 1 : -1, current = available.indexOf(active);
      setActive(available[(current + step + available.length) % available.length] ?? -1); return;
    }
    if (event.key === 'Home' || event.key === 'End') {
      event.preventDefault(); search.current.text = '';
      if (!open) show();
      setActive(available[event.key === 'Home' ? 0 : available.length - 1] ?? -1); return;
    }
    if (event.key === 'Enter' || (event.key === ' ' && (!search.current.text || Date.now() - search.current.time > 700))) {
      event.preventDefault();
      if (open) choose(active); else show();
      return;
    }
    if (event.key.length !== 1 || event.ctrlKey || event.metaKey || event.altKey) return;
    event.preventDefault();
    const time = Date.now(), text = (time - search.current.time > 700 ? '' : search.current.text) + event.key.toLocaleLowerCase();
    search.current = { text, time };
    const prefix = [...text].every(character => character === text[0]) ? text[0] : text;
    const start = open ? active : options.findIndex(option => option.value === value);
    const ordered = [...available.filter(index => index > start), ...available.filter(index => index <= start)];
    const match = ordered.find(index => options[index].label.toLocaleLowerCase().startsWith(prefix));
    if (!open) show();
    if (match !== undefined) setActive(match);
  };

  return <>
    <button ref={trigger} type="button" role="combobox" aria-label={label} aria-haspopup="listbox" aria-expanded={open} aria-controls={open ? id : undefined} aria-activedescendant={open && active >= 0 ? `${id}-${active}` : undefined} disabled={disabled} className={`rounded-select ${className}`} onKeyDown={keyDown} onBlur={() => close()} onPointerDown={event => event.stopPropagation()} onClick={event => { event.stopPropagation(); if (open) close(); else show(); }}>
      {triggerContent ?? <><span className={`select-value${selected ? '' : ' is-placeholder'}`}>{selected?.label ?? placeholder}</span><Swatch color={selected?.color}/><ChevronDown className="select-chevron" size={12} aria-hidden="true"/></>}
    </button>
    {open && createPortal(<div ref={popup} id={id} role="listbox" aria-label={label} className="select-popup" style={position} onPointerDown={event => { if ((event.target as HTMLElement).closest('[role="option"]')) event.preventDefault(); event.stopPropagation(); }} onClick={event => event.stopPropagation()} onWheel={event => event.stopPropagation()}>
      {options.map((option, index) => <div key={option.value} id={`${id}-${index}`} role="option" aria-selected={option.value === value} aria-disabled={option.disabled || undefined} data-option-index={index} className={`select-option${index === active ? ' is-active' : ''}${option.disabled ? ' is-disabled' : ''}`} onPointerMove={() => { if (!option.disabled) setActive(index); }} onClick={() => choose(index)}>
        <span className="select-check">{option.value === value && <Check size={12} aria-hidden="true"/>}</span><span className="select-option-label">{option.label}</span><Swatch color={option.color}/>
      </div>)}
    </div>, document.body)}
  </>;
}
