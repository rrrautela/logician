import type {
  StateDiff,
  StepEvent,
  Timeline,
  TimelineCheckpoint,
  TimelineEntry,
} from "../types/simulation";

export class TimelineEngine<
  TEvent extends StepEvent = StepEvent,
  TDiff extends StateDiff = StateDiff,
  TState = unknown,
> implements Timeline<TEvent, TDiff, TState>
{
  entries: TimelineEntry<TEvent, TDiff>[] = [];
  checkpoints: TimelineCheckpoint<TState>[] = [];
  currentIndex = 0;

  load(
    entries: Array<{ step: TEvent; diff: TDiff }>,
    checkpoints: TimelineCheckpoint<TState>[],
  ): void {
    this.entries = entries.map((entry, index) => ({
      index: index + 1,
      step: {
        ...entry.step,
        timestamp: entry.step.timestamp ?? index,
      },
      diff: entry.diff,
      timestamp: entry.step.timestamp ?? index,
    }));
    this.checkpoints = checkpoints;
    this.currentIndex = 0;
  }

  next(): number {
    this.currentIndex = Math.min(this.currentIndex + 1, this.entries.length);
    return this.currentIndex;
  }

  prev(): number {
    this.currentIndex = Math.max(this.currentIndex - 1, 0);
    return this.currentIndex;
  }

  seek(index: number): number {
    this.currentIndex = Math.max(0, Math.min(Math.round(index), this.entries.length));
    return this.currentIndex;
  }

  reset(): void {
    this.currentIndex = 0;
  }

  getCurrentStep(): TEvent | null {
    if (this.currentIndex <= 0) {
      return null;
    }

    return this.entries[this.currentIndex - 1]?.step ?? null;
  }

  getCurrentDiff(): TDiff | null {
    if (this.currentIndex <= 0) {
      return null;
    }

    return this.entries[this.currentIndex - 1]?.diff ?? null;
  }

  getEntry(index: number): TimelineEntry<TEvent, TDiff> | null {
    if (index <= 0) {
      return null;
    }

    return this.entries[index - 1] ?? null;
  }

  getEntriesUntil(index: number): TimelineEntry<TEvent, TDiff>[] {
    return this.entries.slice(0, index);
  }

  getNearestCheckpoint(targetIndex: number): TimelineCheckpoint<TState> | null {
    let checkpoint: TimelineCheckpoint<TState> | null = null;
    for (const candidate of this.checkpoints) {
      if (candidate.index <= targetIndex) {
        checkpoint = candidate;
      } else {
        break;
      }
    }

    return checkpoint;
  }

  getProgress(): number {
    if (this.entries.length === 0) {
      return 0;
    }

    return this.currentIndex / this.entries.length;
  }

  isStart(): boolean {
    return this.currentIndex === 0;
  }

  isEnd(): boolean {
    return this.currentIndex >= this.entries.length;
  }
}
