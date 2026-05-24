import { TimelineEngine } from "./timelineEngine";
import type {
  AlgorithmPlugin,
  SimulationPerformanceMetrics,
  SimulationResult,
  SimulationSnapshot,
  SimulationStatus,
  StateDiff,
  StateEngine,
  StepEvent,
} from "../types/simulation";

interface SimulationRunnerListeners<TState> {
  onStateUpdate: (state: TState) => void;
  onSnapshotUpdate: (snapshot: SimulationSnapshot) => void;
}

interface SnapshotContext<
  TInput,
  TState,
  TEvent extends StepEvent,
  TDiff extends StateDiff,
  TResult extends SimulationResult,
> {
  algorithm: AlgorithmPlugin<TInput, TEvent, TResult>;
  input: TInput;
  state: TState;
  status: SimulationStatus;
  stepCount: number;
  totalSteps: number;
  currentStep: TEvent | null;
  currentDiff: TDiff | null;
  steps: TEvent[];
  diffs: TDiff[];
  result: TResult;
  milestoneSteps: number[];
  performance: SimulationPerformanceMetrics;
}

interface SimulationRunnerConfig<
  TInput,
  TState,
  TEvent extends StepEvent,
  TDiff extends StateDiff,
  TResult extends SimulationResult,
> {
  stateEngine: StateEngine<TInput, TState, TEvent, TDiff>;
  deriveSnapshot: (
    context: SnapshotContext<TInput, TState, TEvent, TDiff, TResult>,
  ) => SimulationSnapshot;
  deriveMilestoneSteps?: (steps: TEvent[]) => number[];
  autoPauseOnStep?: (step: TEvent) => boolean;
  checkpointInterval?: number;
}

const DEFAULT_PERFORMANCE: SimulationPerformanceMetrics = {
  totalSteps: 0,
  checkpointCount: 0,
  avgDiffBuildMs: 0,
  avgApplyDiffMs: 0,
  avgReplayMs: 0,
  estimatedTimelineBytes: 0,
  estimatedCheckpointBytes: 0,
  estimatedBaselineSnapshotBytes: 0,
};

export class SimulationRunner<
  TInput,
  TState,
  TEvent extends StepEvent,
  TDiff extends StateDiff,
  TResult extends SimulationResult,
