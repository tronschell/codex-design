import type { DesignSystem, DesignSystemToken, DesignSystemTokenKind } from './types.ts';
import { DESIGN_DOCUMENT_SECTIONS, DESIGN_TOKEN_KINDS, LEGACY_TOKEN_IDS, designSystemMarkdown } from './design-system.ts';
import { designSystemTokenSchema } from './validation.ts';

const unescapeMarkdown = (value: string) => value.replace(/\\([\\`*_{}[\]()#|<>])/g, '$1');
const decodeCell = (value: string) => unescapeMarkdown(value.replaceAll('<br>', '\n'));
const codeText = (value: string) => /^`[^`]*`$/.test(value) ? value.slice(1, -1) : value;
const lengthKinds = new Set<DesignSystemTokenKind>(['fontSize', 'letterSpacing', 'spacing', 'radius', 'borderWidth', 'breakpoint']);
const stringKinds = new Set<DesignSystemTokenKind>(['color', 'fontFamily', 'shadow', 'easing']);

function tableCells(line: string): string[] {
  const cells = [''];
  for (let index = 0; index < line.length; index++) {
    const character = line[index];
    if (character === '\\' && index + 1 < line.length) cells[cells.length - 1] += character + line[++index];
    else if (character === '|') cells.push('');
    else cells[cells.length - 1] += character;
  }
  if (cells.shift()?.trim() || cells.pop()?.trim() || cells.length !== 5) throw new Error('Each token row must have five columns enclosed by | characters; escape literal pipes as \\|.');
  return cells.map(cell => decodeCell(cell.trim()));
}

function tokenValue(kind: DesignSystemTokenKind, value: string): string | number {
  value = codeText(value);
  if (stringKinds.has(kind)) return value;
  const number = /^([+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?)(px|ms|s)?$/i.exec(value);
  const unit = number?.[2]?.toLowerCase();
  if (!number || unit && !(lengthKinds.has(kind) ? unit === 'px' : kind === 'duration' && ['ms', 's'].includes(unit))) throw new Error(`Use a numeric ${kind} value${lengthKinds.has(kind) ? ' in px' : kind === 'duration' ? ' in ms or s' : ' without a unit'}.`);
  return Number(number[1]) * (unit === 's' ? 1000 : 1);
}

// Parse only our generated sections, leaving arbitrary authored Markdown as documentation.
export function parseDesignSystemDocument(markdown: string, system: DesignSystem): Pick<DesignSystem, 'name' | 'description' | 'documentation' | 'tokens'> {
  const document = markdown.replaceAll('\r\n', '\n');
  const documentationMarker = `\n\n${DESIGN_DOCUMENT_SECTIONS.documentation}\n\n`, tokensMarker = `\n\n${DESIGN_DOCUMENT_SECTIONS.tokens}\n\n`, catalogMarker = `\n\n${DESIGN_DOCUMENT_SECTIONS.catalog}\n\n`;
  const documentationStart = document.indexOf(documentationMarker), tokensStart = document.lastIndexOf(tokensMarker), catalogStart = document.lastIndexOf(catalogMarker);
  const title = /^# ([^\n]+)\n\n/.exec(document);
  if (!title || documentationStart < title[0].length || tokensStart < documentationStart + documentationMarker.length || catalogStart < tokensStart + tokensMarker.length) throw new Error('Keep the generated # title and codex-design section comments in DESIGN.md. Put freeform rules in its documentation section.');
  const reference = designSystemMarkdown(system);
  if (document.slice(catalogStart + catalogMarker.length).trim() !== reference.slice(reference.lastIndexOf(catalogMarker) + catalogMarker.length).trim()) throw new Error('The generated component and source catalog is read-only here. Edit components through their release actions and sources through update_design_system.');
  const table = document.slice(tokensStart + tokensMarker.length, catalogStart).trim().split('\n').filter(line => line.trim());
  if (table.shift()?.trim() !== '## Tokens' || table.length < 2) throw new Error('Keep the generated ## Tokens heading and five-column token table in DESIGN.md.');
  if (tableCells(table.shift()!.trim()).join('|') !== 'Name|Kind|Value|CSS variable|Description' || !tableCells(table.shift()!.trim()).every(cell => /^:?-{3,}:?$/.test(cell))) throw new Error('Token table columns must be Name, Kind, Value, CSS variable and Description, followed by the Markdown separator row.');
  const ids = new Set<string>(), names = new Set<string>();
  const tokens = table.map((line, index): DesignSystemToken => {
    try {
      const [name, rawKind, value, variable, description] = tableCells(line.trim()), kind = codeText(rawKind) as DesignSystemTokenKind;
      if (!DESIGN_TOKEN_KINDS.includes(kind)) throw new Error(`Unknown token kind: ${rawKind}. Use ${DESIGN_TOKEN_KINDS.join(', ')}.`);
      const id = /^--ds-([a-zA-Z0-9][a-zA-Z0-9_-]{0,127})$/.exec(codeText(variable))?.[1];
      if (!id) throw new Error('CSS variable must be --ds-<stable-token-id>; keep an existing ID when editing a token.');
      const parsed = designSystemTokenSchema.safeParse({ id, name, kind, value: tokenValue(kind, value), ...(description ? { description } : {}) });
      if (!parsed.success) throw new Error(parsed.error.issues.map(issue => `${issue.path.join('.')}: ${issue.message}`).join('; '));
      if (ids.has(id)) throw new Error(`Duplicate token ID: ${id}.`);
      if (names.has(parsed.data.name.toLowerCase())) throw new Error(`Duplicate token name: ${parsed.data.name}.`);
      ids.add(id); names.add(parsed.data.name.toLowerCase());
      return parsed.data;
    } catch (error) { throw new Error(`Token row ${index + 1}: ${error instanceof Error ? error.message : 'Invalid token.'}`); }
  });
  for (const id of Object.values(LEGACY_TOKEN_IDS)) if (system.tokens.some(token => token.id === id) && !ids.has(id)) throw new Error(`Keep compatibility token --ds-${id} in DESIGN.md. Its value and name remain editable.`);
  return {
    name: decodeCell(title[1]), description: unescapeMarkdown(document.slice(title[0].length, documentationStart)),
    documentation: document.slice(documentationStart + documentationMarker.length, tokensStart), tokens,
  };
}
