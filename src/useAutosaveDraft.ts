import { useCallback, useEffect, useLayoutEffect, useMemo, useReducer, useSyncExternalStore } from 'react';

type Fields = Record<string, string>;
type Options<T> = { onSave: (value: T, base: T) => unknown | Promise<unknown>; normalize?: (value: T) => T; enabled?: boolean };
type Session<T extends Fields> = {
  key: string; value: T; base: T; conflicts: (keyof T)[]; deleted: boolean; hadSaved: boolean;
  sending: T | null; busy: boolean; error: string; requested: boolean; composing: boolean; mounted: boolean;
  timer?: ReturnType<typeof setTimeout>; waiters: ((saved: boolean) => void)[]; options: Options<T>; publish: () => void;
};
const same = (a: Fields, b: Fields) => Object.keys(a).every(key => a[key] === b[key]);

type SaveState = 'saved' | 'pending' | 'saving' | 'error';
const tracked = new Map<object, {dirty: boolean; busy: boolean; error: boolean}>(), listeners = new Set<() => void>();
let saveState: SaveState = 'saved';
function track<T extends Fields>(session: Session<T>) {
  if (session.mounted) tracked.set(session, {dirty: !same(session.value, session.base), busy: session.busy, error: !!session.error || session.conflicts.length > 0});
  else tracked.delete(session);
  const values = [...tracked.values()];
  const next = values.some(value => value.error) ? 'error' : values.some(value => value.busy) ? 'saving' : values.some(value => value.dirty) ? 'pending' : 'saved';
  if (next !== saveState) { saveState = next; for (const listener of [...listeners]) listener(); }
}
const subscribe = (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; };
export function useAutosaveState() { return useSyncExternalStore(subscribe, () => saveState); }

async function flush<T extends Fields>(session: Session<T>): Promise<boolean> {
  clearTimeout(session.timer); session.timer = undefined; session.requested = true;
  if (session.busy) return new Promise(resolve => session.waiters.push(resolve));
  if (session.composing || session.deleted || session.conflicts.length || session.options.enabled === false) return false;
  session.requested = false;
  if (same(session.value, session.base)) return true;
  const raw = session.value, base = session.base;
  let sent: T;
  try { sent = session.options.normalize?.(raw) ?? raw; }
  catch (failure) { session.error = failure instanceof Error ? failure.message : 'Enter a valid value.'; session.publish(); return false; }
  if (same(sent, base)) { session.value = sent; session.error = ''; session.publish(); return true; }
  session.busy = true; session.sending = sent; session.error = ''; session.publish();
  let saved = false;
  try {
    const result = await session.options.onSave(sent, base);
    if (result === false || result === null) throw new Error('Could not save. Your draft is kept. Retry saving.');
    const value = { ...session.value }, nextBase = { ...session.base };
    for (const field of Object.keys(sent) as (keyof T)[]) {
      if (value[field] === raw[field]) value[field] = nextBase[field] !== base[field] ? nextBase[field] : sent[field];
      if (nextBase[field] === base[field] || nextBase[field] === sent[field]) nextBase[field] = sent[field];
    }
    session.value = value; session.base = nextBase; saved = true;
  } catch (failure) {
    session.requested = false; clearTimeout(session.timer); session.timer = undefined;
    session.error = failure instanceof Error ? failure.message : 'Could not save. Your draft is kept. Retry saving.';
  } finally {
    session.busy = false; session.sending = null; session.publish();
    if (session.requested) saved = await flush(session);
    const waiters = session.waiters.splice(0);
    for (const resolve of waiters) resolve(saved);
  }
  return saved;
}

export function useAutosaveDraft<T extends Fields>(key: string, saved: T | null, blank: () => T, options: Options<T>) {
  const [, render] = useReducer(value => value + 1, 0);
  const session = useMemo<Session<T>>(() => {
    const value = saved ?? blank();
    return { key, value, base: value, conflicts: [], deleted: false, hadSaved: !!saved, sending: null,
      busy: false, error: '', requested: false, composing: false, mounted: false, waiters: [], options, publish: () => {} };
  }, [key]);
  session.options = options;
  session.publish = () => { if (session.mounted) render(); track(session); };
  const signature = JSON.stringify(saved);
  useLayoutEffect(() => {
    if (!saved) {
      if (session.hadSaved) { session.deleted = true; session.publish(); }
      return;
    }
    if (same(saved, session.base)) return;
    const value = { ...saved }, conflicts = new Set(session.conflicts);
    for (const field of Object.keys(saved) as (keyof T)[]) {
      const dirty = session.value[field] !== session.base[field] || session.sending !== null && session.sending[field] !== session.base[field] && session.value[field] !== session.sending[field];
      if (dirty) {
        value[field] = session.value[field];
        // Pending project writes may return a rounded display value; failed writes still retain the raw draft.
        const ownWrite = session.sending !== null && session.sending[field] !== session.base[field];
        if (saved[field] !== session.base[field] && value[field] !== saved[field] && saved[field] !== session.sending?.[field] && !ownWrite) conflicts.add(field);
      }
      if (value[field] === saved[field]) conflicts.delete(field);
    }
    session.value = value; session.base = saved; session.conflicts = [...conflicts]; session.deleted = false; session.hadSaved = true;
    if (session.conflicts.length) { clearTimeout(session.timer); session.timer = undefined; }
    session.publish();
  }, [session, signature]);
  useLayoutEffect(() => { session.mounted = true; track(session); return () => { session.mounted = false; track(session); }; }, [session]);
  useEffect(() => () => { session.composing = false; void flush(session); }, [session]);
  const save = useCallback(() => flush(session), [session]);
  const schedule = () => {
    clearTimeout(session.timer); session.timer = undefined;
    if (!session.composing && !session.conflicts.length && session.options.enabled !== false) session.timer = setTimeout(() => void flush(session), 650);
  };
  const setValue = (patch: Partial<T>) => {
    session.value = { ...session.value, ...patch }; session.error = '';
    session.conflicts = session.conflicts.filter(field => session.value[field] !== session.base[field]);
    session.publish(); schedule();
  };
  const reset = (value = session.base) => {
    clearTimeout(session.timer); session.timer = undefined; session.requested = session.busy;
    session.value = value; session.base = value; session.conflicts = []; session.error = ''; session.publish();
  };
  return {
    key, value: session.value, base: session.base, conflicts: session.conflicts, deleted: session.deleted,
    busy: session.busy, error: session.error, dirty: !same(session.value, session.base), setValue, reset, flush: save,
    keepDraft: () => { session.conflicts = []; session.publish(); return save(); },
    onCompositionStart: () => { session.composing = true; clearTimeout(session.timer); },
    onCompositionEnd: () => { session.composing = false; schedule(); },
    onBlur: () => { session.composing = false; void save(); },
  };
}