> {
  private readonly timeline = new TimelineEngine<TEvent, TDiff, TState>();
  private algorithm: AlgorithmPlugin<TInput, TEvent, TResult> | null = null;
  private input: TInput | null = null;
  private result: TResult | null = null;
  private status: SimulationStatus = "idle";
  private timerId: number | null = null;
  private speed = 400;
  private autoPlayActive = false;
  private milestoneSteps: number[] = [];
  private currentState: TState | null = null;
  private currentResolvedIndex = 0;
  private performance: SimulationPerformanceMetrics = DEFAULT_PERFORMANCE;

  constructor(
    private readonly listeners: SimulationRunnerListeners<TState>,
    private readonly config: SimulationRunnerConfig<TInput, TState, TEvent, TDiff, TResult>,
  ) {}

  load(input: TInput, algorithm: AlgorithmPlugin<TInput, TEvent, TResult>): void {
    this.pause();

    const steps: TEvent[] = [];
    const iterator = algorithm.execute(input);
    let result: TResult | null = null;

    while (true) {
      const next = iterator.next();
      if (next.done) {
        result = next.value;
        break;
      }

      steps.push(next.value);
    }

    if (!result) {
      throw new Error(`Algorithm "${algorithm.id}" terminated without a result.`);
    }

    const checkpointInterval = Math.max(1, this.config.checkpointInterval ?? 20);
    const initialState = this.config.stateEngine.createInitialState(input);
    const entries: Array<{ step: TEvent; diff: TDiff }> = [];
    const checkpoints: Array<{ index: number; state: TState }> = [{ index: 0, state: initialState }];
    let buildState = initialState;
    let totalDiffBuildMs = 0;
    let totalApplyDiffMs = 0;

    for (let index = 0; index < steps.length; index += 1) {
      const step = steps[index]!;
      const diffStart = performance.now();
      const diff = this.config.stateEngine.deriveDiff(buildState, step, {
        stepIndex: index + 1,
        totalSteps: steps.length,
      });
      totalDiffBuildMs += performance.now() - diffStart;

      const applyStart = performance.now();
      buildState = this.config.stateEngine.applyDiff(buildState, diff, {
        stepIndex: index + 1,
        totalSteps: steps.length,
      });
      totalApplyDiffMs += performance.now() - applyStart;

      entries.push({ step, diff });

      if ((index + 1) % checkpointInterval === 0 || index + 1 === steps.length) {
        checkpoints.push({ index: index + 1, state: buildState });
      }
    }

    this.algorithm = algorithm;
    this.input = input;
    this.result = result;
    this.timeline.load(entries, checkpoints);
    this.milestoneSteps = this.config.deriveMilestoneSteps?.(steps) ?? [];
    this.status = steps.length === 0 ? "completed" : "ready";
    this.currentState = initialState;
    this.currentResolvedIndex = 0;
    this.performance = {
      totalSteps: steps.length,
      checkpointCount: checkpoints.length,
      avgDiffBuildMs: steps.length > 0 ? totalDiffBuildMs / steps.length : 0,
      avgApplyDiffMs: steps.length > 0 ? totalApplyDiffMs / steps.length : 0,
      avgReplayMs: 0,
      estimatedTimelineBytes: roughSize(entries),
      estimatedCheckpointBytes: roughSize(checkpoints),
      estimatedBaselineSnapshotBytes: roughSize(buildState) * Math.max(1, steps.length),
    };
    this.emit();
  }

  setSpeed(speed: number): void {
    this.speed = speed;
    if (this.status === "running") {
      this.pause();
      this.start();
    }
  }

  start(): void {
    if (!this.algorithm || !this.result) {
      return;
    }

    if (this.status === "running" || this.timeline.isEnd()) {
      return;
    }

    this.status = "running";
    this.autoPlayActive = true;
    this.emit();
    this.schedule();
  }

  pause(): void {
    this.autoPlayActive = false;
    if (this.timerId !== null) {
      window.clearTimeout(this.timerId);
      this.timerId = null;
    }

    if (this.status === "running") {
      this.status = "paused";
      this.emitSnapshotOnly();
    }
  }

  reset(): void {
    if (!this.algorithm || !this.input) {
      return;
    }

    this.pause();
    this.timeline.reset();
    this.currentState = this.timeline.checkpoints[0]?.state ?? this.config.stateEngine.createInitialState(this.input);
    this.currentResolvedIndex = 0;
    this.status = "ready";
    this.emit();
  }

  stepForward(): void {
    if (!this.algorithm) {
      return;
    }

    if (this.status === "running") {
      this.pause();
    }

    if (this.timeline.isEnd()) {
      return;
    }

    this.timeline.next();
    this.status = this.timeline.isEnd() ? "completed" : "paused";
    this.emit();
  }

  stepBackward(): void {
    if (!this.algorithm) {
      return;
    }

    if (this.status === "running") {
      this.pause();
    }

    if (this.timeline.isStart()) {
      return;
    }

    this.timeline.prev();
    this.status = this.timeline.isStart() ? "ready" : "paused";
    this.emit();
  }

  seek(index: number): void {
    if (!this.algorithm) {
      return;
    }

    this.pause();
    this.timeline.seek(index);
    this.status = this.timeline.isEnd()
      ? "completed"
      : this.timeline.isStart()
        ? "ready"
        : "paused";
    this.emit();
  }

  dispose(): void {
    this.pause();
  }

  getMilestoneSteps(): number[] {
    return [...this.milestoneSteps];
  }

  peekNextStep(): TEvent | null {
    const nextEntry = this.timeline.getEntry(this.timeline.currentIndex + 1);
    return nextEntry?.step ?? null;
  }

  private schedule(): void {
    this.timerId = window.setTimeout(() => {
      this.consumeNext();
      if (this.autoPlayActive && !this.timeline.isEnd()) {
        this.schedule();
        return;
      }

      this.autoPlayActive = false;
      if (this.timerId !== null) {
        window.clearTimeout(this.timerId);
        this.timerId = null;
      }
    }, this.speed);
  }

  private consumeNext(): void {
    if (!this.algorithm || !this.result || this.timeline.isEnd()) {
      return;
    }

    this.timeline.next();
    const currentStep = this.timeline.getCurrentStep();
    const shouldPause = currentStep
      ? this.config.autoPauseOnStep?.(currentStep) ?? false
      : false;

    this.status = this.timeline.isEnd() ? "completed" : "running";
    this.emit();

    if (shouldPause && !this.timeline.isEnd()) {
      this.pause();
    }
  }

  private emit(): void {
    if (!this.algorithm || !this.input || !this.result) {
      return;
    }

    const stepCount = this.timeline.currentIndex;
    const totalSteps = this.timeline.entries.length;
    const state = this.reconstructState(stepCount);
    const snapshot = this.config.deriveSnapshot({
      algorithm: this.algorithm,
      input: this.input,
      state,
      status: this.status,
      stepCount,
      totalSteps,
      currentStep: this.timeline.getCurrentStep(),
      currentDiff: this.timeline.getCurrentDiff(),
      steps: this.timeline.getEntriesUntil(stepCount).map((entry) => entry.step),
      diffs: this.timeline.getEntriesUntil(stepCount).map((entry) => entry.diff),
      result: this.result,
      milestoneSteps: this.milestoneSteps,
      performance: this.performance,
    });

    this.listeners.onStateUpdate(state);
    this.listeners.onSnapshotUpdate({
      ...snapshot,
      milestoneSteps: [...snapshot.milestoneSteps],
      performance: { ...snapshot.performance },
    });
  }

  private emitSnapshotOnly(): void {
    if (!this.algorithm || !this.input || !this.result) {
      return;
    }

    const stepCount = this.timeline.currentIndex;
    const state = this.reconstructState(stepCount);
    const snapshot = this.config.deriveSnapshot({
      algorithm: this.algorithm,
      input: this.input,
      state,
      status: this.status,
      stepCount,
      totalSteps: this.timeline.entries.length,
      currentStep: this.timeline.getCurrentStep(),
      currentDiff: this.timeline.getCurrentDiff(),
      steps: this.timeline.getEntriesUntil(stepCount).map((entry) => entry.step),
      diffs: this.timeline.getEntriesUntil(stepCount).map((entry) => entry.diff),
      result: this.result,
      milestoneSteps: this.milestoneSteps,
      performance: this.performance,
    });

    this.listeners.onSnapshotUpdate({
      ...snapshot,
      milestoneSteps: [...snapshot.milestoneSteps],
      performance: { ...snapshot.performance },
    });
  }

  private reconstructState(targetIndex: number): TState {
    if (this.currentState !== null && targetIndex === this.currentResolvedIndex) {
      return this.currentState;
    }

    const replayStart = performance.now();
    let state: TState;
    let startIndex: number;

    if (this.currentState !== null && targetIndex === this.currentResolvedIndex + 1) {
      const entry = this.timeline.getEntry(targetIndex)!;
      state = this.config.stateEngine.applyDiff(this.currentState, entry.diff, {
        stepIndex: targetIndex,
        totalSteps: this.timeline.entries.length,
      });
      startIndex = targetIndex;
    } else {
      const checkpoint = this.timeline.getNearestCheckpoint(targetIndex);
      if (!checkpoint) {
        throw new Error(`No checkpoint available for step ${targetIndex}.`);
      }

      state = checkpoint.state;
      startIndex = checkpoint.index;

      for (let stepIndex = startIndex + 1; stepIndex <= targetIndex; stepIndex += 1) {
        const entry = this.timeline.getEntry(stepIndex)!;
        state = this.config.stateEngine.applyDiff(state, entry.diff, {
          stepIndex,
          totalSteps: this.timeline.entries.length,
        });
      }
    }

    this.currentState = state;
    this.currentResolvedIndex = targetIndex;
    const replayMs = performance.now() - replayStart;
    const replayCount = targetIndex === 0 ? 1 : targetIndex;
    this.performance = {
      ...this.performance,
      avgReplayMs:
        this.performance.avgReplayMs === 0
          ? replayMs
          : (this.performance.avgReplayMs * Math.max(replayCount - 1, 1) + replayMs) /
            Math.max(replayCount, 1),
    };

    return state;
  }
}

function roughSize(value: unknown): number {
  try {
    return JSON.stringify(value).length * 2;
  } catch {
    return 0;
  }
}
