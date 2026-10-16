import type { ButtonHTMLAttributes } from 'react';

export function Button({ className = '', variant = 'primary', ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'secondary' }) {
  return <button {...props} className={`inline-flex h-10 items-center justify-center gap-2 rounded-lg px-4 text-sm font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-400 disabled:opacity-50 ${variant === 'primary' ? 'bg-violet-500 text-white hover:bg-violet-400' : 'border border-white/10 bg-white/5 text-zinc-200 hover:bg-white/10'} ${className}`} />;
}
