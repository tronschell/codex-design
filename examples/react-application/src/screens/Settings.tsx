import { useState } from 'react';
import { Check, Save } from 'lucide-react';
import { Button } from '@/components/Button';
import { Shell } from '@/components/Shell';

export default function Settings() {
  const [name, setName] = useState('Orbit Studio');
  const [saved, setSaved] = useState(false);
  return <Shell active="settings"><p className="mb-2 text-xs text-zinc-500">YOUR WORKSPACE</p><h1 className="text-3xl font-semibold tracking-tight">Workspace settings</h1><p className="mt-2 text-sm text-zinc-400">Make this space work for your team.</p>
    <section className="mt-9 max-w-2xl rounded-xl border border-white/10 bg-[#19191f] p-7"><h2 className="text-lg font-semibold">General</h2><p className="mb-7 mt-1 text-sm text-zinc-400">Your workspace identity and preferences.</p><label className="block text-sm font-medium" htmlFor="workspace-name">Workspace name</label><input id="workspace-name" className="mt-2 h-11 w-full rounded-lg border border-white/10 bg-[#101014] px-3 text-sm outline-none focus:border-violet-400" value={name} onChange={event => { setName(event.target.value); setSaved(false); }}/><p className="mt-2 text-xs text-zinc-500">Shown in navigation and shared project links.</p><div className="mt-8 flex items-center gap-3 border-t border-white/10 pt-6"><Button onClick={() => setSaved(true)} disabled={!name.trim()}>{saved ? <Check size={16}/> : <Save size={16}/>}Save changes</Button><Button variant="secondary" onClick={() => { setName('Orbit Studio'); setSaved(false); }}>Reset</Button><span role="status" className="ml-auto text-xs text-emerald-400">{saved ? 'Changes saved in this preview' : ''}</span></div></section>
  </Shell>;
}
