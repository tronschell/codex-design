import { useState } from 'react';
import { ArrowUpRight, Plus } from 'lucide-react';
import { Button } from '@/components/Button';
import { Shell } from '@/components/Shell';

export default function Overview() {
  const [projects, setProjects] = useState(['Website refresh', 'Mobile experience', 'Design system']);
  return <Shell active="overview">
    <div className="mb-9 flex items-center justify-between"><div><p className="mb-2 text-xs text-zinc-500">YOUR WORKSPACE</p><h1 className="text-3xl font-semibold tracking-tight">Good morning, Alex</h1><p className="mt-2 text-sm text-zinc-400">A clear view of everything moving forward.</p></div><Button onClick={() => setProjects(items => [...items, `New project ${items.length + 1}`])}><Plus size={16}/>New project</Button></div>
    <div className="mb-10 grid grid-cols-3 gap-4">{[['Active projects', String(projects.length), '+2 this month'], ['Tasks completed', '128', '+18% this month'], ['Team members', '12', 'Across 3 teams']].map(([label, value, detail]) => <section key={label} className="rounded-xl border border-white/10 bg-[#19191f] p-5"><p className="text-sm text-zinc-400">{label}</p><p className="my-3 text-3xl font-semibold tracking-tight">{value}</p><p className="text-xs text-emerald-400">{detail}</p></section>)}</div>
    <div className="mb-4 flex items-center justify-between"><h2 className="text-lg font-semibold">Recent projects</h2><span className="text-xs text-zinc-500">Updated just now</span></div>
    <div className="overflow-hidden rounded-xl border border-white/10 bg-[#19191f]">{projects.map((project, index) => <div key={project} className="flex items-center gap-4 border-b border-white/5 px-5 py-4 last:border-0"><span className="flex size-10 items-center justify-center rounded-lg bg-violet-500/10 font-medium text-violet-300">{String(index + 1).padStart(2, '0')}</span><div className="flex-1"><p className="text-sm font-medium">{project}</p><p className="mt-1 text-xs text-zinc-500">Product team · Updated today</p></div><span className="rounded-full bg-emerald-500/10 px-2.5 py-1 text-[11px] text-emerald-400">In progress</span><ArrowUpRight size={16} className="ml-3 text-zinc-500"/></div>)}</div>
  </Shell>;
}
