import type { BindableStyleProperty, DesignNode, DesignPage, DesignProject, DesignSystem } from './types.js';
import { shaderRuntimeOptions, shaderRuntimeSource } from './shaders.js';
import { ADVANCED_STYLE_PROPERTIES, effectCss, nodeBoxSize, nodeInnerSize, nodePadding } from './effects.js';
import { isSafeLink } from './links.js';
import { compatibleTokenKinds, designSystemMarkdown, resolveNodeTokens, resolveNodesTokens, tokenCssVariableName, tokenCssVariables } from './design-system.js';
import { gradientCss } from './appearance.js';

export const textListStyle = { margin: 0, padding: 0, listStylePosition: 'inside' } as const;
export const nodeLinkStyle = { position: 'absolute', inset: 0, display: 'block', borderRadius: 'inherit', pointerEvents: 'auto' } as const;

export interface ExportOptions { assetUrls?: Record<string, string>; canvasSize?: { width: number; height: number }; nodeImages?: Record<string, string> }
interface RenderOptions extends ExportOptions { system: DesignSystem; styleFallbacks: ReadonlyMap<string, DesignNode['styles']>; hasLinks: boolean; staticMap?: boolean; included?: ReadonlySet<string> }

export function resolvedNodes(nodes: DesignNode[], system?: DesignSystem): DesignNode[] {
  if (system) nodes = resolveNodesTokens(nodes, system);
  const positions = new Map<string, { x: number; y: number }>();
  const children = childIndex(nodes);
  for (const parent of nodes) {
    const { layout, gap = 0, align = 'start', justify = 'start' } = parent.styles;
    if (layout !== 'vertical' && layout !== 'horizontal') continue;
    const vertical = layout === 'vertical', padding = nodePadding(parent), inner = nodeInnerSize(parent);
    const mainPadding = vertical ? padding.y : padding.x, crossPadding = vertical ? padding.x : padding.y;
    const items = (children.get(parent.id) ?? []).filter(child => !child.hidden).map(child => ({
      child, size: nodeBoxSize(child), mainMargin: (vertical ? child.styles.marginY : child.styles.marginX) ?? 0,
      crossMargin: (vertical ? child.styles.marginX : child.styles.marginY) ?? 0,
    }));
    const occupied = items.reduce((size, item) => size + (vertical ? item.size.height : item.size.width) + item.mainMargin * 2, 0) + gap * Math.max(0, items.length - 1);
    const remaining = Math.max(0, (vertical ? inner.height : inner.width) - mainPadding * 2 - occupied);
    const spacing = gap + (justify === 'space-between' && items.length > 1 ? remaining / (items.length - 1) : 0);
    let cursor = mainPadding + (justify === 'center' ? remaining / 2 : justify === 'end' ? remaining : 0);
    for (const { child, size, mainMargin, crossMargin } of items) {
      const crossSpace = Math.max(0, (vertical ? inner.width - size.width : inner.height - size.height) - crossPadding * 2 - crossMargin * 2);
      const cross = crossPadding + crossMargin + (align === 'center' ? crossSpace / 2 : align === 'end' ? crossSpace : 0);
      positions.set(child.id, vertical ? { x: cross, y: cursor + mainMargin } : { x: cursor + mainMargin, y: cross });
      cursor += (vertical ? size.height : size.width) + mainMargin * 2 + spacing;
    }
  }
  return nodes.map(node => positions.has(node.id) ? { ...node, ...positions.get(node.id)! } : node);
}

