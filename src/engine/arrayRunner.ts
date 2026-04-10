import type { ArrayData } from "../types/array";
import type { ArrayAlgorithmPlugin, ArrayAlgorithmResult, ArrayAlgorithmStep } from "../types/arrayAlgorithm";
import { cloneArrayData } from "../utils/array";

export type ArrayRunnerStatus = "idle" | "ready" | "running" | "paused" | "completed";

export interface ArrayRunnerSnapshot {
  status: ArrayRunnerStatus;
  stepCount: number;
  totalSteps: number;
  exploredCount: number;
  pathLength: number;
  metricLabel: string;
  foundPath: boolean | null;
  message: string;
  algorithmId: string | null;
  explanation?: string;
  decision?: string;
  recentMessages: string[];
}

export interface ArrayVisualState {
  nums: number[];
  target: number;
  left: number | null;
  right: number | null;
  currentSum: number | null;
  action: ArrayAlgorithmStep["action"] | null;
  found: boolean;
  foundIndices: [number, number] | null;
  maxLength: number;
  windowIndices: [number, number] | null;
  window: number[];
  maxSum: number | null;
  currentIndex: number | null;
  subarrayIndices: [number, number] | null;
  bestSubarrayIndices: [number, number] | null;
  explanation: string;
  decision: string | null;
  changedIndices: number[];
}

interface ArrayRunnerListeners {
  onArrayStateUpdate: (state: ArrayVisualState) => void;
  onSnapshotUpdate: (snapshot: ArrayRunnerSnapshot) => void;
}

const DEFAULT_ARRAY_STATE: ArrayVisualState = {
  nums: [],
  target: 0,
  left: null,
  right: null,
  currentSum: null,
  action: null,
  found: false,
  foundIndices: null,
  maxLength: 0,
  windowIndices: null,
  window: [],
  maxSum: null,
  currentIndex: null,
  subarrayIndices: null,
  bestSubarrayIndices: null,
  explanation: "Load an example or random input to begin.",
  decision: null,
  changedIndices: [],
};

const DEFAULT_SNAPSHOT: ArrayRunnerSnapshot = {
  status: "idle",
  stepCount: 0,
  totalSteps: 0,
  exploredCount: 0,
  pathLength: 0,
  metricLabel: "Array Metric",
  foundPath: null,
  message: "Load an example array, then start the algorithm.",
  algorithmId: null,
  recentMessages: [],
};

export class ArrayVisualizationRunner {
  private baseArrayData: ArrayData = { nums: [], target: 0 };
  private generator: Generator<ArrayAlgorithmStep, ArrayAlgorithmResult, void> | null = null;
  private executedSteps: ArrayAlgorithmStep[] = [];
  private snapshot: ArrayRunnerSnapshot = DEFAULT_SNAPSHOT;
  private algorithm: ArrayAlgorithmPlugin | null = null;
  private timerId: number | null = null;
  private speed = 110;
  private totalSteps = 0;

  constructor(private readonly listeners: ArrayRunnerListeners) {}

  configure(arrayData: ArrayData, algorithm: ArrayAlgorithmPlugin): void {
    this.pause();
    this.baseArrayData = cloneArrayData(arrayData);
    this.generator = null;
    this.executedSteps = [];
    this.algorithm = algorithm;
    this.totalSteps = countAllSteps(algorithm, this.baseArrayData);
    this.snapshot = {
      ...DEFAULT_SNAPSHOT,
      status: "ready",
      algorithmId: algorithm.id,
      message: `Ready to run ${algorithm.label}.`,
      metricLabel: algorithm.metricLabel ?? DEFAULT_SNAPSHOT.metricLabel,
      totalSteps: this.totalSteps,
    };
    this.emit();
  }

  setSpeed(speed: number): void {
    this.speed = speed;
    if (this.snapshot.status === "running") {
      this.pause();
      this.start();
    }
  }

  start(): void {
    if (!this.algorithm || this.snapshot.status === "running") {
      return;
    }

    this.ensureGenerator();
    if (!this.generator) {
      return;
    }

    this.snapshot = {
      ...this.snapshot,
      status: "running",
      message: `Running ${this.algorithm.label}...`,
    };
    this.emitSnapshot();
    this.schedule();
  }

  pause(): void {
    if (this.timerId !== null) {
      window.clearTimeout(this.timerId);
      this.timerId = null;
    }

    if (this.snapshot.status === "running") {
      this.snapshot = {
        ...this.snapshot,
        status: "paused",
        message: "Playback paused.",
      };
      this.emitSnapshot();
    }
  }

