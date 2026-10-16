import React, {useMemo,useState} from "react";
import {createRoot} from "react-dom/client";
import {SlidersHorizontal,Layers,ChevronDown,ArrowRight,GitCompareArrows,Check,X,Code2,Eye,Link,Download,Settings2,BookOpen,Folder,MousePointer2,Hand,Plus,ChevronRight,RotateCcw,Copy,Frame,Type,MoreHorizontal,LockKeyhole} from "lucide-react";
import {context,initialScenarios,initialRules,baseNodes,validateValues,resolve,differences,applyPatch} from "./state-model.mjs";
const control="h-7 rounded border border-[#414141] bg-[#2a2a2a] px-2 text-xs text-[#e8eaed] hover:bg-[#333333] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#87bfff] disabled:cursor-not-allowed disabled:opacity-45";
const initialPatch=JSON.stringify({version:1,operations:[{op:"upsert_scenario",scenario:{id:"team",name:"Team member",values:{membership:"team",billing:"current",onboarding:true}}},{op:"set_values",values:{membership:"team",billing:"current"}}]},null,2);
function StateTarget({id,children,className="",nodes,byId,highlight,selected,onSelect}){
   const diff=byId[id],hidden=!nodes[id].visible;
   if(hidden&&(!highlight||!diff))return null;
   return <div data-state-node={id} tabIndex={0} onClick={()=>{onSelect(id);}} onKeyDown={e=>{if(e.key==="Enter"||e.key===" "){e.preventDefault();onSelect(id);}}} aria-label={nodes[id].name+(diff?". "+diff.kind+". "+diff.before+" to "+diff.after:"")} className={(className.includes("absolute")?"":"relative ")+"rounded "+className+" "+(highlight&&diff?(hidden?"border border-dashed border-[#e8c15b] bg-[#e8c15b]/5":"outline outline-1 outline-offset-4 outline-[#e8c15b]"):"")+" "+(selected===id?"ring-2 ring-[#4497ff] ring-offset-8 ring-offset-[#1d1f22]":"")+" focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#87bfff]"}>
    {highlight&&diff&&<span className="pointer-events-none absolute -left-1 -top-3 z-10 flex h-[18px] items-center gap-1 rounded-sm bg-[#e8c15b] px-1.5 text-[10px] font-semibold text-[#282114]">{diff.index}{diff.kind==="added"?" · Added":diff.kind==="hidden"?" · Hidden":""}</span>}
    <div className={hidden?"opacity-45":""}>{children}</div>
   </div>;
 }
