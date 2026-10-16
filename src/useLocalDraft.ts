import { useMemo } from 'react';
import { useAutosaveDraft } from './useAutosaveDraft';

export function useLocalDraft<T extends Record<string, string>>(key: string, initial: T, track = true) {
  const storageKey = `codex-design:draft:${key}`;
  const saved = useMemo(() => {
    try {
      const stored: unknown = JSON.parse(sessionStorage.getItem(storageKey) ?? 'null');
      if (stored && typeof stored === 'object') return Object.fromEntries(Object.entries(initial).map(([name, fallback]) => [name, typeof (stored as Record<string, unknown>)[name] === 'string' ? (stored as Record<string, string>)[name] : fallback])) as T;
    } catch { /* A missing or invalid local draft starts from the current form. */ }
    return initial;
  }, [storageKey]);
  return useAutosaveDraft(storageKey, saved, () => initial, { track, onSave: value => { sessionStorage.setItem(storageKey, JSON.stringify(value)); } });
}
