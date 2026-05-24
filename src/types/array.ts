import type { ArrayEventType } from "./arrayAlgorithm";
import type { StateDiff, StepDecision, StepExplanation } from "./simulation";

export interface ArrayData {
  nums: number[];
  target: number;
}

export interface ArrayVisualState {
  nums: number[];
  target: number;
  left: number | null;
  right: number | null;
  currentSum: number | null;
  eventType: ArrayEventType | null;
  found: boolean;
  foundIndices: [number, number] | null;
  maxLength: number;
  windowIndices: [number, number] | null;
  maxSum: number | null;
  currentIndex: number | null;
  subarrayIndices: [number, number] | null;
  bestSubarrayIndices: [number, number] | null;
  explanation: StepExplanation;
  decision: StepDecision | null;
  insightTags: string[];
  changedIndices: number[];
}

export type ArrayStateDiff = StateDiff<
  "array_patch",
  {
    changes: Partial<Omit<ArrayVisualState, "nums">>;
    changedIndices: number[];
  }
>;
