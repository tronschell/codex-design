export const DIAGRAM_KINDS = ['architecture','data','flowchart','journey','roadmap','venn','class','component','deployment','object','package','profile','composite','use-case','activity','state-machine','sequence','communication','interaction-overview','timing'] as const;
export type DiagramKind = typeof DIAGRAM_KINDS[number];
export interface DiagramConfig { kind: DiagramKind; autoPlace: boolean; direction: 'RIGHT' | 'DOWN'; spacing: 'comfortable' | 'compact' }
export interface DiagramElement { kind: string; pinned?: boolean; subtitle?: string; stereotype?: string; rows?: string[]; operations?: string[]; start?: string; end?: string; lane?: string; order?: number; color?: string }
export type DiagramPort = 'auto' | 'n25' | 'n50' | 'n75' | 'e25' | 'e50' | 'e75' | 's25' | 's50' | 's75' | 'w25' | 'w50' | 'w75';
export interface DiagramEndpoint { nodeId: string; port: DiagramPort }
export type RelationKind = 'association' | 'dependency' | 'realization' | 'generalization' | 'aggregation' | 'composition' | 'flow' | 'message' | 'reply' | 'include' | 'extend' | 'transition' | 'one-many' | 'assembly' | 'extension';
export interface Point { x: number; y: number }
export interface DiagramEdge { from: DiagramEndpoint; to: DiagramEndpoint; kind: RelationKind; label?: string; startLabel?: string; endLabel?: string; route: 'orthogonal' | 'straight' | 'curved'; waypoints?: Point[]; locked?: boolean; sequence?: number }
export const RELATION_KINDS: readonly RelationKind[] = ['association','dependency','realization','generalization','aggregation','composition','flow','message','reply','include','extend','transition','one-many','assembly','extension'];
