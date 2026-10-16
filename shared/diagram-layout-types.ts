import type { Operation } from './types';
export interface DiagramLayoutResult { frameId:string; revision:number; operations:Operation[]; metrics:{beforeCrossings:number;afterCrossings:number;durationMs:number;movedNodes:number}; warnings:string[] }
