import type { ArrayVisualState } from "../engine/arrayRunner";

interface ArrayPanelProps {
  arrayState: ArrayVisualState;
}

export function ArrayPanel({ arrayState }: ArrayPanelProps) {
  const {
    nums,
    left,
    right,
    action,
    found,
    foundIndices,
    maxLength,
    windowIndices,
    maxSum,
    currentIndex,
    subarrayIndices,
    bestSubarrayIndices,
    changedIndices,
  } = arrayState;
  const isSlidingWindowMode =
    action === "expand" || action === "shrink" || action === "update_max" || maxLength > 0;
  const isKadaneMode =
    action === "extend" || action === "restart" || maxSum !== null;

  return (
    <section className="panel visualization-panel visualization-panel--stage-only">
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
