import { z } from 'zod';
import type { DesignNode, DesignProject, ReactProject } from './types';

export const reactFilePathSchema = z.string().min(1).max(180).regex(/^(?:[a-zA-Z0-9_][a-zA-Z0-9_.-]*\/)*[a-zA-Z0-9_][a-zA-Z0-9_.-]*\.(?:tsx?|jsx?|css|json)$/, 'Use a relative source path, such as src/screens/Home.tsx').refine(path => !path.split('/').includes('node_modules'), 'node_modules is reserved for declared dependencies').refine(path => !['package.json', 'vite.config.js', 'canvas-main.jsx', 'preview.css'].includes(path), 'This root filename is reserved for the exported application scaffold; keep application modules in src/');
const packageName = z.string().max(160).regex(/^(?:@[a-z0-9][a-z0-9._-]*\/)?[a-z0-9][a-z0-9._-]*$/);
const packageVersion = z.string().max(100).regex(/^\d+\.\d+\.\d+(?:-[a-zA-Z0-9.-]+)?$/, 'Use an exact npm version; URLs, local paths, tags and ranges are not accepted');
export const reactFilesSchema = z.record(reactFilePathSchema, z.string().max(500_000)).refine(files => Object.keys(files).length <= 200 && Object.values(files).reduce((size, source) => size + source.length, 0) <= 2_000_000, 'Use at most 200 files and 2 million source characters');
export const reactDependenciesSchema = z.record(packageName, packageVersion).refine(dependencies => Object.keys(dependencies).length <= 80, 'Use at most 80 direct dependencies');
export const reactFileChangesSchema = z.record(reactFilePathSchema, z.string().max(500_000).nullable()).refine(files => Object.keys(files).length <= 200, 'Use at most 200 file changes');
export const reactDependencyChangesSchema = z.record(packageName, packageVersion.nullable()).refine(dependencies => Object.keys(dependencies).length <= 80, 'Use at most 80 dependency changes');
const jsonValue: z.ZodType<unknown> = z.lazy(() => z.union([z.string(), z.number().finite(), z.boolean(), z.null(), z.array(jsonValue), z.record(jsonValue)]));
export const reactBindingSchema = z.object({
  entry: reactFilePathSchema.refine(path => /\.[jt]sx?$/.test(path), 'A React entry must be a JS, JSX, TS or TSX module'),
  exportName: z.string().regex(/^[a-zA-Z_$][\w$]*$/).max(100),
  props: z.record(jsonValue).optional(),
}).strict();
export const reactProjectSchema = z.object({
  files: reactFilesSchema, dependencies: reactDependenciesSchema,
  entryPoints: z.array(reactFilePathSchema).max(200), exports: z.array(z.string().max(300)).max(1000),
  javascript: z.string().max(8_000_000), css: z.string().max(2_000_000),
}).strict();
export const reactNodes = (project: DesignProject): DesignNode[] => [...project.pages.flatMap(page => page.nodes), ...project.designSystem.components.flatMap(component => component.nodes)].filter(node => !!node.react);
export const reactExportKey = (binding: NonNullable<DesignNode['react']>): string => JSON.stringify([binding.entry, binding.exportName]);

export function updateReactFiles(current: ReactProject | undefined, files: Record<string, string | null>, dependencies?: Record<string, string | null>): ReactProject {
  const next: ReactProject = current ? { ...current, files: { ...current.files }, dependencies: { ...current.dependencies } } : { files: {}, dependencies: { react: '19.3.0', 'react-dom': '19.3.0' }, entryPoints: [], exports: [], javascript: '', css: '' };
  for (const [path, value] of Object.entries(files)) { if (value === null) delete next.files[path]; else next.files[path] = value; }
  for (const [name, value] of Object.entries(dependencies ?? {})) { if (value === null) delete next.dependencies[name]; else next.dependencies[name] = value; }
  reactFilesSchema.parse(next.files); reactDependenciesSchema.parse(next.dependencies);
  if (!next.dependencies.react || !next.dependencies['react-dom']) throw new Error('React applications require react and react-dom dependencies.');
  return next;
}
