import type { Graph } from "./graph";
import type {
  AlgorithmPlugin as BaseAlgorithmPlugin,
  SimulationResult,
  StateDiff,
  StepEvent,
} from "./simulation";
import type { GraphStateDiffPayload } from "./graph";

export type GraphEventType =
  | "enqueue"
  | "dequeue"
  | "visit_node"
  | "relax_edge"
  | "update_distance"
  | "priority_update"
  | "skip_node"
  | "update_indegree"
  | "path_found";

export interface GraphEventPayload {
  nodeIds?: string[];
  nodeId?: string;
  fromId?: string;
  toId?: string;
  edgeId?: string;
  distance?: number;
  previousDistance?: number | null;
  heuristic?: number;
  priority?: number;
  gScore?: number;
  hScore?: number;
  fScore?: number;
  indegree?: number;
  previousIndegree?: number;
  orderIndex?: number;
  finalPath?: string[];
}

export type GraphStepEvent = StepEvent<
  GraphEventType,
  GraphEventPayload,
  {
    currentNodeId?: string | null;
    frontierNodeIds?: string[];
    currentEdgeId?: string | null;
  }
>;

export type GraphStateDiff = StateDiff<"graph_patch", GraphStateDiffPayload>;

export interface GraphAlgorithmResult extends SimulationResult {
  path: string[];
  visitedCount: number;
}

export type GraphAlgorithmPlugin = BaseAlgorithmPlugin<
  Graph,
  GraphStepEvent,
  GraphAlgorithmResult
>;
