import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { AlgorithmPlugin } from "../types/algorithm";
import type { ArrayAlgorithmPlugin } from "../types/arrayAlgorithm";
import type { GraphAlgorithmPlugin } from "../types/graphAlgorithm";
import type { SimulationSnapshot, StepEvent } from "../types/simulation";

type SpeedRate = { label: string; ms: number };
type EventFilter = "all" | "milestones" | "bookmarks";

const SPEED_RATES: SpeedRate[] = [
  { label: "Slow", ms: 533 },
  { label: "Normal", ms: 400 },
  { label: "Fast", ms: 267 },
  { label: "Very Fast", ms: 200 },
];

interface AlgorithmInfo {
  timeComplexity: string | null;
  spaceComplexity: string | null;
  keyIdea: string | null;
}

interface PendingPrediction {
  step: StepEvent;
  stepIndex: number;
  selectedOption: string | null;
  submitted: boolean;
}

interface ControlsProps {
  algorithm: AlgorithmPlugin | ArrayAlgorithmPlugin | GraphAlgorithmPlugin;
  snapshot: SimulationSnapshot;
  speed: number;
  generateLabel?: string;
  onGenerate: () => void;
  onTogglePlayback: () => void;
  onReset: () => void;
  onPreviousStep: () => void;
  onNextStep: () => void;
  onSeek: (step: number) => void;
  onSpeedChange: (speed: number) => void;
  onGenerateRandom?: () => void;
  presets?: Array<{ id: string; label: string }>;
  selectedPresetId?: string;
  onSelectPreset?: (presetId: string) => void;
  milestoneSteps?: number[];
  algorithmInfo?: AlgorithmInfo;
  predictMode: boolean;
  pendingPrediction: PendingPrediction | null;
  onTogglePredictMode: () => void;
  onSelectPrediction: (option: string) => void;
  onSubmitPrediction: () => void;
  onRevealPrediction: () => void;
}

