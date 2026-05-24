import { SimulationRunner } from "./simulationRunner";
import type {
  AlgorithmPlugin,
  GridCellPatch,
  GridAlgorithmResult,
  GridStateDiff,
  GridStepEvent,
} from "../types/algorithm";
import type { Cell } from "../types/grid";
import type { SimulationSnapshot, StateEngine } from "../types/simulation";
import { clearTraversalState, cloneGrid } from "../utils/grid";

export type RunnerSnapshot = SimulationSnapshot;

interface RunnerListeners {
  onGridUpdate: (grid: Cell[][]) => void;
  onSnapshotUpdate: (snapshot: RunnerSnapshot) => void;
}

const DEFAULT_MESSAGE = "Generate or edit a grid, then start an algorithm.";

export const gridStateEngine: StateEngine<Cell[][], Cell[][], GridStepEvent, GridStateDiff> = {
  createInitialState(grid) {
    return clearTraversalState(cloneGrid(grid));
  },
  deriveDiff(previousState, step) {
    const targets = step.payload.nodes;
    const targetKeys = new Set(targets.map(([row, col]) => `${row}:${col}`));
    const patches: GridCellPatch[] = [];

    for (const row of previousState) {
      for (const cell of row) {
        if (cell.current || cell.failed) {
          patches.push({
            row: cell.row,
            col: cell.col,
            changes: {
              current: false,
              failed: false,
            },
          });
        }
      }
    }

    for (const row of previousState) {
      for (const cell of row) {
        const key = `${cell.row}:${cell.col}`;
        if (!targetKeys.has(key)) {
          continue;
        }

        switch (step.type) {
          case "enqueue":
            patches.push({
              row: cell.row,
              col: cell.col,
              changes: { queued: true },
            });
            break;
          case "visit":
            patches.push({
              row: cell.row,
              col: cell.col,
              changes: {
                visited: true,
                queued: false,
                current: true,
                backtracked: false,
                stepNumber: step.payload.stepNumber ?? cell.stepNumber,
              },
            });
            break;
          case "path":
            patches.push({
              row: cell.row,
              col: cell.col,
              changes: {
                path: true,
                current: true,
                queued: false,
                visited: true,
                backtracked: false,
                stepNumber: step.payload.stepNumber ?? cell.stepNumber,
              },
            });
            break;
          case "backtrack":
            patches.push({
              row: cell.row,
              col: cell.col,
              changes: {
                current: false,
                backtracked: true,
                stepNumber: step.payload.stepNumber ?? cell.stepNumber,
              },
            });
            break;
          case "fail":
            patches.push({
              row: cell.row,
              col: cell.col,
              changes: {
                failed: true,
                current: true,
              },
            });
            break;
        }
      }
    }

    return {
      type: "grid_patch",
      payload: {
        patches,
      },
    };
  },
  applyDiff(previousState, diff) {
    if (diff.payload.patches.length === 0) {
      return previousState;
    }

    const nextGrid = [...previousState];
    const updatedRows = new Map<number, Cell[]>();

    for (const patch of diff.payload.patches) {
      const currentRow = updatedRows.get(patch.row) ?? [...nextGrid[patch.row]!];
      const previousCell = currentRow[patch.col]!;
      currentRow[patch.col] = {
        ...previousCell,
        ...patch.changes,
      };
      updatedRows.set(patch.row, currentRow);
    }

    for (const [rowIndex, row] of updatedRows) {
      nextGrid[rowIndex] = row;
    }

    return nextGrid;
  },
};

export class VisualizationRunner {
  private readonly runner: SimulationRunner<
    Cell[][],
    Cell[][],
    GridStepEvent,
    GridStateDiff,
    GridAlgorithmResult
  >;

  constructor(listeners: RunnerListeners) {
    this.runner = new SimulationRunner({
      onStateUpdate: listeners.onGridUpdate,
      onSnapshotUpdate: listeners.onSnapshotUpdate,
    }, {
      stateEngine: gridStateEngine,
      deriveSnapshot: ({ algorithm, status, stepCount, totalSteps, currentStep, steps, result, milestoneSteps, performance }) => {
        const exploredCount = countUniqueExploredNodes(steps);
        const metricValue = countPathNodes(steps);

        return {
          status,
          stepCount,
          totalSteps,
          exploredCount,
          metricValue:
            status === "completed"
              ? result.metricValue ?? metricValue
              : metricValue,
          metricLabel: algorithm.metadata.metricLabel ?? "Path Length",
          foundResult: status === "completed" ? result.found : null,
          message: deriveGridMessage({
            algorithmLabel: algorithm.metadata.label,
            status,
            currentStep,
            resultMessage: result.message,
            totalSteps,
            stepCount,
          }),
          explanation: currentStep?.explanation,
          decision: currentStep?.decision,
          insightTags: currentStep?.insightTags ?? [],
          algorithmId: algorithm.id,
          recentMessages: steps.slice(-5).map((step) => step.explanation.what),
          recentEvents: buildRecentEvents(steps, milestoneSteps),
          milestoneSteps,
          performance,
        };
      },
      deriveMilestoneSteps: (steps) =>
        steps.flatMap((step, index) =>
          step.type === "path" || step.type === "fail" ? [index + 1] : [],
        ),
      checkpointInterval: 20,
    });
  }

  load(grid: Cell[][], algorithm: AlgorithmPlugin): void {
    this.runner.load(grid, algorithm);
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

  peekNextStep(): GridStepEvent | null {
    return this.runner.peekNextStep();
  }
}

function countUniqueExploredNodes(steps: GridStepEvent[]): number {
  const explored = new Set<string>();

  for (const step of steps) {
    if (step.type !== "visit") {
      continue;
    }

    for (const [row, col] of step.payload.nodes) {
      explored.add(`${row}:${col}`);
    }
  }

  return explored.size;
}

function countPathNodes(steps: GridStepEvent[]): number {
  return steps.reduce(
    (count, step) => count + (step.type === "path" ? step.payload.nodes.length : 0),
    0,
  );
}

function deriveGridMessage({
  algorithmLabel,
  status,
  currentStep,
  resultMessage,
  totalSteps,
  stepCount,
}: {
  algorithmLabel: string;
  status: RunnerSnapshot["status"];
  currentStep: GridStepEvent | null;
  resultMessage?: string;
  totalSteps: number;
  stepCount: number;
}): string {
  if (totalSteps === 0) {
    return resultMessage ?? DEFAULT_MESSAGE;
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

  return DEFAULT_MESSAGE;
}

function buildRecentEvents(
  steps: GridStepEvent[],
  milestoneSteps: number[],
): RunnerSnapshot["recentEvents"] {
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