function App(){
 const [values,setValues]=useState(initialScenarios[1].values),[previous,setPrevious]=useState(initialScenarios[0].values),[scenarioId,setScenarioId]=useState("pro");
 const [scenarios,setScenarios]=useState(initialScenarios),[rules,setRules]=useState(initialRules),[baseline,setBaseline]=useState("free");
 const [highlight,setHighlight]=useState(true),[tab,setTab]=useState("Preview"),[selected,setSelected]=useState(null),[override,setOverride]=useState("inherit");
 const [patch,setPatch]=useState(initialPatch),[error,setError]=useState(""),[status,setStatus]=useState("Preview values stay in this session.");
 const [savingScenario,setSavingScenario]=useState(false),[scenarioName,setScenarioName]=useState(""),[step,setStep]=useState("home"),[tabOpen,setTabOpen]=useState(true),[readDefinition,setReadDefinition]=useState(false);
 const sameValues=(a,b)=>context.variables.every(v=>a[v.id]===b[v.id]);
 const currentScenario=scenarios.find(s=>s.id===scenarioId&&sameValues(s.values,values));
 const base=baseline==="previous"?previous:(scenarios.find(s=>s.id===baseline)||scenarios[0]).values;
 const nodes=useMemo(()=>resolve(values,rules,override),[values,rules,override]);
 const before=useMemo(()=>resolve(base,rules,override),[base,rules,override]);
 const changes=useMemo(()=>differences(before,nodes),[before,nodes]);
 const byId=Object.fromEntries(changes.map((d,i)=>[d.id,{...d,index:i+1}]));
 const rule=rules.find(r=>r.id==="export-access"),condition=rule.when.all.find(c=>c.key==="membership"),billingCondition=rule.when.all.find(c=>c.key==="billing");
 const simpleRule=rule.when.all.length===2&&Array.isArray(condition?.in)&&billingCondition&&Object.hasOwn(billingCondition,"eq")&&rule.effects.length===1&&rule.effects[0].target==="export"&&rule.effects[0].set.visible===true&&Object.keys(rule.effects[0].set).length===1;
 function change(next,message="Preview updated.",chosenScenarioId=null){
   try {validateValues(next);setPrevious(values);setValues(next);setScenarioId(chosenScenarioId||(scenarios.find(s=>s.id===scenarioId&&sameValues(s.values,next))||scenarios.find(s=>sameValues(s.values,next)))?.id||null);setSelected(null);setError("");if(override==="free"&&next.billing==="attention"){setOverride("inherit");message+=" Export now follows the frame because Free + payment issue is invalid.";}setStatus(message);}catch(e){setError(e.message);}
 }
 function updateValue(key,value){
   const next={...values,[key]:value};
   let message=context.variables.find(v=>v.id===key).name+" updated.";
   if(key==="membership"&&value==="free"&&next.billing!=="current"){next.billing="current";message="Free membership selected; Billing reset to Current because Free has no invoice.";}
   change(next,message);
 }
 function saveScenario(){
   const name=scenarioName.trim();if(!name){setError("Name this scenario before creating it.");return;}
   if(scenarios.length>=24){setError("This prototype supports up to 24 scenarios.");return;}
   let id=name.toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"").slice(0,48)||"scenario";if(!/^[a-z]/.test(id))id="scenario-"+id;
   if(scenarios.some(s=>s.id===id)){setError("That name already exists. Choose a different name.");return;}
   setScenarios([...scenarios,{id,name,values:{...values}}]);setScenarioId(id);setSavingScenario(false);setScenarioName("");setError("");setStatus("Scenario created in this local prototype.");
 }
 function mutateRule(next){
   try {const out=applyPatch({version:1,operations:[{op:"upsert_rule",rule:next}]},{rules,scenarios,values});setRules(out.rules);setError("");setStatus("Rule updated in this session. Both compared states use the new rule.");}
   catch(e){setError(e.message);}
 }
 function patchApply(){
   try{const out=applyPatch(JSON.parse(patch),{rules,scenarios,values});setPrevious(values);setRules(out.rules);setScenarios(out.scenarios);setValues(out.values);setScenarioId((out.scenarios.find(s=>s.id===scenarioId&&sameValues(s.values,out.values))||out.scenarios.find(s=>sameValues(s.values,out.values)))?.id||null);setSelected(null);setError("");setStatus("Patch applied atomically. "+out.scenarios.length+" scenarios · "+out.rules.length+" rules.");}
   catch(e){setError(e.message);}
 }
 function downloadJSON(){
   const data={schemaVersion:1,context,scenarios,rules,preview:{values,baseline,componentOverride:override}};
   const url=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:"application/json"}));const a=document.createElement("a");a.href=url;a.download="member-experience.state.json";a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);setStatus("State definition exported.");
 }
 function reset(){setScenarioId("pro");setValues(initialScenarios[1].values);setPrevious(initialScenarios[0].values);setScenarios(initialScenarios);setRules(initialRules);setBaseline("free");setOverride("inherit");setSelected(null);setHighlight(true);setError("");setStep("home");setStatus("Prototype reset to Pro compared with Free.");}
 function focusChange(id){setSelected(id);setTabOpen(true);setTab("Preview");document.querySelector('[data-state-node="'+id+'"]')?.scrollIntoView({block:"nearest",inline:"nearest",behavior:"auto"});}
 const targetProps={nodes,byId,highlight,selected,onSelect:id=>{setSelected(id);setTabOpen(true);}};

 const baselineLabel=baseline==="previous"?"Previous state":scenarios.find(s=>s.id===baseline)?.name;
 return <div className="flex h-screen flex-col overflow-hidden bg-[#171717] font-sans text-[13px] text-[#e8eaed]">
  <header className="flex h-8 shrink-0 items-center justify-between border-b border-[#333333] bg-[#202020] px-3">
   <div className="flex items-center gap-4"><strong className="text-sm font-semibold">Codex Design</strong><span className="text-[#ababab]">/</span><span className="hidden text-xs sm:block">Membership experience</span></div>
   <span className="text-[10px] text-[#ababab]">Interactive concept</span>
  </header>
  <div className="flex h-12 shrink-0 items-center justify-between gap-2 px-2">
   <div className="flex h-[31px] items-center gap-1 rounded border border-[#3b3b3b] bg-[#202020] px-2"><span className="mr-2 text-xs">Overview</span><ChevronDown size={13}/><span className="mx-2 h-4 w-px bg-[#3b3b3b]"/><MousePointer2 className="rounded bg-[#243a54] p-0.5 text-[#69aeff]" size={24}/><Hand size={18}/><Frame size={18} className="mx-1"/><Type size={18}/><span className="mx-2 h-4 w-px bg-[#3b3b3b]"/><span className="hidden text-xs sm:inline">Insert</span><Plus size={16} className="ml-4 hidden sm:block"/></div>
   <button className={control+" flex items-center gap-2"} onClick={()=>setTabOpen(!tabOpen)} aria-expanded={tabOpen}><SlidersHorizontal size={14}/>States</button>
  </div>
  <div className={"flex min-h-0 flex-1 flex-col overflow-y-auto min-[1000px]:grid min-[1000px]:overflow-hidden "+(tabOpen?"min-[1000px]:grid-cols-[minmax(0,1fr)_336px]":"min-[1000px]:grid-cols-1")}>
   <main className="relative order-2 min-h-[790px] shrink-0 overflow-auto min-[1000px]:order-none px-6 pb-8 pt-3 min-[1000px]:min-h-0" aria-label="Design canvas">
    <div className="mx-auto w-full min-w-[760px] max-w-[976px]">
     <div className="mb-5 flex h-10 items-center gap-3 rounded border border-[#3b3b3b] bg-[#202020] px-3">
      <SlidersHorizontal size={16} className="text-[#ababab]"/><label htmlFor="scenario" className="text-xs text-[#ababab]">View as</label>
      <select id="scenario" className={control+" w-36 border-[#4779aa] bg-[#243a54]"} value={currentScenario?.id||"custom"} onChange={e=>{const s=scenarios.find(s=>s.id===e.target.value);if(s)change(s.values,s.name+" previewed.",s.id);}}>
       {!currentScenario&&<option value="custom">Custom</option>}{scenarios.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}
      </select>
      <label htmlFor="compare" className="ml-3 text-xs text-[#ababab]">Compare to</label>
      <select id="compare" className={control+" w-36"} value={baseline} onChange={e=>{setBaseline(e.target.value);setSelected(null);}}><option value="previous">Previous state</option>{scenarios.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}</select>
      <button className="ml-auto flex items-center gap-2 text-xs text-[#e8c15b] hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#87bfff]" onClick={()=>{setTabOpen(true);setTab("Preview");}}><GitCompareArrows size={15}/>{changes.length} changes</button>
      <button className={control} onClick={reset} title="Reset prototype"><RotateCcw size={14}/></button>
     </div>
     <div className="mb-2 flex items-center justify-between text-xs"><span className="flex items-center gap-2"><Frame size={14}/>{step==="home"?"Member home":"Collection"}</span><span className="text-[#ababab]">One frame · Member experience</span></div>
     <section className="relative h-[650px] overflow-visible rounded-lg border border-[#41464e] bg-[#1d1f22]" aria-label="Member application preview">
      <nav className="absolute inset-y-0 left-0 flex w-40 flex-col rounded-l-lg border-r border-[#363a40] bg-[#222529] p-3">
       <div className="my-3 mb-9 flex items-center gap-2 px-1 font-semibold"><Layers size={19}/>Member space</div>
       {[["home","Overview",Frame],["library","Library",BookOpen],["collection","Collections",Folder]].map(([id,name,Icon])=><button key={id} className={"mb-2 flex h-8 items-center gap-3 rounded px-2 text-xs hover:bg-[#303843] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#87bfff] "+(step===id?"bg-[#303843] text-[#d3e5ff]":"text-[#ababab]")} onClick={()=>{setStep(id);setStatus("Journey step changed; membership, billing and onboarding carried forward.");}}><Icon size={16}/>{name}</button>)}
       <div className="mt-auto border-t border-[#3b3b3b] pt-4"><span className="text-xs">Jamie Chen</span><p className="mt-1 text-[10px] text-[#ababab]">Personal account</p></div>
      </nav>
      <div className="absolute inset-y-0 left-40 right-0 px-7 pt-8">
       <StateTarget {...targetProps} id="plan" className="absolute right-7 top-9"><span className="block rounded bg-[#2b343c] px-3 py-1 text-xs text-[#d1dce5]">{nodes.plan.content}</span></StateTarget>
       <h1 className="pr-36 text-[23px] font-semibold tracking-tight">{step==="home"?"Good evening, Jamie.":step==="library"?"Your library":"Design systems"}</h1>
       <p className="mt-2 text-xs text-[#ababab]">{step==="home"?"Pick up where you left off.":step==="library"?"A place for everything you’re learning.":"Six resources for a shared design language."}</p>
       <div className="mt-8 flex items-center justify-between gap-5">
        <StateTarget {...targetProps} id="allowance"><h2 className="text-lg font-semibold">{nodes.allowance.content}</h2><p className="mt-1 text-[11px] text-[#ababab]">{values.membership==="free"?"A little space to start something good.":"Room to keep everything you’re learning."}</p></StateTarget>
        <StateTarget {...targetProps} id="action"><span className="block whitespace-nowrap rounded border border-[#414141] bg-[#2a2a2a] px-3 py-2 text-xs">{nodes.action.content}</span></StateTarget>
       </div>
       <div className="mt-7 flex items-center justify-between border-t border-[#3b3b3b] pt-5"><h2 className="text-base font-semibold">{step==="collection"?"Collection resources":"Continue learning"}</h2><StateTarget {...targetProps} id="export"><span className="flex items-center gap-2 whitespace-nowrap rounded border border-[#414141] bg-[#2a2a2a] px-3 py-1.5 text-xs"><Download size={13}/>{nodes.export.content}</span></StateTarget></div>
       <div className="mt-5">
        {["Product strategy","Research practices","Design systems"].map((name,i)=><div key={name} className="flex h-[58px] items-center gap-3 border-b border-[#363a40]"><BookOpen size={18} className="text-[#ababab]"/><div className="min-w-0 flex-1"><p className="text-xs font-medium">{step==="collection"?["Color foundations","Type & hierarchy","Component anatomy"][i]:name}</p><p className="mt-1 text-[10px] text-[#ababab]">{["Course · 8 lessons","Guide · 12 chapters","Collection · 6 resources"][i]}</p></div>{i===0?<StateTarget {...targetProps} id="access"><span className="flex items-center gap-1 text-[11px] text-[#b5cbbf]">{nodes.access.content==="Locked"&&<LockKeyhole size={12}/>} {nodes.access.content}</span></StateTarget>:<span className="text-[11px] text-[#b5cbbf]">Available</span>}</div>)}
       </div>
       <StateTarget {...targetProps} id="payment" className="absolute left-7 right-7 top-[436px]"><div className="rounded bg-[#302a21] px-3 py-2.5 text-xs text-[#e8d8b6]">{nodes.payment.content}</div></StateTarget>
       <StateTarget {...targetProps} id="onboarding" className="absolute left-7 right-7 top-[486px]"><div className="rounded bg-[#26313a] px-3 py-2.5 text-xs text-[#c5dced]">{nodes.onboarding.content}</div></StateTarget>
       <StateTarget {...targetProps} id="upgrade" className="absolute bottom-6 left-7 right-7"><div className="flex h-[80px] items-center justify-between gap-4 rounded border border-[#3c4147] bg-[#25282e] px-4"><div><p className="text-sm font-medium">{nodes.upgrade.content}</p><p className="mt-1 text-[11px] text-[#ababab]">Unlock the full library and unlimited collections.</p></div><span className="whitespace-nowrap text-xs">Upgrade to Pro <ArrowRight size={12} className="ml-1 inline"/></span></div></StateTarget>
      </div>
     </section>
     <div className="mt-4 flex items-center justify-between text-[10px] text-[#ababab]"><span>Illustrative membership app · select a highlighted element to inspect it</span><span>Yellow marks the difference</span></div>
    </div>
   </main>
   {tabOpen&&<aside className="order-1 shrink-0 overflow-y-auto min-[1000px]:order-none border-l border-[#3b3b3b] bg-[#202020] text-xs max-[999px]:border-t" aria-label="Application state controls">
    <div className="flex h-11 items-stretch border-b border-[#333333] px-3 text-xs"><span className="flex flex-1 items-center text-[#ababab]">Properties</span><span className="flex flex-1 items-center text-[#ababab]">Code</span><span className="flex flex-1 items-center text-[#ababab]">Tweaks</span><span className="flex flex-1 items-center justify-center border-b-2 border-[#4497ff] font-semibold">States</span></div>
    <div className="p-3">
     <div className="flex items-center justify-between"><h2 className="text-[15px] font-semibold">Application state</h2><SlidersHorizontal size={16} className="text-[#ababab]"/></div>
     <div className="mb-4 mt-2 flex items-center justify-between text-[#ababab]"><span>{step==="home"?"Member home":step==="library"?"Library":"Collection"}</span><span className="rounded border border-[#414141] px-2 py-0.5 text-[10px]">Frame</span></div>
     <div className="mb-5 flex rounded bg-[#181818] p-0.5" role="tablist" aria-label="State tools">{["Preview","Rules","Agent"].map(t=><button role="tab" id={"state-tab-"+t} aria-controls={"state-panel-"+t} tabIndex={tab===t?0:-1} onKeyDown={e=>{const modes=["Preview","Rules","Agent"];let index=modes.indexOf(t);if(e.key==="ArrowRight")index=(index+1)%3;else if(e.key==="ArrowLeft")index=(index+2)%3;else if(e.key==="Home")index=0;else if(e.key==="End")index=2;else return;e.preventDefault();setTab(modes[index]);e.currentTarget.parentElement.children[index].focus();}} aria-selected={tab===t} key={t} onClick={()=>{setTab(t);setError("");}} className={"h-7 flex-1 rounded focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#87bfff] "+(tab===t?"bg-[#353535]":"text-[#ababab] hover:bg-[#292929]")}>{t}</button>)}</div>
     <div role="tabpanel" id={"state-panel-"+tab} aria-labelledby={"state-tab-"+tab}>
     {tab==="Preview"&&<>
      <div className="mb-4 flex items-center justify-between"><span className="text-[#ababab]">Saved scenario</span><button className="flex items-center gap-1 text-[#bddbff] hover:underline" onClick={()=>{setSavingScenario(!savingScenario);setError("");}}><Plus size={12}/>Save as scenario</button></div>
      {savingScenario&&<form className="mb-4 flex gap-2" onSubmit={e=>{e.preventDefault();saveScenario();}}><input aria-label="Scenario name" autoFocus maxLength={60} className={control+" min-w-0 flex-1"} placeholder="Scenario name" value={scenarioName} onChange={e=>setScenarioName(e.target.value)}/><button className={control} type="submit">Create</button><button aria-label="Cancel creation" className={control} onClick={()=>setSavingScenario(false)} type="button"><X size={12}/></button></form>}
      <p className="mb-5 rounded border border-[#414141] bg-[#292929] px-2 py-2">{currentScenario?.name||"Custom values"}</p>
      <div className="space-y-4">
       <label className="flex items-center justify-between"><span className="text-[#ababab]">Membership</span><select aria-label="Membership" className={control+" w-[180px]"} value={values.membership} onChange={e=>updateValue("membership",e.target.value)}><option value="free">Free</option><option value="pro">Pro</option><option value="team">Team</option></select></label>
       <label className="flex items-center justify-between"><span className="text-[#ababab]">Billing</span><select aria-label="Billing" disabled={values.membership==="free"} className={control+" w-[180px]"} value={values.billing} onChange={e=>updateValue("billing",e.target.value)}><option value="current">Current</option><option value="attention">Needs attention</option></select></label>
       <label className="flex items-center justify-between"><span className="text-[#ababab]">Onboarding</span><span className="flex w-[180px] items-center justify-between rounded border border-[#414141] bg-[#292929] px-2 py-1.5">{values.onboarding?"Complete":"Not complete"}<input type="checkbox" aria-label="Onboarding complete" checked={values.onboarding} onChange={e=>updateValue("onboarding",e.target.checked)} className="h-3.5 w-3.5 accent-[#4497ff]"/></span></label>
      </div>
      <div className="mb-3 mt-6 border-t border-[#3b3b3b] pt-4"><label className="flex items-center justify-between font-medium">Highlight differences<input type="checkbox" aria-label="Highlight differences" checked={highlight} onChange={e=>setHighlight(e.target.checked)} className="h-3.5 w-3.5 accent-[#e8c15b]"/></label><p className="mt-2 text-[11px] text-[#ababab]">Compared with {baselineLabel}</p></div>
      <div aria-label="Difference list">{changes.length?changes.map((d,i)=><button key={d.id} aria-pressed={selected===d.id} onClick={()=>focusChange(d.id)} className={"mb-1 flex w-full gap-3 rounded px-2 py-2 text-left hover:bg-[#302c22] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#87bfff] "+(selected===d.id?"bg-[#302c22]":"")}><span className="flex h-5 w-5 shrink-0 items-center justify-center rounded bg-[#3b3320] text-[10px] text-[#e8c15b]">{i+1}</span><span className="min-w-0"><span className="block font-medium">{d.name}<span className="ml-2 text-[10px] font-normal text-[#cbb578]">{d.kind}</span></span><span className="mt-1 block text-[10px] leading-relaxed text-[#ababab]">{d.before} → {d.after}</span>{selected===d.id&&<span className="mt-2 block text-[10px] text-[#bddbff]">Rule: {d.ruleIds.join(", ")||"base value"}</span>}</span></button>):<p className="py-6 text-center text-[#ababab]">No differences from {baselineLabel}.</p>}</div>
      <p className="mt-5 border-t border-[#3b3b3b] pt-3 text-[11px] leading-relaxed text-[#ababab]">Preview only. The base design stays intact.<br/>Journey navigation carries these values forward.</p>
     </>}
     {tab==="Rules"&&<>
      <p className="mb-1 text-[#ababab]">Selected component</p><p className="mb-5 rounded border border-[#414141] bg-[#292929] p-2">Export collection</p>
      <label className="mb-5 block text-[#ababab]">State source<select aria-label="Component state source" className={control+" mt-2 w-full"} value={override} onChange={e=>{setOverride(e.target.value);setSelected("export");setStatus(e.target.value==="inherit"?"Export follows the frame.":"Only Export uses "+e.target.value+" membership; all other values are inherited.");}}><option value="inherit">Follow frame · Member experience</option><option value="free" disabled={values.billing==="attention"}>Override membership · Free</option><option value="pro">Override membership · Pro</option><option value="team">Override membership · Team</option></select></label>
      <div className="flex items-center justify-between"><h3 className="text-sm font-semibold">Visibility rule</h3><label className="flex items-center gap-2 text-[10px] text-[#ababab]">Enabled<input type="checkbox" checked={rule.enabled} onChange={e=>mutateRule({...rule,enabled:e.target.checked})} className="accent-[#4497ff]"/></label></div>
      {simpleRule?<><p className="mb-2 mt-4 text-[#ababab]">When Membership is one of</p>
      <div className="flex gap-2">{["free","pro","team"].map(v=><label key={v} className="flex flex-1 items-center justify-center gap-2 rounded border border-[#414141] bg-[#292929] px-2 py-2 capitalize"><input type="checkbox" checked={condition.in.includes(v)} onChange={e=>{const vals=e.target.checked?[...condition.in,v]:condition.in.filter(x=>x!==v);if(!vals.length){setError("Choose at least one membership.");return;}mutateRule({...rule,when:{all:[{key:"membership",in:vals},billingCondition]}});}} className="accent-[#4497ff]"/>{v}</label>)}</div>
      <label className="mt-4 block text-[#ababab]">And Billing is<select aria-label="Rule billing condition" className={control+" mt-2 w-full"} value={billingCondition.eq} onChange={e=>mutateRule({...rule,when:{all:[condition,{key:"billing",eq:e.target.value}]}})}><option value="current">Current</option><option value="attention">Needs attention</option></select></label>
      <p className="mb-2 mt-5 text-[#ababab]">Then</p><div className="rounded border border-[#4779aa] bg-[#243a54] p-2 text-[#bddbff]">Visible</div><p className="mb-2 mt-4 text-[#ababab]">Otherwise</p><div className="rounded border border-[#414141] bg-[#292929] p-2">Hidden · base value</div></>:<div className="mt-4"><p className="text-[11px] leading-relaxed text-[#ababab]">This rule uses a custom condition. Edit its structured form to preserve every condition and effect.</p><pre className="mt-3 max-h-56 overflow-auto rounded bg-[#171717] p-2 text-[10px]">{JSON.stringify({when:rule.when,effects:rule.effects},null,2)}</pre></div>}
      <div className="mt-6 border-t border-[#3b3b3b] pt-4"><p className="flex items-center justify-between font-medium">Resolved visibility <span className="text-[#b5cbbf]">{nodes.export.visible?"Visible":"Hidden"}</span></p><p className="mt-3 text-[11px] leading-relaxed text-[#ababab]">Only visibility changes. Geometry, label and the component link stay shared.</p></div>
      <button onClick={()=>{setTab("Agent");setPatch(JSON.stringify({version:1,operations:[{op:"upsert_rule",rule}]},null,2));}} className={control+" mt-5 flex w-full items-center justify-center gap-2"}><Code2 size={14}/>Edit structured rule</button>
      <p className="mt-3 text-[10px] text-[#ababab]">Rule edits are applied locally as you change them.</p>
     </>}
     {tab==="Agent"&&<>
      <h3 className="font-semibold">Structured state</h3><p className="mt-2 text-[11px] leading-relaxed text-[#ababab]">Stable variable, rule and node IDs. Read the current context, then submit one validated patch.</p>
      <div className="my-4 rounded border border-[#414141] bg-[#181818] px-3 py-2 font-mono text-[10px] leading-relaxed text-[#b9c9d8]">context: member-experience<br/>frame: member-home<br/>membership: {values.membership}<br/>billing: {values.billing}<br/>onboarding: {String(values.onboarding)}</div>
      <label htmlFor="agent-patch" className="mb-2 block text-[#ababab]">Local patch</label><textarea id="agent-patch" spellCheck={false} value={patch} onChange={e=>setPatch(e.target.value)} className="h-[330px] w-full resize-y rounded border border-[#414141] bg-[#171717] p-3 font-mono text-[11px] leading-relaxed text-[#c1d3e5] caret-[#e8c15b] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#87bfff]"/>
      <button onClick={patchApply} className={control+" mt-3 w-full border-[#4779aa] bg-[#243a54] text-[#bddbff]"}>Apply patch</button>
      <button onClick={()=>setReadDefinition(!readDefinition)} className={control+" mt-2 flex w-full items-center justify-center gap-2"}><Code2 size={13}/>{readDefinition?"Hide definition":"Read state definition"}</button>{readDefinition&&<textarea aria-label="State definition" readOnly value={JSON.stringify({schemaVersion:1,context,scenarios,rules},null,2)} className="mt-3 h-64 w-full rounded border border-[#414141] bg-[#171717] p-2 font-mono text-[10px] focus-visible:outline focus-visible:outline-[#87bfff]"/>}
      <p className="mt-3 text-[10px] leading-relaxed text-[#ababab]">This lab applies patches locally. Proposed MCP operations are documented in the implementation handoff.</p>
     </>}
     </div>
     {error&&<div role="alert" className="mt-4 rounded border border-[#956e54] bg-[#33271f] p-3 text-[11px] leading-relaxed text-[#f0c7aa]">{error}</div>}
    </div>
   </aside>}
  </div>
  <footer className="flex min-h-8 shrink-0 items-center justify-between gap-5 border-t border-[#333333] bg-[#202020] px-3 py-1.5 text-[10px] text-[#ababab]"><span role="status" aria-live="polite">{status}</span><span className="hidden whitespace-nowrap sm:block">{rules.length} rules · {scenarios.length} scenarios</span></footer>
 </div>;
}
createRoot(document.getElementById('root')).render(<App/>);
