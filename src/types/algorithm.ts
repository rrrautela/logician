import type { Cell, Coordinate } from "./grid";
import type {
  AlgorithmPlugin as BaseAlgorithmPlugin,
  SimulationResult,
  StateDiff,
  StepEvent,
} from "./simulation";

export type GridEventType = "visit" | "enqueue" | "path" | "backtrack" | "fail";

export interface GridEventPayload {
  nodes: Coordinate[];
  stepNumber?: number;
  wave?: number;
}

export type GridStepEvent = StepEvent<
  GridEventType,
  GridEventPayload,
  { current?: Coordinate[] }
>;

export interface GridCellPatch {
  row: number;
  col: number;
  changes: Partial<
    Pick<
      Cell,
      "visited" | "queued" | "path" | "cycle" | "current" | "backtracked" | "failed" | "stepNumber"
    >
  >;
}

export type GridStateDiff = StateDiff<
  "grid_patch",
  {
    patches: GridCellPatch[];
  }
>;

export interface GridAlgorithmResult extends SimulationResult {
  path: Coordinate[];
  visitedCount: number;
}

export type AlgorithmPlugin = BaseAlgorithmPlugin<
  Cell[][],
  GridStepEvent,
  GridAlgorithmResult
>;
