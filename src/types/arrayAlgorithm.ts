import type { ArrayData } from "./array";
import type {
  AlgorithmPlugin as BaseAlgorithmPlugin,
  SimulationResult,
  StepEvent,
} from "./simulation";

export type ArrayEventType =
  | "compare"
  | "move_left"
  | "move_right"
  | "found"
  | "extend"
  | "restart"
  | "expand"
  | "shrink"
  | "update_max";

export interface ArrayEventPayload {
  left?: number;
  right?: number;
  currentSum?: number;
  target?: number;
  maxLength?: number;
  k?: number;
  index?: number;
  value?: number;
  subarrayStart?: number;
  subarrayEnd?: number;
  maxSum?: number;
  bestStart?: number;
  bestEnd?: number;
}

export type ArrayStepEvent = StepEvent<
  ArrayEventType,
  ArrayEventPayload,
  {
    left?: number | null;
    right?: number | null;
    currentIndex?: number | null;
  }
>;

export interface ArrayAlgorithmResult extends SimulationResult {
  pair: [number, number] | null;
  visitedCount: number;
}

export type ArrayAlgorithmPlugin = BaseAlgorithmPlugin<
  ArrayData,
  ArrayStepEvent,
  ArrayAlgorithmResult
>;
