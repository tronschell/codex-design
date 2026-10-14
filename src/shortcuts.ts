export const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad|iPod/i.test(navigator.platform || navigator.userAgent);

export const shortcut = (keys: string) => isMac ? keys.replaceAll('Ctrl+Shift+', '⇧⌘').replaceAll('Ctrl+', '⌘').replaceAll('Shift+', '⇧').replaceAll('Alt+', '⌥') : keys;

export function isTextInput(target: EventTarget | null) {
  if (!(target instanceof Element)) return false;
  return !!target.closest('input,textarea,select,[role="textbox"]') || !!target.closest<HTMLElement>('[contenteditable]')?.isContentEditable;
}

export function isShortcutDialog(target: EventTarget | null) {
  return target instanceof Element && !!target.closest('[role="dialog"],[role="listbox"],[role="combobox"][aria-expanded="true"],[role="menu"],.dropdown,.comment-popover,.comment-list');
}