export function nodeCss(node: DesignNode, system?: DesignSystem, fallbackStyles = node.styles): Record<string, string | number> {
  const s = system ? resolveNodeTokens(node, system).styles : node.styles;
  const cssValue = (property: BindableStyleProperty, fallback: string | number): string | number => {
    const value = s[property] ?? fallback;
    const token = system?.tokens.find(token => token.id === node.tokenBindings?.[property] && compatibleTokenKinds(property).includes(token.kind));
    if (!token) return value;
    const literal = fallbackStyles[property] ?? fallback;
    return `var(${tokenCssVariableName(token)}, ${typeof literal === 'number' && !['fontWeight', 'lineHeight', 'opacity'].includes(property) ? `${literal}px` : literal})`;
  };
  const length = (value: string | number) => typeof value === 'number' ? `${value}px` : value;
  const css: Record<string, string | number> = {
    position: 'absolute', left: node.x, top: node.y, width: node.width, height: node.height,
    boxSizing: 'border-box', opacity: cssValue('opacity', 1),
  };
  if (node.type === 'text') {
    Object.assign(css, {
      color: cssValue('color', '#e8eaed'), fontSize: cssValue('fontSize', 16), fontWeight: cssValue('fontWeight', 400),
      fontFamily: cssValue('fontFamily', 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'),
      textAlign: s.textAlign ?? 'left', lineHeight: cssValue('lineHeight', 1.24), whiteSpace: 'pre-wrap', overflowWrap: 'break-word',
      letterSpacing: cssValue('letterSpacing', (s.fontSize ?? 16) >= 24 ? '-0.035em' : '-0.01em'),
    });
    if (s.fontStyle !== undefined) css.fontStyle = s.fontStyle;
  } else if (node.type === 'line' || node.type === 'arrow') {
    const color = s.fillMode === 'none' ? 'transparent' : s.fill !== undefined ? cssValue('fill', '#777777') : cssValue('color', '#777777');
    const width = cssValue('borderWidth', node.height);
    Object.assign(css, { color, borderTop: `${typeof width === 'number' ? `${Math.max(width, 1)}px` : `max(1px, ${width})`} solid ${color}` });
  } else {
    const fill = cssValue('fill', 'transparent'), fillOpacity = s.fillOpacity ?? 1;
    css.background = s.fillMode === 'none' ? 'transparent' : s.fillMode === 'gradient' ? s.gradient ? gradientCss(s.gradient) : 'transparent'
      : fillOpacity < 1 ? `color-mix(in srgb, ${fill} ${fillOpacity * 100}%, transparent)` : fill;
    css.borderRadius = node.type === 'ellipse' ? '50%' : s.radiusMode === 'individual' && s.cornerRadii
      ? [s.cornerRadii.topLeft, s.cornerRadii.topRight, s.cornerRadii.bottomRight, s.cornerRadii.bottomLeft].map(radius => `${radius}px`).join(' ')
      : cssValue('radius', 0);
    if (['frame', 'code', 'image', 'video', 'shader'].includes(node.type)) css.overflow = 'hidden';
  }
  if (s.paddingX !== undefined || s.paddingY !== undefined) {
    css.paddingLeft = css.paddingRight = s.paddingX ?? cssValue('padding', 0);
    css.paddingTop = css.paddingBottom = s.paddingY ?? cssValue('padding', 0);
  }
  if (s.borderColor && node.type !== 'line' && node.type !== 'arrow') css.border = `${length(cssValue('borderWidth', 1))} solid ${cssValue('borderColor', s.borderColor)}`;
  if (s.outlineColor) css.outline = `${s.outlineWidth ?? 1}px solid ${s.outlineColor}`;
  if (s.outlineOffset !== undefined) css.outlineOffset = s.outlineOffset;
  if (s.blendMode !== undefined) css.mixBlendMode = s.blendMode;
  if (s.shadow) css.boxShadow = cssValue('shadow', 'none');
  const effects = effectCss(node);
  if (effects.boxShadow && s.shadow && !['none', 'inherit', 'initial', 'unset', 'revert', 'revert-layer'].includes(s.shadow.trim().toLowerCase())) effects.boxShadow = `${cssValue('shadow', 'none')}, ${effects.boxShadow}`;
  Object.assign(css, effects);
  for (const property of ADVANCED_STYLE_PROPERTIES) if (s[property] !== undefined) css[property] = s[property]!;
  if (node.hidden) css.display = 'none';
  return css;
}

const styleText = (css: string) => css.replaceAll('<', '\\3c ');

export function safeCodeDocument(source: string, system?: DesignSystem): string {
  // This policy is prepended so source cannot relax it with another CSP declaration.
  const passiveSource = source.replace(/<meta\b[^>]*>/gi, '').replace(/<base\b[^>]*>/gi, '');
  // Apply current project variables after copied source token blocks, without rewriting the source.
  return `<meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src data:; media-src data:; style-src 'unsafe-inline'; font-src data:; base-uri 'none'; form-action 'none'"><style>html,body{margin:0;width:100%;height:100%;overflow:hidden}*{box-sizing:border-box}body>svg:only-child{display:block;width:100%;height:100%}</style>${passiveSource}${system ? `<style>${styleText(tokenCssVariables(system))}</style>` : ''}`;
}

export function vectorDataUrl(source: string): string | null {
  if (!/^\s*<svg\b[\s\S]*<\/svg>\s*$/i.test(source)) return null;
  // CSS variables need the document's token definitions; use the existing sandboxed preview.
  if (/<!|<\?|\bon[a-z]+\s*=|\b(?:href|src|style)\s*=|(?:url|var)\s*\(/i.test(source)) return null;
  const allowed = new Set(['svg', 'g', 'path', 'rect', 'circle', 'ellipse', 'line', 'polyline', 'polygon', 'text', 'tspan', 'defs', 'clippath', 'lineargradient', 'radialgradient', 'stop', 'mask', 'title', 'desc']);
  for (const match of source.matchAll(/<\/?([\w:-]+)/g)) if (!allowed.has(match[1].toLowerCase())) return null;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(source)}`;
}

const escapeHtml = (value: string) => value.replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]!);
const cssName = (value: string) => value.replace(/[A-Z]/g, character => `-${character.toLowerCase()}`);
const unitless = new Set(['opacity', 'fontWeight', 'lineHeight', 'zIndex', 'flexGrow', 'flexShrink', 'aspectRatio']);

export function inlineCss(style: Record<string, string | number>): string {
  return Object.entries(style).map(([key, value]) => `${cssName(key)}:${typeof value === 'number' && value !== 0 && !unitless.has(key) ? `${value}px` : value}`).join(';');
}

export function exportMediaUrl(ref: string | undefined, options: ExportOptions = {}): string {
  return ref ? options.assetUrls?.[ref] ?? ref : '';
}

function renderNode(node: DesignNode, children: Map<string | null, DesignNode[]>, options: RenderOptions, ancestors = new Set<string>(), linkedAncestor = false, inheritedPointerEvents: 'auto' | 'none' = 'auto'): string {
  if (ancestors.has(node.id) || (options.staticMap && node.hidden)) return '';
  const nextAncestors = new Set(ancestors).add(node.id);
  const href = node.href && isSafeLink(node.href) ? node.href : '';
  const pointerEvents = node.styles.pointerEvents ?? inheritedPointerEvents;
  const style = nodeCss(node, options.system, options.styleFallbacks.get(node.id));
  const shell = options.included && !options.included.has(node.id);
  if (options.staticMap) { style.animation = 'none'; style.transition = 'none'; }
  if (shell) Object.assign(style, { background: 'transparent', borderColor: 'transparent', outline: 'none', mixBlendMode: 'normal', boxShadow: 'none', textShadow: 'none' });
  if (linkedAncestor && node.styles.pointerEvents === undefined) style.pointerEvents = 'none';
  const attributes = `${options.hasLinks ? `id="${escapeHtml(node.id)}" ` : ''}data-node-id="${escapeHtml(node.id)}" data-node-type="${node.type}" aria-label="${escapeHtml(node.name)}" style="${escapeHtml(inlineCss(style))}"`;
  const vector = node.type === 'code' ? vectorDataUrl(node.source ?? '') : null;
  const mediaStyle = `${node.type === 'video' && href ? 'position:relative;' : ''}display:block;width:100%;height:100%;object-fit:${node.styles.objectFit ?? node.media?.fit ?? 'cover'};pointer-events:${linkedAncestor && node.type !== 'video' && node.styles.pointerEvents === undefined ? 'none' : linkedAncestor || href ? pointerEvents : node.styles.pointerEvents ?? (node.type === 'video' ? 'auto' : 'none')}`;
  const snapshot = options.nodeImages?.[node.id];
  let content = snapshot ? `<img alt="${escapeHtml(node.name)}" style="display:block;width:100%;height:100%;object-fit:fill;pointer-events:none" src="${escapeHtml(snapshot)}"/>` : node.type === 'text' ? escapeHtml(node.content ?? '') : node.type === 'image'
    ? `<img alt="${escapeHtml(node.media?.alt ?? node.name)}" draggable="false" style="${mediaStyle}" src="${escapeHtml(exportMediaUrl(node.media?.src, options))}"/>`
    : node.type === 'video'
      ? options.staticMap && node.media?.poster ? `<img alt="${escapeHtml(node.name)}" style="${mediaStyle}" src="${escapeHtml(exportMediaUrl(node.media.poster, options))}"/>` : `<video aria-label="${escapeHtml(node.media?.alt ?? node.name)}" playsinline=""${node.media?.autoplay ? ' autoplay=""' : ' controls=""'}${node.media?.loop ? ' loop=""' : ''}${node.media?.muted !== false ? ' muted=""' : ''}${node.media?.poster ? ` poster="${escapeHtml(exportMediaUrl(node.media.poster, options))}"` : ''} style="${mediaStyle}" src="${escapeHtml(exportMediaUrl(node.media?.src, options))}"></video>`
    : node.type === 'shader'
      ? options.staticMap ? '' : `<canvas aria-label="${escapeHtml(node.name)}" data-shader="${escapeHtml(JSON.stringify(shaderRuntimeOptions(node.shader)))}" style="display:block;width:100%;height:100%"></canvas><span data-shader-status hidden style="position:absolute;inset:0;padding:8px;overflow:auto;color:#dddddd;background:#242424;font:11px/1.4 system-ui,sans-serif"></span>`
    : node.type === 'code'
    ? vector ? `<img alt="${escapeHtml(node.name)}" draggable="false" style="display:block;width:100%;height:100%;object-fit:${node.styles.objectFit ?? 'fill'};pointer-events:none" src="${escapeHtml(vector)}"/>`
      : `<iframe title="${escapeHtml(node.name)}" sandbox="" referrerpolicy="no-referrer" style="display:block;width:100%;height:100%;border:0;pointer-events:none" srcdoc="${escapeHtml(safeCodeDocument(node.source ?? '', options.system))}"></iframe>`
    : node.type === 'arrow' ? '<span style="position:absolute;right:0;top:-5px;width:9px;height:9px;border-top:2px solid currentColor;border-right:2px solid currentColor;transform:rotate(45deg)"></span>' : '';
  const list = node.styles.listStyleType;
  if (node.type === 'text' && list && list !== 'none') {
    const tag = list === 'decimal' ? 'ol' : 'ul';
    content = `<${tag} style="${inlineCss({ ...textListStyle, listStyleType: list })}">${(node.content ?? '').split(/\r?\n/).map(line => `<li>${escapeHtml(line) || '<br/>'}</li>`).join('')}</${tag}>`;
  }
  if (shell) content = '';
  const link = href && !shell && !options.staticMap ? `<a aria-label="${escapeHtml(node.name)}" href="${escapeHtml(href)}"${href.startsWith('#') ? '' : ' target="_blank" rel="noopener noreferrer"'} style="${inlineCss({ ...nodeLinkStyle, pointerEvents })}"></a>` : '';
  const body = node.type === 'video' ? link + content : content + link;
  return `<div ${attributes}>${body}${(children.get(node.id) ?? []).map(child => renderNode(child, children, options, nextAncestors, linkedAncestor || !!href, pointerEvents)).join('')}</div>`;
}

export function exportMapPageMarkup(project: DesignProject, pageId: string, options: ExportOptions = {}, included?: ReadonlySet<string>): string {
  const page = requirePage(project, pageId), nodes = resolvedNodes(page.nodes, project.designSystem);
  const renderOptions: RenderOptions = { ...options, system: project.designSystem, styleFallbacks: new Map(page.nodes.map(node => [node.id, node.styles])), hasLinks: false, staticMap: true, included };
  const children = childIndex(nodes);
  return nodes.filter(node => !node.parentId).map(node => renderNode(node, children, renderOptions)).join('');
}

function childIndex(nodes: DesignNode[]): Map<string | null, DesignNode[]> {
  const index = new Map<string | null, DesignNode[]>();
  for (const node of nodes) {
    const siblings = index.get(node.parentId);
    if (siblings) siblings.push(node);
    else index.set(node.parentId, [node]);
  }
  return index;
}

function htmlDocument(title: string, body: string, background: string, system?: DesignSystem): string {
  const shaderScript = body.includes('data-shader=') ? `<script>document.querySelectorAll('canvas[data-shader]').forEach(canvas=>{const fail=message=>{const status=canvas.nextElementSibling;if(status){status.textContent='Shader unavailable: '+message;status.hidden=false;}};try{(${shaderRuntimeSource()})(canvas,JSON.parse(canvas.dataset.shader),fail);}catch(error){fail(error.message);}});</script>` : '';
  return `<!doctype html>\n<html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${escapeHtml(title)}</title><style>${system ? styleText(tokenCssVariables(system)) : ''}html,body{margin:0;min-width:100%;min-height:100%;font-family:Inter,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}*{box-sizing:border-box}::selection{background:#4497ff;color:#fff}</style></head><body style="background:${escapeHtml(background)}">${body}${shaderScript}</body></html>`;
}

function requirePage(project: DesignProject, pageId: string): DesignPage {
  const page = project.pages.find(item => item.id === pageId);
  if (!page) throw new Error(`Page not found: ${pageId}`);
  return page;
}

function pageLabel(project: DesignProject, page: DesignPage): string {
  const board = project.boards.find(board => board.id === (page.boardId ?? project.boards[0]?.id));
  return board ? `${board.name} / ${page.name}` : page.name;
}

export function projectForBoard(project: DesignProject, boardId: string): DesignProject {
  const board = project.boards.find(board => board.id === boardId);
  if (!board) throw new Error(`Board not found: ${boardId}`);
  const pages = project.pages.filter(page => (page.boardId ?? project.boards[0]?.id) === boardId);
  const pageIds = new Set(pages.map(page => page.id));
  return { ...project, boards: [board], pages, threads: project.threads.filter(thread => pageIds.has(thread.pageId)) };
}

export function exportPageHtml(project: DesignProject, pageId: string, options: ExportOptions = {}): string {
  const page = requirePage(project, pageId);
  const nodes = resolvedNodes(page.nodes, project.designSystem);
  const roots = nodes.filter(node => !node.parentId);
  const width = options.canvasSize?.width ?? Math.max(1280, ...roots.map(node => node.x + nodeBoxSize(node).width + 80));
  const height = options.canvasSize?.height ?? Math.max(900, ...roots.map(node => node.y + nodeBoxSize(node).height + 80));
  const children = childIndex(nodes);
  const renderOptions = { ...options, system: project.designSystem, styleFallbacks: new Map(page.nodes.map(node => [node.id, node.styles])), hasLinks: nodes.some(node => !!node.href && isSafeLink(node.href)) };
  const label = pageLabel(project, page);
  return htmlDocument(`${project.name} — ${label}`, `<main aria-label="${escapeHtml(label)}" style="position:relative;width:${width}px;height:${height}px">${roots.map(node => renderNode(node, children, renderOptions)).join('')}</main>`, '#171717', project.designSystem);
}

export function exportNodeCode(project: DesignProject, pageId: string, nodeId: string, options: ExportOptions = {}): string {
  const page = requirePage(project, pageId);
  const nodes = resolvedNodes(page.nodes, project.designSystem), node = nodes.find(item => item.id === nodeId);
  if (!node) throw new Error(`Node not found: ${nodeId}`);
  const renderOptions = { ...options, system: project.designSystem, styleFallbacks: new Map(page.nodes.map(node => [node.id, node.styles])), hasLinks: nodes.some(node => !!node.href && isSafeLink(node.href)) };
  const size = nodeBoxSize(node);
  return htmlDocument(`${project.name} — ${pageLabel(project, page)} — ${node.name}`, `<main style="position:relative;width:${size.width}px;height:${size.height}px">${renderNode({ ...node, x: 0, y: 0 }, childIndex(nodes), renderOptions)}</main>`, 'transparent', project.designSystem);
}

function filename(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 96).replace(/-$/, '') || 'untitled';
}

export function exportProjectBundle(project: DesignProject, options: ExportOptions = {}): { files: Record<string, string> } {
  const files: Record<string, string> = { 'design.json': JSON.stringify(project, null, 2), 'DESIGN.md': designSystemMarkdown(project.designSystem), 'tokens.css': tokenCssVariables(project.designSystem) };
  if (project.pages.some(page => page.nodes.some(node => node.jsx))) files['jsx/README.md'] = 'These files retain the authored JSX for source-backed components. The design.json document preserves their original markup, starter names, device presentation and compiled passive HTML. Edit through canvas_write_jsx in Codex Design. Read original starter files through canvas_read_design_reference; these JSX snippets assume those component names and are not standalone application modules. HTML screens remain viewable without executing JSX.\n';
  const pages: string[] = [];
  const screens: string[] = [];
  const pageOptions = { assetUrls: Object.fromEntries(Object.entries(options.assetUrls ?? {}).map(([ref, url]) => [ref, /^(?:[a-z]+:|\/)/i.test(url) ? url : `../${url.replace(/^\.\//, '')}`])) };
  for (const [pageIndex, page] of project.pages.entries()) {
    for (const [nodeIndex, node] of page.nodes.entries()) if (node.jsx) files[`jsx/${pageIndex + 1}-${nodeIndex + 1}-${filename(node.id)}.jsx`] = node.jsx.source;
    const label = pageLabel(project, page);
    const pagePath = `pages/${String(pageIndex + 1).padStart(2, '0')}-${filename(label)}.html`;
    files[pagePath] = exportPageHtml(project, page.id, pageOptions);
    pages.push(`<li><a href="${pagePath}">${escapeHtml(label)}</a> <span>${page.nodes.length} editable nodes</span></li>`);
    for (const [screenIndex, node] of page.nodes.filter(item => item.type === 'frame' && !item.parentId).entries()) {
      const screenPath = `screens/${pageIndex + 1}-${String(screenIndex + 1).padStart(2, '0')}-${filename(label)}-${filename(node.name)}.html`;
      files[screenPath] = exportNodeCode(project, page.id, node.id, pageOptions);
      screens.push(`- ${label} / ${node.name} (${node.width} × ${node.height}) → ${screenPath}`);
    }
  }
  const boards = project.boards.map(board => {
    const count = project.pages.filter(page => (page.boardId ?? project.boards[0]?.id) === board.id).length;
    return { name: board.name, pageCount: count };
  });
  const boardHtml = boards.map(board => `<li>${escapeHtml(board.name)} <span>${board.pageCount} page(s)</span></li>`).join('');
  const boardNotes = boards.map(board => `- ${board.name}: ${board.pageCount} page(s)`).join('\n');
  const escapedName = escapeHtml(project.name);
  files['index.html'] = htmlDocument(project.name, `<main style="max-width:880px;margin:80px auto;padding:0 32px;color:#ececec"><p style="color:#ff650b;font-size:14px">CODEX DESIGN · PROJECT HANDOFF</p><h1 style="font-size:42px;margin:16px 0">${escapedName}</h1><p style="color:#a5a5a5;line-height:1.6">${escapeHtml(project.description)}</p><h2 style="margin-top:40px;font-size:22px">Included boards</h2><ul style="padding-left:20px;line-height:2.2">${boardHtml}</ul><h2 style="margin-top:40px;font-size:22px">Pages</h2><ul style="padding-left:20px;line-height:2.2">${pages.join('')}</ul><p style="margin-top:40px;color:#a5a5a5;font-size:14px">Open a page to inspect its complete canvas. Individual frames are in the screens folder. The included boards, pages, comments, source and shared project tokens are saved in design.json.</p></main><style>a{color:#ededed;text-underline-offset:4px}li span{color:#8f8f8f;font-size:13px;margin-left:12px}</style>`, '#171717');
  files['README.md'] = `# ${project.name}\n\n${project.description}\n\nOpen index.html in a browser. This export runs locally without a build step or dependencies.\n\n## Included boards\n\n${boardNotes}\n\nThe application project name, revision and shared tokens are retained. This handoff contains the boards listed above and their pages and anchored conversations.\n\n- design.json is the complete editable document for the included boards, including source, comments, the project design system, literal style fallbacks, token bindings and viewport positions.\n- DESIGN.md contains the shared design system documentation and source provenance.\n- tokens.css contains the named CSS variables used by the generated HTML and React.\n- pages/ contains each board page at its original coordinates.\n- screens/ contains standalone HTML for each top-level frame. File names and labels include the board and page context.\n- Text and shapes are rendered as DOM elements with their original dimensions and styles. Passive vector layers remain SVG; other code layers run in script-free, network-blocked sandboxed iframes.\n\n## Screens and slides\n\n${screens.length ? screens.join('\n') : 'The included boards have no top-level frames.'}\n\n## Design system\n\nRead DESIGN.md for the shared rules, tokens and provenance. CSS variables use stable token IDs; the generated layout preserves the exported dimensions and stack geometry.\n\n\`\`\`json\n${JSON.stringify(project.designSystem, null, 2)}\n\`\`\`\n\nRevision: ${project.revision}\nExported project updated at: ${project.updatedAt}\n`;
  return { files };
}
