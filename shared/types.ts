export type NodeType = 'frame' | 'text' | 'rectangle' | 'ellipse' | 'line' | 'arrow' | 'code' | 'image' | 'video' | 'shader';

export interface MediaConfig {
  src: string;
  fit?: 'cover' | 'contain' | 'fill';
  alt?: string;
  poster?: string;
  autoplay?: boolean;
  loop?: boolean;
  muted?: boolean;
}

export interface ShaderConfig {
  preset: 'mesh' | 'waves' | 'grain' | 'custom';
  colors?: string[];
  speed?: number;
  scale?: number;
  seed?: number;
  animate?: boolean;
  fragment?: string;
}

export interface ShadowEffect {
  id: string;
  type: 'drop-shadow' | 'inner-shadow' | 'text-shadow';
  enabled?: boolean;
  x: number;
  y: number;
  blur: number;
  spread: number;
  color: string;
  opacity: number;
}

export interface BlurEffect {
  id: string;
  type: 'layer-blur' | 'background-blur';
  enabled?: boolean;
  radius: number;
}

export interface TransformEffect {
  id: string;
  type: 'transform';
  enabled?: boolean;
  rotate: number;
  scaleX: number;
  scaleY: number;
  skewX: number;
  skewY: number;
  translateX: number;
  translateY: number;
}

export type NodeEffect = ShadowEffect | BlurEffect | TransformEffect;

export interface GradientStop {
  id: string;
  color: string;
  position: number;
  opacity: number;
}

export interface GradientFill {
  type: 'linear' | 'radial';
  angle: number;
  interpolation: 'srgb' | 'oklab';
  stops: GradientStop[];
}

export interface NodeStyle {
  fill?: string;
  fillMode?: 'solid' | 'gradient' | 'none';
  fillOpacity?: number;
  gradient?: GradientFill;
  color?: string;
  fontSize?: number;
  fontWeight?: number;
  fontStyle?: 'normal' | 'italic';
  fontFamily?: string;
  lineHeight?: number;
  letterSpacing?: number;
  shadow?: string;
  radius?: number;
  radiusMode?: 'uniform' | 'individual';
  cornerRadii?: { topLeft: number; topRight: number; bottomRight: number; bottomLeft: number };
  opacity?: number;
  blendMode?: 'normal' | 'multiply' | 'screen' | 'overlay' | 'darken' | 'lighten' | 'color-dodge' | 'color-burn' | 'hard-light' | 'soft-light' | 'difference' | 'exclusion' | 'hue' | 'saturation' | 'color' | 'luminosity' | 'plus-darker' | 'plus-lighter';
  borderColor?: string;
  borderWidth?: number;
  outlineColor?: string;
  outlineWidth?: number;
  outlineOffset?: number;
  textAlign?: 'left' | 'center' | 'right';
  listStyleType?: 'none' | 'disc' | 'decimal';
  layout?: 'free' | 'vertical' | 'horizontal';
  align?: 'start' | 'center' | 'end';
  justify?: 'start' | 'center' | 'end' | 'space-between';
  gap?: number;
  padding?: number;
  paddingX?: number;
  paddingY?: number;
  marginX?: number;
  marginY?: number;
  zIndex?: number | 'auto';
  overflow?: 'visible' | 'hidden' | 'clip' | 'scroll' | 'auto';
  overflowX?: 'visible' | 'hidden' | 'clip' | 'scroll' | 'auto';
  overflowY?: 'visible' | 'hidden' | 'clip' | 'scroll' | 'auto';
  cursor?: 'auto' | 'default' | 'none' | 'context-menu' | 'help' | 'pointer' | 'progress' | 'wait' | 'cell' | 'crosshair' | 'text' | 'vertical-text' | 'alias' | 'copy' | 'move' | 'no-drop' | 'not-allowed' | 'grab' | 'grabbing' | 'all-scroll' | 'col-resize' | 'row-resize' | 'n-resize' | 'e-resize' | 's-resize' | 'w-resize' | 'ne-resize' | 'nw-resize' | 'se-resize' | 'sw-resize' | 'ew-resize' | 'ns-resize' | 'nesw-resize' | 'nwse-resize' | 'zoom-in' | 'zoom-out';
  pointerEvents?: 'auto' | 'none';
  objectFit?: 'cover' | 'contain' | 'fill' | 'none' | 'scale-down';
  whiteSpace?: 'normal' | 'nowrap' | 'pre' | 'pre-wrap' | 'pre-line' | 'break-spaces';
  textOverflow?: 'clip' | 'ellipsis';
  textDecorationLine?: 'none' | 'underline' | 'overline' | 'line-through';
  textDecorationColor?: string;
  boxSizing?: 'border-box' | 'content-box';
  aspectRatio?: number | string;
  transition?: string;
  animation?: string;
}

