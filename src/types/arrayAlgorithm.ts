import type { ArrayData } from "./array";

export type ArrayAction =
  | "checking"
  | "move_left"
  | "move_right"
  | "found"
  | "extend"
  | "restart"
  | "expand"
  | "shrink"
  | "update_max";

export interface ArrayAlgorithmStep {
  left: number;
  right: number;
  currentSum: number;
  action: ArrayAction;
  found: boolean;
  arraySnapshot: number[];
  target: number;
  maxLength?: number;
  window?: number[];
  k?: number;
  index?: number;
  value?: number;
  subarrayStart?: number;
  subarrayEnd?: number;
  maxSum?: number;
  bestStart?: number;
  bestEnd?: number;
  explanation: string;
  decision?: string;
}

export interface ArrayAlgorithmResult {
  found: boolean;
  pair: [number, number] | null;
  visitedCount: number;
  terminated: boolean;
  message?: string;
  metricValue?: number;
}

export interface ArrayAlgorithmPlugin {
  id: string;
  label: string;
  family: string;
  description: string;
  behaviorNote: string;
  metricLabel?: string;
  intuition?: string;
  keyIdea?: string;
  timeComplexity?: string;
  spaceComplexity?: string;
  run(arrayData: ArrayData): Generator<ArrayAlgorithmStep, ArrayAlgorithmResult, void>;
}
