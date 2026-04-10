import type { ArrayData } from "../types/array";
import type {
  ArrayAlgorithmPlugin,
  ArrayAlgorithmResult,
  ArrayAlgorithmStep,
} from "../types/arrayAlgorithm";
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

export type ArrayPlaybackFrame = {
  visualState: ArrayVisualState;
  snapshot: ArrayRunnerSnapshot;
};

export type ArrayPlaybackBundle = {
  frames: ArrayPlaybackFrame[];
  steps: ArrayAlgorithmStep[];
  milestoneSteps: number[];
};

export class ArrayVisualizationRunner {
  private baseArrayData: ArrayData = { nums: [], target: 0 };
  private executedSteps: ArrayAlgorithmStep[] = [];
  private snapshot: ArrayRunnerSnapshot = DEFAULT_SNAPSHOT;
  private algorithm: ArrayAlgorithmPlugin | null = null;
  private timerId: number | null = null;
  private speed = 400;
  private totalSteps = 0;
  private playbackBundle: ArrayPlaybackBundle | null = null;
  private autoPlayActive = false;

  constructor(private readonly listeners: ArrayRunnerListeners) {}

  hydrateFromBundle(
    arrayData: ArrayData,
    algorithm: ArrayAlgorithmPlugin,
    bundle: ArrayPlaybackBundle,
  ): void {
    this.pause();
    this.baseArrayData = cloneArrayData(arrayData);
    this.algorithm = algorithm;
    this.playbackBundle = bundle;
    this.totalSteps = bundle.steps.length;
    this.applyPlaybackFrame(0);
  }

  setSpeed(speed: number): void {
    this.speed = speed;
    if (this.snapshot.status === "running") {
      this.pause();
      this.start();
    }
  }

  start(): void {
    if (!this.algorithm || !this.playbackBundle || this.snapshot.status === "running") {
      return;
    }

    if (this.snapshot.status === "completed" && this.snapshot.stepCount >= this.totalSteps) {
      return;
    }

    this.autoPlayActive = true;
    this.snapshot = {
      ...this.snapshot,
      status: "running",
      message: `Running ${this.algorithm.label}...`,
    };
    this.emitSnapshot();
    this.schedule();
  }

