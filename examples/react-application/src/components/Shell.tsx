import type { ReactNode } from 'react';
import { Circle, LayoutDashboard, Settings2, Sparkles } from 'lucide-react';

export function Shell({ children, active }: { children: ReactNode; active: 'overview' | 'settings' }) {
  return <div className="flex min-h-screen bg-[#101014] font-sans text-zinc-100">
    <aside className="flex w-56 shrink-0 flex-col border-r border-white/10 p-6">
      <div className="mb-12 flex items-center gap-3 text-lg font-semibold tracking-tight"><div className="rounded-lg bg-violet-500 p-2"><Sparkles size={18}/></div>Orbit</div>
      <p className="mb-3 text-[10px] font-semibold uppercase tracking-[0.18em] text-zinc-500">Workspace</p>
      <nav className="space-y-2">{[{ id: 'overview', label: 'Overview', icon: LayoutDashboard, file: 'Overview' }, { id: 'settings', label: 'Settings', icon: Settings2, file: 'Settings' }].map(({ id, label, icon: Icon, file }) => <a key={id} href={`?screen=src/screens/${file}.tsx`} className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm ${active === id ? 'bg-violet-500/15 text-violet-300' : 'text-zinc-400 hover:bg-white/5'}`}><Icon size={16}/>{label}</a>)}</nav>
      <div className="mt-auto flex items-center gap-2 pt-20 text-xs text-zinc-500"><Circle size={7} fill="currentColor" className="text-emerald-400"/>All systems operational</div>
    </aside>
    <main className="min-w-0 flex-1 p-10">{children}</main>
  </div>;
}
