import { z } from 'zod';
import { isSafeLink } from './links.ts';
import { defaultTokens, type DesignProject, type Operation, type ProjectVersion } from './types.ts';
import { ASSET_MIME_TYPES, ASSET_REF_PATTERN, MAX_ASSET_BYTES, MAX_ASSET_CHUNK_BYTES } from './media.ts';
import { BINDABLE_STYLE_PROPERTIES, DESIGN_TOKEN_KINDS, LEGACY_TOKEN_IDS, compatibleTokenKinds, defaultDesignSystem } from './design-system.ts';
import { BOX_SIZING_VALUES, CURSOR_VALUES, OBJECT_FIT_VALUES, OVERFLOW_VALUES, POINTER_EVENTS_VALUES, TEXT_DECORATION_VALUES, TEXT_OVERFLOW_VALUES, WHITE_SPACE_VALUES, safeColor, safeCssText, safeEffectColor } from './effects.ts';
import { BLEND_MODES } from './appearance.ts';

export const MAX_INPUT_BYTES = 2 * 1024 * 1024;
export const idSchema = z.string().regex(/^[a-zA-Z0-9][a-zA-Z0-9_-]{0,127}$/, 'Use a safe ID containing letters, numbers, underscores or hyphens');
export const canvasSelectionSchema = z.object({ projectId: idSchema, boardId: idSchema, pageId: idSchema.optional() }).strict();
const nameSchema = z.string().trim().min(1).max(160);
const coordinate = z.number().finite().min(-10_000_000).max(10_000_000);
const dimension = z.number().finite().min(0).max(1_000_000);
const timestamp = z.string().datetime({ offset: true });
const color = z.string().max(500);