  pause(): void {
    this.autoPlayActive = false;
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

  reset(): void {
    this.pause();
    if (!this.playbackBundle || !this.algorithm) {
      return;
    }
    this.applyPlaybackFrame(0);
    this.snapshot = {
      ...this.snapshot,
      status: "ready",
      message: `Array reset. ${this.algorithm.label} is ready.`,
    };
    this.emitSnapshot();
  }

  stepForward(): void {
    if (!this.algorithm || !this.playbackBundle) {
      return;
    }
    if (this.snapshot.status === "running") {
      this.pause();
    }
    if (this.snapshot.stepCount >= this.totalSteps) {
      return;
    }
    this.applyPlaybackFrame(this.snapshot.stepCount + 1);
  }

  stepBackward(): void {
    if (!this.algorithm || !this.playbackBundle) {
      return;
    }
    if (this.snapshot.status === "running") {
      this.pause();
    }
    if (this.snapshot.stepCount <= 0) {
      return;
    }
    this.applyPlaybackFrame(this.snapshot.stepCount - 1);
  }

  seekToStep(targetStep: number): void {
    if (!this.algorithm || !this.playbackBundle) {
      return;
    }

    this.pause();
    const clamped = Math.max(0, Math.min(Math.round(targetStep), this.totalSteps));
    this.applyPlaybackFrame(clamped);
  }

  dispose(): void {
    this.pause();
  }



  private schedule(): void {
    this.timerId = window.setTimeout(() => {
      this.consumeNextStep();
      if (this.autoPlayActive && this.snapshot.stepCount < this.totalSteps) {
        this.schedule();
      } else {
        this.autoPlayActive = false;
        if (this.timerId !== null) {
          window.clearTimeout(this.timerId);
          this.timerId = null;
        }
      }
    }, this.speed);
  }

  private consumeNextStep(): void {
    if (!this.playbackBundle) {
      return;
    }
    if (this.snapshot.stepCount >= this.totalSteps) {
      return;
    }
    this.applyPlaybackFrame(this.snapshot.stepCount + 1);
  }

  private applyPlaybackFrame(index: number): void {
    if (!this.playbackBundle || !this.algorithm) {
      return;
    }

    const clamped = Math.max(0, Math.min(index, this.totalSteps));
    const frame = this.playbackBundle.frames[clamped];
    this.executedSteps = this.playbackBundle.steps.slice(0, clamped);
    this.snapshot = { ...frame.snapshot };
    this.listeners.onArrayStateUpdate(frame.visualState);
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

export function buildArrayPlaybackBundle(
  arrayData: ArrayData,
  algorithm: ArrayAlgorithmPlugin,
): ArrayPlaybackBundle {
  const gen = algorithm.run(cloneArrayData(arrayData));
  const steps: ArrayAlgorithmStep[] = [];
  let finalResult: ArrayAlgorithmResult | null = null;
  while (true) {
    const r = gen.next();
    if (r.done) {
      finalResult = r.value;
      break;
    }
    steps.push(r.value);
  }

  const totalSteps = steps.length;
  const frames: ArrayPlaybackFrame[] = [];

  if (totalSteps === 0) {
    const visualState = buildVisualState(arrayData, []);
    const snapshot: ArrayRunnerSnapshot = {
      ...DEFAULT_SNAPSHOT,
      status: "completed",
      stepCount: 0,
      totalSteps: 0,
      algorithmId: algorithm.id,
      metricLabel: algorithm.metricLabel ?? DEFAULT_SNAPSHOT.metricLabel,
      exploredCount: 0,
      pathLength: finalResult?.metricValue ?? deriveArrayMetric([]),
      foundPath: finalResult?.found ?? null,
      message:
        finalResult?.message ??
        (finalResult?.found ? "Array algorithm completed." : "Array algorithm finished."),
      explanation: undefined,
      decision: undefined,
      recentMessages: [],
    };
    frames.push({ visualState, snapshot });
    return { frames, steps: [], milestoneSteps: [] };
  }

  for (let i = 0; i <= totalSteps; i++) {
    const slice = steps.slice(0, i);
    const visualState = buildVisualState(arrayData, slice);
    let snapshot: ArrayRunnerSnapshot;

    if (i === 0) {
      snapshot = {
        ...DEFAULT_SNAPSHOT,
        status: "ready",
        stepCount: 0,
        totalSteps,
        algorithmId: algorithm.id,
        metricLabel: algorithm.metricLabel ?? DEFAULT_SNAPSHOT.metricLabel,
        exploredCount: 0,
        pathLength: 0,
        foundPath: null,
        message: `Ready to run ${algorithm.label}.`,
        recentMessages: [],
      };
    } else if (i < totalSteps) {
      const eff = steps[i - 1]!;
      snapshot = {
        ...DEFAULT_SNAPSHOT,
        status: "paused",
        stepCount: i,
        totalSteps,
        algorithmId: algorithm.id,
        metricLabel: algorithm.metricLabel ?? DEFAULT_SNAPSHOT.metricLabel,
        exploredCount: countKeySteps(slice),
        pathLength: deriveArrayMetric(slice),
        foundPath: null,
        message: describeArrayStep(eff),
        explanation: eff.explanation,
        decision: eff.decision,
        recentMessages: getRecentMessages(slice),
      };
    } else {
      snapshot = {
        ...DEFAULT_SNAPSHOT,
        status: "completed",
        stepCount: totalSteps,
        totalSteps,
        algorithmId: algorithm.id,
        metricLabel: algorithm.metricLabel ?? DEFAULT_SNAPSHOT.metricLabel,
        exploredCount: countKeySteps(steps),
        pathLength: finalResult!.metricValue ?? deriveArrayMetric(steps),
        foundPath: finalResult!.found,
        message:
          finalResult!.message ??
          (finalResult!.found ? "Array algorithm completed." : "Array algorithm finished."),
        explanation: steps.at(-1)?.explanation,
        decision: steps.at(-1)?.decision,
        recentMessages: getRecentMessages(steps),
      };
    }

    frames.push({ visualState, snapshot });
  }

  return { frames, steps, milestoneSteps: deriveArrayMilestoneSteps(steps) };
}

function deriveArrayMilestoneSteps(steps: ArrayAlgorithmStep[]): number[] {
  const milestones: number[] = [];
  for (let i = 0; i < steps.length; i++) {
    const step = steps[i];
    if (step.action === "found" || step.action === "update_max") {
      milestones.push(i + 1);
    }
  }
  return milestones;
}
