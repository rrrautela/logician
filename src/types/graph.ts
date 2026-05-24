import type { StepDecision, StepExplanation } from "./simulation";

export interface GraphNode {
  id: string;
  label?: string;
  x: number;
  y: number;
  metadata?: Record<string, string | number | boolean>;
}

export interface GraphEdge {
  id: string;
  from: string;
  to: string;
  weight?: number;
  directed: boolean;
}

export interface GraphNeighbor {
  nodeId: string;
  edge: GraphEdge;
  weight: number;
}

export interface Graph {
  nodes: GraphNode[];
  edges: GraphEdge[];
  adjacencyList: Record<string, GraphNeighbor[]>;
  startNodeId?: string;
  endNodeId?: string;
}

export interface GraphVisualState {
  graph: Graph;
  visitedNodeIds: string[];
  frontierNodeIds: string[];
  skippedNodeIds: string[];
  currentNodeId: string | null;
  currentEdgeId: string | null;
  pathNodeIds: string[];
  pathEdgeIds: string[];
  parentByNodeId: Record<string, string | null>;
  distanceByNodeId: Record<string, number>;
  heuristicByNodeId: Record<string, number>;
  scoreByNodeId: Record<string, number>;
  indegreeByNodeId: Record<string, number>;
  processedOrder: string[];
  explanation: StepExplanation;
  decision: StepDecision | null;
  insightTags: string[];
}

export interface GraphStateDiffPayload {
  currentNodeId?: string | null;
  currentEdgeId?: string | null;
  frontierNodeIds?: string[];
  addVisitedNodeIds?: string[];
  addSkippedNodeIds?: string[];
  pathNodeIds?: string[];
  pathEdgeIds?: string[];
  parentUpdates?: Record<string, string | null>;
  distanceUpdates?: Record<string, number>;
  heuristicUpdates?: Record<string, number>;
  scoreUpdates?: Record<string, number>;
  indegreeUpdates?: Record<string, number>;
  processedOrderAppend?: string[];
  explanation: StepExplanation;
  decision: StepDecision | null;
  insightTags: string[];
}
