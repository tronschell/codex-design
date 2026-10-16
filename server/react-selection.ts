import { parse } from '@babel/parser';
import type { Node } from '@babel/types';
import type { ReactBinding } from '../shared/types';
import { reactExportKey } from '../shared/react-project';

// Attribute instrumentation preserves the application's DOM, refs, layout and event handlers.
export function selectableReactSource(source: string, filename: string, bindings: ReactBinding[]): string {
  if (!bindings.length) return source;
  const program = parse(source, { sourceType: 'module', plugins: filename.endsWith('x') ? ['jsx', 'typescript'] : ['typescript'] }).program;
  const declarations = new Map<string, Node>(), exports = new Map<string, Node | string>();
  const remember = (node: Node) => {
    if ((node.type === 'FunctionDeclaration' || node.type === 'ClassDeclaration') && node.id) declarations.set(node.id.name, node);
    if (node.type === 'VariableDeclaration') for (const item of node.declarations) if (item.id.type === 'Identifier' && item.init) declarations.set(item.id.name, item.init);
  };
  for (const statement of program.body) {
    remember(statement);
    if (statement.type === 'ExportDefaultDeclaration') exports.set('default', statement.declaration.type === 'Identifier' ? statement.declaration.name : statement.declaration);
    if (statement.type === 'ExportNamedDeclaration') {
      if (statement.declaration) {
        remember(statement.declaration);
        const declaration = statement.declaration;
        if ((declaration.type === 'FunctionDeclaration' || declaration.type === 'ClassDeclaration') && declaration.id) exports.set(declaration.id.name, declaration);
        if (declaration.type === 'VariableDeclaration') for (const item of declaration.declarations) if (item.id.type === 'Identifier' && item.init) exports.set(item.id.name, item.init);
      }
      if (!statement.source) for (const item of statement.specifiers) if (item.type === 'ExportSpecifier') exports.set(item.exported.type === 'Identifier' ? item.exported.name : item.exported.value, item.local.name);
    }
  }
  const insertions = new Map<number, string>();
  for (const binding of bindings) {
    const exported = exports.get(binding.exportName), declaration = typeof exported === 'string' ? declarations.get(exported) : exported;
    if (!declaration) continue; // shortcut: barrel re-exports need a binding to the defining module for automatic selection.
    const visit = (node: Node) => {
      if (node.type === 'JSXOpeningElement' && node.name.type === 'JSXIdentifier' && /^[a-z]/.test(node.name.name)) {
        const offset = node.end! - (node.selfClosing ? 2 : 1);
        if (!node.attributes.some(attribute => attribute.type === 'JSXAttribute' && attribute.name.name === 'data-codex-component')) insertions.set(offset, ` data-codex-component={${JSON.stringify(reactExportKey({ ...binding, entry: filename }))}}`);
      }
      for (const value of Object.values(node)) {
        if (Array.isArray(value)) for (const child of value) { if (child && typeof child === 'object' && typeof child.type === 'string') visit(child); }
        else if (value && typeof value === 'object' && 'type' in value && typeof value.type === 'string') visit(value as Node);
      }
    };
    visit(declaration);
  }
  for (const [offset, text] of [...insertions].sort(([a], [b]) => b - a)) source = source.slice(0, offset) + text + source.slice(offset);
  return source;
}
