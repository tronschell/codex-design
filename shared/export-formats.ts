import type { DesignNode, DesignProject } from './types.js';
import { exportMediaUrl, exportNodeCode, exportPageHtml, inlineCss, nodeCss, nodeLinkStyle, projectForBoard, resolvedNodes, safeCodeDocument, textListStyle, vectorDataUrl, type ExportOptions } from './export.js';
import { shaderRuntimeOptions, shaderRuntimeSource } from './shaders.js';
import { ADVANCED_STYLE_PROPERTIES, nodeBoxSize } from './effects.js';
import { isSafeLink } from './links.js';
import { resolveNodeTokens, tokenCssVariables } from './design-system.js';

export type ExportScope = 'selection' | 'page' | 'board' | 'project';
export interface ExportTarget { scope: ExportScope; boardId?: string; pageId?: string; nodeIds?: string[] }
export type ExportFormat = 'react' | 'html' | 'svg' | 'source' | 'project' | 'png';
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
  if (node.hidden || (node.styles.opacity ?? 1) !== 1 || (node.styles.radius ?? 0) !== 0 || (node.styles.borderColor && (node.styles.borderWidth ?? 1) > 0) || (node.styles.fill && node.styles.fill !== 'transparent') || (node.styles.shadow && node.styles.shadow !== 'none')) return 'This layer has container styling that SVG source cannot preserve. Use HTML or React + CSS.';
  return null;
}

export function exportTargetSvg(project: DesignProject, target: ExportTarget): string {
  const reason = svgExportReason(project, target);
  if (reason) throw new Error(reason);
  const node = targetPage(project, target).nodes.find(node => node.id === target.nodeIds![0])!;
  return node.source!.replace(/<svg\b([^>]*)>/i, (_match, attributes: string) => `<svg${/\bxmlns\s*=/i.test(attributes) ? '' : ' xmlns="http://www.w3.org/2000/svg"'}${attributes.replace(/\s(?:width|height)\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, '')} width="${node.width}" height="${node.height}">`);
}

export function exportFormatReason(project: DesignProject, target: ExportTarget, format: ExportFormat): string | null {
  if (format === 'png') return 'PNG capture is not available for HTML, video and shader layers. Use a source format to preserve them.';
  if (format === 'svg') return svgExportReason(project, target);
  if ((format === 'react' || format === 'html') && (target.scope === 'board' || target.scope === 'project')) return 'Choose a selection or page. Source ZIP includes HTML and React for multiple pages.';
  if (target.scope === 'selection' && !target.nodeIds?.length) return 'Select a layer or frame on the canvas first.';
  return null;
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
