import { SimulationRunner } from "./simulationRunner";
import type { ArrayData, ArrayStateDiff, ArrayVisualState } from "../types/array";
import type {
  ArrayAlgorithmPlugin,
  ArrayAlgorithmResult,
  ArrayStepEvent,
} from "../types/arrayAlgorithm";
import type { SimulationSnapshot, StateEngine, StepExplanation } from "../types/simulation";

export type ArrayRunnerSnapshot = SimulationSnapshot;

interface ArrayRunnerListeners {
  onArrayStateUpdate: (state: ArrayVisualState) => void;
  onSnapshotUpdate: (snapshot: ArrayRunnerSnapshot) => void;
}

export const arrayStateEngine: StateEngine<
  ArrayData,
  ArrayVisualState,
  ArrayStepEvent,
  ArrayStateDiff
> = {
  createInitialState(arrayData) {
    return {
      nums: [...arrayData.nums],
      target: arrayData.target,
      left: null,
      right: null,
      currentSum: null,
      eventType: null,
      found: false,
      foundIndices: null,
      maxLength: 0,
      windowIndices: null,
      maxSum: null,
      currentIndex: null,
      subarrayIndices: null,
      bestSubarrayIndices: null,
      explanation: READY_EXPLANATION,
      decision: null,
      insightTags: [],
      changedIndices: [],
    };
  },
  deriveDiff(previousState, step) {
    const payload = step.payload;
    const left = payload.left ?? previousState.left;
    const right = payload.right ?? previousState.right;
    const currentIndex = payload.index ?? right ?? previousState.currentIndex;
    const subarrayIndices =
      payload.subarrayStart !== undefined && payload.subarrayEnd !== undefined
        ? ([payload.subarrayStart, payload.subarrayEnd] as [number, number])
        : previousState.subarrayIndices;
    const bestSubarrayIndices =
      payload.bestStart !== undefined && payload.bestEnd !== undefined
        ? ([payload.bestStart, payload.bestEnd] as [number, number])
        : previousState.bestSubarrayIndices;

    const changes: Partial<Omit<ArrayVisualState, "nums">> = {
      target: payload.target ?? payload.k ?? previousState.target,
      left,
      right,
      currentSum: payload.currentSum ?? previousState.currentSum,
      eventType: step.type,
      found: step.type === "found",
      foundIndices:
        step.type === "found" && left !== null && right !== null ? [left, right] : null,
      maxLength: payload.maxLength ?? previousState.maxLength,
      windowIndices:
        left !== null &&
        right !== null &&
        (step.type === "expand" || step.type === "shrink" || step.type === "update_max")
          ? [left, right]
          : previousState.windowIndices,
      maxSum: payload.maxSum ?? previousState.maxSum,
      currentIndex,
      subarrayIndices,
      bestSubarrayIndices,
      explanation: step.explanation,
      decision: step.decision ?? null,
      insightTags: step.insightTags ?? [],
    };

    const changedIndices = deriveChangedIndices(previousState, {
      ...previousState,
      ...changes,
      nums: previousState.nums,
      changedIndices: previousState.changedIndices,
    });

    return {
      type: "array_patch",
      payload: {
        changes,
        changedIndices,
      },
    };
  },
  applyDiff(previousState, diff) {
    const changes = diff.payload.changes;
    const foundIndices = changes.foundIndices
      ? ([...changes.foundIndices] as [number, number])
      : changes.foundIndices === null
        ? null
        : previousState.foundIndices;
    const windowIndices = changes.windowIndices
      ? ([...changes.windowIndices] as [number, number])
      : changes.windowIndices === null
        ? null
        : previousState.windowIndices;
    const subarrayIndices = changes.subarrayIndices
      ? ([...changes.subarrayIndices] as [number, number])
      : changes.subarrayIndices === null
        ? null
        : previousState.subarrayIndices;
    const bestSubarrayIndices = changes.bestSubarrayIndices
      ? ([...changes.bestSubarrayIndices] as [number, number])
      : changes.bestSubarrayIndices === null
        ? null
        : previousState.bestSubarrayIndices;

    return {
      ...previousState,
      ...changes,
      foundIndices,
      windowIndices,
      subarrayIndices,
      bestSubarrayIndices,
      changedIndices: [...diff.payload.changedIndices],
    };
  },
};