export type BindableStyleProperty = 'fill' | 'color' | 'borderColor' | 'fontFamily' | 'fontSize' | 'fontWeight' | 'lineHeight' | 'letterSpacing' | 'gap' | 'padding' | 'radius' | 'borderWidth' | 'opacity' | 'shadow';
export type DesignSystemTokenKind = 'color' | 'fontFamily' | 'fontSize' | 'fontWeight' | 'lineHeight' | 'letterSpacing' | 'spacing' | 'radius' | 'borderWidth' | 'opacity' | 'shadow' | 'duration' | 'easing' | 'breakpoint' | 'zIndex';
export interface DesignSystemToken { id: string; name: string; kind: DesignSystemTokenKind; value: string | number; description?: string }
export interface DesignSystemSource { path: string; kind: 'design-md' | 'component' | 'stylesheet' | 'config' | 'canvas'; notes: string; confidence: 'observed' | 'inferred' }
export interface DesignSystemRequest { id: string; mode: 'generate' | 'find'; brief: string; repository: string; createdAt: string; queued: boolean }
export interface NativeComponentDefinition { id: string; name: string; description: string; rootNodeId: string; nodes: DesignNode[]; version: number; releaseLabel?: string }
export interface ComponentInstance { componentId: string; version: number; nodeMap: Record<string, string>; overrides: Record<string, string[]> }
export interface DesignSystem { name: string; description: string; documentation: string; tokens: DesignSystemToken[]; sources: DesignSystemSource[]; components: NativeComponentDefinition[]; request?: DesignSystemRequest }
export interface InspirationItem { id: string; name: string; assetRef: string; width: number; height: number; notes: string; usage: string; sourceUrl?: string }

export interface DesignNode {
  id: string;
  type: NodeType;
  name: string;
  parentId: string | null;
  x: number;
  y: number;
  width: number;
  height: number;
  content?: string;
  href?: string;
  source?: string;
  jsx?: { source: string; starters: string[]; deviceChrome?: 'safe-area' | 'device' };
  generation?: { status: 'building' | 'ready'; updatedAt?: string };
  media?: MediaConfig;
  shader?: ShaderConfig;
  effects?: NodeEffect[];
  styles: NodeStyle;
  tokenBindings?: Partial<Record<BindableStyleProperty, string>>;
  componentInstance?: ComponentInstance;
  locked?: boolean;
  hidden?: boolean;
}

