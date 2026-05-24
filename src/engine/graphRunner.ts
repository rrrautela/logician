import { SimulationRunner } from "./simulationRunner";
import type { Graph, GraphStateDiffPayload, GraphVisualState } from "../types/graph";
import type {
  GraphAlgorithmPlugin,
  GraphAlgorithmResult,
  GraphStateDiff,
  GraphStepEvent,
} from "../types/graphAlgorithm";
import type { SimulationSnapshot, StateEngine, StepExplanation } from "../types/simulation";
import { resetTraversalState } from "../utils/graph";

export type GraphRunnerSnapshot = SimulationSnapshot;

interface GraphRunnerListeners {
  onGraphStateUpdate: (state: GraphVisualState) => void;
  onSnapshotUpdate: (snapshot: GraphRunnerSnapshot) => void;
}

export const graphStateEngine: StateEngine<
  Graph,
  GraphVisualState,
  GraphStepEvent,
  GraphStateDiff
> = {
  createInitialState(graph) {
    return {
      graph: resetTraversalState(graph),
      visitedNodeIds: [],
      frontierNodeIds: [],
      skippedNodeIds: [],
      currentNodeId: null,
      currentEdgeId: null,
      pathNodeIds: [],
      pathEdgeIds: [],
      parentByNodeId: Object.fromEntries(graph.nodes.map((node) => [node.id, null as string | null])),
      distanceByNodeId: {},
      heuristicByNodeId: {},
      scoreByNodeId: {},
      indegreeByNodeId: {},
      processedOrder: [],
      explanation: READY_EXPLANATION,
      decision: null,
      insightTags: [],
    };
  },
  deriveDiff(previousState, step) {
    const payload: GraphStateDiffPayload = {
      currentNodeId:
        step.pointers?.currentNodeId ?? step.payload.nodeId ?? previousState.currentNodeId,
      currentEdgeId: step.pointers?.currentEdgeId ?? step.payload.edgeId ?? null,
      explanation: step.explanation,
      decision: step.decision ?? null,
      insightTags: step.insightTags ?? [],
    };

    if (step.pointers?.frontierNodeIds) {
      payload.frontierNodeIds = [...step.pointers.frontierNodeIds];
    }
    if (step.payload.distance !== undefined && step.payload.nodeId) {
      payload.distanceUpdates = { [step.payload.nodeId]: step.payload.distance };
    }
    if (step.payload.heuristic !== undefined && step.payload.nodeId) {
      payload.heuristicUpdates = { [step.payload.nodeId]: step.payload.heuristic };
    }
    if (step.payload.fScore !== undefined && step.payload.nodeId) {
      payload.scoreUpdates = { [step.payload.nodeId]: step.payload.fScore };
    } else if (step.payload.priority !== undefined && step.payload.nodeId) {
      payload.scoreUpdates = { [step.payload.nodeId]: step.payload.priority };
    }
    if (step.payload.indegree !== undefined && step.payload.nodeId) {
      payload.indegreeUpdates = { [step.payload.nodeId]: step.payload.indegree };
    }

    switch (step.type) {
      case "enqueue":
      case "priority_update":
        if (step.payload.nodeId && !previousState.frontierNodeIds.includes(step.payload.nodeId)) {
          payload.frontierNodeIds = [
            ...(payload.frontierNodeIds ?? previousState.frontierNodeIds),
            step.payload.nodeId,
          ];
        }
        break;
      case "dequeue":
        if (step.payload.nodeId) {
          payload.frontierNodeIds = (payload.frontierNodeIds ?? previousState.frontierNodeIds).filter(
            (nodeId) => nodeId !== step.payload.nodeId,
          );
        }
        break;
      case "visit_node":
        if (step.payload.nodeId && !previousState.visitedNodeIds.includes(step.payload.nodeId)) {
          payload.addVisitedNodeIds = [step.payload.nodeId];
        }
        if (
          step.payload.orderIndex !== undefined &&
          step.payload.nodeId &&
          !previousState.processedOrder.includes(step.payload.nodeId)
        ) {
          payload.processedOrderAppend = [step.payload.nodeId];
        }
        break;
      case "update_distance":
        if (step.payload.fromId && step.payload.toId) {
          payload.parentUpdates = { [step.payload.toId]: step.payload.fromId };
        }
        break;
      case "skip_node":
        if (
          step.payload.nodeId &&
          !step.payload.edgeId &&
          !previousState.skippedNodeIds.includes(step.payload.nodeId)
        ) {
          payload.addSkippedNodeIds = [step.payload.nodeId];
        }
        break;
      case "path_found":
        if (step.payload.finalPath) {
          payload.pathNodeIds = [...step.payload.finalPath];
          payload.pathEdgeIds = derivePathEdgeIds(previousState.graph, step.payload.finalPath);
          if (previousState.processedOrder.length === 0) {
            payload.processedOrderAppend = [...step.payload.finalPath];
          }
        }
        break;
    }

    return {
      type: "graph_patch",
      payload,
    };
  },
  applyDiff(previousState, diff) {
    const payload = diff.payload;
    return {
      graph: previousState.graph,
      visitedNodeIds: payload.addVisitedNodeIds
        ? [...previousState.visitedNodeIds, ...payload.addVisitedNodeIds]
        : previousState.visitedNodeIds,
      frontierNodeIds: payload.frontierNodeIds ?? previousState.frontierNodeIds,
      skippedNodeIds: payload.addSkippedNodeIds
        ? [...previousState.skippedNodeIds, ...payload.addSkippedNodeIds]
        : previousState.skippedNodeIds,
      currentNodeId:
        payload.currentNodeId !== undefined ? payload.currentNodeId : previousState.currentNodeId,
      currentEdgeId:
        payload.currentEdgeId !== undefined ? payload.currentEdgeId : previousState.currentEdgeId,
      pathNodeIds: payload.pathNodeIds ?? previousState.pathNodeIds,
      pathEdgeIds: payload.pathEdgeIds ?? previousState.pathEdgeIds,
      parentByNodeId: payload.parentUpdates
        ? { ...previousState.parentByNodeId, ...payload.parentUpdates }
        : previousState.parentByNodeId,
      distanceByNodeId: payload.distanceUpdates
        ? { ...previousState.distanceByNodeId, ...payload.distanceUpdates }
        : previousState.distanceByNodeId,
      heuristicByNodeId: payload.heuristicUpdates
        ? { ...previousState.heuristicByNodeId, ...payload.heuristicUpdates }
        : previousState.heuristicByNodeId,
      scoreByNodeId: payload.scoreUpdates
        ? { ...previousState.scoreByNodeId, ...payload.scoreUpdates }
        : previousState.scoreByNodeId,
      indegreeByNodeId: payload.indegreeUpdates
        ? { ...previousState.indegreeByNodeId, ...payload.indegreeUpdates }
        : previousState.indegreeByNodeId,
      processedOrder: payload.processedOrderAppend
        ? [...previousState.processedOrder, ...payload.processedOrderAppend]
        : previousState.processedOrder,
      explanation: payload.explanation,
      decision: payload.decision,
      insightTags: payload.insightTags,
    };
  },
};

