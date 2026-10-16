import type { NodeStyle } from './types';
export type StateValue = string | boolean | number;
export type StateValues = Record<string, StateValue>;
export type StateCondition = { key: string; eq: StateValue } | { key: string; in: StateValue[] } | { all: StateCondition[] } | { any: StateCondition[] };
export interface StateVariable { id: string; name: string; type: 'enum' | 'boolean' | 'number' | 'string'; default: StateValue; options?: string[]; min?: number; max?: number }
export interface StateScenario { id: string; name: string; values: StateValues }
export interface ApplicationStateContext { name: string; variables: StateVariable[]; scenarios: StateScenario[]; constraints?: { id: string; message: string; forbidden: StateCondition }[] }
export interface StateBinding { contextNodeId: string; inputs?: StateValues }
export interface StatePropertyPatch { content?: string; name?: string; hidden?: boolean; x?: number; y?: number; width?: number; height?: number; styles?: Pick<NodeStyle, 'fill' | 'color' | 'borderColor' | 'opacity' | 'fontSize' | 'fontWeight' | 'radius'> }
export interface StateRule { id: string; name: string; enabled: boolean; priority: number; when: StateCondition; effects: { targetNodeId: string; set: StatePropertyPatch }[] }
export interface JourneyTransition { targetNodeId: string; label?: string; when?: StateCondition; set?: StateValues }
export interface StatePreview { frameId: string; scenarioId?: string; values: StateValues; compareScenarioId?: string; baselineValues?: StateValues; highlight: boolean }
