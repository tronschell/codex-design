import { useSyncExternalStore } from 'react';

// At most one scripted code layer runs in the editor. Components subscribe by id, so entering or leaving re-renders only the affected layer.
let current: string | null = null;
const listeners = new Set<() => void>();
export const setLiveFrame = (id: string | null) => { if (id === current) return; current = id; listeners.forEach(listener => listener()); };
export const getLiveFrame = () => current;
export function useIsLiveFrame(id: string) {
  return useSyncExternalStore(listener => { listeners.add(listener); return () => { listeners.delete(listener); }; }, () => current === id);
}