export class GraphVisualizationRunner {
  private readonly runner: SimulationRunner<
    Graph,
    GraphVisualState,
    GraphStepEvent,
    GraphStateDiff,
    GraphAlgorithmResult
  >;

  constructor(listeners: GraphRunnerListeners) {
    this.runner = new SimulationRunner(
      {
        onStateUpdate: listeners.onGraphStateUpdate,
        onSnapshotUpdate: listeners.onSnapshotUpdate,
      },
      {
        stateEngine: graphStateEngine,
        deriveSnapshot: ({
          algorithm,
          state,
          status,
          stepCount,
          totalSteps,
          currentStep,
          steps,
          diffs,
          result,
          milestoneSteps,
          performance,
        }) => ({
          status,
          stepCount,
          totalSteps,
          exploredCount: state.visitedNodeIds.length,
          metricValue:
            status === "completed"
              ? result.metricValue ?? deriveGraphMetric(state)
              : deriveGraphMetric(state),
          metricLabel: algorithm.metadata.metricLabel ?? "Graph Metric",
          foundResult: status === "completed" ? result.found : null,
          message: deriveGraphMessage({
            algorithmLabel: algorithm.metadata.label,
            status,
            currentStep,
            resultMessage: result.message,
            totalSteps,
            stepCount,
          }),
          explanation: state.explanation,
          decision: state.decision ?? undefined,
          insightTags: currentStep?.insightTags ?? state.insightTags,
          algorithmId: algorithm.id,
          recentMessages: steps.slice(-5).map((step) => step.explanation.what),
          recentEvents: buildRecentEvents(steps, milestoneSteps),
          milestoneSteps,
          performance,
        }),
        deriveMilestoneSteps: (steps) =>
          steps.flatMap((step, index) =>
            step.type === "path_found" || step.type === "update_distance" ? [index + 1] : [],
          ),
        autoPauseOnStep: (step) => step.type === "path_found",
        checkpointInterval: 12,
      },
    );
  }

