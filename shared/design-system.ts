import { defaultTokens, type BindableStyleProperty, type DesignNode, type DesignProject, type DesignSystem, type DesignSystemToken, type DesignSystemTokenKind, type DesignTokens } from './types.js';

export const LEGACY_TOKEN_IDS = { accent: 'system-accent', background: 'system-background', foreground: 'system-foreground', fontFamily: 'system-font-family', radius: 'system-radius' } as const;
export const DESIGN_TOKEN_KINDS = ['color', 'fontFamily', 'fontSize', 'fontWeight', 'lineHeight', 'letterSpacing', 'spacing', 'radius', 'borderWidth', 'opacity', 'shadow', 'duration', 'easing', 'breakpoint', 'zIndex'] as const;
export const BINDABLE_STYLE_PROPERTIES = ['fill', 'color', 'borderColor', 'fontFamily', 'fontSize', 'fontWeight', 'lineHeight', 'letterSpacing', 'gap', 'padding', 'radius', 'borderWidth', 'opacity', 'shadow'] as const;

const bindingKinds: Record<BindableStyleProperty, readonly DesignSystemTokenKind[]> = {
  fill: ['color'], color: ['color'], borderColor: ['color'], fontFamily: ['fontFamily'],
  fontSize: ['fontSize'], fontWeight: ['fontWeight'], lineHeight: ['lineHeight'], letterSpacing: ['letterSpacing'],
  gap: ['spacing'], padding: ['spacing'], radius: ['radius'], borderWidth: ['borderWidth'], opacity: ['opacity'], shadow: ['shadow'],
};

export function compatibleTokenKinds(property: BindableStyleProperty): readonly DesignSystemTokenKind[] { return bindingKinds[property]; }

export function defaultDesignSystem(legacyTokens: DesignTokens = defaultTokens): DesignSystem {
  return {
    name: 'Project design system', description: '', documentation: '',
    tokens: [
      { id: LEGACY_TOKEN_IDS.accent, name: 'Accent', kind: 'color', value: legacyTokens.accent },
      { id: LEGACY_TOKEN_IDS.background, name: 'Background', kind: 'color', value: legacyTokens.background },
      { id: LEGACY_TOKEN_IDS.foreground, name: 'Foreground', kind: 'color', value: legacyTokens.foreground },
      { id: LEGACY_TOKEN_IDS.fontFamily, name: 'Font family', kind: 'fontFamily', value: legacyTokens.fontFamily },
      { id: LEGACY_TOKEN_IDS.radius, name: 'Radius', kind: 'radius', value: legacyTokens.radius },
    ], sources: [], components: [],
  };
}

export function resolveNodeTokens(node: DesignNode, system: DesignSystem): DesignNode {
  if (!node.tokenBindings || !Object.keys(node.tokenBindings).length) return node;
  return resolveWithTokens(node, new Map(system.tokens.map(token => [token.id, token])));
}

export function resolveNodesTokens(nodes: DesignNode[], system: DesignSystem): DesignNode[] {
  const tokens = new Map(system.tokens.map(token => [token.id, token]));
  return nodes.map(node => resolveWithTokens(node, tokens));
}

function resolveWithTokens(node: DesignNode, tokens: Map<string, DesignSystemToken>): DesignNode {
  let styles = node.styles;
  for (const [key, id] of Object.entries(node.tokenBindings ?? {})) {
    const property = key as BindableStyleProperty;
    const token = tokens.get(id);
    if (!token || !bindingKinds[property]?.includes(token.kind)) continue;
    if (styles === node.styles) styles = { ...node.styles };
    Object.assign(styles, { [property]: token.value });
  }
  return styles === node.styles ? node : { ...node, styles };
}

export function resolveProjectTokens(project: DesignProject): DesignProject {
  const tokens = new Map(project.designSystem.tokens.map(token => [token.id, token]));
  let changed = false;
  const pages = project.pages.map(page => {
    const nodes = page.nodes.map(node => resolveWithTokens(node, tokens));
    if (nodes.every((node, index) => node === page.nodes[index])) return page;
    changed = true;
    return { ...page, nodes };
  });
  return changed ? { ...project, pages } : project;
}

export function tokenCssVariableName(token: Pick<DesignSystemToken, 'id'>): string { return `--ds-${token.id}`; }

export function tokenCssValue(token: DesignSystemToken): string {
  if (typeof token.value === 'string') return token.value;
  if (token.kind === 'duration') return `${token.value}ms`;
  return ['fontSize', 'letterSpacing', 'spacing', 'radius', 'borderWidth', 'breakpoint'].includes(token.kind) ? `${token.value}px` : String(token.value);
}

export function tokenCssVariables(system: DesignSystem): string {
  return `:root {\n${system.tokens.map(token => `  ${tokenCssVariableName(token)}: ${tokenCssValue(token)};`).join('\n')}\n}\n`;
}

const markdownText = (value: string) => value.replace(/[\\`*_{}[\]()#|<>]/g, '\\$&');
const markdownCell = (value: string | number) => markdownText(String(value)).replace(/\r?\n/g, '<br>');

export function designSystemMarkdown(system: DesignSystem): string {
  const parts = [`# ${markdownText(system.name).replace(/\r?\n/g, ' ')}`, markdownText(system.description), system.documentation];
  if (system.tokens.length) parts.push(`## Tokens\n\n| Name | Kind | Value | CSS variable | Description |\n| --- | --- | --- | --- | --- |\n${system.tokens.map(token => `| ${markdownCell(token.name)} | ${token.kind} | ${markdownCell(tokenCssValue(token))} | ${tokenCssVariableName(token)} | ${markdownCell(token.description ?? '')} |`).join('\n')}`);
  if (system.components.length) parts.push(`## Reusable native components\n\n| Component | Definition ID | Released revision | Nodes | Description |\n| --- | --- | --- | --- | --- |\n${system.components.map(component => `| ${markdownCell(component.name)} | ${component.id} | ${component.version}${component.releaseLabel ? ` (${markdownCell(component.releaseLabel)})` : ''} | ${component.nodes.length} | ${markdownCell(component.description)} |`).join('\n')}\n\nDefinitions live in the project document. Linked instances retain their released revision and explicit local overrides; applying a newer release is deliberate. Source-backed code remains passive source. Prior releases are immutable project-history snapshots; portable project backups start a new history baseline when imported.`);
  if (system.sources.length) parts.push(`## Sources\n\n${system.sources.map(source => `- ${markdownText(source.path)} (${source.kind}; ${source.confidence})${source.notes ? `: ${markdownText(source.notes).replace(/\r?\n/g, ' ')}` : ''}`).join('\n')}`);
  return `${parts.filter(part => part.trim()).join('\n\n')}\n`;
}
