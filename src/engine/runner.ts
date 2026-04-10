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
  exploredCount: 0,
  pathLength: 0,
  metricLabel: "Path / Order",
  foundPath: null,
  message: "Generate or edit a grid, then start an algorithm.",
  algorithmId: null,
};

export class VisualizationRunner {
  private baseGrid: Cell[][] = [];
  private displayGrid: Cell[][] = [];
  private generator: Generator<AlgorithmStep, AlgorithmResult, void> | null =
    null;
  private executedSteps: AlgorithmStep[] = [];
  private gridHistory: Cell[][][] = [];
  private snapshotHistory: RunnerSnapshot[] = [];
  private algorithm: AlgorithmPlugin | null = null;
  private timerId: number | null = null;
  private speed = 110;
  private snapshot: RunnerSnapshot = DEFAULT_SNAPSHOT;

  constructor(private readonly listeners: RunnerListeners) {}

  configure(baseGrid: Cell[][], algorithm: AlgorithmPlugin): void {
    this.pause();
    this.baseGrid = cloneGrid(baseGrid);
    this.displayGrid = clearTraversalState(cloneGrid(baseGrid));
    this.generator = null;
    this.executedSteps = [];
    this.algorithm = algorithm;
    this.snapshot = {
      status: "ready",
      stepCount: 0,
      exploredCount: 0,
      pathLength: 0,
      metricLabel: algorithm.metricLabel ?? DEFAULT_SNAPSHOT.metricLabel,
      foundPath: null,
      message: `Ready to run ${algorithm.label}.`,
      algorithmId: algorithm.id,
    };
    this.gridHistory = [cloneGrid(this.displayGrid)];
    this.snapshotHistory = [{ ...this.snapshot }];
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
    if (!this.algorithm) {
      return;
    }

    if (this.snapshot.status === "running") {
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

  stop(): void {
    this.pause();
    this.snapshot = {
      ...this.snapshot,
      status: "stopped",
      message: "Playback stopped. Reset to clear the board.",
    };
    this.emitSnapshot();
  }

  reset(baseGrid?: Cell[][]): void {
    this.pause();
    if (baseGrid) {
      this.baseGrid = cloneGrid(baseGrid);
    }
    this.displayGrid = clearTraversalState(cloneGrid(this.baseGrid));
    this.generator = null;
    this.executedSteps = [];
    this.snapshot = {
      status: this.algorithm ? "ready" : "idle",
      stepCount: 0,
      exploredCount: 0,
      pathLength: 0,
      metricLabel: this.algorithm?.metricLabel ?? DEFAULT_SNAPSHOT.metricLabel,
      foundPath: null,
      message: this.algorithm
        ? `Board reset. ${this.algorithm.label} is ready.`
        : DEFAULT_SNAPSHOT.message,
      algorithmId: this.algorithm?.id ?? null,
    };
    this.gridHistory = [cloneGrid(this.displayGrid)];
    this.snapshotHistory = [{ ...this.snapshot }];
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
    if (!this.algorithm) {
      return;
    }

    if (this.snapshot.status === "running") {
      this.pause();
    }

    if (this.executedSteps.length === 0) {
      return;
    }

    this.executedSteps.pop();
    if (this.gridHistory.length > 1) {
      this.gridHistory.pop();
    }
    if (this.snapshotHistory.length > 1) {
      this.snapshotHistory.pop();
    }
    this.rebuildGeneratorFromHistory();
    this.restorePreviousState();
  }

  dispose(): void {
    this.pause();
  }

  private ensureGenerator(): void {
    if (!this.generator && this.algorithm) {
      const cleanGrid = clearTraversalState(cloneGrid(this.baseGrid));
      this.generator = this.algorithm.run(cleanGrid);
    }
  }

  private rebuildGeneratorFromHistory(): void {
    if (!this.algorithm) {
      this.generator = null;
      return;
    }

    const cleanGrid = clearTraversalState(cloneGrid(this.baseGrid));
    this.generator = this.algorithm.run(cleanGrid);

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
    this.rebuildFromHistory(result.value);
  }

  private finish(result: AlgorithmResult): void {
    this.pause();
    this.snapshot = {
      ...this.snapshot,
      status: "completed",
      exploredCount: countUniqueExploredNodes(this.executedSteps),
      pathLength:
        result.metricValue ??
        deriveMetricValue(this.executedSteps, this.algorithm?.id) ??
        result.path.length,
      foundPath: result.found,
      message:
        result.message ??
        (result.found
          ? "Path found. Replay or edit the grid to explore another route."
          : "Search terminated without finding a path."),
    };
    this.snapshotHistory[this.snapshotHistory.length - 1] = { ...this.snapshot };
    this.emitSnapshot();
  }

  private emit(): void {
    this.listeners.onGridUpdate(cloneGrid(this.displayGrid));
    this.emitSnapshot();
  }

  private emitSnapshot(): void {
    this.listeners.onSnapshotUpdate({ ...this.snapshot });
  }

  private rebuildFromHistory(latestStep?: AlgorithmStep): void {
    let nextGrid = clearTraversalState(cloneGrid(this.baseGrid));
    const effectiveStep = latestStep ?? this.executedSteps.at(-1);
    const exploredCount = countUniqueExploredNodes(this.executedSteps);
    const pathLength =
      deriveMetricValue(this.executedSteps, this.algorithm?.id) ??
      countPathNodes(this.executedSteps);

    for (const step of this.executedSteps) {
      nextGrid = applyStep(nextGrid, step);
    }

    this.displayGrid = nextGrid;
    this.snapshot = {
      ...this.snapshot,
      status:
        this.executedSteps.length === 0
          ? this.algorithm
            ? "ready"
            : "idle"
          : this.snapshot.status === "completed"
            ? "paused"
            : this.snapshot.status,
      stepCount: this.executedSteps.length,
      exploredCount,
      pathLength,
      metricLabel: this.algorithm?.metricLabel ?? DEFAULT_SNAPSHOT.metricLabel,
      foundPath: null,
      message: effectiveStep
        ? describeStep(effectiveStep)
        : this.algorithm
          ? `Ready to run ${this.algorithm.label}.`
          : DEFAULT_SNAPSHOT.message,
    };
    this.gridHistory.push(cloneGrid(this.displayGrid));
    this.snapshotHistory.push({ ...this.snapshot });
    this.emit();
  }

  private restorePreviousState(): void {
    const previousGrid = this.gridHistory.at(-1);
    const previousSnapshot = this.snapshotHistory.at(-1);

    if (!previousGrid || !previousSnapshot) {
      this.displayGrid = clearTraversalState(cloneGrid(this.baseGrid));
      this.snapshot = {
        status: this.algorithm ? "ready" : "idle",
        stepCount: 0,
        exploredCount: 0,
        pathLength: 0,
        metricLabel: this.algorithm?.metricLabel ?? DEFAULT_SNAPSHOT.metricLabel,
        foundPath: null,
        message: this.algorithm
          ? `Ready to run ${this.algorithm.label}.`
          : DEFAULT_SNAPSHOT.message,
        algorithmId: this.algorithm?.id ?? null,
      };
    } else {
      this.displayGrid = cloneGrid(previousGrid);
      this.snapshot = {
        ...previousSnapshot,
        status:
          previousSnapshot.status === "completed" ? "paused" : previousSnapshot.status,
        foundPath: null,
      };
    }

    this.emit();
  }
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