  load(graph: Graph, algorithm: GraphAlgorithmPlugin): void {
    this.runner.load(graph, algorithm);
  }

  setSpeed(speed: number): void {
    this.runner.setSpeed(speed);
  }

  start(): void {
    this.runner.start();
  }

  pause(): void {
    this.runner.pause();
  }

  reset(): void {
    this.runner.reset();
  }

  stepForward(): void {
    this.runner.stepForward();
  }

  stepBackward(): void {
    this.runner.stepBackward();
  }

  seekToStep(step: number): void {
    this.runner.seek(step);
  }

  dispose(): void {
    this.runner.dispose();
  }

  peekNextStep(): GraphStepEvent | null {
    return this.runner.peekNextStep();
  }
}

function derivePathEdgeIds(graph: Graph, path: string[]): string[] {
  const edgeIds: string[] = [];
  for (let index = 0; index < path.length - 1; index += 1) {
    const fromId = path[index]!;
    const toId = path[index + 1]!;
    const edge = graph.edges.find(
      (candidate) =>
        (candidate.from === fromId && candidate.to === toId) ||
        (!candidate.directed && candidate.from === toId && candidate.to === fromId),
    );
    if (edge) {
      edgeIds.push(edge.id);
    }
  }

  return edgeIds;
}

function deriveGraphMetric(state: GraphVisualState): number {
  if (state.pathNodeIds.length > 0) {
    const endNodeId = state.pathNodeIds.at(-1)!;
    const distance = state.distanceByNodeId[endNodeId];
    if (distance !== undefined) {
      return distance;
    }
    return state.pathNodeIds.length;
  }

  if (state.processedOrder.length > 0) {
    return state.processedOrder.length;
  }

  return state.visitedNodeIds.length;
}

function deriveGraphMessage({
  algorithmLabel,
  status,
  currentStep,
  resultMessage,
  totalSteps,
  stepCount,
}: {
  algorithmLabel: string;
  status: GraphRunnerSnapshot["status"];
  currentStep: GraphStepEvent | null;
  resultMessage?: string;
  totalSteps: number;
  stepCount: number;
}): string {
  if (totalSteps === 0) {
    return resultMessage ?? "Load a graph algorithm to begin the simulation.";
  }

  if (status === "ready" && stepCount === 0) {
    return `Ready to run ${algorithmLabel}.`;
  }

  if (status === "running") {
    return currentStep?.explanation.what ?? `Running ${algorithmLabel}...`;
  }

  if (status === "completed") {
    return resultMessage ?? `${algorithmLabel} completed.`;
  }

  if (status === "paused") {
    return currentStep?.explanation.what ?? "Playback paused.";
  }

  return "Load a graph algorithm to begin the simulation.";
}

const READY_EXPLANATION: StepExplanation = {
  what: "Load a graph algorithm to begin the simulation.",
  why: "The graph view waits for a concrete algorithm and graph before explaining decisions.",
  impact: "No nodes or edges have been changed yet.",
  next: "Press play or step forward to begin.",
};

function buildRecentEvents(
  steps: GraphStepEvent[],
  milestoneSteps: number[],
): GraphRunnerSnapshot["recentEvents"] {
  const milestoneSet = new Set(milestoneSteps);
  const startIndex = Math.max(0, steps.length - 8);

  return steps.slice(startIndex).map((step, index) => {
    const stepIndex = startIndex + index + 1;
    return {
      index: stepIndex,
      type: step.type,
      summary: step.explanation.what,
      insightTags: step.insightTags ?? [],
      isMilestone: milestoneSet.has(stepIndex),
    };
  });
}
