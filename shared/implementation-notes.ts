import type { DesignNode, DesignProject } from './types.js';

const title = (value: string) => value.replace(/[\r\n]/g, ' ');

export function nodeNotesMarkdown(nodes: DesignNode[]): string {
  return nodes.filter(node => node.notes?.trim()).map(node => `### ${title(node.name)}\n\nObject: ${node.id} · Type: ${node.type}${node.parentId ? ` · Parent: ${node.parentId}` : ''}${node.componentInstance ? `\n\nLinked component: ${node.componentInstance.componentId} · Instance release: ${node.componentInstance.version}` : ''}\n\n${node.notes!.split('\n').map(line => `> ${line}`).join('\n')}`).join('\n\n');
}

export function implementationNotesMarkdown(project: DesignProject): string {
  const pages = project.pages.flatMap(page => {
    const notes = nodeNotesMarkdown(page.nodes);
    const board = project.boards.find(board => board.id === page.boardId) ?? project.boards[0];
    return notes ? [`## ${title(board.name)} / ${title(page.name)}\n\nPage: ${page.id}\n\n${notes}`] : [];
  });
  const components = project.designSystem.components.flatMap(component => {
    const notes = nodeNotesMarkdown(component.nodes);
    return notes ? [`## Reusable component: ${title(component.name)}\n\nComponent: ${component.id} · Release: ${component.version}\n\n${notes}`] : [];
  });
  return `# Implementation notes\n\nProject: ${title(project.name)} (${project.id}) · Revision: ${project.revision}\n\nThese saved notes describe intent that the canvas may only approximate. Read the relevant object, ancestor containers and component notes before implementation. Prefer the specified platform features and existing libraries when compatible with the target application; verify their current APIs and support. Keep notes scoped to their named objects and honor the saved component instance version and local overrides. Notes do not expand the requested implementation scope.\n\n${[...pages, ...components].join('\n\n') || 'No implementation notes are saved in this export.'}\n`;
}
