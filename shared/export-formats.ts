import type { DesignNode, DesignProject } from './types.js';
import { exportMapPageMarkup, exportMediaUrl, exportNodeCode, exportPageHtml, inlineCss, nodeCss, nodeLinkStyle, projectForBoard, resolvedNodes, safeCodeDocument, textListStyle, vectorDataUrl, type ExportOptions } from './export.js';
import { shaderRuntimeOptions, shaderRuntimeSource } from './shaders.js';
import { ADVANCED_STYLE_PROPERTIES, nodeBoxSize, visibleBounds } from './effects.js';
import { isSafeLink } from './links.js';
import { resolveNodeTokens, tokenCssVariables } from './design-system.js';

export type ExportScope = 'selection' | 'page' | 'board' | 'project';
export interface ExportTarget { scope: ExportScope; boardId?: string; pageId?: string; nodeIds?: string[] }
export type ExportFormat = 'react' | 'html' | 'svg' | 'svg-map' | 'source' | 'project' | 'png';
export interface CanvasMapSettings { background?: 'transparent' | 'white' | 'dark' | `#${string}`; scale?: 1 | 2 | 3 | 4; labels?: boolean; margin?: number }
export const MAX_MAP_SIDE = 16_384, MAX_MAP_PIXELS = 64_000_000;
export const exportFilename = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 96).replace(/-$/, '') || 'design';

function targetPage(project: DesignProject, target: ExportTarget) {
  const page = project.pages.find(page => page.id === target.pageId);
  if (!page || (target.boardId && (page.boardId ?? project.boards[0]?.id) !== target.boardId)) throw new Error('The export page is no longer available. Choose a page and try again.');
  return page;
}

function selectionNodes(project: DesignProject, target: ExportTarget) {
  const page = targetPage(project, target), nodes = resolvedNodes(page.nodes, project.designSystem), byId = new Map(nodes.map(node => [node.id, node]));
  const selected = new Set(target.nodeIds);
  if (!selected.size || [...selected].some(id => !byId.has(id))) throw new Error('Select a layer or frame to export.');
  const included = new Set(selected);
  for (const node of nodes) {
    let parent = node.parentId;
    const visited = new Set<string>();
    while (parent && !visited.has(parent)) {
      if (selected.has(parent)) { included.add(node.id); break; }
      visited.add(parent); parent = byId.get(parent)?.parentId ?? null;
    }
  }
  const roots = nodes.filter(node => selected.has(node.id) && !included.has(node.parentId ?? ''));
  return { page, nodes, byId, included, roots };
}

export function exportTargetProject(project: DesignProject, target: ExportTarget, options: { originalSelectionLayout?: boolean } = {}): DesignProject {
  if (target.scope === 'project') return project;
  if (target.scope === 'board') return projectForBoard(project, target.boardId ?? '');
  const page = targetPage(project, target);
  let nodes = page.nodes;
  if (target.scope === 'selection') {
    const selected = selectionNodes(project, target), included = new Set(selected.included);
    // Ancestor shells preserve the selected layers' original editable geometry.
    for (const root of selected.roots) {
      let parent = root.parentId;
      while (parent && !included.has(parent)) { included.add(parent); parent = selected.byId.get(parent)?.parentId ?? null; }
    }
    nodes = page.nodes.filter(node => included.has(node.id));
    if (!options.originalSelectionLayout) {
      nodes = nodes.map(node => {
        const resolved = selected.byId.get(node.id)!;
        const shell = !selected.included.has(node.id);
        return { ...node, x: resolved.x, y: resolved.y, ...(shell && node.styles.layout && node.styles.layout !== 'free' ? { styles: { ...node.styles, layout: 'free' as const } } : {}) };
      });
    }
  }
  const nodeIds = new Set(nodes.map(node => node.id)), boardId = page.boardId ?? project.boards[0]?.id;
  nodes = nodes.map(node => {
    if (!node.componentInstance || Object.values(node.componentInstance.nodeMap).every(id => nodeIds.has(id))) return node;
    const { componentInstance: _instance, ...detached } = node;
    return detached;
  });
  return {
    ...project, boards: project.boards.filter(board => board.id === boardId), pages: [{ ...page, nodes }],
    threads: project.threads.filter(thread => thread.pageId === page.id && (target.scope !== 'selection' || (thread.nodeId !== null && nodeIds.has(thread.nodeId)))),
  };
}