  reset(arrayData?: ArrayData): void {
    this.pause();
    if (arrayData) {
      this.baseArrayData = cloneArrayData(arrayData);
    }
    this.generator = null;
    this.executedSteps = [];
    this.totalSteps = this.algorithm ? countAllSteps(this.algorithm, this.baseArrayData) : 0;
    this.snapshot = {
      ...DEFAULT_SNAPSHOT,
      status: this.algorithm ? "ready" : "idle",
      algorithmId: this.algorithm?.id ?? null,
      metricLabel: this.algorithm?.metricLabel ?? DEFAULT_SNAPSHOT.metricLabel,
      totalSteps: this.totalSteps,
      message: this.algorithm
        ? `Array reset. ${this.algorithm.label} is ready.`
        : DEFAULT_SNAPSHOT.message,
    };
    this.emit();
  }

  stepForward(): void {
    if (!this.algorithm) {
      return;
    }
    this.ensureGenerator();
    if (!this.generator) {
      return;
    }
    if (this.snapshot.status === "running") {
      this.pause();
    }
    this.consumeNextStep();
  }

  stepBackward(): void {
    if (!this.algorithm || this.executedSteps.length === 0) {
      return;
    }
    if (this.snapshot.status === "running") {
      this.pause();
    }
    this.executedSteps.pop();
    this.rebuildGeneratorFromHistory();
    this.rebuildState();
  }

  dispose(): void {
    this.pause();
  }

  private ensureGenerator(): void {
    if (!this.generator && this.algorithm) {
      this.generator = this.algorithm.run(cloneArrayData(this.baseArrayData));
    }
  }

  private rebuildGeneratorFromHistory(): void {
    if (!this.algorithm) {
      this.generator = null;
      return;
    }
    this.generator = this.algorithm.run(cloneArrayData(this.baseArrayData));
    for (let index = 0; index < this.executedSteps.length; index += 1) {
      const result = this.generator.next();
      if (result.done) {
        break;
      }
    }
  }

  private schedule(): void {
    this.timerId = window.setTimeout(() => {
      this.consumeNextStep();
      if (this.snapshot.status === "running") {
        this.schedule();
      }
    }, this.speed);
  }

  private consumeNextStep(): void {
    if (!this.generator) {
      return;
    }
    const result = this.generator.next();
    if (result.done) {
      this.finish(result.value);
      return;
    }
    this.executedSteps.push(result.value);
    this.rebuildState(result.value);
    if (this.snapshot.status === "running" && shouldPauseOnStep(result.value)) {
      this.snapshot = {
        ...this.snapshot,
        status: "paused",
        message: result.value.explanation,
      };
      if (this.timerId !== null) {
        window.clearTimeout(this.timerId);
        this.timerId = null;
      }
      this.emitSnapshot();
    }
  }

  private finish(result: ArrayAlgorithmResult): void {
    this.pause();
    this.snapshot = {
      ...this.snapshot,
      status: "completed",
      exploredCount: countKeySteps(this.executedSteps),
      pathLength: result.metricValue ?? deriveArrayMetric(this.executedSteps),
      foundPath: result.found,
      message: result.message ?? (result.found ? "Array algorithm completed." : "Array algorithm finished."),
      explanation: this.executedSteps.at(-1)?.explanation,
      decision: this.executedSteps.at(-1)?.decision,
      recentMessages: getRecentMessages(this.executedSteps),
    };
    this.emitSnapshot();
  }

  private rebuildState(latestStep?: ArrayAlgorithmStep): void {
    const visualState = buildVisualState(this.baseArrayData, this.executedSteps);
    const effectiveStep = latestStep ?? this.executedSteps.at(-1);
    this.snapshot = {
      ...this.snapshot,
      status: this.executedSteps.length === 0 ? "ready" : this.snapshot.status,
      stepCount: this.executedSteps.length,
      totalSteps: this.totalSteps,
      exploredCount: countKeySteps(this.executedSteps),
      pathLength: deriveArrayMetric(this.executedSteps),
      message: effectiveStep ? describeArrayStep(effectiveStep) : this.snapshot.message,
      explanation: effectiveStep?.explanation,
      decision: effectiveStep?.decision,
      recentMessages: getRecentMessages(this.executedSteps),
    };
    this.listeners.onArrayStateUpdate(visualState);
    this.emitSnapshot();
  }

  private emit(): void {
    this.listeners.onArrayStateUpdate({
      ...DEFAULT_ARRAY_STATE,
      nums: [...this.baseArrayData.nums],
      target: this.baseArrayData.target,
    });
    this.emitSnapshot();
  }

  private emitSnapshot(): void {
    this.listeners.onSnapshotUpdate({ ...this.snapshot });
  }
}

