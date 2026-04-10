import { useCallback, useEffect, useRef, useState } from "react";
import type { ArrayRunnerSnapshot } from "../engine/arrayRunner";
import type { RunnerSnapshot } from "../engine/runner";
import type { AlgorithmPlugin } from "../types/algorithm";
import type { ArrayAlgorithmPlugin } from "../types/arrayAlgorithm";

type SpeedRate = { label: string; ms: number };

const SPEED_RATES: SpeedRate[] = [
  { label: "0.75x", ms: 533 },
  { label: "1x", ms: 400 },
  { label: "1.5x", ms: 267 },
  { label: "2x", ms: 200 },
];

interface AlgorithmInfo {
  timeComplexity: string | null;
  spaceComplexity: string | null;
  keyIdea: string | null;
}

interface ControlsProps {
  algorithm: AlgorithmPlugin | ArrayAlgorithmPlugin;
  snapshot: RunnerSnapshot | ArrayRunnerSnapshot;
  speed: number;
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
  onSeek,
  onSpeedChange,
  onGenerateRandom,
  presets,
  selectedPresetId,
  onSelectPreset,
  milestoneSteps = [],
  algorithmInfo,
}: ControlsProps) {
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [infoOpen, setInfoOpen] = useState(false);
  const [hoverStep, setHoverStep] = useState<number | null>(null);
  const [tooltipX, setTooltipX] = useState(0);
  const seekBarRef = useRef<HTMLInputElement>(null);

  const currentStep = snapshot.stepCount;
  const totalSteps = snapshot.totalSteps;
  const generateLabel =
    algorithm.family === "array"
      ? "Load Example Array"
      : "Generate Random Grid";
  const previousDisabled = currentStep === 0;
  const resetDisabled = currentStep === 0 && snapshot.status !== "completed";
  const scrubDisabled = totalSteps <= 0;
  const scrubMax = Math.max(0, totalSteps);
  const scrubValue = scrubDisabled ? 0 : Math.min(currentStep, scrubMax);
  const scrubProgress =
    scrubMax > 0 ? Math.min(100, (currentStep / scrubMax) * 100) : 0;
  const nextDisabled =
    snapshot.status === "running" ||
    (totalSteps > 0 && currentStep >= totalSteps);
  const isRunning = snapshot.status === "running";
  const playPauseIcon = isRunning ? "⏸" : "▶";
  const playPauseLabel = isRunning ? "Pause" : "Play";

  const speedLabel = nearestSpeedLabel(speed);

  // Hover preview for the seek bar
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

  // Close info overlay when clicking outside
  const infoRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!infoOpen) return;
    const handler = (e: MouseEvent) => {
      if (infoRef.current && !infoRef.current.contains(e.target as Node)) {
        setInfoOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [infoOpen]);

  const hasInfo =
    algorithmInfo &&
    (algorithmInfo.timeComplexity || algorithmInfo.spaceComplexity || algorithmInfo.keyIdea);

  return (
    <section className="panel controls-panel controls-panel--enhanced media-player">
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
          {/* Milestone markers */}
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
          {/* Hover tooltip */}
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
          <span>{currentStep}</span>
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
              onClick={() => { setSettingsOpen((open) => !open); setInfoOpen(false); }}
              aria-expanded={settingsOpen}
              aria-controls="media-player-settings"
              aria-label={settingsOpen ? "Close settings" : "Open settings"}
              title="Settings"
            >
              ⚙
            </button>
            {hasInfo && (
              <button
                type="button"
                className={`media-player__info-toggle ${infoOpen ? "is-open" : ""}`}
                onClick={() => { setInfoOpen((open) => !open); setSettingsOpen(false); }}
                aria-expanded={infoOpen}
                aria-label={infoOpen ? "Close algorithm info" : "Show algorithm info"}
                title="Algorithm Info"
              >
                ℹ
              </button>
            )}
          </div>
          {settingsOpen && (
            <div
              id="media-player-settings"
              className="media-player__settings"
              role="region"
              aria-label="Playback settings"
            >
              <p className="media-player__settings-title">{algorithm.label}</p>
              <div className="media-player__aux">
                <button
                  type="button"
                  className="media-player__text-btn"
                  onClick={onGenerate}
                  title={generateLabel}
                  aria-label={generateLabel}
                >
                  {generateLabel}
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
          {/* Bento Box Info Overlay */}
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
            ⏮
          </button>
          <button
            type="button"
            className={`media-player__icon-btn media-player__icon-btn--primary ${
              isRunning ? "is-live" : ""
            }`}
            onClick={onTogglePlayback}
            title={playPauseLabel}
            aria-label={playPauseLabel}
          >
            {playPauseIcon}
          </button>
          <button
            type="button"
            className="media-player__icon-btn"
            onClick={onNextStep}
            disabled={nextDisabled}
            title="Next step"
            aria-label="Next step"
          >
            ⏭
          </button>
        </div>

        <div className="media-player__right">
          <label className="media-player__speed">
            <span className="visually-hidden">Playback speed</span>
            <select
              className="control-select media-player__speed-select"
              value={speedLabel}
              onChange={(event) => {
                const next = SPEED_RATES.find((r) => r.label === event.target.value);
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