function renderProject(project: DesignProject, target: ExportTarget) {
  if (target.scope === 'board' || target.scope === 'project') throw new Error('Choose a selection or page for this format. Use Source ZIP for multiple pages.');
  const scoped = exportTargetProject(project, target), page = scoped.pages[0];
  if (target.scope === 'page') {
    const roots = resolvedNodes(page.nodes, project.designSystem).filter(node => !node.parentId);
    return { project: scoped, width: Math.max(1280, ...roots.map(node => node.x + nodeBoxSize(node).width + 80)), height: Math.max(900, ...roots.map(node => node.y + nodeBoxSize(node).height + 80)) };
  }
  const selected = selectionNodes(project, target);
  const position = (node: DesignNode) => {
    let x = node.x, y = node.y, parent = node.parentId;
    const visited = new Set<string>();
    while (parent && !visited.has(parent)) {
      visited.add(parent);
      const ancestor = selected.byId.get(parent);
      if (!ancestor) break;
      x += ancestor.x; y += ancestor.y; parent = ancestor.parentId;
    }
    return { x, y };
  };
  const roots = selected.roots.map(node => ({ ...node, ...position(node) })), rootIds = new Set(roots.map(node => node.id));
  const left = Math.min(...roots.map(node => node.x)), top = Math.min(...roots.map(node => node.y));
  const width = Math.max(1, ...roots.map(node => node.x + nodeBoxSize(node).width - left)), height = Math.max(1, ...roots.map(node => node.y + nodeBoxSize(node).height - top));
  const rawStyles = new Map(selected.page.nodes.map(node => [node.id, node.styles]));
  const nodes = selected.nodes.filter(node => selected.included.has(node.id)).map(node => {
    const root = rootIds.has(node.id) ? roots.find(root => root.id === node.id) : undefined;
    return { ...node, styles: rawStyles.get(node.id)!, ...(root ? { parentId: null, x: root.x - left, y: root.y - top } : {}) };
  });
  return { project: { ...scoped, pages: [{ ...page, nodes }] }, width, height };
}

export function exportTargetHtml(project: DesignProject, target: ExportTarget, options: ExportOptions = {}): string {
  if (target.scope === 'selection' && target.nodeIds?.length === 1) { targetPage(project, target); return exportNodeCode(project, target.pageId ?? '', target.nodeIds[0], options); }
  const rendered = renderProject(project, target);
  return exportPageHtml(rendered.project, rendered.project.pages[0].id, target.scope === 'selection' ? { ...options, canvasSize: { width: rendered.width, height: rendered.height } } : options);
}

