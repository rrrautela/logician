import type { ArrayData } from "../types/array";
import type {
  ArrayAlgorithmPlugin,
  ArrayAlgorithmResult,
  ArrayStepEvent,
} from "../types/arrayAlgorithm";

export const slidingWindowMaxSubarrayAlgorithm: ArrayAlgorithmPlugin = {
  id: "sliding-window-max-subarray",
  metadata: {
    label: "Sliding Window - Max Length (Sum <= K)",
    family: "array",
    description: "Find longest subarray with sum <= K using dynamic window.",
    behaviorNote:
      "Because all values are positive, the window can safely shrink from the left whenever the sum exceeds K. The best length is updated only after the window becomes valid again.",
    intuition: "Grow the window while it stays valid, and shrink only when the sum gets too large.",
    keyIdea:
      "Positive numbers make the window monotonic, so once the sum exceeds K, moving left is the only fix.",
    timeComplexity: "O(n)",
    spaceComplexity: "O(1)",
    metricLabel: "Max Length",
  },
  *execute(arrayData: ArrayData): Generator<ArrayStepEvent, ArrayAlgorithmResult, void> {
    const nums = [...arrayData.nums];
    const k = arrayData.target;

    if (nums.length === 0) {
      return {
        found: false,
        pair: null,
        visitedCount: 0,
        terminated: true,
        message: "Array is empty.",
        metricValue: 0,
      };
    }

    let left = 0;
    let currentSum = 0;
    let maxLength = 0;

    for (let right = 0; right < nums.length; right += 1) {
      currentSum += nums[right];
      yield {
        type: "expand",
        payload: {
          left,
          right,
          currentSum,
          maxLength,
          k,
        },
        pointers: { left, right },
        explanation: {
          what: `Expand the window to include ${nums[right]} at index ${right}.`,
          why: "Positive values let the right edge grow the candidate window one item at a time.",
          impact: `Window sum becomes ${currentSum}.`,
          next: currentSum > k ? "Shrink until the sum is valid again." : "Check whether this valid window is best.",
        },
        decision: {
          options: ["Expand right", "Shrink left"],
          chosen: "Expand right",
          reasoning: "Before the limit is exceeded, adding the next item is the only way to find a longer valid window.",
        },
        insightTags: ["Window expand"],
      };

      while (currentSum > k && left <= right) {
        currentSum -= nums[left];
        left += 1;
        yield {
          type: "shrink",
          payload: {
            left,
            right,
            currentSum,
            maxLength,
            k,
          },
          pointers: { left, right },
          explanation: {
            what: "Shrink the window from the left.",
            why: `The sum exceeded ${k}, and all numbers are positive.`,
            impact: `The window sum drops to ${currentSum}; left is now ${left}.`,
            next: currentSum > k ? "Keep shrinking." : "Measure the valid window.",
          },
          decision: {
            options: ["Shrink left", "Expand right"],
            chosen: "Shrink left",
            reasoning: "With positive numbers, expanding would only increase the invalid sum.",
          },
          insightTags: ["Window shrink condition triggered", "Positive-number invariant"],
        };
      }

      const windowLength = right >= left ? right - left + 1 : 0;
      if (windowLength > maxLength) {
        maxLength = windowLength;
        yield {
          type: "update_max",
          payload: {
            left,
            right,
            currentSum,
            maxLength,
            k,
          },
          pointers: { left, right },
          explanation: {
            what: `Update the best valid window length to ${maxLength}.`,
            why: "The current window is valid and longer than every previous valid window.",
            impact: `Best length is now ${maxLength}.`,
            next: "Continue expanding to look for a longer valid window.",
          },
          decision: {
            options: ["Keep previous best", "Record current window"],
            chosen: "Record current window",
            reasoning: "The objective is maximum length among valid windows.",
          },
          insightTags: ["Best-so-far", "Valid window"],
        };
      }
    }

    return {
      found: maxLength > 0,
      pair: null,
      visitedCount: nums.length,
      terminated: true,
      message:
        maxLength > 0
          ? `Longest valid window has length ${maxLength}.`
          : "No valid subarray found.",
      metricValue: maxLength,
    };
  },
};
