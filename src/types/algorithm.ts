import type { Cell, Coordinate } from "./grid";

export type StepType =
  | "visit"
  | "enqueue"
  | "path"
  | "backtrack"
  | "fail";

export interface AlgorithmStep {
  type: StepType;
  node?: Coordinate;
  nodes?: Coordinate[];
  wave?: number;
  stepNumber?: number;
}

export interface AlgorithmResult {
  found: boolean;
  path: Coordinate[];
  visitedCount: number;
  terminated: boolean;
  message?: string;
  metricValue?: number;
}

export interface AlgorithmPlugin {
  id: string;
  label: string;
  family: string;
  description: string;
  behaviorNote: string;
  metricLabel?: string;
  timeComplexity?: string;
  spaceComplexity?: string;
  keyIdea?: string;
  run(grid: Cell[][]): Generator<AlgorithmStep, AlgorithmResult, void>;
}