export function svgExportReason(project: DesignProject, target: ExportTarget): string | null {
  if (target.scope !== 'selection' || target.nodeIds?.length !== 1) return 'Select one SVG source layer to export its vector source.';
  const page = targetPage(project, target), raw = page.nodes.find(node => node.id === target.nodeIds![0]);
  if (!raw || raw.type !== 'code' || !vectorDataUrl(raw.source ?? '') || page.nodes.some(child => child.parentId === raw.id)) return 'SVG export requires one self-contained passive SVG source layer without children. Use HTML or React + CSS for source that depends on document styles or variables.';
  const node = resolveNodeTokens(raw, project.designSystem);
  if (node.effects?.some(effect => effect.enabled !== false) || ADVANCED_STYLE_PROPERTIES.some(property => node.styles[property] !== undefined)) return 'This layer has effects or advanced styling that SVG source cannot preserve. Use HTML or React + CSS.';
  if (node.href || node.styles.paddingX !== undefined || node.styles.paddingY !== undefined) return 'This layer has links or inner padding that SVG source cannot preserve. Use HTML or React + CSS.';
  const s = node.styles;
  if ((s.fillMode === 'gradient' && s.gradient) || (s.blendMode && s.blendMode !== 'normal') || (s.outlineColor && (s.outlineWidth ?? 1) > 0)) return 'This layer has gradient, blend or outline styling that SVG source cannot preserve. Use HTML or React + CSS.';
  const rounded = s.radiusMode === 'individual' && s.cornerRadii ? Object.values(s.cornerRadii).some(radius => radius > 0) : (s.radius ?? 0) !== 0;
  const filled = s.fillMode !== 'none' && s.fillMode !== 'gradient' && (s.fillOpacity ?? 1) > 0 && s.fill && s.fill !== 'transparent';
  if (node.hidden || (s.opacity ?? 1) !== 1 || rounded || (s.borderColor && (s.borderWidth ?? 1) > 0) || filled || (s.shadow && s.shadow !== 'none')) return 'This layer has container styling that SVG source cannot preserve. Use HTML or React + CSS.';
  return null;
}

export function exportTargetSvg(project: DesignProject, target: ExportTarget): string {
  const reason = svgExportReason(project, target);
  if (reason) throw new Error(reason);
  const node = targetPage(project, target).nodes.find(node => node.id === target.nodeIds![0])!;
  return node.source!.replace(/<svg\b([^>]*)>/i, (_match, attributes: string) => `<svg${/\bxmlns\s*=/i.test(attributes) ? '' : ' xmlns="http://www.w3.org/2000/svg"'}${attributes.replace(/\s(?:width|height)\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, '')} width="${node.width}" height="${node.height}">`);
}

export function exportFormatReason(project: DesignProject, target: ExportTarget, format: ExportFormat): string | null {
  if (format === 'svg') return svgExportReason(project, target);
  if ((format === 'react' || format === 'html') && (target.scope === 'board' || target.scope === 'project')) return 'Choose a selection or page. Source ZIP includes HTML and React for multiple pages.';
  if (target.scope === 'selection' && !target.nodeIds?.length) return 'Select a layer or frame on the canvas first.';
  return null;
}

const xml = (value: string) => value.replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]!);

