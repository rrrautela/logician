import { memo } from "react";
import type { ArrayVisualState } from "../types/array";

interface ArrayPanelProps {
  arrayState: ArrayVisualState;
}

export function ArrayPanel({ arrayState }: ArrayPanelProps) {
  const {
    nums,
    left,
    right,
    eventType,
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
    eventType === "expand" || eventType === "shrink" || maxLength > 0;
  const isKadaneMode =
    eventType === "extend" || eventType === "restart" || maxSum !== null;

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
              <ArrayItemView
                key={`${value}-${index}`}
                value={value}
                index={index}
                isKadaneMode={isKadaneMode}
                isInActiveSubarray={isInActiveSubarray}
                isInBestSubarray={isInBestSubarray}
                isInWindow={isInWindow}
                isLeft={isLeft}
                isRight={isRight}
                isFound={isFound}
                isCurrentIndex={isCurrentIndex}
                isChanged={changedIndices.includes(index)}
              />
            );
          })}
        </div>
      </div>
    </section>
  );
}

const ArrayItemView = memo(function ArrayItemView({
  value,
  index,
  isKadaneMode,
  isInActiveSubarray,
  isInBestSubarray,
  isInWindow,
  isLeft,
  isRight,
  isFound,
  isCurrentIndex,
  isChanged,
}: {
  value: number;
  index: number;
  isKadaneMode: boolean;
  isInActiveSubarray: boolean;
  isInBestSubarray: boolean;
  isInWindow: boolean;
  isLeft: boolean;
  isRight: boolean;
  isFound: boolean;
  isCurrentIndex: boolean;
  isChanged: boolean;
}) {
  return (
    <div
      className={`array-item ${
        isKadaneMode ? (isInActiveSubarray ? "is-window" : "") : isInWindow ? "is-window" : ""
      } ${isKadaneMode && isInBestSubarray ? "is-best" : ""} ${isLeft || isCurrentIndex ? "is-left" : ""} ${isRight ? "is-right" : ""} ${isFound ? "is-found" : ""} ${isChanged ? "is-changed" : ""}`}
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
});
