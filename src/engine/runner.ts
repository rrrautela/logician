import type {
  AlgorithmPlugin,
  AlgorithmResult,
  AlgorithmStep,
} from "../types/algorithm";
import type { Cell } from "../types/grid";
import { clearTraversalState, cloneGrid } from "../utils/grid";

export type RunnerStatus =
  | "idle"
  | "ready"
  | "running"
  | "paused"
  | "completed"
  | "stopped";

export interface RunnerSnapshot {
  status: RunnerStatus;
  stepCount: number;
  totalSteps: number;
  exploredCount: number;
  pathLength: number;
  metricLabel: string;
  foundPath: boolean | null;
  message: string;
  algorithmId: string | null;
}

interface RunnerListeners {
  onGridUpdate: (grid: Cell[][]) => void;
  onSnapshotUpdate: (snapshot: RunnerSnapshot) => void;
}

const DEFAULT_SNAPSHOT: RunnerSnapshot = {
  status: "idle",
  stepCount: 0,
  totalSteps: 0,
  exploredCount: 0,
  pathLength: 0,
  metricLabel: "Path / Order",
  foundPath: null,
  message: "Generate or edit a grid, then start an algorithm.",
  algorithmId: null,
};

export type GridPlaybackFrame = {
  grid: Cell[][];
  snapshot: RunnerSnapshot;
};

export type GridPlaybackBundle = {
  frames: GridPlaybackFrame[];
  steps: AlgorithmStep[];
  milestoneSteps: number[];
};

export class VisualizationRunner {
  private baseGrid: Cell[][] = [];
  private displayGrid: Cell[][] = [];
  private executedSteps: AlgorithmStep[] = [];
  private algorithm: AlgorithmPlugin | null = null;
  private timerId: number | null = null;
  private speed = 400;
  private totalSteps = 0;
  private snapshot: RunnerSnapshot = DEFAULT_SNAPSHOT;
  private playbackBundle: GridPlaybackBundle | null = null;
  private autoPlayActive = false;

  constructor(private readonly listeners: RunnerListeners) {}