export interface Viewport { x: number; y: number; zoom: number }
export interface DesignBoard { id: string; name: string; createdAt: string; updatedAt: string; inspiration?: InspirationItem[] }
export interface CanvasSelection { projectId: string; boardId: string; pageId?: string }
export interface DesignPage { id: string; boardId?: string; name: string; nodes: DesignNode[]; viewport: Viewport }
export interface CommentMessage { id: string; role: 'user' | 'assistant'; content: string; createdAt: string; intent?: 'generate_image' }
export interface CommentThread {
  id: string;
  pageId: string;
  nodeId: string | null;
  x: number;
  y: number;
  status: 'open' | 'resolved';
  queued: boolean;
  messages: CommentMessage[];
  createdAt: string;
}
export interface DesignTokens { accent: string; background: string; foreground: string; fontFamily: string; radius: number }
export interface DesignProject {
  id: string;
  name: string;
  description: string;
  revision: number;
  boards: DesignBoard[];
  pages: DesignPage[];
  threads: CommentThread[];
  designSystem: DesignSystem;
  tokens: DesignTokens;
  createdAt: string;
  updatedAt: string;
}
export type ProjectSummary = Pick<DesignProject, 'id' | 'name' | 'description' | 'revision' | 'createdAt' | 'updatedAt'> & { boardCount?: number; pageCount: number; screenCount: number };
export interface ProjectVersionSummary { revision: number; createdAt: string; label: string; restoredFrom?: number; library?: { system: boolean; componentIds: string[] } }
export interface ProjectVersion { project: DesignProject; version: ProjectVersionSummary }
export type LibraryScope = 'system' | 'component';
export interface LibraryVersion { designSystem: DesignSystem; version: ProjectVersionSummary; component?: NativeComponentDefinition }

export type Operation =
  | { type: 'rename_project'; name: string; description?: string }
  | { type: 'create_board'; board: Pick<DesignBoard, 'id' | 'name'> }
  | { type: 'update_board'; boardId: string; patch: Partial<Pick<DesignBoard, 'name'>> }
  | { type: 'delete_board'; boardId: string }
  | { type: 'create_page'; page: DesignPage }
  | { type: 'update_page'; pageId: string; patch: Partial<Pick<DesignPage, 'name' | 'viewport' | 'boardId'>> }
  | { type: 'replace_page'; pageId: string; page: DesignPage }
  | { type: 'delete_page'; pageId: string }
  | { type: 'create_node'; pageId: string; node: DesignNode }
  | { type: 'update_node'; pageId: string; nodeId: string; patch: Partial<Omit<DesignNode, 'id' | 'componentInstance'>> }
  | { type: 'delete_node'; pageId: string; nodeId: string }
  | { type: 'snap_node'; pageId: string; nodeId: string; distance?: number }
  | { type: 'create_thread'; thread: CommentThread }
  | { type: 'add_message'; threadId: string; message: CommentMessage; queued?: boolean }
  | { type: 'update_thread'; threadId: string; patch: Partial<Pick<CommentThread, 'status' | 'queued'>> }
  | { type: 'update_design_system'; patch: Partial<Pick<DesignSystem, 'name' | 'description' | 'documentation' | 'sources'>> }
  | { type: 'upsert_design_token'; token: DesignSystemToken }
  | { type: 'delete_design_token'; tokenId: string }
  | { type: 'set_design_system_request'; request: DesignSystemRequest | null }
  | { type: 'release_design_system'; label: string }
  | { type: 'capture_component'; pageId: string; nodeId: string; componentId: string; name: string; description?: string }
  | { type: 'instantiate_component'; componentId: string; pageId: string; nodeId: string; x: number; y: number; parentId?: string | null }
  | { type: 'release_component'; pageId: string; nodeId: string; componentId?: string; label?: string }
  | { type: 'update_component_instance'; pageId: string; nodeId: string; resetOverrides?: boolean }
  | { type: 'detach_component_instance'; pageId: string; nodeId: string }
  | { type: 'upsert_inspiration'; boardId: string; item: InspirationItem }
  | { type: 'delete_inspiration'; boardId: string; itemId: string }
  | { type: 'set_tokens'; tokens: Partial<DesignTokens> };

export const defaultTokens: DesignTokens = { accent: '#ff650b', background: '#0b0c0e', foreground: '#e8eaed', fontFamily: 'Inter, system-ui, sans-serif', radius: 16 };
