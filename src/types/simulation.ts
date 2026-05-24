export interface AlgorithmMetadata {
  label: string;
  family: string;
  description: string;
  behaviorNote: string;
  metricLabel?: string;
  intuition?: string;
  keyIdea?: string;
  timeComplexity?: string;
  spaceComplexity?: string;
}

export interface StepExplanation {
  what: string;
  why: string;
  impact: string;
  next?: string;
}

export interface StepDecision {
  options: string[];
  chosen: string;
  reasoning: string;
}

export interface StepPredictionPrompt {
  question: string;
  options?: string[];
  allowFreeform?: boolean;
}

export interface StepHistoryItem {
  index: number;
  type: string;
  summary: string;
  insightTags: string[];
  isMilestone: boolean;
}

export interface StepEvent<
  TType extends string = string,
  TPayload extends object = object,
  TPointers extends object | undefined = object | undefined,
> {
  type: TType;
  payload: TPayload;
  explanation: StepExplanation;
  decision?: StepDecision;
  insightTags?: string[];
  prediction?: StepPredictionPrompt;
  pointers?: TPointers;
  timestamp?: number;
}

export interface SimulationResult {
  found: boolean;
  terminated: boolean;
  message?: string;
  metricValue?: number;
}

export interface StateDiff<
  TType extends string = string,
  TPayload extends object = object,
> {
  type: TType;
  payload: TPayload;
}

export interface AlgorithmPlugin<
  TInput,
  TEvent extends StepEvent = StepEvent,
  TResult extends SimulationResult = SimulationResult,
> {
  id: string;
  metadata: AlgorithmMetadata;
  execute(input: TInput): Generator<TEvent, TResult, void>;
}

export interface TimelineEntry<
  TEvent extends StepEvent = StepEvent,
  TDiff extends StateDiff = StateDiff,
> {
  index: number;
  timestamp: number;
  step: TEvent;
  diff: TDiff;
}

export interface TimelineCheckpoint<TState> {
  index: number;
  state: TState;
}

export interface Timeline<
  TEvent extends StepEvent = StepEvent,
  TDiff extends StateDiff = StateDiff,
  TState = unknown,
> {
  entries: TimelineEntry<TEvent, TDiff>[];
  checkpoints: TimelineCheckpoint<TState>[];
  currentIndex: number;
}

export interface StateEngine<
  TInput,
  TState,
  TEvent extends StepEvent = StepEvent,
  TDiff extends StateDiff = StateDiff,
> {
  createInitialState(input: TInput): TState;
  deriveDiff(
    previousState: TState,
    step: TEvent,
    context: { stepIndex: number; totalSteps: number },
  ): TDiff;
  applyDiff(
    previousState: TState,
    diff: TDiff,
    context: { stepIndex: number; totalSteps: number },
  ): TState;
}

export type SimulationStatus =
  | "idle"
  | "ready"
  | "running"
  | "paused"
  | "completed"
  | "stopped";

export interface SimulationSnapshot {
  status: SimulationStatus;
  stepCount: number;
  totalSteps: number;
  exploredCount: number;
  metricValue: number;
  metricLabel: string;
  foundResult: boolean | null;
  message: string;
  explanation?: StepExplanation;
  decision?: StepDecision;
  insightTags: string[];
  algorithmId: string | null;
  recentMessages: string[];
  recentEvents: StepHistoryItem[];
  milestoneSteps: number[];
  performance: SimulationPerformanceMetrics;
}

export interface SimulationPerformanceMetrics {
  totalSteps: number;
  checkpointCount: number;
  avgDiffBuildMs: number;
  avgApplyDiffMs: number;
  avgReplayMs: number;
  estimatedTimelineBytes: number;
  estimatedCheckpointBytes: number;
  estimatedBaselineSnapshotBytes: number;
}
