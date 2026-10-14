export function isSafeLink(value: string): boolean {
  if (!value) return true;
  if (value.length > 2048 || /[\s\\\x00-\x1f\x7f]/.test(value)) return false;
  if (value.startsWith('#')) return true;
  if (!/^(?:https?:\/\/|mailto:|tel:)/i.test(value)) return false;
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:' ? !!url.hostname : !!url.pathname;
  } catch { return false; }
}
