export const context = {
  id: "member-experience",
  name: "Member experience",
  variables: [
    { id: "membership", name: "Membership", type: "enum", values: ["free", "pro", "team"], default: "free" },
    { id: "billing", name: "Billing", type: "enum", values: ["current", "attention"], default: "current" },
    { id: "onboarding", name: "Onboarding complete", type: "boolean", default: true }
  ]
};
export const initialScenarios = [
  { id: "free", name: "Free member", values: { membership: "free", billing: "current", onboarding: true } },
  { id: "pro", name: "Pro member", values: { membership: "pro", billing: "current", onboarding: true } },
  { id: "payment", name: "Payment issue", values: { membership: "pro", billing: "attention", onboarding: true } },
  { id: "new", name: "New member", values: { membership: "free", billing: "current", onboarding: false } }
];
export const baseNodes = {
  plan: { name: "Plan badge", content: "Free member", visible: true },
  allowance: { name: "Collection allowance", content: "3 collections", visible: true },
  action: { name: "Membership action", content: "Upgrade to Pro", visible: true },
  export: { name: "Export collection", content: "Export collection", visible: false },
  access: { name: "Product strategy access", content: "Locked", visible: true },
  upgrade: { name: "Upgrade prompt", content: "Make room for more.", visible: true },
  payment: { name: "Billing notice", content: "Your payment needs attention. Update your payment method.", visible: false },
  onboarding: { name: "Getting started", content: "Welcome. Create your first collection to get started.", visible: false }
};
const paid = { key: "membership", in: ["pro", "team"] };
export const initialRules = [
  { id: "plan-pro", name: "Pro label", priority: 10, enabled: true, when: { all: [{ key: "membership", eq: "pro" }] }, effects: [{ target: "plan", set: { content: "Pro member" } }] },
  { id: "plan-team", name: "Team label", priority: 10, enabled: true, when: { all: [{ key: "membership", eq: "team" }] }, effects: [{ target: "plan", set: { content: "Team member" } }] },
  { id: "paid-benefits", name: "Paid membership benefits", priority: 10, enabled: true, when: { all: [paid] }, effects: [
    { target: "allowance", set: { content: "Unlimited collections" } },
    { target: "action", set: { content: "Manage membership" } },
    { target: "access", set: { content: "Available" } },
    { target: "upgrade", set: { visible: false } }
  ] },
  { id: "export-access", name: "Export collection", priority: 20, enabled: true, when: { all: [paid, { key: "billing", eq: "current" }] }, effects: [{ target: "export", set: { visible: true } }] },
  { id: "billing-attention", name: "Payment recovery", priority: 30, enabled: true, when: { all: [paid, { key: "billing", eq: "attention" }] }, effects: [
    { target: "payment", set: { visible: true } },
    { target: "action", set: { content: "Update payment" } }
  ] },
  { id: "new-member", name: "First collection journey", priority: 10, enabled: true, when: { all: [{ key: "onboarding", eq: false }] }, effects: [{ target: "onboarding", set: { visible: true } }] }
];
export function validateValues(values) {
  if (!values || typeof values !== "object" || Array.isArray(values)) throw Error("Values must be an object.");
  for (const key of Object.keys(values)) if (!context.variables.some(v => v.id === key)) throw Error("Unknown variable: " + key);
  for (const variable of context.variables) {
    const value = values[variable.id];
    if (variable.type === "enum" ? !variable.values.includes(value) : typeof value !== "boolean") throw Error("Invalid value for " + variable.name + ".");
  }
  if (values.membership === "free" && values.billing !== "current") throw Error("Free members have no paid invoice. Set Billing to Current.");
}
export function matches(when, values) {
  return when.all.every(c => c.in ? c.in.includes(values[c.key]) : values[c.key] === c.eq);
}
export function resolve(values, rules = initialRules, componentMembership = "inherit") {
  validateValues(values);
  const nodes = structuredClone(baseNodes);
  for (const node of Object.values(nodes)) node.reasons = [];
  for (const rule of [...rules].sort((a,b) => a.priority - b.priority || a.id.localeCompare(b.id))) {
    if (!rule.enabled) continue;
    for (const effect of rule.effects) {
      const local = effect.target === "export" && componentMembership !== "inherit" ? { ...values, membership: componentMembership } : values;
      if (matches(rule.when, local)) {
        Object.assign(nodes[effect.target], effect.set);
        nodes[effect.target].reasons.push(rule.id);
      }
    }
  }
  return nodes;
}
export function differences(before, after) {
  return Object.keys(baseNodes).flatMap(id => {
    const a=before[id], b=after[id];
    if (!a.visible && !b.visible) return [];
    const kind = !a.visible && b.visible ? "added" : a.visible && !b.visible ? "hidden" : a.content !== b.content ? "changed" : null;
    if (!kind) return [];
    return [{ id, name:b.name, kind, before: a.visible ? a.content : "Hidden", after:b.visible ? b.content : "Hidden", ruleIds:b.reasons }];
  });
}
function validateRule(rule) {
  if (!rule || !/^[a-z][a-z0-9-]{0,63}$/.test(rule.id) || typeof rule.name !== "string" || !rule.name.trim() || rule.name.length>80) throw Error("A rule needs a stable ID and a name of 1–80 characters.");
  if (typeof rule.enabled!=="boolean" || !Number.isInteger(rule.priority) || rule.priority<0 || rule.priority>1000) throw Error("Rule priority must be an integer from 0 to 1000.");
  if (!rule.when || Object.keys(rule.when).some(k=>k!=="all") || !Array.isArray(rule.when.all) || !rule.when.all.length || rule.when.all.length>8) throw Error("Use 1–8 conditions in when.all.");
  for (const c of rule.when.all) {
    const v=context.variables.find(v=>v.id===c.key);
    if (!v || Object.keys(c).some(k=>!["key","eq","in"].includes(k)) || (Object.hasOwn(c,"eq")===Object.hasOwn(c,"in"))) throw Error("Each condition needs a known key and either eq or in.");
    const values=Object.hasOwn(c,"in")?c.in:[c.eq];
    if (!Array.isArray(values)||!values.length||values.length>8||values.some(value=>v.type==="enum"?!v.values.includes(value):typeof value!=="boolean")) throw Error("Condition values must match the variable type.");
  }
  if (!Array.isArray(rule.effects)||!rule.effects.length||rule.effects.length>16) throw Error("Use 1–16 effects.");
  for (const e of rule.effects) {
    if (!Object.hasOwn(baseNodes,e.target) || !e.set || !Object.keys(e.set).length) throw Error("An effect needs a known target and properties.");
    for(const [key,value] of Object.entries(e.set)) {
      if(!["content","visible"].includes(key) || (key==="visible"?typeof value!=="boolean":typeof value!=="string"||value.length>180)) throw Error("This prototype supports content (up to 180 characters) and visible (Boolean) overrides.");
    }
  }
}
export function applyPatch(patch, snapshot) {
  if (!patch || patch.version!==1 || !Array.isArray(patch.operations) || patch.operations.length<1 || patch.operations.length>32) throw Error("Expected version 1 with 1–32 operations.");
  const next=structuredClone(snapshot);
  for (const op of patch.operations) {
    if (op.op==="set_values") {
      if (!op.values || Array.isArray(op.values)) throw Error("set_values needs an object.");
      next.values={...next.values,...op.values};
    } else if (op.op==="upsert_scenario") {
      const s=op.scenario;
      if(!s||!/^[a-z][a-z0-9-]{0,63}$/.test(s.id)||typeof s.name!=="string"||!s.name.trim()||s.name.length>60) throw Error("A scenario needs a stable ID and a name of 1–60 characters.");
      validateValues(s.values);
      const i=next.scenarios.findIndex(x=>x.id===s.id);
      if(i<0)next.scenarios.push(s);else next.scenarios[i]=s;
    } else if (op.op==="upsert_rule") {
      validateRule(op.rule);
      const i=next.rules.findIndex(x=>x.id===op.rule.id);
      if(i<0)next.rules.push(op.rule);else next.rules[i]=op.rule;
    } else throw Error("Unsupported local operation: "+op.op);
  }
  validateValues(next.values);
  if(next.scenarios.length>24 || next.rules.length>32)throw Error("This prototype is limited to 24 scenarios and 32 rules.");
  // Equal-priority writers are rejected for all finite context combinations.
  for(const membership of ["free","pro","team"])for(const billing of ["current","attention"])for(const onboarding of [false,true]){
    if(membership==="free"&&billing!=="current")continue;
    const values={membership,billing,onboarding},writers=new Map();
    for(const r of next.rules)if(r.enabled&&matches(r.when,values))for(const e of r.effects)for(const key of Object.keys(e.set)){
      const slot=r.priority+":"+e.target+":"+key;
      if(writers.has(slot))throw Error("Ambiguous rules: "+writers.get(slot)+" and "+r.id+" both set "+e.target+"."+key+" at the same priority.");
      writers.set(slot,r.id);
    }
  }
  return next;
}