  hydrateFromBundle(
    baseGrid: Cell[][],
    algorithm: AlgorithmPlugin,
    bundle: GridPlaybackBundle,
  ): void {
    this.pause();
    this.baseGrid = cloneGrid(baseGrid);
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
    if (!this.algorithm || !this.playbackBundle) {
      return;
    }

    if (this.snapshot.status === "running") {
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

  stop(): void {
    this.autoPlayActive = false;
    this.pause();
    this.snapshot = {
      ...this.snapshot,
      status: "stopped",
      message: "Playback stopped. Reset to clear the board.",
    };
    this.emitSnapshot();
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
      message: `Board reset. ${this.algorithm.label} is ready.`,
    };
    this.listeners.onGridUpdate(cloneGrid(this.displayGrid));
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
    this.displayGrid = cloneGrid(frame.grid);
    this.snapshot = { ...frame.snapshot };
    this.emit();
  }

  private emit(): void {
    this.listeners.onGridUpdate(cloneGrid(this.displayGrid));
    this.emitSnapshot();
  }

  private emitSnapshot(): void {
    this.listeners.onSnapshotUpdate({ ...this.snapshot });
  }
}

export function buildGridPlaybackBundle(
  baseGrid: Cell[][],
  algorithm: AlgorithmPlugin,
): GridPlaybackBundle {
  const clean = clearTraversalState(cloneGrid(baseGrid));
  const gen = algorithm.run(clean);
  const steps: AlgorithmStep[] = [];
  let result: AlgorithmResult | null = null;
  while (true) {
    const r = gen.next();
    if (r.done) {
      result = r.value;
      break;
    }
    steps.push(r.value);
  }

  const totalSteps = steps.length;
  const frames: GridPlaybackFrame[] = [];

  if (totalSteps === 0) {
    const grid = clearTraversalState(cloneGrid(baseGrid));
    const snapshot: RunnerSnapshot = {
      status: "completed",
      stepCount: 0,
      totalSteps: 0,
      exploredCount: 0,
      pathLength:
        result?.metricValue ??
        deriveMetricValue([], algorithm.id) ??
        result?.path.length ??
        0,
      metricLabel: algorithm.metricLabel ?? DEFAULT_SNAPSHOT.metricLabel,
      foundPath: result?.found ?? null,
      message:
        result?.message ??
        (result?.found
          ? "Path found. Replay or edit the grid to explore another route."
          : "Search terminated without finding a path."),
      algorithmId: algorithm.id,
    };
    frames.push({ grid: cloneGrid(grid), snapshot });
    return { frames, steps: [], milestoneSteps: [] };
  }

  for (let i = 0; i <= totalSteps; i++) {
    let grid = clearTraversalState(cloneGrid(baseGrid));
    for (let j = 0; j < i; j++) {
      grid = applyStep(grid, steps[j]!);
    }
    const slice = steps.slice(0, i);
    const exploredCount = countUniqueExploredNodes(slice);
    const pathLength =
      deriveMetricValue(slice, algorithm.id) ?? countPathNodes(slice);

    let snapshot: RunnerSnapshot;

    if (i === 0) {
      snapshot = {
        status: "ready",
        stepCount: 0,
        totalSteps,
        exploredCount: 0,
        pathLength: 0,
        metricLabel: algorithm.metricLabel ?? DEFAULT_SNAPSHOT.metricLabel,
        foundPath: null,
        message: `Ready to run ${algorithm.label}.`,
        algorithmId: algorithm.id,
      };
    } else if (i < totalSteps) {
      const eff = steps[i - 1]!;
      snapshot = {
        status: "paused",
        stepCount: i,
        totalSteps,
        exploredCount,
        pathLength,
        metricLabel: algorithm.metricLabel ?? DEFAULT_SNAPSHOT.metricLabel,
        foundPath: null,
        message: describeStep(eff),
        algorithmId: algorithm.id,
      };
    } else {
      snapshot = {
        status: "completed",
        stepCount: totalSteps,
        totalSteps,
        exploredCount: countUniqueExploredNodes(steps),
        pathLength:
          result!.metricValue ??
          deriveMetricValue(steps, algorithm.id) ??
          result!.path.length,
        metricLabel: algorithm.metricLabel ?? DEFAULT_SNAPSHOT.metricLabel,
        foundPath: result!.found,
        message:
          result!.message ??
          (result!.found
            ? "Path found. Replay or edit the grid to explore another route."
            : "Search terminated without finding a path."),
        algorithmId: algorithm.id,
      };
    }

    frames.push({ grid: cloneGrid(grid), snapshot });
  }

  const milestoneSteps = deriveMilestoneSteps(steps);
  return { frames, steps, milestoneSteps };
}

function applyStep(grid: Cell[][], step: AlgorithmStep): Cell[][] {
  const targets = getStepTargets(step);
  const targetKeys = new Set(targets.map(([row, col]) => `${row}:${col}`));

  return grid.map((row) =>
    row.map((cell) => {
      const key = `${cell.row}:${cell.col}`;
      const isTarget = targetKeys.has(key);
      const nextCell = {
        ...cell,
        current: false,
        failed: false,
      };

      if (!isTarget) {
        return nextCell;
      }

      switch (step.type) {
        case "enqueue":
          return {
            ...nextCell,
            queued: true,
          };
        case "visit":
          return {
            ...nextCell,
            visited: true,
            queued: false,
            current: true,
            stepNumber: step.stepNumber ?? nextCell.stepNumber,
          };
        case "path":
          return {
            ...nextCell,
            path: true,
            cycle: false,
            current: true,
            queued: false,
            visited: true,
            stepNumber: step.stepNumber ?? nextCell.stepNumber,
          };
        case "backtrack":
          return {
            ...nextCell,
            visited: false,
            queued: false,
            path: false,
            cycle: false,
            current: false,
            backtracked: false,
            stepNumber: null,
          };
        case "fail":
          return {
            ...nextCell,
            failed: true,
            current: true,
          };
      }
    }),
  );
}

function describeStep(step: AlgorithmStep): string {
  const targets = getStepTargets(step);
  const [row, col] = targets[0] ?? [0, 0];
  switch (step.type) {
    case "enqueue":
      return `Queued (${row}, ${col}) for exploration.`;
    case "visit":
      return targets.length > 1
        ? `BFS frontier expanded across ${targets.length} cells in one layer.`
        : `Visiting cell (${row}, ${col}).`;
    case "path":
      return `Tracing final path through (${row}, ${col}).`;
    case "backtrack":
      return `Backtracking from (${row}, ${col}).`;
    case "fail":
      return "DFS is cycling in failure mode because no route to the end exists.";
  }
}

function getStepTargets(step: AlgorithmStep): [number, number][] {
  if (step.nodes?.length) {
    return step.nodes;
  }

  return step.node ? [step.node] : [];
}

function countUniqueExploredNodes(steps: AlgorithmStep[]): number {
  const explored = new Set<string>();

  for (const step of steps) {
    if (step.type !== "visit") {
      continue;
    }

    for (const [row, col] of getStepTargets(step)) {
      explored.add(`${row}:${col}`);
    }
  }

  return explored.size;
}

function countPathNodes(steps: AlgorithmStep[]): number {
  return steps.reduce(
    (count, step) => count + (step.type === "path" ? getStepTargets(step).length : 0),
    0,
  );
}

function deriveMetricValue(
  _steps: AlgorithmStep[],
  _algorithmId: string | null | undefined,
): number | null {
  return null;
}

function deriveMilestoneSteps(steps: AlgorithmStep[]): number[] {
  const milestones: number[] = [];
  for (let i = 0; i < steps.length; i++) {
    const step = steps[i];
    if (step.type === "path" || step.type === "fail") {
      milestones.push(i + 1);
    }
  }
  return milestones;
}