const safeFontFamily = (value: string) => safeCssText(value) && value.length <= 500 && value.split(',').every(family => /^(?:[\p{L}\p{N}_-][\p{L}\p{N}\s_-]*|"[\p{L}\p{N}\s_.,-]+"|'[\p{L}\p{N}\s_.,-]+')$/u.test(family.trim()));
const safeShadow = (value: string) => safeCssText(value) && /^(?:none|[\da-z\s#.,()%+\-/]+)$/i.test(value) && [...value.matchAll(/([a-z-]+)\s*\(/gi)].every(match => ['rgb', 'rgba', 'hsl', 'hsla', 'hwb', 'lab', 'lch', 'oklab', 'oklch', 'color'].includes(match[1].toLowerCase()));
const safeEasing = (value: string) => {
  if (['linear', 'ease', 'ease-in', 'ease-out', 'ease-in-out', 'step-start', 'step-end'].includes(value)) return true;
  const bezier = /^cubic-bezier\(\s*([+-]?(?:\d*\.)?\d+)\s*,\s*([+-]?(?:\d*\.)?\d+)\s*,\s*([+-]?(?:\d*\.)?\d+)\s*,\s*([+-]?(?:\d*\.)?\d+)\s*\)$/.exec(value);
  if (bezier) return bezier.slice(1).every(number => Number.isFinite(Number(number)) && Math.abs(Number(number)) <= 10_000) && Number(bezier[1]) >= 0 && Number(bezier[1]) <= 1 && Number(bezier[3]) >= 0 && Number(bezier[3]) <= 1;
  const steps = /^steps\(\s*(\d+)\s*(?:,\s*(start|end|jump-start|jump-end|jump-none|jump-both)\s*)?\)$/.exec(value);
  return !!steps && Number(steps[1]) >= (steps[2] === 'jump-none' ? 2 : 1) && Number(steps[1]) <= 10_000;
};

const safeMotion = (value: string) => {
  if (!safeCssText(value)) return false;
  let valid = true;
  const remaining = value.replace(/[a-z-]+\([^()]*\)/gi, match => { if (!safeEasing(match)) valid = false; return ''; });
  if (!valid || !/^[a-z\d\s.,%+_-]+$/i.test(remaining)) return false;
  return [...value.matchAll(/(?:^|[\s,])([+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?)(ms|s)(?=$|[\s,])/gi)].every(match => Number.isFinite(Number(match[1])) && Math.abs(Number(match[1]) * (match[2].toLowerCase() === 's' ? 1000 : 1)) <= 600_000);
};
const safeAspectRatio = (value: string) => {
  if (value === 'auto') return true;
  const ratio = /^(\d+(?:\.\d+)?|\.\d+)(?:\s*\/\s*(\d+(?:\.\d+)?|\.\d+))?$/.exec(value);
  if (!ratio) return false;
  const numerator = Number(ratio[1]), denominator = Number(ratio[2] ?? 1);
  return numerator > 0 && numerator <= 1_000_000 && denominator > 0 && denominator <= 1_000_000 && numerator / denominator <= 1_000_000;
};
const safeColorSchema = z.string().trim().min(1).max(500).refine(safeColor, 'Use a safe CSS color without aliases, URLs or declarations');
const effectOffset = z.number().finite().min(-100_000).max(100_000);
const effectBlur = z.number().finite().min(0).max(1000);
const effectBase = { id: idSchema, enabled: z.boolean().optional() };
const shadowFields = { ...effectBase, x: effectOffset, y: effectOffset, blur: effectBlur, spread: effectOffset, color: safeColorSchema.refine(safeEffectColor, 'Use a shadow color rather than a CSS-wide keyword'), opacity: z.number().finite().min(0).max(1) };
export const nodeEffectSchema = z.discriminatedUnion('type', [
  z.object({ ...shadowFields, type: z.literal('drop-shadow') }).strict(),
  z.object({ ...shadowFields, type: z.literal('inner-shadow') }).strict(),
  z.object({ ...shadowFields, type: z.literal('text-shadow'), spread: z.literal(0).describe('CSS text shadows do not support spread.') }).strict(),
  z.object({ ...effectBase, type: z.literal('layer-blur'), radius: effectBlur }).strict(),
  z.object({ ...effectBase, type: z.literal('background-blur'), radius: effectBlur }).strict(),
  z.object({
    ...effectBase, type: z.literal('transform'),
    rotate: z.number().finite().min(-3600).max(3600), scaleX: z.number().finite().min(-100).max(100), scaleY: z.number().finite().min(-100).max(100),
    skewX: z.number().finite().min(-89).max(89), skewY: z.number().finite().min(-89).max(89), translateX: effectOffset, translateY: effectOffset,
  }).strict(),
]);
export const nodeEffectsSchema = z.array(nodeEffectSchema).max(32).superRefine((effects, ctx) => {
  const ids = new Set<string>();
  effects.forEach((effect, index) => {
    if (ids.has(effect.id)) ctx.addIssue({ code: 'custom', message: `Duplicate effect ID: ${effect.id}`, path: [index, 'id'] });
    ids.add(effect.id);
  });
}).describe('Ordered editable effects with unique stable IDs within this node. Disabled entries are retained without rendering.');

export const designSystemTokenSchema = z.object({
  id: idSchema, name: nameSchema, kind: z.enum(DESIGN_TOKEN_KINDS),
  value: z.union([z.string().trim().min(1).max(2000), z.number().finite()]), description: z.string().max(5000).optional(),
}).strict().superRefine((token, ctx) => {
  const limits: Partial<Record<typeof token.kind, readonly [number, number]>> = { fontSize: [1, 1024], fontWeight: [1, 1000], lineHeight: [0.1, 10], letterSpacing: [-1000, 1000], spacing: [0, 100_000], radius: [0, 100_000], borderWidth: [0, 1000], opacity: [0, 1], duration: [0, 600_000], breakpoint: [0, 100_000], zIndex: [-2147483647, 2147483647] };
  const limit = limits[token.kind];
  const valid = limit ? typeof token.value === 'number' && token.value >= limit[0] && token.value <= limit[1] && (token.kind !== 'zIndex' || Number.isInteger(token.value))
    : typeof token.value === 'string' && ({ color: safeColor, fontFamily: safeFontFamily, shadow: safeShadow, easing: safeEasing } as Record<string, (value: string) => boolean>)[token.kind](token.value);
  if (!valid) ctx.addIssue({ code: 'custom', message: limit ? `Use a numeric ${token.kind} value between ${limit[0]} and ${limit[1]}${token.kind === 'zIndex' ? ' (an integer)' : ''}` : `Use a safe CSS ${token.kind} value without aliases, URLs or declarations`, path: ['value'] });
  const reserved = Object.entries(LEGACY_TOKEN_IDS).find(([, id]) => id === token.id)?.[0];
  const reservedKind = reserved === 'fontFamily' ? 'fontFamily' : reserved === 'radius' ? 'radius' : 'color';
  if (reserved && token.kind !== reservedKind) ctx.addIssue({ code: 'custom', message: `The compatibility token ${token.id} must keep kind ${reservedKind}`, path: ['kind'] });
});

export const designSystemSourceSchema = z.object({
  path: z.string().trim().min(1).max(2000).refine(value => !/[\x00-\x1f\x7f]/.test(value), 'Use a source path without control characters'),
  kind: z.enum(['design-md', 'component', 'stylesheet', 'config', 'canvas']), notes: z.string().max(5000), confidence: z.enum(['observed', 'inferred']),
}).strict();
export const designSystemRequestSchema = z.object({
  id: idSchema, mode: z.enum(['generate', 'find']), brief: z.string().trim().min(1).max(20_000), repository: z.string().max(2000), createdAt: timestamp, queued: z.boolean(),
}).strict();

export const assetRefSchema = z.string().regex(ASSET_REF_PATTERN, 'Use an uploaded asset:<SHA-256> media reference');
export const inspirationItemSchema = z.object({
  id: idSchema, name: nameSchema, assetRef: assetRefSchema,
  width: z.number().finite().positive().max(1_000_000), height: z.number().finite().positive().max(1_000_000),
  notes: z.string().max(5000), usage: z.string().max(5000),
  sourceUrl: z.string().max(2048).url().refine(value => /^https?:\/\//i.test(value), 'Use an HTTP or HTTPS source URL').optional(),
}).strict();
const assetNameSchema = z.string().trim().min(1).max(160).refine(name => !/[\\/\x00-\x1f\x7f]/.test(name) && name !== '.' && name !== '..', 'Use a file name without paths or control characters');
export const assetMetadataSchema = z.object({ ref: assetRefSchema, mimeType: z.enum(ASSET_MIME_TYPES), byteLength: z.number().int().min(1).max(MAX_ASSET_BYTES), name: assetNameSchema }).strict();
export const beginAssetUploadSchema = assetMetadataSchema.omit({ ref: true });
export const assetUploadIdSchema = z.string().uuid();
export const cancelAssetUploadSchema = z.object({ uploadId: assetUploadIdSchema }).strict();
export const assetUploadCancellationSchema = cancelAssetUploadSchema.extend({ cancelled: z.boolean() }).strict();
export const assetUploadSchema = z.object({ uploadId: assetUploadIdSchema, offset: z.number().int().min(0).max(MAX_ASSET_BYTES), byteLength: z.number().int().min(1).max(MAX_ASSET_BYTES), asset: assetMetadataSchema.optional() }).strict();
export const uploadAssetChunkSchema = z.object({
  uploadId: assetUploadIdSchema, offset: z.number().int().min(0).max(MAX_ASSET_BYTES),
  data: z.string().min(4).max(4 * Math.ceil(MAX_ASSET_CHUNK_BYTES / 3)).regex(/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/, 'Use canonical base64 bytes'),
}).strict();
export const readAssetChunkSchema = z.object({ ref: assetRefSchema, offset: z.number().int().min(0).max(MAX_ASSET_BYTES), byteLength: z.number().int().min(1).max(MAX_ASSET_CHUNK_BYTES).default(MAX_ASSET_CHUNK_BYTES) }).strict();
export const assetChunkSchema = z.object({ ref: assetRefSchema, offset: z.number().int().min(0).max(MAX_ASSET_BYTES), byteLength: z.number().int().min(0).max(MAX_ASSET_CHUNK_BYTES), totalBytes: z.number().int().min(1).max(MAX_ASSET_BYTES), data: z.string().max(4 * Math.ceil(MAX_ASSET_CHUNK_BYTES / 3)) }).strict();
export const mediaSchema = z.object({
  src: assetRefSchema, fit: z.enum(['cover', 'contain', 'fill']).optional(), alt: z.string().max(2000).optional(),
  poster: assetRefSchema.optional(), autoplay: z.boolean().optional(), loop: z.boolean().optional(), muted: z.boolean().optional(),
}).strict();
export const shaderSchema = z.object({
  preset: z.enum(['mesh', 'waves', 'grain', 'custom']),
  colors: z.array(z.string().regex(/^#(?:[a-fA-F0-9]{3}|[a-fA-F0-9]{4}|[a-fA-F0-9]{6}|[a-fA-F0-9]{8})$/, 'Use a hex RGB or RGBA color')).min(2).max(4).optional(),
  speed: z.number().finite().min(0).max(5).optional(), scale: z.number().finite().min(0.1).max(10).optional(),
  seed: z.number().finite().min(0).max(10_000).optional(), animate: z.boolean().optional(), fragment: z.string().max(30_000).optional(),
}).strict();

const gradientSchema = z.object({
  type: z.enum(['linear', 'radial']), angle: z.number().finite().min(-3600).max(3600), interpolation: z.enum(['srgb', 'oklab']),
  stops: z.array(z.object({
    id: idSchema, color: safeColorSchema.refine(safeEffectColor, 'Use a gradient color rather than a CSS-wide keyword'),
    position: z.number().finite().min(0).max(100), opacity: z.number().finite().min(0).max(1),
  }).strict()).min(2).max(12).superRefine((stops, ctx) => {
    const ids = new Set<string>();
    stops.forEach((stop, index) => {
      if (ids.has(stop.id)) ctx.addIssue({ code: 'custom', message: `Duplicate gradient stop ID: ${stop.id}`, path: [index, 'id'] });
      ids.add(stop.id);
    });
  }),
}).strict().describe('Editable native CSS gradient with unique stable stop IDs. Stored stop order is preserved; rendering sorts by percentage position. Angle is in degrees and applies to linear gradients. Color interpolation requires a modern browser.');
const cornerRadius = z.number().finite().min(0).max(100_000);

export const nodeStyleSchema = z.object({
  fill: color.optional(), color: color.optional(),
  fillMode: z.enum(['solid', 'gradient', 'none']).optional().describe('Absent means legacy solid fill. Gradient mode uses gradient; none hides fill without deleting saved colors or gradient settings.'),
  fillOpacity: z.number().finite().min(0).max(1).optional().describe('Solid box-fill opacity factor, default 1. Multiplies the authored color alpha without changing the saved color or token binding. Text and line colors retain their existing behavior.'),
  gradient: gradientSchema.optional(),
  fontSize: z.number().finite().min(1).max(1024).optional(),
  fontWeight: z.number().finite().min(1).max(1000).optional(),
  fontStyle: z.enum(['normal', 'italic']).optional(),
  fontFamily: z.string().max(500).optional(),
  lineHeight: z.number().finite().min(0.1).max(10).optional(),
  letterSpacing: z.number().finite().min(-1000).max(1000).optional(),
  shadow: z.string().max(2000).refine(safeShadow, 'Use a safe CSS shadow without aliases, URLs or declarations').optional(),
  radius: cornerRadius.optional(),
  radiusMode: z.enum(['uniform', 'individual']).optional(),
  cornerRadii: z.object({ topLeft: cornerRadius, topRight: cornerRadius, bottomRight: cornerRadius, bottomLeft: cornerRadius }).strict().optional().describe('Individual corners in pixels, active only in individual radius mode. Ellipses retain their circular shape.'),
  opacity: z.number().finite().min(0).max(1).optional(),
  blendMode: z.enum(BLEND_MODES).optional(),
  borderColor: color.optional(), borderWidth: z.number().finite().min(0).max(1000).optional(),
  outlineColor: safeColorSchema.optional(), outlineWidth: z.number().finite().min(0).max(1000).optional(), outlineOffset: effectOffset.optional(),
  textAlign: z.enum(['left', 'center', 'right']).optional(),
  listStyleType: z.enum(['none', 'disc', 'decimal']).optional().describe('Text nodes render each plain-text line as a native list item without changing content.'),
  layout: z.enum(['free', 'vertical', 'horizontal']).optional(),
  align: z.enum(['start', 'center', 'end']).optional().describe('Cross-axis alignment of visible children in a vertical or horizontal stack; defaults to start.'),
  justify: z.enum(['start', 'center', 'end', 'space-between']).optional().describe('Main-axis child placement in a stack. Space-between distributes spare room beyond the minimum gap. Fixed child sizes never shrink; overflow starts at padding.'),
  gap: z.number().finite().min(0).max(100_000).optional(),
  padding: z.number().finite().min(0).max(100_000).optional(),
  paddingX: z.number().finite().min(0).max(100_000).optional().describe('Horizontal inner padding, overriding padding. Explicit axis padding also applies to node content.'),
  paddingY: z.number().finite().min(0).max(100_000).optional().describe('Vertical inner padding, overriding padding. Explicit axis padding also applies to node content.'),
  marginX: z.number().finite().min(0).max(100_000).optional().describe('Symmetric horizontal margin used only when the parent is a stack; free-positioned geometry is unchanged.'),
  marginY: z.number().finite().min(0).max(100_000).optional().describe('Symmetric vertical margin used only when the parent is a stack; free-positioned geometry is unchanged.'),
  zIndex: z.union([z.number().int().min(-2147483647).max(2147483647), z.literal('auto')]).optional(),
  overflow: z.enum(OVERFLOW_VALUES).optional(), overflowX: z.enum(OVERFLOW_VALUES).optional(), overflowY: z.enum(OVERFLOW_VALUES).optional(),
  cursor: z.enum(CURSOR_VALUES).optional(), pointerEvents: z.enum(POINTER_EVENTS_VALUES).optional(),
  objectFit: z.enum(OBJECT_FIT_VALUES).optional(), whiteSpace: z.enum(WHITE_SPACE_VALUES).optional(), textOverflow: z.enum(TEXT_OVERFLOW_VALUES).optional(),
  textDecorationLine: z.enum(TEXT_DECORATION_VALUES).optional(), textDecorationColor: safeColorSchema.optional(), boxSizing: z.enum(BOX_SIZING_VALUES).optional(),
  aspectRatio: z.union([z.number().finite().positive().max(1_000_000), z.string().trim().min(1).max(100).refine(safeAspectRatio, 'Use auto, a positive number or a positive width / height ratio')]).optional(),
  transition: z.string().trim().min(1).max(2000).refine(safeMotion, 'Use safe CSS transitions without URLs or declarations; times are limited to 600 seconds').optional(),
  animation: z.string().trim().min(1).max(2000).refine(safeMotion, 'Use safe CSS animation without URLs or declarations; times are limited to 600 seconds').optional(),
}).strict();

export const tokenBindingsSchema = z.object(Object.fromEntries(BINDABLE_STYLE_PROPERTIES.map(property => [property, idSchema.optional()])) as Record<typeof BINDABLE_STYLE_PROPERTIES[number], z.ZodOptional<typeof idSchema>>).strict();

const componentOverrideProperties = ['type', 'name', 'x', 'y', 'width', 'height', 'content', 'href', 'source', 'jsx', 'media', 'shader', 'effects', 'locked', 'hidden'];
const componentOverridePathSchema = z.string().max(100).refine(value => componentOverrideProperties.includes(value) || (value.startsWith('styles.') && Object.hasOwn(nodeStyleSchema.shape, value.slice(7))) || (value.startsWith('tokenBindings.') && (BINDABLE_STYLE_PROPERTIES as readonly string[]).includes(value.slice(14))), 'Use an editable node property or an individual styles/tokenBindings property');
export const componentInstanceSchema = z.object({
  componentId: idSchema, version: z.number().int().min(0).max(Number.MAX_SAFE_INTEGER),
  nodeMap: z.record(idSchema, idSchema), overrides: z.record(idSchema, z.array(componentOverridePathSchema).max(100)),
}).strict().superRefine((instance, ctx) => {
  if (Object.keys(instance.nodeMap).length < 1 || Object.keys(instance.nodeMap).length > 5000) ctx.addIssue({ code: 'custom', message: 'A linked instance must map 1–5000 definition nodes', path: ['nodeMap'] });
  if (new Set(Object.values(instance.nodeMap)).size !== Object.keys(instance.nodeMap).length) ctx.addIssue({ code: 'custom', message: 'Instance node IDs must be unique', path: ['nodeMap'] });
  if (Object.keys(instance.overrides).some(id => !Object.hasOwn(instance.nodeMap, id))) ctx.addIssue({ code: 'custom', message: 'Overrides must reference mapped definition nodes', path: ['overrides'] });
});

export const nodeSchema = z.object({
  id: idSchema, type: z.enum(['frame', 'text', 'rectangle', 'ellipse', 'line', 'arrow', 'code', 'image', 'video', 'shader']),
  name: nameSchema, parentId: idSchema.nullable(),
  x: coordinate, y: coordinate, width: dimension, height: dimension,
  href: z.string().trim().max(2048).refine(isSafeLink, 'Use an HTTP(S), mailto:, tel: or # link; an empty string removes the link').optional(),
  content: z.string().max(100_000).optional(), source: z.string().max(500_000).optional(),
  jsx: z.object({ source: z.string().max(100_000), starters: z.array(z.enum(['ios-frame', 'android-frame', 'macos-window', 'browser-window'])).max(4), deviceChrome: z.enum(['safe-area', 'device']).optional() }).strict().optional(),
  generation: z.object({ status: z.enum(['building', 'ready']), updatedAt: timestamp.optional() }).strict().optional().describe('Frames being generated use building, then ready when complete. The store timestamps actual saved work; editor-only loading chrome never changes authored styles.'),
  media: mediaSchema.optional(), shader: shaderSchema.optional(), effects: nodeEffectsSchema.optional(),
  styles: nodeStyleSchema, tokenBindings: tokenBindingsSchema.optional(), componentInstance: componentInstanceSchema.optional(), locked: z.boolean().optional(), hidden: z.boolean().optional(),
}).strict();

export const nativeComponentDefinitionSchema = z.object({
  id: idSchema, name: nameSchema, description: z.string().max(5000), rootNodeId: idSchema,
  nodes: z.array(nodeSchema).min(1).max(5000), version: z.number().int().min(0).max(Number.MAX_SAFE_INTEGER), releaseLabel: nameSchema.optional(),
}).strict().superRefine((component, ctx) => {
  const nodes = new Map(component.nodes.map(node => [node.id, node]));
  if (nodes.size !== component.nodes.length) ctx.addIssue({ code: 'custom', message: 'Component node IDs must be unique', path: ['nodes'] });
  const root = nodes.get(component.rootNodeId);
  if (!root || root.parentId !== null || root.x !== 0 || root.y !== 0) ctx.addIssue({ code: 'custom', message: 'A component needs one root at local position 0, 0', path: ['rootNodeId'] });
  const complete = new Set<string>([component.rootNodeId]);
  component.nodes.forEach((node, index) => {
    if (node.componentInstance) ctx.addIssue({ code: 'custom', message: 'Nested linked components must be detached before capture', path: ['nodes', index] });
    const seen = new Set<string>();
    let current: typeof node | undefined = node;
    while (current && !complete.has(current.id) && !seen.has(current.id)) { seen.add(current.id); current = current.parentId === null ? undefined : nodes.get(current.parentId); }
    if (!current || seen.has(current.id)) ctx.addIssue({ code: 'custom', message: 'Every component node must descend from its root without cycles', path: ['nodes', index, 'parentId'] });
    else seen.forEach(id => complete.add(id));
  });
});

export const designSystemSchema = z.object({
  name: nameSchema, description: z.string().max(5000), documentation: z.string().max(100_000),
  tokens: z.array(designSystemTokenSchema).max(1000), sources: z.array(designSystemSourceSchema).max(1000), components: z.array(nativeComponentDefinitionSchema).max(200).default([]), request: designSystemRequestSchema.optional(),
}).strict().superRefine((system, ctx) => {
  const componentIds = new Set<string>(), componentNames = new Set<string>();
  system.components.forEach((component, index) => {
    if (componentIds.has(component.id)) ctx.addIssue({ code: 'custom', message: `Duplicate component ID: ${component.id}`, path: ['components', index, 'id'] });
    if (componentNames.has(component.name.toLowerCase())) ctx.addIssue({ code: 'custom', message: `Duplicate component name: ${component.name}`, path: ['components', index, 'name'] });
    componentIds.add(component.id); componentNames.add(component.name.toLowerCase());
    for (const node of component.nodes) for (const [property, tokenId] of Object.entries(node.tokenBindings ?? {})) {
      const token = system.tokens.find(item => item.id === tokenId);
      if (!token || !compatibleTokenKinds(property as typeof BINDABLE_STYLE_PROPERTIES[number]).includes(token.kind)) ctx.addIssue({ code: 'custom', message: `Component ${component.name} has an invalid ${property} token binding`, path: ['components', index, 'nodes'] });
    }
  });
  const ids = new Set<string>(), names = new Set<string>();
  system.tokens.forEach((token, index) => {
    if (ids.has(token.id)) ctx.addIssue({ code: 'custom', message: `Duplicate token ID: ${token.id}`, path: ['tokens', index, 'id'] });
    if (names.has(token.name.toLowerCase())) ctx.addIssue({ code: 'custom', message: `Duplicate token name: ${token.name}`, path: ['tokens', index, 'name'] });
    ids.add(token.id); names.add(token.name.toLowerCase());
  });
});

export const viewportSchema = z.object({
  x: coordinate, y: coordinate, zoom: z.number().finite().min(0.02).max(16),
}).strict();
export const boardInputSchema = z.object({ id: idSchema, name: nameSchema }).strict();
export const boardSchema = boardInputSchema.extend({ createdAt: timestamp, updatedAt: timestamp, inspiration: z.array(inspirationItemSchema).max(100).optional() });
export const pageSchema = z.object({
  id: idSchema, boardId: idSchema.optional(), name: nameSchema, nodes: z.array(nodeSchema).max(5000), viewport: viewportSchema,
}).strict();
export const messageSchema = z.object({
  id: idSchema, role: z.enum(['user', 'assistant']), content: z.string().trim().min(1).max(20_000), createdAt: timestamp,
  intent: z.literal('generate_image').optional(),
}).strict();
export const threadSchema = z.object({
  id: idSchema, pageId: idSchema, nodeId: idSchema.nullable(), x: coordinate, y: coordinate,
  status: z.enum(['open', 'resolved']), queued: z.boolean(),
  messages: z.array(messageSchema).min(1).max(1000), createdAt: timestamp,
}).strict();
export const tokensSchema = z.object({
  accent: color, background: color, foreground: color, fontFamily: z.string().min(1).max(500),
  radius: z.number().finite().min(0).max(100_000),
}).strict();

const isRecord = (input: unknown): input is Record<string, unknown> => typeof input === 'object' && input !== null && !Array.isArray(input);

export function normalizeLegacyProject(input: unknown): unknown {
  if (!isRecord(input)) return input;
  let boards = input.boards;
  if (boards === undefined) {
    const ids = new Set<unknown>([input.id]);
    if (Array.isArray(input.pages)) for (const page of input.pages) {
      if (!isRecord(page)) continue;
      ids.add(page.id);
      if (Array.isArray(page.nodes)) for (const node of page.nodes) if (isRecord(node)) ids.add(node.id);
    }
    if (Array.isArray(input.threads)) for (const thread of input.threads) {
      if (!isRecord(thread)) continue;
      ids.add(thread.id);
      if (Array.isArray(thread.messages)) for (const message of thread.messages) if (isRecord(message)) ids.add(message.id);
    }
    let id = 'board-main';
    for (let suffix = 2; ids.has(id); suffix++) id = `board-main-${suffix}`;
    boards = [{ id, name: 'Main board', createdAt: input.createdAt, updatedAt: input.updatedAt }];
  }
  const firstBoard = Array.isArray(boards) && isRecord(boards[0]) ? boards[0].id : undefined;
  const legacyTokens = input.designSystem === undefined ? tokensSchema.safeParse(input.tokens) : undefined;
  const migratedSystem = legacyTokens?.success ? defaultDesignSystem(legacyTokens.data) : undefined;
  if (migratedSystem) migratedSystem.tokens = migratedSystem.tokens.filter(token => designSystemTokenSchema.safeParse(token).success);
  let tokens = input.tokens;
  if (isRecord(input.designSystem) && Array.isArray(input.designSystem.tokens)) {
    const mirrored = isRecord(tokens) ? { ...tokens } : tokens === undefined ? { ...defaultTokens } : undefined;
    if (mirrored) {
      for (const [key, id] of Object.entries(LEGACY_TOKEN_IDS)) {
        const token = input.designSystem.tokens.find(item => isRecord(item) && item.id === id);
        if (isRecord(token) && typeof token.value === (key === 'radius' ? 'number' : 'string')) Object.assign(mirrored, { [key]: token.value });
      }
      tokens = mirrored;
    }
  }
  return {
    ...input, boards, tokens,
    // Old token strings were intentionally permissive. Keep their literal mirror intact,
    // but only expose safe, typed values as CSS variables in a newly normalized system.
    designSystem: migratedSystem ?? input.designSystem,
    pages: Array.isArray(input.pages) ? input.pages.map((page) => isRecord(page) && page.boardId === undefined ? { ...page, boardId: firstBoard } : page) : input.pages,
  };
}

const resolvedProjectSchema = z.object({
  id: idSchema, name: nameSchema, description: z.string().max(5000),
  revision: z.number().int().min(0).max(Number.MAX_SAFE_INTEGER),
  boards: z.array(boardSchema).min(1).max(100),
  pages: z.array(pageSchema.extend({ boardId: idSchema })).min(1).max(100), threads: z.array(threadSchema).max(2000),
  tokens: tokensSchema, designSystem: designSystemSchema, createdAt: timestamp, updatedAt: timestamp,
}).strict().superRefine((project, ctx) => {
  const ids = new Set<string>([project.id]);
  const addId = (id: string, path: (string | number)[]) => {
    if (ids.has(id)) ctx.addIssue({ code: 'custom', message: `Duplicate ID: ${id}`, path });
    ids.add(id);
  };
  const boards = new Map(project.boards.map((board) => [board.id, board]));
  const boardPageCounts = new Map<string, number>();
  project.boards.forEach((board, boardIndex) => {
    addId(board.id, ['boards', boardIndex, 'id']);
    board.inspiration?.forEach((item, itemIndex) => addId(item.id, ['boards', boardIndex, 'inspiration', itemIndex, 'id']));
  });
  if (project.designSystem.request) addId(project.designSystem.request.id, ['designSystem', 'request', 'id']);
  const tokens = new Map(project.designSystem.tokens.map(token => [token.id, token]));
  const components = new Map(project.designSystem.components.map(component => [component.id, component]));
  project.designSystem.components.forEach((component, index) => {
    if (component.version > project.revision) ctx.addIssue({ code: 'custom', message: 'A component release cannot reference a future project revision', path: ['designSystem', 'components', index, 'version'] });
  });
  const pages = new Map(project.pages.map((page) => [page.id, page]));
  let nodeCount = 0;
  project.pages.forEach((page, pageIndex) => {
    addId(page.id, ['pages', pageIndex, 'id']);
    if (!boards.has(page.boardId)) ctx.addIssue({ code: 'custom', message: 'Page board does not exist', path: ['pages', pageIndex, 'boardId'] });
    boardPageCounts.set(page.boardId, (boardPageCounts.get(page.boardId) ?? 0) + 1);
    nodeCount += page.nodes.length;
    const nodes = new Map(page.nodes.map((node) => [node.id, node]));
    const complete = new Set<string>();
    page.nodes.forEach((node, nodeIndex) => {
      addId(node.id, ['pages', pageIndex, 'nodes', nodeIndex, 'id']);
      for (const [property, tokenId] of Object.entries(node.tokenBindings ?? {})) {
        const token = tokenId === undefined ? undefined : tokens.get(tokenId);
        if (!token) ctx.addIssue({ code: 'custom', message: `Bound token ${tokenId} does not exist`, path: ['pages', pageIndex, 'nodes', nodeIndex, 'tokenBindings', property] });
        else if (!compatibleTokenKinds(property as typeof BINDABLE_STYLE_PROPERTIES[number]).includes(token.kind)) ctx.addIssue({ code: 'custom', message: `Token ${tokenId} of kind ${token.kind} cannot bind ${property}`, path: ['pages', pageIndex, 'nodes', nodeIndex, 'tokenBindings', property] });
      }
      if (node.parentId !== null && !nodes.has(node.parentId)) {
        ctx.addIssue({ code: 'custom', message: `Parent ${node.parentId} does not exist on this page`, path: ['pages', pageIndex, 'nodes', nodeIndex, 'parentId'] });
      }
      const path = new Set<string>();
      let current: typeof node | undefined = node;
      while (current && !complete.has(current.id)) {
        if (path.has(current.id)) {
          ctx.addIssue({ code: 'custom', message: `Parent cycle involving ${current.id}`, path: ['pages', pageIndex, 'nodes', nodeIndex, 'parentId'] });
          break;
        }
        path.add(current.id);
        current = current.parentId === null ? undefined : nodes.get(current.parentId);
      }
      path.forEach((id) => complete.add(id));
    });
    const owners = new Set<string>();
    page.nodes.forEach((root, nodeIndex) => {
      const instance = root.componentInstance;
      if (!instance) return;
      const location = ['pages', pageIndex, 'nodes', nodeIndex, 'componentInstance'];
      const definition = components.get(instance.componentId);
      if (!definition) ctx.addIssue({ code: 'custom', message: 'The linked component definition does not exist in this project', path: [...location, 'componentId'] });
      if (instance.version > project.revision) ctx.addIssue({ code: 'custom', message: 'An instance cannot reference a future project revision', path: [...location, 'version'] });
      if (definition && (!Object.hasOwn(instance.nodeMap, definition.rootNodeId) || instance.nodeMap[definition.rootNodeId] !== root.id)) ctx.addIssue({ code: 'custom', message: 'The instance root must map the component definition root', path: [...location, 'nodeMap'] });
      const mapped = new Set(Object.values(instance.nodeMap));
      for (const id of mapped) {
        const node = nodes.get(id);
        if (!node || owners.has(id)) { ctx.addIssue({ code: 'custom', message: 'Instance members must exist on this page and belong to one instance', path: [...location, 'nodeMap'] }); continue; }
        owners.add(id);
        if (id !== root.id && (!node.parentId || !mapped.has(node.parentId) || node.componentInstance)) ctx.addIssue({ code: 'custom', message: 'Every mapped member must remain inside its instance; nested instances are unsupported', path: [...location, 'nodeMap'] });
      }
      if (page.nodes.some(node => node.parentId && mapped.has(node.parentId) && !mapped.has(node.id))) ctx.addIssue({ code: 'custom', message: 'Detach the instance before adding unlinked children', path: [...location, 'nodeMap'] });
      if (definition && instance.version === definition.version && (definition.nodes.length !== mapped.size || definition.nodes.some(node => !Object.hasOwn(instance.nodeMap, node.id)))) ctx.addIssue({ code: 'custom', message: 'An instance must map all nodes in its linked component release', path: [...location, 'nodeMap'] });
    });
  });
  project.boards.forEach((board, boardIndex) => {
    if (!boardPageCounts.get(board.id)) ctx.addIssue({ code: 'custom', message: 'Each board must keep at least one page', path: ['boards', boardIndex] });
  });
  if (nodeCount > 20_000) ctx.addIssue({ code: 'custom', message: 'A project may contain at most 20,000 nodes', path: ['pages'] });
  project.threads.forEach((thread, threadIndex) => {
    addId(thread.id, ['threads', threadIndex, 'id']);
    const page = pages.get(thread.pageId);
    if (!page) ctx.addIssue({ code: 'custom', message: 'Comment page does not exist', path: ['threads', threadIndex, 'pageId'] });
    if (thread.nodeId !== null && !page?.nodes.some((node) => node.id === thread.nodeId)) {
      ctx.addIssue({ code: 'custom', message: 'Comment anchor does not exist on its page', path: ['threads', threadIndex, 'nodeId'] });
    }
    thread.messages.forEach((message, messageIndex) => addId(message.id, ['threads', threadIndex, 'messages', messageIndex, 'id']));
  });
});
export const projectSchema: z.ZodType<DesignProject, z.ZodTypeDef, unknown> = z.preprocess(normalizeLegacyProject, resolvedProjectSchema);

const nonempty = <T extends z.ZodRawShape>(shape: T) => z.object(shape).strict().partial().refine((value) => Object.values(value).some((field) => field !== undefined), 'Provide at least one field');

export const operationSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('rename_project'), name: nameSchema, description: z.string().max(5000).optional() }).strict(),
  z.object({ type: z.literal('create_board'), board: boardInputSchema }).strict(),
  z.object({ type: z.literal('update_board'), boardId: idSchema, patch: nonempty({ name: nameSchema }) }).strict(),
  z.object({ type: z.literal('delete_board'), boardId: idSchema }).strict(),
  z.object({ type: z.literal('create_page'), page: pageSchema }).strict(),
  z.object({ type: z.literal('update_page'), pageId: idSchema, patch: nonempty({ name: nameSchema, viewport: viewportSchema, boardId: idSchema }) }).strict(),
  z.object({ type: z.literal('replace_page'), pageId: idSchema, page: pageSchema }).strict(),
  z.object({ type: z.literal('delete_page'), pageId: idSchema }).strict(),
  z.object({ type: z.literal('create_node'), pageId: idSchema, node: nodeSchema }).strict(),
  z.object({ type: z.literal('update_node'), pageId: idSchema, nodeId: idSchema, patch: nonempty(nodeSchema.omit({ id: true, componentInstance: true }).shape) }).strict(),
  z.object({ type: z.literal('delete_node'), pageId: idSchema, nodeId: idSchema }).strict(),
  z.object({ type: z.literal('snap_node'), pageId: idSchema, nodeId: idSchema, distance: z.number().finite().min(0).max(100).default(8).describe('Maximum snapping distance in design units; defaults to 8. Snaps visible free-positioned unlocked nodes to parent content, siblings, other roots or canvas origin.') }).strict(),
  z.object({ type: z.literal('create_thread'), thread: threadSchema }).strict(),
  z.object({ type: z.literal('add_message'), threadId: idSchema, message: messageSchema, queued: z.boolean().optional() }).strict(),
  z.object({ type: z.literal('update_thread'), threadId: idSchema, patch: nonempty({ status: z.enum(['open', 'resolved']), queued: z.boolean() }) }).strict(),
  z.object({ type: z.literal('set_tokens'), tokens: nonempty(tokensSchema.shape) }).strict(),
  z.object({ type: z.literal('update_design_system'), patch: nonempty({ name: nameSchema, description: z.string().max(5000), documentation: z.string().max(100_000), sources: z.array(designSystemSourceSchema).max(1000) }) }).strict(),
  z.object({ type: z.literal('apply_design_system_document'), markdown: z.string().min(1).max(MAX_INPUT_BYTES) }).strict(),
  z.object({ type: z.literal('upsert_design_token'), token: designSystemTokenSchema }).strict(),
  z.object({ type: z.literal('delete_design_token'), tokenId: idSchema }).strict(),
  z.object({ type: z.literal('set_design_system_request'), request: designSystemRequestSchema.nullable() }).strict(),
  z.object({ type: z.literal('release_design_system'), label: nameSchema }).strict(),
  z.object({ type: z.literal('capture_component'), pageId: idSchema, nodeId: idSchema, componentId: idSchema, name: nameSchema, description: z.string().max(5000).optional() }).strict(),
  z.object({ type: z.literal('instantiate_component'), componentId: idSchema, pageId: idSchema, nodeId: idSchema, x: coordinate, y: coordinate, parentId: idSchema.nullable().optional() }).strict(),
  z.object({ type: z.literal('release_component'), pageId: idSchema, nodeId: idSchema, componentId: idSchema.optional(), label: nameSchema.optional() }).strict(),
  z.object({ type: z.literal('update_component_instance'), pageId: idSchema, nodeId: idSchema, resetOverrides: z.boolean().optional() }).strict(),
  z.object({ type: z.literal('detach_component_instance'), pageId: idSchema, nodeId: idSchema }).strict(),
  z.object({ type: z.literal('upsert_inspiration'), boardId: idSchema, item: inspirationItemSchema }).strict(),
  z.object({ type: z.literal('delete_inspiration'), boardId: idSchema, itemId: idSchema }).strict(),
]);
export const operationsSchema: z.ZodType<Operation[]> = z.array(operationSchema).min(1).max(2000);
export const revisionSchema = z.number().int().min(0).max(Number.MAX_SAFE_INTEGER);
export const projectVersionSummarySchema = z.object({ revision: revisionSchema, createdAt: timestamp, label: z.string().trim().min(1).max(500), restoredFrom: revisionSchema.optional(), library: z.object({ system: z.boolean(), componentIds: z.array(idSchema).max(200) }).strict().optional() }).strict();
export const projectVersionSchema: z.ZodType<ProjectVersion, z.ZodTypeDef, unknown> = z.object({ project: projectSchema, version: projectVersionSummarySchema }).strict().superRefine(({ project, version }, ctx) => {
  if (project.revision !== version.revision) ctx.addIssue({ code: 'custom', message: 'Version revision does not match its project snapshot', path: ['version', 'revision'] });
});
export const restoreProjectVersionSchema = z.object({ expectedRevision: revisionSchema, revision: revisionSchema }).strict();
export const libraryScopeSchema = z.enum(['system', 'component']);
export const libraryVersionRequestSchema = z.object({ scope: libraryScopeSchema, componentId: idSchema.optional() }).strict().superRefine((input, ctx) => {
  if ((input.scope === 'component') !== (input.componentId !== undefined)) ctx.addIssue({ code: 'custom', message: 'Supply componentId only for component history', path: ['componentId'] });
});
export const libraryVersionSchema = z.object({ designSystem: designSystemSchema, version: projectVersionSummarySchema, component: nativeComponentDefinitionSchema.optional() }).strict();
export const restoreLibraryVersionSchema = z.object({ expectedRevision: revisionSchema, revision: revisionSchema, scope: libraryScopeSchema, componentId: idSchema.optional() }).strict().refine(input => (input.scope === 'component') === (input.componentId !== undefined), 'Supply componentId only for component history');
export const createProjectSchema = z.object({ name: nameSchema, template: z.enum(['blank', 'demo']).default('blank') }).strict();
export const mutateProjectSchema = z.object({ expectedRevision: revisionSchema, operations: operationsSchema }).strict();
export const canvasMapSettingsSchema = z.object({
  background: z.union([z.enum(['transparent', 'white', 'dark']), z.string().refine((value): value is `#${string}` => /^#(?:[\da-f]{3}|[\da-f]{4}|[\da-f]{6}|[\da-f]{8})$/i.test(value), 'Use a hexadecimal background color')]).optional(),
  scale: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4)]).optional(), labels: z.boolean().optional(), margin: z.number().finite().min(0).max(1000).optional(),
}).strict();
