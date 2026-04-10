import { useEffect, useMemo, useState } from "react";
import type { ArrayRunnerSnapshot } from "../engine/arrayRunner";
import type { RunnerSnapshot } from "../engine/runner";
import type { AlgorithmPlugin } from "../types/algorithm";
import type { ArrayAlgorithmPlugin } from "../types/arrayAlgorithm";

interface ControlsProps {
  algorithm: AlgorithmPlugin | ArrayAlgorithmPlugin;
  snapshot: RunnerSnapshot | ArrayRunnerSnapshot;
  speed: number;
  onGenerate: () => void;
  onTogglePlayback: () => void;
  onReset: () => void;
  onPreviousStep: () => void;
  onNextStep: () => void;
  onSpeedChange: (speed: number) => void;
  onGenerateRandom?: () => void;
  presets?: Array<{ id: string; label: string }>;
  selectedPresetId?: string;
  onSelectPreset?: (presetId: string) => void;
}

export function Controls({
  algorithm,
  snapshot,
  speed,
  onGenerate,
  onTogglePlayback,
  onReset,
  onPreviousStep,
  onNextStep,
  onSpeedChange,
  onGenerateRandom,
  presets,
  selectedPresetId,
  onSelectPreset,
}: ControlsProps) {
  const [notesOpen, setNotesOpen] = useState(false);
  const [metricPulseKey, setMetricPulseKey] = useState(0);

  useEffect(() => {
    setMetricPulseKey((value) => value + 1);
  }, [snapshot.stepCount, snapshot.exploredCount, snapshot.pathLength, snapshot.status]);

  const playbackLabel = snapshot.status === "running" ? "Pause" : "Start";
  const playbackIcon = snapshot.status === "running" ? "||" : ">";
  const generateLabel =
    algorithm.family === "array"
      ? "Load Example Array"
      : "Generate Random Grid";
  const previousDisabled = snapshot.stepCount === 0;
  const resetDisabled = snapshot.stepCount === 0 && snapshot.status !== "completed";
  const speedProgress = ((speed - 1) / (1000 - 1)) * 100;
  const speedLabel = getSpeedDescriptor(speed);
  const totalSteps = "totalSteps" in snapshot ? snapshot.totalSteps : 0;
  const progress = totalSteps > 0 ? Math.min(100, (snapshot.stepCount / totalSteps) * 100) : 0;
  const recentMessages = "recentMessages" in snapshot ? snapshot.recentMessages : [];

  const metrics = useMemo(
    () => [
      {
        icon: "#",
        label: "Steps",
        value: snapshot.stepCount,
        tone: "steps",
      },
      {
        icon: "@",
        label: "Explored",
        value: snapshot.exploredCount,
        tone: "explored",
      },
      {
        icon: "*",
        label: snapshot.metricLabel,
        value: snapshot.pathLength,
        tone: "result",
      },
      {
        icon: "!",
        label: "Status",
        value: snapshot.status,
        tone: "status",
        isStatus: true,
      },
    ],
    [snapshot],
  );

  return (
    <section className="panel controls-panel controls-panel--enhanced">
      <div className="panel__header">
        <div>
          <p className="eyebrow">Control Center</p>
          <h2>{algorithm.label}</h2>
        </div>
        <span className={`status-pill status-pill--${snapshot.status}`}>
          {snapshot.status}
        </span>
      </div>

      <p className="panel__description">{algorithm.description}</p>

      {"intuition" in algorithm && algorithm.intuition && (
        <div className="info-card why-card">
          <div className="info-card__header">
            <h3>Why It Works</h3>
          </div>
          <p><strong>Intuition:</strong> {algorithm.intuition}</p>
          <p><strong>Key Idea:</strong> {algorithm.keyIdea}</p>
          <p><strong>Time:</strong> {algorithm.timeComplexity}</p>
          <p><strong>Space:</strong> {algorithm.spaceComplexity}</p>
        </div>
      )}

      {totalSteps > 0 && (
        <div className="info-card progress-card">
          <div className="info-card__header">
            <h3>Progress</h3>
            <span>{snapshot.stepCount} / {totalSteps}</span>
          </div>
          <div className="progress-bar" aria-hidden="true">
            <div className="progress-bar__fill" style={{ width: `${progress}%` }} />
          </div>
        </div>
      )}

      <div className="metric-grid metric-grid--enhanced">
        {metrics.map((metric, index) => (
          <article
            key={`${metric.label}-${metricPulseKey}`}
            className={`metric-card metric-card--${metric.tone} ${
              index === 2 ? "metric-card--featured" : ""
            }`}
          >
            <span className="metric-card__icon">{metric.icon}</span>
            <span>{metric.label}</span>
            <strong className={metric.isStatus ? `status status--${snapshot.status}` : ""}>
              {metric.value}
            </strong>
          </article>
        ))}
      </div>

      <div className="control-cluster">
        <div className="control-cluster__header">
          <span>Playback</span>
          <small>{speedLabel}</small>
        </div>
        <div className="player-bar">
          <button
            type="button"
            className="control-button control-button--secondary"
            onClick={onPreviousStep}
            disabled={previousDisabled}
            title="Previous Step"
            aria-label="Previous Step"
            data-tooltip="Previous Step"
          >
            <span className="control-button__icon">{"<<"}</span>
            <span>Previous</span>
          </button>

          <button
            type="button"
            className={`control-button control-button--primary ${
              snapshot.status === "running" ? "is-live" : ""
            }`}
            onClick={onTogglePlayback}
            title={playbackLabel === "Pause" ? "Pause Execution" : "Start Execution"}
            aria-label={playbackLabel === "Pause" ? "Pause Execution" : "Start Execution"}
            data-tooltip={playbackLabel === "Pause" ? "Pause Execution" : "Start Execution"}
          >
            <span className="control-button__icon">{playbackIcon}</span>
            <span>{playbackLabel}</span>
          </button>

          <button
            type="button"
            className="control-button control-button--secondary"
            onClick={onNextStep}
            disabled={snapshot.status === "running"}
            title="Next Step"
            aria-label="Next Step"
            data-tooltip="Next Step"
          >
            <span className="control-button__icon">{">>"}</span>
            <span>Next</span>
          </button>

          <button
            type="button"
            className="control-button control-button--ghost"
            onClick={onReset}
            disabled={resetDisabled}
            title="Reset Visualization"
            aria-label="Reset Visualization"
            data-tooltip="Reset Visualization"
          >
            <span className="control-button__icon">{"[]"}</span>
            <span>Reset</span>
          </button>
        </div>
      </div>

      <div className="control-cluster">
        <div className="control-cluster__header">
          <span>Generation</span>
          <small>Fresh test case</small>
        </div>
        <div className="generate-stack">
          <button
            type="button"
            className="generate-button"
            onClick={onGenerate}
            title={generateLabel}
            aria-label={generateLabel}
            data-tooltip={generateLabel}
          >
            <span className="control-button__icon">{"@@"}</span>
            <span>{generateLabel}</span>
          </button>
          {onGenerateRandom && (
            <button
              type="button"
              className="control-button control-button--secondary"
              onClick={onGenerateRandom}
              title="Generate Random Input"
              aria-label="Generate Random Input"
              data-tooltip="Generate Random Input"
            >
              <span className="control-button__icon">{"??"}</span>
              <span>Generate Random Input</span>
            </button>
          )}
        </div>
        {presets && presets.length > 0 && onSelectPreset && (
          <label className="slider-field">
            <div className="slider-field__copy">
              <span>Edge Case Mode</span>
              <strong>Preset</strong>
            </div>
            <select
              className="control-select"
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

      <label className="slider-field slider-field--enhanced">
        <div className="slider-field__copy">
          <span>Time Per Step</span>
          <strong>{speedLabel}</strong>
        </div>
        <input
          type="range"
          min="1"
          max="1000"
          step="1"
          value={speed}
          style={{ ["--slider-progress" as string]: `${speedProgress}%` }}
          onChange={(event) => onSpeedChange(Number(event.target.value))}
          aria-label="Time per step"
        />
        <div className="slider-zones" aria-hidden="true">
          <span>Fast (review)</span>
          <span>Normal</span>
          <span>Slow (learning)</span>
        </div>
      </label>

      <div className="info-card info-card--console">
        <div className="info-card__header">
          <h3>Engine Feed</h3>
          <span className="console-dot" />
        </div>
        <p key={`${snapshot.message}-${snapshot.stepCount}`} className="console-line">
          {snapshot.message}
        </p>
        {"explanation" in snapshot && snapshot.explanation && (
          <p className="console-line console-line--explanation">{snapshot.explanation}</p>
        )}
        {"decision" in snapshot && snapshot.decision && (
          <p className="console-line console-line--decision">Decision: {snapshot.decision}</p>
        )}
      </div>

      {recentMessages.length > 0 && (
        <div className="info-card">
          <div className="info-card__header">
            <h3>Recent Actions</h3>
          </div>
          {recentMessages.map((message, index) => (
            <p key={`${message}-${index}`}>{message}</p>
          ))}
        </div>
      )}

      <div className={`info-card info-card--accordion ${notesOpen ? "is-open" : ""}`}>
        <button
          type="button"
          className="accordion-toggle"
          onClick={() => setNotesOpen((value) => !value)}
          aria-expanded={notesOpen}
          aria-label="Toggle behavior notes"
        >
          <span>Behavior Notes</span>
          <span>{notesOpen ? "-" : "+"}</span>
        </button>
        {notesOpen && <p>{algorithm.behaviorNote}</p>}
      </div>
    </section>
  );
}

function getSpeedDescriptor(speed: number): string {
  if (speed <= 180) {
    return "Fast (review)";
  }
  if (speed <= 520) {
    return "Normal";
  }
  return "Slow (learning)";
}