export function Controls({
  algorithm,
  snapshot,
  speed,
  generateLabel,
  onGenerate,
  onTogglePlayback,
  onReset,
  onPreviousStep,
  onNextStep,
  onSeek,
  onSpeedChange,
  onGenerateRandom,
  presets,
  selectedPresetId,
  onSelectPreset,
  milestoneSteps = [],
  algorithmInfo,
  predictMode,
  pendingPrediction,
  onTogglePredictMode,
  onSelectPrediction,
  onSubmitPrediction,
  onRevealPrediction,
}: ControlsProps) {
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [infoOpen, setInfoOpen] = useState(false);
  const [debuggerOpen, setDebuggerOpen] = useState(false);
  const [eventFilter, setEventFilter] = useState<EventFilter>("all");
  const [bookmarkedSteps, setBookmarkedSteps] = useState<Set<number>>(() => new Set());
  const [hoverStep, setHoverStep] = useState<number | null>(null);
  const [tooltipX, setTooltipX] = useState(0);
  const seekBarRef = useRef<HTMLInputElement>(null);
  const infoRef = useRef<HTMLDivElement>(null);

  const currentStep = snapshot.stepCount;
  const totalSteps = snapshot.totalSteps;
  const resolvedGenerateLabel =
    generateLabel ??
    (algorithm.metadata.family === "array" ? "Load Example Array" : "Generate Random Grid");
  const previousDisabled = currentStep === 0;
  const resetDisabled = currentStep === 0 && snapshot.status !== "completed";
  const scrubDisabled = totalSteps <= 0;
  const scrubMax = Math.max(0, totalSteps);
  const scrubValue = scrubDisabled ? 0 : Math.min(currentStep, scrubMax);
  const scrubProgress = scrubMax > 0 ? Math.min(100, (currentStep / scrubMax) * 100) : 0;
  const nextDisabled =
    snapshot.status === "running" ||
    Boolean(pendingPrediction) ||
    (totalSteps > 0 && currentStep >= totalSteps);
  const isRunning = snapshot.status === "running";
  const playPauseLabel = isRunning ? "Pause" : predictMode ? "Predict" : "Play";
  const speedLabel = nearestSpeedLabel(speed);
  const predictionOptions = useMemo(
    () =>
      pendingPrediction?.step.prediction?.options ??
      pendingPrediction?.step.decision?.options ??
      [pendingPrediction?.step.explanation.what ?? "Reveal next step"],
    [pendingPrediction],
  );
  const correctPrediction = pendingPrediction?.step.decision?.chosen ?? predictionOptions[0] ?? "";
  const predictionIsCorrect =
    pendingPrediction?.submitted &&
    pendingPrediction.selectedOption !== null &&
    pendingPrediction.selectedOption === correctPrediction;
  const bookmarkedEventSteps = useMemo(
    () => [...bookmarkedSteps].sort((first, second) => first - second),
    [bookmarkedSteps],
  );
  const visibleDebuggerEvents = useMemo(() => {
    if (eventFilter === "milestones") {
      return snapshot.recentEvents.filter((event) => event.isMilestone);
    }

    if (eventFilter === "bookmarks") {
      return snapshot.recentEvents.filter((event) => bookmarkedSteps.has(event.index));
    }

    return snapshot.recentEvents;
  }, [bookmarkedSteps, eventFilter, snapshot.recentEvents]);

  const handleSeekMouseMove = useCallback(
    (event: React.MouseEvent<HTMLInputElement>) => {
      const bar = event.currentTarget;
      const rect = bar.getBoundingClientRect();
      const x = event.clientX - rect.left;
      const ratio = Math.max(0, Math.min(1, x / rect.width));
      const step = Math.round(ratio * scrubMax);
      setHoverStep(step);
      setTooltipX(x);
    },
    [scrubMax],
  );

  const handleSeekMouseLeave = useCallback(() => {
    setHoverStep(null);
  }, []);

  useEffect(() => {
    if (!infoOpen) {
      return;
    }

    const handler = (event: MouseEvent) => {
      if (infoRef.current && !infoRef.current.contains(event.target as Node)) {
        setInfoOpen(false);
      }
    };

    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [infoOpen]);

  const hasInfo =
    Boolean(
      algorithmInfo &&
        (algorithmInfo.timeComplexity ||
          algorithmInfo.spaceComplexity ||
          algorithmInfo.keyIdea),
    );

  return (
    <section className="controls-panel controls-panel--enhanced media-player">
      <div className="media-player__scrubber">
        <div className="seek-bar-container">
          <input
            ref={seekBarRef}
            type="range"
            className="seek-bar media-player__seek"
            min={0}
            max={scrubDisabled ? 1 : scrubMax}
            step={1}
            value={scrubValue}
            disabled={scrubDisabled}
            style={{ ["--slider-progress" as string]: `${scrubProgress}%` }}
            onChange={(event) => onSeek(Number(event.target.value))}
            onMouseMove={handleSeekMouseMove}
            onMouseLeave={handleSeekMouseLeave}
            aria-label="Seek to step"
            aria-valuemin={0}
            aria-valuemax={totalSteps}
            aria-valuenow={currentStep}
            aria-valuetext={`Step ${currentStep} of ${totalSteps}`}
          />
          {!scrubDisabled && scrubMax > 0 && milestoneSteps.length > 0 && (
            <div className="seek-bar__milestones" aria-hidden="true">
              {milestoneSteps.map((step) => (
                <span
                  key={step}
                  className="seek-bar__milestone"
                  style={{ left: `${(step / scrubMax) * 100}%` }}
                  title={`Milestone at step ${step}`}
                />
              ))}
            </div>
          )}
          {hoverStep !== null && !scrubDisabled && (
            <div
              className="seek-bar__tooltip"
              style={{ left: `${tooltipX}px` }}
              aria-hidden="true"
            >
              Step {hoverStep}
            </div>
          )}
        </div>
        <div className="media-player__time" aria-hidden="true">
          <span>Step {currentStep}</span>
          <span className="media-player__time-sep">/</span>
          <span>{totalSteps}</span>
        </div>
      </div>

      <div className="media-player__row">
        <div className="media-player__left">
          <div className="media-player__left-btns">
            <button
              type="button"
              className={`media-player__settings-toggle ${settingsOpen ? "is-open" : ""}`}
              onClick={() => {
                setSettingsOpen((open) => !open);
                setInfoOpen(false);
                setDebuggerOpen(false);
              }}
              aria-expanded={settingsOpen}
              aria-controls="media-player-settings"
              aria-label={settingsOpen ? "Close settings" : "Open settings"}
              title="Settings"
            >
              Config
            </button>
            {hasInfo && (
              <button
                type="button"
                className={`media-player__info-toggle ${infoOpen ? "is-open" : ""}`}
                onClick={() => {
                  setInfoOpen((open) => !open);
                  setSettingsOpen(false);
                  setDebuggerOpen(false);
                }}
                aria-expanded={infoOpen}
                aria-label={infoOpen ? "Close algorithm info" : "Show algorithm info"}
                title="Algorithm Info"
              >
                Info
              </button>
            )}
            <button
              type="button"
              className={`media-player__info-toggle ${debuggerOpen ? "is-open" : ""}`}
              onClick={() => {
                setDebuggerOpen((open) => !open);
                setSettingsOpen(false);
                setInfoOpen(false);
              }}
              aria-expanded={debuggerOpen}
              aria-label={debuggerOpen ? "Close event inspector" : "Show event inspector"}
              title="Event Inspector"
            >
              Trace
            </button>
          </div>
          {settingsOpen && (
            <div
              id="media-player-settings"
              className="media-player__settings"
              role="region"
              aria-label="Playback settings"
            >
              <p className="media-player__settings-title">{algorithm.metadata.label}</p>
              <div className="media-player__aux">
                <button
                  type="button"
                  className="media-player__text-btn"
                  onClick={onGenerate}
                  title={resolvedGenerateLabel}
                  aria-label={resolvedGenerateLabel}
                >
                  {resolvedGenerateLabel}
                </button>
                {onGenerateRandom && (
                  <button
                    type="button"
                    className="media-player__text-btn"
                    onClick={onGenerateRandom}
                    title="Random input"
                    aria-label="Generate random input"
                  >
                    Random
                  </button>
                )}
                <button
                  type="button"
                  className="media-player__text-btn"
                  onClick={onReset}
                  disabled={resetDisabled}
                  title="Reset"
                  aria-label="Reset visualization"
                >
                  Reset
                </button>
                {presets && presets.length > 0 && onSelectPreset && (
                  <label className="media-player__preset">
                    <span className="visually-hidden">Preset</span>
                    <select
                      className="control-select media-player__select"
                      value={selectedPresetId}
                      onChange={(event) => onSelectPreset(event.target.value)}
                    >
                      {presets.map((preset) => (
                        <option key={preset.id} value={preset.id}>
                          {preset.label}
                        </option>
                      ))}
                    </select>
                  </label>
                )}
              </div>
            </div>
          )}
          {infoOpen && algorithmInfo && (
            <div
              ref={infoRef}
              className="bento-overlay"
              role="region"
              aria-label="Algorithm information"
            >
              {algorithmInfo.timeComplexity && (
                <div className="bento-card">
                  <span className="bento-card__label">Time Complexity</span>
                  <strong className="bento-card__value">{algorithmInfo.timeComplexity}</strong>
                </div>
              )}
              {algorithmInfo.spaceComplexity && (
                <div className="bento-card">
                  <span className="bento-card__label">Space Complexity</span>
                  <strong className="bento-card__value">{algorithmInfo.spaceComplexity}</strong>
                </div>
              )}
              {algorithmInfo.keyIdea && (
                <div className="bento-card bento-card--wide">
                  <span className="bento-card__label">Key Idea</span>
                  <p className="bento-card__text">{algorithmInfo.keyIdea}</p>
                </div>
              )}
            </div>
          )}
          {debuggerOpen && (
            <div className="debugger-overlay" role="region" aria-label="Event inspector">
              <div className="debugger-overlay__header">
                <div>
                  <span className="bento-card__label">Timeline Debugger</span>
                  <strong>Step {currentStep} / {totalSteps}</strong>
                </div>
                <button
                  type="button"
                  className="debugger-overlay__bookmark"
                  disabled={currentStep === 0}
                  onClick={() => {
                    setBookmarkedSteps((current) => {
                      const next = new Set(current);
                      if (next.has(currentStep)) {
                        next.delete(currentStep);
                      } else {
                        next.add(currentStep);
                      }
                      return next;
                    });
                  }}
                >
                  {bookmarkedSteps.has(currentStep) ? "Unbookmark" : "Bookmark"}
                </button>
              </div>

              <div className="debugger-overlay__quick-jumps">
                {(["all", "milestones", "bookmarks"] as EventFilter[]).map((filter) => (
                  <button
                    key={filter}
                    type="button"
                    className={eventFilter === filter ? "is-active" : ""}
                    onClick={() => setEventFilter(filter)}
                  >
                    {filter}
                  </button>
                ))}
                {milestoneSteps.slice(0, 8).map((step) => (
                  <button key={step} type="button" onClick={() => onSeek(step)}>
                    M{step}
                  </button>
                ))}
                {bookmarkedEventSteps.map((step) => (
                  <button key={`bookmark-${step}`} type="button" onClick={() => onSeek(step)}>
                    B{step}
                  </button>
                ))}
              </div>

              <div className="debugger-event-list">
                {visibleDebuggerEvents.length === 0 ? (
                  <p className="debugger-event-list__empty">Run or step once to inspect emitted events.</p>
                ) : (
                  visibleDebuggerEvents.map((event) => (
                    <button
                      type="button"
                      key={`${event.index}-${event.type}`}
                      className={`debugger-event ${event.index === currentStep ? "is-active" : ""}`}
                      onClick={() => onSeek(event.index)}
                    >
                      <span>{event.index}</span>
                      <strong>{event.type}</strong>
                      <small>{event.summary}</small>
                      {event.isMilestone && <em>milestone</em>}
                    </button>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        <div className="media-player__transport" role="group" aria-label="Playback">
          <button
            type="button"
            className="media-player__icon-btn"
            onClick={onPreviousStep}
            disabled={previousDisabled}
            title="Previous step"
            aria-label="Previous step"
          >
            Prev
          </button>
          <button
            type="button"
            id="btn-play-pause"
            className={`media-player__icon-btn media-player__icon-btn--primary${isRunning ? " is-live" : ""}`}
            onClick={onTogglePlayback}
            title={playPauseLabel}
            aria-label={playPauseLabel}
            aria-pressed={isRunning}
          >
            {playPauseLabel}
          </button>
          <button
            type="button"
            className="media-player__icon-btn"
            onClick={onNextStep}
            disabled={nextDisabled}
            title="Next step"
            aria-label="Next step"
          >
            Next
          </button>
        </div>

        <div className="media-player__right">
          <button
            type="button"
            className={`predict-toggle ${predictMode ? "is-active" : ""}`}
            onClick={onTogglePredictMode}
            aria-pressed={predictMode}
            title="Predict next step"
          >
            Predict
          </button>
          <label className="media-player__speed">
            <span className="visually-hidden">Playback speed</span>
            <select
              className="control-select media-player__speed-select"
              value={speedLabel}
              onChange={(event) => {
                const next = SPEED_RATES.find((rate) => rate.label === event.target.value);
                if (next) {
                  onSpeedChange(next.ms);
                }
              }}
            >
              {SPEED_RATES.map((rate) => (
                <option key={rate.label} value={rate.label}>
                  {rate.label}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>

      {pendingPrediction && (
        <section className="prediction-panel" aria-label="Predict next step">
          <div className="prediction-panel__copy">
            <span className="teaching-panel__label">Predict Step {pendingPrediction.stepIndex}</span>
            <strong>
              {pendingPrediction.step.prediction?.question ?? "What should happen next?"}
            </strong>
            {pendingPrediction.submitted && (
              <p className={predictionIsCorrect ? "is-correct" : "is-missed"}>
                {predictionIsCorrect
                  ? "Correct. Now reveal the event and connect it to the state change."
                  : `Close, but the engine will choose: ${correctPrediction}.`}
              </p>
            )}
          </div>

          <div className="prediction-options" role="group" aria-label="Prediction options">
            {predictionOptions.map((option) => (
              <button
                key={option}
                type="button"
                className={option === pendingPrediction.selectedOption ? "is-selected" : ""}
                onClick={() => onSelectPrediction(option)}
                disabled={pendingPrediction.submitted}
              >
                {option}
              </button>
            ))}
          </div>

          <div className="prediction-panel__actions">
            <button
              type="button"
              className="media-player__text-btn"
              onClick={onSubmitPrediction}
              disabled={!pendingPrediction.selectedOption || pendingPrediction.submitted}
            >
              Check
            </button>
            <button type="button" className="media-player__text-btn" onClick={onRevealPrediction}>
              Reveal Step
            </button>
          </div>
        </section>
      )}

      {(snapshot.explanation || snapshot.decision || snapshot.insightTags.length > 0) && (
        <div className="teaching-strip" aria-label="Step reasoning">
          {snapshot.explanation && (
            <section className="teaching-panel teaching-panel--explanation">
              <div>
                <span className="teaching-panel__label">What</span>
                <p>{snapshot.explanation.what}</p>
              </div>
              <div>
                <span className="teaching-panel__label">Why</span>
                <p>{snapshot.explanation.why}</p>
              </div>
              <div>
                <span className="teaching-panel__label">Impact</span>
                <p>{snapshot.explanation.impact}</p>
              </div>
              {snapshot.explanation.next && (
                <div>
                  <span className="teaching-panel__label">Next</span>
                  <p>{snapshot.explanation.next}</p>
                </div>
              )}
            </section>
          )}

          {snapshot.decision && (
            <section className="teaching-panel teaching-panel--decision">
              <span className="teaching-panel__label">Decision</span>
              <strong>{snapshot.decision.chosen}</strong>
              <p>{snapshot.decision.reasoning}</p>
              <div className="teaching-options">
                {snapshot.decision.options.map((option) => (
                  <span
                    key={option}
                    className={option === snapshot.decision?.chosen ? "is-chosen" : ""}
                  >
                    {option}
                  </span>
                ))}
              </div>
            </section>
          )}

          {snapshot.insightTags.length > 0 && (
            <section className="teaching-panel teaching-panel--insights">
              <span className="teaching-panel__label">Insight</span>
              <div className="insight-tags">
                {snapshot.insightTags.map((tag) => (
                  <span key={tag}>{tag}</span>
                ))}
              </div>
            </section>
          )}
        </div>
      )}
    </section>
  );
}

function nearestSpeedLabel(ms: number): string {
  let best = SPEED_RATES[0];
  let bestDiff = Math.abs(ms - best.ms);
  for (const rate of SPEED_RATES) {
    const diff = Math.abs(ms - rate.ms);
    if (diff < bestDiff) {
      best = rate;
      bestDiff = diff;
    }
  }
  return best.label;
}
