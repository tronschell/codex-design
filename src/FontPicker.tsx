import { useMemo, type CSSProperties } from 'react';
import { ChevronDown } from 'lucide-react';
import { Field } from './InspectorFields';
import { Select, type SelectOption } from './Select';
import './font-picker.css';

const commonFonts: SelectOption[] = [
  { label: 'System sans', value: 'system-ui, sans-serif' },
  { label: 'Inter', value: 'Inter, system-ui, sans-serif' },
  { label: 'Arial', value: 'Arial, Helvetica, sans-serif' },
  { label: 'Helvetica Neue', value: '"Helvetica Neue", Helvetica, Arial, sans-serif' },
  { label: 'Verdana', value: 'Verdana, Geneva, sans-serif' },
  { label: 'Trebuchet MS', value: '"Trebuchet MS", sans-serif' },
  { label: 'System serif', value: 'ui-serif, Georgia, serif' },
  { label: 'Georgia', value: 'Georgia, "Times New Roman", serif' },
  { label: 'Times New Roman', value: '"Times New Roman", Times, serif' },
  { label: 'Palatino', value: '"Palatino Linotype", Palatino, serif' },
  { label: 'System mono', value: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace' },
  { label: 'Courier New', value: '"Courier New", Courier, monospace' },
];

export function FontPicker({ label, value, onChange, disabled, families = [], autoSave = true }: { label: string; value: string; onChange: (value: string) => unknown; autoSave?: boolean; disabled?: boolean; families?: string[] }) {
  const options = useMemo(() => {
    const saved = [...new Set([value, ...families].filter(family => family.trim()))];
    return [...saved.map(family => ({ value: family, label: family })), ...commonFonts.filter(option => !saved.includes(option.value))].map(option => ({ ...option, fontFamily: option.value }));
  }, [value, families]);
  const hint = 'Enter a CSS font stack or choose a font. Previews use installed fonts and CSS fallbacks; fonts are not installed by this control.';
  return <div className="font-picker" style={{ '--font-picker-family': value || 'inherit' } as CSSProperties} title={hint}>
    <Field autoSave={autoSave} label={label} value={value} onChange={onChange} disabled={disabled} title={hint}/>
    <Select className="font-picker-select" label={`Choose ${label.toLocaleLowerCase()}`} value={value} onChange={onChange} disabled={disabled} options={options} searchable triggerContent={<ChevronDown size={12} aria-hidden="true"/>}/>
  </div>;
}