export function canvasMapLayout(project: DesignProject, target: ExportTarget, settings: CanvasMapSettings = {}) {
  const background = settings.background ?? 'dark', scale = settings.scale ?? 2, labels = settings.labels ?? true, margin = settings.margin ?? 80;
  if (!['transparent', 'white', 'dark'].includes(background) && !/^#(?:[\da-f]{3}|[\da-f]{4}|[\da-f]{6}|[\da-f]{8})$/i.test(background)) throw new Error('Choose a background preset or a hexadecimal color.');
  if (![1, 2, 3, 4].includes(scale) || !Number.isFinite(margin) || margin < 0 || margin > 1000) throw new Error('Use a 1×–4× scale and a margin between 0 and 1,000 design pixels.');
  const scoped = exportTargetProject(project, target), included = target.scope === 'selection' ? selectionNodes(project, target).included : undefined;
  const pages = scoped.pages.flatMap(page => {
    const nodes = resolvedNodes(page.nodes, project.designSystem);
    const bounds = nodes.filter(node => !included || included.has(node.id)).map(node => visibleBounds(node, nodes)).filter((box): box is NonNullable<typeof box> => !!box);
    if (!bounds.length) return [];
    const frameLabels = labels ? nodes.filter(node => node.type === 'frame' && (!node.parentId || (target.scope === 'selection' && target.nodeIds?.includes(node.id)))).flatMap(node => { const box = visibleBounds(node, nodes); return box ? [{ name: node.name, box }] : []; }) : [];
    const left = Math.min(...bounds.map(box => box.x)), top = Math.min(...bounds.map(box => box.y), ...frameLabels.map(label => label.box.y - 28));
    const width = Math.max(1, ...bounds.map(box => box.x + box.width - left)), height = Math.max(1, ...bounds.map(box => box.y + box.height - top));
    const board = project.boards.find(board => board.id === (page.boardId ?? project.boards[0]?.id));
    return [{ page, nodes, included, frameLabels, left, top, width, height, label: `${board?.name ? `${board.name} / ` : ''}${page.name}`, x: 0, y: 0 }];
  });
  if (!pages.length) throw new Error('This scope has no visible layers to export. Choose another page or selection.');
  const columns = Math.ceil(Math.sqrt(pages.length)), rows = Math.ceil(pages.length / columns), header = pages.length > 1 && labels ? 40 : 0, gap = Math.max(80, margin);
  const columnWidths = Array.from({ length: columns }, (_, column) => Math.max(...pages.filter((_, index) => index % columns === column).map(page => page.width)));
  const rowHeights = Array.from({ length: rows }, (_, row) => Math.max(...pages.slice(row * columns, (row + 1) * columns).map(page => page.height + header)));
  pages.forEach((page, index) => { page.x = margin + columnWidths.slice(0, index % columns).reduce((sum, width) => sum + width + gap, 0); page.y = margin + rowHeights.slice(0, Math.floor(index / columns)).reduce((sum, height) => sum + height + gap, 0); });
  const width = Math.ceil(columnWidths.reduce((sum, width) => sum + width, 0) + gap * (columns - 1) + margin * 2), height = Math.ceil(rowHeights.reduce((sum, height) => sum + height, 0) + gap * (rows - 1) + margin * 2);
  if (!Number.isFinite(width) || !Number.isFinite(height) || width > 1_000_000 || height > 1_000_000) throw new Error('This canvas spans more than 1,000,000 design pixels. Export a smaller scope.');
  return { project: scoped, pages, width, height, pixelWidth: width * scale, pixelHeight: height * scale, header, background: background === 'dark' ? '#171717' : background === 'white' ? '#ffffff' : background, scale, labels, margin };
}

export function canvasMapPngReason(layout: Pick<ReturnType<typeof canvasMapLayout>, 'pixelWidth' | 'pixelHeight'>): string | null {
  return layout.pixelWidth > MAX_MAP_SIDE || layout.pixelHeight > MAX_MAP_SIDE || layout.pixelWidth * layout.pixelHeight > MAX_MAP_PIXELS ? 'PNG is limited to 16,384 pixels per side and 64 megapixels. Choose a lower scale, a smaller scope, or SVG canvas map.' : null;
}

export function exportCanvasMap(project: DesignProject, target: ExportTarget, settings: CanvasMapSettings = {}, options: ExportOptions = {}) {
  const layout = canvasMapLayout(project, target, settings), warnings = ['SVG canvas maps use HTML/CSS foreignObject. Open them in a modern browser; some image viewers and vector editors cannot display that content.', 'Text uses available system fonts and embedded source fonts. Fonts that are not installed may be substituted.'];
  const visible = layout.pages.flatMap(page => page.nodes.filter(node => (!page.included || page.included.has(node.id)) && !!visibleBounds(node, page.nodes)));
  for (const node of visible) {
    const ref = node.type === 'image' ? node.media?.src : node.type === 'video' && !options.nodeImages?.[node.id] ? node.media?.poster : undefined;
    if (ref && !/^data:image\//i.test(exportMediaUrl(ref, options))) throw new Error(`“${node.name}” needs embedded image bytes. Read its asset before exporting a self-contained canvas map.`);
  }
  const missingStill = visible.find(node => !options.nodeImages?.[node.id] && (node.type === 'shader' || (node.type === 'video' && !node.media?.poster)));
  if (missingStill) throw new Error(`“${missingStill.name}” needs a ${missingStill.type} still. Download the canvas map from the editor to capture it, or use HTML / Source ZIP to retain playback.`);
  if (visible.some(node => node.type === 'code' && !options.nodeImages?.[node.id] && !vectorDataUrl(node.source ?? ''))) warnings.push('Sandboxed HTML source remains embedded. SVG image previews cannot display its iframe; download from the editor to flatten these source layers.');
  if (visible.some(node => node.type === 'video')) warnings.push('Videos are still images: the saved poster is preferred, otherwise the first decodable frame is captured.');
  if (visible.some(node => node.type === 'shader')) warnings.push('Shaders are captured at time zero. Animated states and video playback remain in HTML and source exports.');
  if (visible.some(node => node.styles.animation || node.styles.transition)) warnings.push('Canvas maps freeze CSS motion; named source animation states can differ from a running preview.');
  const label = (name: string, x: number, y: number, width: number, large = false) => `<foreignObject x="${x}" y="${y}" width="${Math.max(1, width)}" height="${large ? 28 : 22}"><div xmlns="http://www.w3.org/1999/xhtml" style="box-sizing:border-box;display:inline-block;max-width:100%;padding:2px 5px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;background:#242424;color:#e8eaed;border-radius:3px;font:${large ? '600 16px' : '500 12px'}/18px Inter,-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif">${xml(name)}</div></foreignObject>`;
  const content = layout.pages.map(page => {
    const x = page.x, y = page.y + layout.header;
    return `${layout.header ? label(page.label, x, page.y, page.width, true) : ''}<foreignObject x="${x}" y="${y}" width="${page.width}" height="${page.height}" overflow="visible"><div xmlns="http://www.w3.org/1999/xhtml" style="position:relative;width:${page.width}px;height:${page.height}px;overflow:visible;font-family:Inter,-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif"><div style="position:absolute;left:${-page.left}px;top:${-page.top}px">${exportMapPageMarkup(layout.project, page.page.id, options, page.included)}</div></div></foreignObject>${page.frameLabels.map(frame => label(frame.name, x + frame.box.x - page.left, y + frame.box.y - page.top - 26, frame.box.width)).join('')}`;
  }).join('');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${layout.width}" height="${layout.height}" viewBox="0 0 ${layout.width} ${layout.height}"><title>${xml(project.name)} — canvas map</title><desc>${xml(`Revision ${project.revision}. Frames retain their original spatial arrangement within each page. Independent pages are arranged in labeled groups. ${warnings.join(' ')}`)}</desc><style>${tokenCssVariables(project.designSystem).replaceAll('<', '\\3c ')}</style>${layout.background === 'transparent' ? '' : `<rect width="100%" height="100%" fill="${layout.background}"/>`}${content}</svg>`;
  if (new TextEncoder().encode(svg).byteLength > 64 * 1024 * 1024) throw new Error('This SVG exceeds 64 MiB after embedding media. Export a smaller scope.');
  return { svg, width: layout.width, height: layout.height, pixelWidth: layout.pixelWidth, pixelHeight: layout.pixelHeight, warnings };
}

export function exportTargetReact(project: DesignProject, target: ExportTarget, options: ExportOptions = {}): { jsx: string; css: string; files: Record<string, string> } {
  const rendered = renderProject(project, target), nodes = resolvedNodes(rendered.project.pages[0].nodes, project.designSystem);
  const rawStyles = new Map(rendered.project.pages[0].nodes.map(node => [node.id, node.styles]));
  const children = new Map<string | null, DesignNode[]>(), classes = new Map<string, string>();
  const css = [tokenCssVariables(project.designSystem), `.exported-design { position: relative; width: ${rendered.width}px; height: ${rendered.height}px; }`];
  nodes.forEach((node, index) => {
    const siblings = children.get(node.parentId);
    if (siblings) siblings.push(node); else children.set(node.parentId, [node]);
    const className = `cd-layer-${index}`; classes.set(node.id, className);
    css.push(`.${className} {\n  ${inlineCss(nodeCss(node, project.designSystem, rawStyles.get(node.id))).replaceAll(';', ';\n  ')};\n}`);
  });
  css.push('.cd-media { display: block; width: 100%; height: 100%; pointer-events: none; }', '.cd-code { border: 0; }', '.cd-shader-status { position: absolute; inset: 0; padding: 8px; overflow: auto; color: #ddd; background: #242424; font: 11px/1.4 system-ui, sans-serif; }', '.cd-arrow { position: absolute; right: 0; top: -5px; width: 9px; height: 9px; border-top: 2px solid currentColor; border-right: 2px solid currentColor; transform: rotate(45deg); }');
  const hasLinks = nodes.some(node => !!node.href && isSafeLink(node.href));
  if (hasLinks) css.push(`.cd-link { ${inlineCss(nodeLinkStyle)}; }`);
  if (nodes.some(node => node.type === 'text' && node.styles.listStyleType && node.styles.listStyleType !== 'none')) css.push(`.cd-text-list { ${inlineCss(textListStyle)}; }`);
  const expression = (value: unknown) => `{${JSON.stringify(value)}}`;
  const render = (node: DesignNode, depth = 2, ancestors = new Set<string>(), linkedAncestor = false, inheritedPointerEvents: 'auto' | 'none' = 'auto'): string => {
    if (ancestors.has(node.id)) return '';
    const indent = '  '.repeat(depth), next = new Set(ancestors).add(node.id);
    const href = node.href && isSafeLink(node.href) ? node.href : '';
    const pointerEvents = node.styles.pointerEvents ?? inheritedPointerEvents;
    const attributes = `${hasLinks ? `id=${expression(node.id)} ` : ''}className="${classes.get(node.id)}" data-node-id=${expression(node.id)} aria-label=${expression(node.name)}${linkedAncestor && node.styles.pointerEvents === undefined ? ' style={{ pointerEvents: "none" }}' : ''}`;
    let content = node.type === 'text' ? expression(node.content ?? '') : '';
    const list = node.styles.listStyleType;
    if (node.type === 'text' && list && list !== 'none') {
      const tag = list === 'decimal' ? 'ol' : 'ul';
      content = `<${tag} className="cd-text-list" style={{ listStyleType: ${JSON.stringify(list)} }}>${(node.content ?? '').split(/\r?\n/).map(line => `<li>${line ? expression(line) : '<br />'}</li>`).join('')}</${tag}>`;
    }
    if (node.type === 'image') content = `<img className="cd-media" style={{ objectFit: ${JSON.stringify(node.styles.objectFit ?? node.media?.fit ?? 'cover')} }} alt=${expression(node.media?.alt ?? node.name)} src=${expression(exportMediaUrl(node.media?.src, options))} draggable={false} />`;
    if (node.type === 'video') content = `<video className="cd-media" style={{ objectFit: ${JSON.stringify(node.styles.objectFit ?? node.media?.fit ?? 'cover')}, pointerEvents: ${JSON.stringify(linkedAncestor || href ? pointerEvents : node.styles.pointerEvents ?? 'auto')}${href ? ", position: 'relative'" : ''} }} aria-label=${expression(node.media?.alt ?? node.name)} src=${expression(exportMediaUrl(node.media?.src, options))}${node.media?.poster ? ` poster=${expression(exportMediaUrl(node.media.poster, options))}` : ''} autoPlay={${!!node.media?.autoplay}} controls={${!node.media?.autoplay}} loop={${!!node.media?.loop}} muted={${node.media?.muted !== false}} playsInline />`;
    if (node.type === 'shader') content = `<canvas className="cd-media" data-shader=${expression(JSON.stringify(shaderRuntimeOptions(node.shader)))} aria-label=${expression(node.name)} /><span className="cd-shader-status" hidden />`;
    if (node.type === 'arrow') content = '<span className="cd-arrow" />';
    if (node.type === 'code') {
      const vector = vectorDataUrl(node.source ?? '');
      content = vector ? `<img className="cd-media" style={{ objectFit: ${JSON.stringify(node.styles.objectFit ?? 'fill')} }} alt=${expression(node.name)} src=${expression(vector)} draggable={false} />` : `<iframe className="cd-media cd-code" title=${expression(node.name)} sandbox="" referrerPolicy="no-referrer" srcDoc=${expression(safeCodeDocument(node.source ?? '', project.designSystem))} />`;
    }
    const descendants = (children.get(node.id) ?? []).map(child => render(child, depth + 1, next, linkedAncestor || !!href, pointerEvents)).join('\n');
    const link = href ? `<a className="cd-link" style={{ pointerEvents: ${JSON.stringify(pointerEvents)} }} aria-label=${expression(node.name)} href=${expression(href)}${href.startsWith('#') ? '' : ' target="_blank" rel="noopener noreferrer"'} />` : '';
    const body = node.type === 'video' ? link + content : content + link;
    return `${indent}<div ${attributes}>${body}${descendants ? `\n${descendants}\n${indent}` : ''}</div>`;
  };
  const shaders = nodes.some(node => node.type === 'shader');
  const imports = shaders ? "import { useEffect, useRef } from 'react';\n" : '';
  const runtime = shaders ? `\nconst createShaderRenderer = ${shaderRuntimeSource()};\n` : '';
  const setup = shaders ? `  const root = useRef(null);\n  useEffect(() => {\n    const renderers = Array.from(root.current.querySelectorAll('canvas[data-shader]'), canvas => {\n      const status = canvas.nextElementSibling;\n      status.hidden = true;\n      return createShaderRenderer(canvas, JSON.parse(canvas.dataset.shader), message => { status.textContent = 'Shader unavailable: ' + message; status.hidden = false; });\n    });\n    return () => renderers.forEach(renderer => renderer.dispose());\n  }, []);\n` : '';
  const jsx = `${imports}import './design.css';\n${runtime}\nexport default function ExportedDesign() {\n${setup}  return (\n    <main${shaders ? ' ref={root}' : ''} className="exported-design" aria-label=${expression(project.name)}>\n${(children.get(null) ?? []).map(node => render(node, 3)).join('\n')}\n    </main>\n  );\n}\n`;
  const stylesheet = `${css.join('\n\n')}\n`;
  return { jsx, css: stylesheet, files: { 'Design.jsx': jsx, 'design.css': stylesheet } };
}

export function exportHandoffPrompt(project: DesignProject, target: ExportTarget): string {
  const page = project.pages.find(page => page.id === target.pageId), board = project.boards.find(board => board.id === target.boardId);
  const scope = target.scope === 'selection' ? `only the selected layer subtree(s) ${target.nodeIds?.join(', ')} on page ${page?.name ?? target.pageId} (${target.pageId})` : target.scope === 'page' ? `only page ${page?.name ?? target.pageId} (${target.pageId})` : target.scope === 'board' ? `only board ${board?.name ?? target.boardId} (${target.boardId})` : 'the entire project, across every board and page';
  const read = target.scope === 'selection' ? target.nodeIds?.map(nodeId => `canvas_get_node_context with projectId ${project.id}, pageId ${target.pageId} and nodeId ${nodeId}`).join('; then ') : `canvas_get_project with projectId ${project.id}`;
  return `Implement ${scope} in ${project.name}. The approved project is ${project.id}, revision ${project.revision}.${target.boardId && target.scope !== 'project' ? ` Board context: ${target.boardId}.` : ''} First read ${read}, then use canvas_export_project with projectId ${project.id}${target.scope !== 'project' && target.boardId ? ` and boardId ${target.boardId}` : ''}${(target.scope === 'page' || target.scope === 'selection') && target.pageId ? ` and pageId ${target.pageId}` : ''}${target.scope === 'selection' ? ` and nodeIds ${JSON.stringify(target.nodeIds)}` : ''} and format source. Use format react for generated JSX and CSS of a selection or page. Review the scoped layout, component hierarchy, editable source, media, shader settings, project design system, DESIGN.md, tokens.css, explicit token bindings and anchored conversations before implementing. Preserve the approved design and its original dimensions. Exported React and CSS are implementation source for the visual structure; connect real application behavior in the target codebase. Keep unrelated project areas outside this implementation scope.`;
}
