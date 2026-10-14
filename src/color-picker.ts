import { safeEffectColor } from '../shared/effects';

let colorContext: CanvasRenderingContext2D | null | undefined;
export function colorParts(value: string) {
  const hex = /^#([a-f\d]{3,4}|[a-f\d]{6}|[a-f\d]{8})$/i.exec(value)?.[1];
  if (hex) {
    const expanded = hex.length <= 4 ? [...hex].map(channel => channel + channel).join('') : hex;
    return { hex: `#${expanded.slice(0, 6)}`, opacity: expanded.length === 8 ? parseInt(expanded.slice(6), 16) / 255 : 1 };
  }
  colorContext ??= document.createElement('canvas').getContext('2d', { willReadFrequently: true });
  if (!colorContext || !(safeEffectColor(value) && CSS.supports('color', value))) return { hex: '#171717', opacity: 1 };
  colorContext.clearRect(0, 0, 1, 1); colorContext.fillStyle = '#000000'; colorContext.fillStyle = value; colorContext.fillRect(0, 0, 1, 1);
  const [red, green, blue, alpha] = colorContext.getImageData(0, 0, 1, 1).data;
  return { hex: `#${[red, green, blue].map(channel => channel.toString(16).padStart(2, '0')).join('')}`, opacity: alpha / 255 };
}

export function withOpacity(value: string, opacity: number) {
  const { hex } = colorParts(value);
  return opacity === 1 ? hex : `${hex}${Math.round(Math.max(0, Math.min(1, opacity)) * 255).toString(16).padStart(2, '0')}`;
}

