import type { GradientFill } from './types.js';

export const BLEND_MODES = ['normal', 'multiply', 'screen', 'overlay', 'darken', 'lighten', 'color-dodge', 'color-burn', 'hard-light', 'soft-light', 'difference', 'exclusion', 'hue', 'saturation', 'color', 'luminosity', 'plus-darker', 'plus-lighter'] as const;

export function gradientCss(gradient: GradientFill): string {
  const stops = [...gradient.stops].sort((a, b) => a.position - b.position).map(stop => {
    const color = stop.opacity === 1 ? stop.color : `color-mix(in srgb, ${stop.color} ${stop.opacity * 100}%, transparent)`;
    return `${color} ${stop.position}%`;
  }).join(', ');
  return gradient.type === 'radial'
    ? `radial-gradient(in ${gradient.interpolation}, ${stops})`
    : `linear-gradient(${gradient.angle}deg in ${gradient.interpolation}, ${stops})`;
}
