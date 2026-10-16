import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Check, ChevronDown } from 'lucide-react';
import './select.css';

export type SelectOption = { value: string; label: string; color?: string; fontFamily?: string; fontWeight?: CSSProperties['fontWeight']; disabled?: boolean };
type Props = {
  options: SelectOption[];
  value: string;
  onChange: (value: string) => void;
  label: string;
  disabled?: boolean;
  className?: string;
  placeholder?: string;
  triggerContent?: ReactNode;
  searchable?: boolean;
};

function Swatch({ color }: { color?: string }) {
  return color ? <span className="select-swatch" aria-hidden="true"><span style={{ backgroundColor: color }}/></span> : null;
}

export function Select({ options, value, onChange, label, disabled, className = '', placeholder = 'Choose…', triggerContent, searchable = false }: Props) {
  const id = useId();
  const trigger = useRef<HTMLButtonElement>(null), popup = useRef<HTMLDivElement>(null);
  const filter = useRef<HTMLInputElement>(null), list = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false), [active, setActive] = useState(-1);
  const [query, setQuery] = useState('');
  const [position, setPosition] = useState<CSSProperties>({ visibility: 'hidden' });
  const search = useRef({ text: '', time: 0 });
  const selected = options.find(option => option.value === value);
  const visible = useMemo(() => open && searchable && query.trim() ? options.filter(option => `${option.label} ${option.value}`.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase())) : options, [open, options, searchable, query]);
  const available = visible.map((option, index) => option.disabled ? -1 : index).filter(index => index !== -1);

  const close = (restoreFocus = false) => {
    setOpen(false); search.current.text = '';
    if (restoreFocus) trigger.current?.focus({ preventScroll: true });
  };
  const show = (last = false) => {
    if (disabled || !options.some(option => !option.disabled)) return;
    const selectedIndex = options.findIndex(option => option.value === value && !option.disabled);
    const enabled = options.map((option, index) => option.disabled ? -1 : index).filter(index => index !== -1);
    setQuery(''); setActive(selectedIndex >= 0 ? selectedIndex : enabled[last ? enabled.length - 1 : 0]);
    setPosition({ visibility: 'hidden' }); setOpen(true);
  };
  const choose = (index: number) => {
    const option = visible[index];
    if (!option || option.disabled) return;
    close(true);
    if (option.value !== value) onChange(option.value);
  };

  useEffect(() => { if (disabled) setOpen(false); }, [disabled]);
  useLayoutEffect(() => {
    if (!open) return;
    if (!available.length) { if (!searchable) setOpen(false); else if (active !== -1) setActive(-1); return; }
    if (!visible[active] || visible[active].disabled) setActive(available[0]);
  }, [open, visible, active, searchable]);
  useLayoutEffect(() => { if (open && searchable && position.visibility === 'visible') filter.current?.focus({ preventScroll: true }); }, [open, searchable, position.visibility]);
  useLayoutEffect(() => {
    if (!open || !popup.current) return;
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
      const desired = Math.min(288, searchable ? (filter.current?.offsetHeight ?? 0) + (list.current?.scrollHeight ?? 0) + 12 : menu.scrollHeight + 2);
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
  }, [open, visible, searchable]);
  useLayoutEffect(() => {
    const menu = searchable ? list.current : popup.current, row = menu?.querySelector<HTMLElement>(`[data-option-index="${active}"]`);
    if (!open || !menu || !row) return;
    if (row.offsetTop < menu.scrollTop) menu.scrollTop = row.offsetTop;
    else if (row.offsetTop + row.offsetHeight > menu.scrollTop + menu.clientHeight) menu.scrollTop = row.offsetTop + row.offsetHeight - menu.clientHeight;
  }, [open, active, position.maxHeight, searchable, visible]);

  const keyDown = (event: KeyboardEvent<HTMLButtonElement | HTMLInputElement>) => {
    const filtering = event.currentTarget === filter.current;
    if (event.nativeEvent.isComposing) { event.stopPropagation(); return; }
    if (event.key === 'Tab') { close(filtering); return; }
    if (event.key === 'Escape') { if (open) { event.preventDefault(); event.stopPropagation(); close(true); } return; }
    event.stopPropagation();
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault(); search.current.text = '';
      if (!open) { show(event.key === 'ArrowUp'); return; }
      if (event.altKey && event.key === 'ArrowUp') { close(true); return; }
      const step = event.key === 'ArrowDown' ? 1 : -1, current = available.indexOf(active);
      setActive(available[(current + step + available.length) % available.length] ?? -1); return;
    }
    if (!filtering && (event.key === 'Home' || event.key === 'End')) {
      event.preventDefault(); search.current.text = '';
      if (!open) show();
      setActive(available[event.key === 'Home' ? 0 : available.length - 1] ?? -1); return;
    }
    if (event.key === 'Enter' || (!filtering && event.key === ' ' && (!search.current.text || Date.now() - search.current.time > 700))) {
      event.preventDefault();
      if (open) choose(active); else show();
      return;
    }
    if (filtering || event.key.length !== 1 || event.ctrlKey || event.metaKey || event.altKey) return;
    event.preventDefault();
    if (searchable) { if (!open) show(); setQuery(previous => open ? previous + event.key : event.key); setActive(0); return; }
    const time = Date.now(), text = (time - search.current.time > 700 ? '' : search.current.text) + event.key.toLocaleLowerCase();
    search.current = { text, time };
    const prefix = [...text].every(character => character === text[0]) ? text[0] : text;
    const start = open ? active : visible.findIndex(option => option.value === value);
    const ordered = [...available.filter(index => index > start), ...available.filter(index => index <= start)];
    const match = ordered.find(index => visible[index].label.toLocaleLowerCase().startsWith(prefix));
    if (!open) show();
    if (match !== undefined) setActive(match);
  };

  return <>
    <button ref={trigger} type="button" role={searchable ? undefined : 'combobox'} aria-label={label} aria-haspopup={searchable ? 'dialog' : 'listbox'} aria-expanded={open} aria-controls={open ? searchable ? `${id}-popup` : id : undefined} aria-activedescendant={!searchable && open && active >= 0 ? `${id}-${active}` : undefined} disabled={disabled} className={`rounded-select ${className}`} onKeyDown={keyDown} onBlur={event => { if (!popup.current?.contains(event.relatedTarget)) close(); }} onPointerDown={event => event.stopPropagation()} onClick={event => { event.stopPropagation(); if (open) close(); else show(); }}>
      {triggerContent ?? <><span className={`select-value${selected ? '' : ' is-placeholder'}`} style={{ fontFamily: selected?.fontFamily, fontWeight: selected?.fontWeight }}>{selected?.label ?? placeholder}</span><Swatch color={selected?.color}/><ChevronDown className="select-chevron" size={12} aria-hidden="true"/></>}
    </button>
    {open && createPortal(<div ref={popup} id={searchable ? `${id}-popup` : undefined} role={searchable ? 'dialog' : undefined} aria-label={searchable ? label : undefined} className={`select-popup${searchable ? ' is-searchable' : ''}`} style={position} onBlur={event => { if (!popup.current?.contains(event.relatedTarget) && !trigger.current?.contains(event.relatedTarget)) close(); }} onPointerDown={event => { if ((event.target as HTMLElement).closest('[role="option"]')) event.preventDefault(); event.stopPropagation(); }} onClick={event => event.stopPropagation()} onWheel={event => event.stopPropagation()}>
      {searchable && <input ref={filter} className="select-search" role="combobox" aria-label={`Search options for ${label.toLocaleLowerCase()}`} aria-expanded="true" aria-controls={id} aria-autocomplete="list" aria-activedescendant={active >= 0 ? `${id}-${active}` : undefined} placeholder="Search…" value={query} onChange={event => { setQuery(event.target.value); setActive(0); }} onKeyDown={keyDown}/>}
      <div ref={list} id={id} role="listbox" aria-label={label} className="select-options">
        {visible.map((option, index) => <div key={option.value} id={`${id}-${index}`} role="option" aria-selected={option.value === value} aria-disabled={option.disabled || undefined} data-option-index={index} className={`select-option${index === active ? ' is-active' : ''}${option.disabled ? ' is-disabled' : ''}`} onPointerMove={() => { if (!option.disabled) setActive(index); }} onClick={() => choose(index)}>
          <span className="select-check">{option.value === value && <Check size={12} aria-hidden="true"/>}</span><span className="select-option-label" style={{ fontFamily: option.fontFamily, fontWeight: option.fontWeight }}>{option.label}</span><Swatch color={option.color}/>
        </div>)}
        {!visible.length && <div className="select-empty" role="status">No matching options.</div>}
      </div>
    </div>, document.body)}
  </>;
}
