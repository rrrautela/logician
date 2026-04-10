import type { ArrayVisualState } from "../engine/arrayRunner";

interface ArrayPanelProps {
  arrayState: ArrayVisualState;
}

export function ArrayPanel({ arrayState }: ArrayPanelProps) {
  const {
    nums,
    left,
    right,
    currentSum,
    target,
    action,
    found,
    foundIndices,
    maxLength,
    windowIndices,
    maxSum,
    currentIndex,
    subarrayIndices,
    bestSubarrayIndices,
    explanation,
    decision,
    changedIndices,
  } = arrayState;
  const isSlidingWindowMode =
    action === "expand" || action === "shrink" || action === "update_max" || maxLength > 0;
  const isKadaneMode =
    action === "extend" || action === "restart" || maxSum !== null;
  const panelTitle = isKadaneMode
    ? "Kadane decision scan"
    : isSlidingWindowMode
      ? "Sliding window scan"
      : "Two-pointer pair scan";
  const panelHint = isKadaneMode
    ? "Watch the running subarray either extend forward or restart at the current value while the best segment is tracked separately."
    : isSlidingWindowMode
      ? "Watch the window expand and shrink until the longest valid range under K is found."
      : "Watch the left and right pointers close in until they either find the target sum or cross.";

  return (
    <section className="panel visualization-panel">
      <div className="panel__header">
        <div>
          <p className="eyebrow">Array State</p>
          <h2>{panelTitle}</h2>
          <p className="grid-hint">{panelHint}</p>
        </div>
        <div className="legend">
          <LegendSwatch
            label={isKadaneMode ? "Current Index" : "Left Pointer"}
            tone="left"
          />
          <LegendSwatch
            label={isKadaneMode ? "Active Subarray" : "Right Pointer"}
            tone={isKadaneMode ? "window" : "right"}
          />
          <LegendSwatch
            label={
              isKadaneMode
                ? "Best Subarray"
                : isSlidingWindowMode
                    ? "Window"
                    : "Pair Found"
            }
            tone={isKadaneMode ? "best" : isSlidingWindowMode ? "window" : "found"}
          />
        </div>
      </div>

      <div className="array-summary">
        <article className="array-stat">
          <span>
            {isKadaneMode ? "Current Sum" : isSlidingWindowMode ? "K" : "Target"}
          </span>
          <strong>{isKadaneMode ? (currentSum ?? "-") : target}</strong>
        </article>
        <article className="array-stat">
          <span>{isKadaneMode ? "Max Sum" : "Current Sum"}</span>
          <strong>{isKadaneMode ? (maxSum ?? "-") : (currentSum ?? "-")}</strong>
        </article>
        <article className="array-stat">
          <span>
            {isKadaneMode ? "Active Range" : isSlidingWindowMode ? "Max Length" : "Pair Status"}
          </span>
          <strong>
            {isKadaneMode
              ? formatRange(subarrayIndices)
              : isSlidingWindowMode
                ? maxLength
                : found
                  ? "Found"
                  : "-"}
          </strong>
        </article>
        <article className="array-stat array-stat--message">
          <span>Action</span>
          <strong>{getActionLabel(action, found, maxLength, maxSum)}</strong>
        </article>
      </div>

      <div className="array-teaching-panel">
        <article className="array-stat array-stat--message">
          <span>Explanation</span>
          <strong>{explanation}</strong>
        </article>
        {decision && (
          <article className="array-stat array-stat--message">
            <span>Decision</span>
            <strong>{decision}</strong>
          </article>
        )}
      </div>

      <div className="array-stage">
        <div className="array-track">
          {nums.map((value, index) => {
            const isLeft = left === index;
            const isRight = right === index;
            const isFound =
              foundIndices !== null &&
              (foundIndices[0] === index || foundIndices[1] === index);
            const isInActiveSubarray =
              subarrayIndices !== null &&
              index >= subarrayIndices[0] &&
              index <= subarrayIndices[1];
            const isInBestSubarray =
              bestSubarrayIndices !== null &&
              index >= bestSubarrayIndices[0] &&
              index <= bestSubarrayIndices[1];
            const isInWindow =
              windowIndices !== null &&
              index >= windowIndices[0] &&
              index <= windowIndices[1];
            const isCurrentIndex = currentIndex === index;

            return (
              <div
                key={`${value}-${index}`}
                className={`array-item ${
                  isKadaneMode
                    ? isInActiveSubarray
                      ? "is-window"
                      : ""
                    : isInWindow
                      ? "is-window"
                      : ""
                } ${isKadaneMode && isInBestSubarray ? "is-best" : ""} ${isLeft || isCurrentIndex ? "is-left" : ""} ${isRight ? "is-right" : ""} ${isFound ? "is-found" : ""} ${changedIndices.includes(index) ? "is-changed" : ""}`}
              >
                <span className="array-item__pointer">
                  {isKadaneMode
                    ? isCurrentIndex
                      ? "I"
                      : ""
                    : isLeft && isRight
                      ? "L/R"
                      : isLeft
                        ? "L"
                        : isRight
                          ? "R"
                          : ""}
                </span>
                <strong>{value}</strong>
                <small>{index}</small>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function LegendSwatch({
  label,
  tone,
}: {
  label: string;
  tone: "left" | "right" | "found" | "window" | "best";
}) {
  return (
    <div className="legend__item">
      <span className={`legend__swatch legend__swatch--${tone}`} />
      <span>{label}</span>
    </div>
  );
}

function getActionLabel(
  action: ArrayVisualState["action"],
  found: boolean,
  maxLength: number,
  maxSum: number | null,
): string {
  if (found && action === "found") {
    return "Pair found!";
  }

  switch (action) {
    case "checking":
      return "Checking current pair";
    case "expand":
      return "Expanding window";
    case "shrink":
      return "Shrinking window (sum exceeded)";
    case "update_max":
      return maxSum !== null ? `New maximum found: ${maxSum}` : `Updating max length to ${maxLength}`;
    case "extend":
      return "Extending previous subarray";
    case "restart":
      return "Restarting at current index";
    case "move_left":
      return "Sum too small -> move left";
    case "move_right":
      return "Sum too large -> move right";
    default:
      return "Ready to scan";
  }
}

function formatRange(range: [number, number] | null): string {
  if (!range) {
    return "-";
  }

  return `${range[0]}-${range[1]}`;
}