function buildVisualState(arrayData: ArrayData, steps: ArrayAlgorithmStep[]): ArrayVisualState {
  if (steps.length === 0) {
    return {
      ...DEFAULT_ARRAY_STATE,
      nums: [...arrayData.nums],
      target: arrayData.target,
    };
  }

  const latestStep = steps.at(-1)!;
  const previousStep = steps.length > 1 ? steps.at(-2) : undefined;
  return {
      nums: [...latestStep.arraySnapshot],
      target: latestStep.target,
      left: latestStep.left,
      right: latestStep.right,
      currentSum: latestStep.currentSum,
      action: latestStep.action,
      found: latestStep.found,
      foundIndices:
        latestStep.action === "found" && latestStep.found
          ? [latestStep.left, latestStep.right]
          : null,
      maxLength: latestStep.maxLength ?? 0,
      windowIndices: latestStep.left <= latestStep.right ? [latestStep.left, latestStep.right] : null,
      window: latestStep.window ?? latestStep.arraySnapshot.slice(latestStep.left, latestStep.right + 1),
      maxSum: latestStep.maxSum ?? null,
      currentIndex: latestStep.index ?? latestStep.right,
      subarrayIndices:
        latestStep.subarrayStart !== undefined && latestStep.subarrayEnd !== undefined
          ? [latestStep.subarrayStart, latestStep.subarrayEnd]
          : null,
      bestSubarrayIndices:
        latestStep.bestStart !== undefined && latestStep.bestEnd !== undefined
          ? [latestStep.bestStart, latestStep.bestEnd]
          : null,
      explanation: latestStep.explanation,
      decision: latestStep.decision ?? null,
      changedIndices: deriveChangedIndices(previousStep, latestStep),
  };
}

function countKeySteps(steps: ArrayAlgorithmStep[]): number {
  return steps.filter(
    (step) =>
      step.action === "checking" ||
      step.action === "extend" ||
      step.action === "restart" ||
      step.action === "expand",
  ).length;
}

function countAllSteps(
  algorithm: ArrayAlgorithmPlugin,
  arrayData: ArrayData,
): number {
  const generator = algorithm.run(cloneArrayData(arrayData));
  let count = 0;
  while (true) {
    const result = generator.next();
    if (result.done) {
      return count;
    }
    count += 1;
  }
}

function deriveArrayMetric(steps: ArrayAlgorithmStep[]): number {
  const maxLengthStep = [...steps]
    .reverse()
    .find((step) => step.maxLength !== undefined && step.maxLength > 0);

  if (maxLengthStep?.maxLength !== undefined) {
    return maxLengthStep.maxLength;
  }

  const maxSumStep = [...steps]
    .reverse()
    .find((step) => step.maxSum !== undefined);

  if (maxSumStep?.maxSum !== undefined) {
    return maxSumStep.maxSum;
  }

  return steps.filter((step) => step.action === "checking").length;
}

function describeArrayStep(step: ArrayAlgorithmStep): string {
  if (step.explanation) {
    return step.explanation;
  }

  switch (step.action) {
    case "checking":
      return `Checking ${step.arraySnapshot[step.left]} + ${step.arraySnapshot[step.right]} = ${step.currentSum}.`;
    case "expand":
      return `Expanding window to include ${step.arraySnapshot[step.right]}.`;
    case "shrink":
      return "Shrinking window (sum exceeded).";
    case "update_max":
      if (step.maxSum !== undefined) {
        return `New maximum found: ${step.maxSum}.`;
      }
      return `Updating max length to ${step.maxLength ?? 0}.`;
    case "move_left":
      return "Sum too small -> move left.";
    case "move_right":
      return "Sum too large -> move right.";
    case "found":
      return "Pair found!";
    case "extend":
      return "Extending previous subarray.";
    case "restart":
      return "Restarting at current index.";
  }
}

function shouldPauseOnStep(step: ArrayAlgorithmStep): boolean {
  return (
    step.action === "found" ||
    step.action === "update_max"
  );
}

function getRecentMessages(steps: ArrayAlgorithmStep[]): string[] {
  return steps
    .slice(-5)
    .map((step) => step.explanation)
    .filter(Boolean);
}

function deriveChangedIndices(
  previousStep: ArrayAlgorithmStep | undefined,
  latestStep: ArrayAlgorithmStep,
): number[] {
  const changed = new Set<number>();

  if (latestStep.index !== undefined) {
    changed.add(latestStep.index);
  }
  if (previousStep?.left !== latestStep.left) {
    changed.add(latestStep.left);
  }
  if (previousStep?.right !== latestStep.right) {
    changed.add(latestStep.right);
  }
  return [...changed].filter((value) => value >= 0);
}