export class ArrayVisualizationRunner {
  private readonly runner: SimulationRunner<
    ArrayData,
    ArrayVisualState,
    ArrayStepEvent,
    ArrayStateDiff,
    ArrayAlgorithmResult
  >;

  constructor(listeners: ArrayRunnerListeners) {
    this.runner = new SimulationRunner({
      onStateUpdate: listeners.onArrayStateUpdate,
      onSnapshotUpdate: listeners.onSnapshotUpdate,
    }, {
      stateEngine: arrayStateEngine,
      deriveSnapshot: ({ algorithm, state, status, stepCount, totalSteps, currentStep, steps, result, milestoneSteps, performance }) => ({
        status,
        stepCount,
        totalSteps,
        exploredCount: countPrimaryMoments(steps),
        metricValue:
          status === "completed"
            ? result.metricValue ?? deriveArrayMetric(state, steps)
            : deriveArrayMetric(state, steps),
        metricLabel: algorithm.metadata.metricLabel ?? "Array Metric",
        foundResult: status === "completed" ? result.found : null,
        message: deriveArrayMessage({
          algorithmLabel: algorithm.metadata.label,
          status,
          currentStep,
          resultMessage: result.message,
          totalSteps,
          stepCount,
        }),
        explanation: state.explanation,
        decision: state.decision ?? undefined,
        algorithmId: algorithm.id,
        insightTags: currentStep?.insightTags ?? state.insightTags,
        recentMessages: steps.slice(-5).map((step) => step.explanation.what),
        recentEvents: buildRecentEvents(steps, milestoneSteps),
        milestoneSteps,
        performance,
      }),
      deriveMilestoneSteps: (steps) =>
        steps.flatMap((step, index) =>
          step.type === "found" || step.type === "update_max" ? [index + 1] : [],
        ),
      autoPauseOnStep: (step) => step.type === "found" || step.type === "update_max",
      checkpointInterval: 20,
    });
  }

  load(arrayData: ArrayData, algorithm: ArrayAlgorithmPlugin): void {
    this.runner.load(arrayData, algorithm);
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

  getMilestoneSteps(): number[] {
    return this.runner.getMilestoneSteps();
  }

  peekNextStep(): ArrayStepEvent | null {
    return this.runner.peekNextStep();
  }
}

function deriveChangedIndices(
  previousState: ArrayVisualState,
  nextState: ArrayVisualState,
): number[] {
  const changed = new Set<number>();

  if (nextState.currentIndex !== null && nextState.currentIndex !== previousState.currentIndex) {
    changed.add(nextState.currentIndex);
  }
  if (nextState.left !== null && nextState.left !== previousState.left) {
    changed.add(nextState.left);
  }
  if (nextState.right !== null && nextState.right !== previousState.right) {
    changed.add(nextState.right);
  }

  return [...changed].filter((index) => index >= 0);
}

function countPrimaryMoments(steps: ArrayStepEvent[]): number {
  return steps.filter(
    (step) =>
      step.type === "compare" ||
      step.type === "expand" ||
      step.type === "extend" ||
      step.type === "restart",
  ).length;
}

function deriveArrayMetric(state: ArrayVisualState, steps: ArrayStepEvent[]): number {
  if (state.maxSum !== null) {
    return state.maxSum;
  }

  if (state.maxLength > 0) {
    return state.maxLength;
  }

  return steps.filter((step) => step.type === "compare").length;
}

function deriveArrayMessage({
  algorithmLabel,
  status,
  currentStep,
  resultMessage,
  totalSteps,
  stepCount,
}: {
  algorithmLabel: string;
  status: ArrayRunnerSnapshot["status"];
  currentStep: ArrayStepEvent | null;
  resultMessage?: string;
  totalSteps: number;
  stepCount: number;
}): string {
  if (totalSteps === 0) {
    return resultMessage ?? "Load an example array, then start the algorithm.";
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

  return "Load an example array, then start the algorithm.";
}

const READY_EXPLANATION: StepExplanation = {
  what: "Load an example or random input to begin.",
  why: "A simulation needs concrete input before any algorithm decision can be shown.",
  impact: "No state has changed yet.",
  next: "Choose a preset or press play.",
};

function buildRecentEvents(
  steps: ArrayStepEvent[],
  milestoneSteps: number[],
): ArrayRunnerSnapshot["recentEvents"] {
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
