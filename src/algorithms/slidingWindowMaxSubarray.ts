import type { ArrayData } from "../types/array";
import type { ArrayAlgorithmPlugin, ArrayAlgorithmResult, ArrayAlgorithmStep } from "../types/arrayAlgorithm";

export const slidingWindowMaxSubarrayAlgorithm: ArrayAlgorithmPlugin = {
  id: "sliding-window-max-subarray",
  label: "Sliding Window - Max Length (Sum <= K)",
  family: "array",
  description: "Find longest subarray with sum <= K using dynamic window.",
  behaviorNote:
    "Because all values are positive, the window can safely shrink from the left whenever the sum exceeds K. The best length is updated only after the window becomes valid again.",
  intuition: "Grow the window while it stays valid, and shrink only when the sum gets too large.",
  keyIdea: "Positive numbers make the window monotonic, so once the sum exceeds K, moving left is the only fix.",
  timeComplexity: "O(n)",
  spaceComplexity: "O(1)",
  metricLabel: "Max Length",
  *run(arrayData: ArrayData): Generator<ArrayAlgorithmStep, ArrayAlgorithmResult, void> {
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
        left,
        right,
        currentSum,
        maxLength,
        action: "expand",
        found: false,
        arraySnapshot: [...nums],
        target: k,
        k,
        window: nums.slice(left, right + 1),
        explanation: `Expanding the window to include ${nums[right]}, which updates the running sum to ${currentSum}.`,
        decision: "Expand window",
      };

      while (currentSum > k && left <= right) {
        currentSum -= nums[left];
        left += 1;
        yield {
          left,
          right,
          currentSum,
          maxLength,
          action: "shrink",
          found: false,
          arraySnapshot: [...nums],
          target: k,
          k,
          window: nums.slice(left, right + 1),
          explanation: "Window sum exceeded k, so we shrink from the left until the window becomes valid again.",
          decision: "Shrink window",
        };
      }

      const windowLength = right >= left ? right - left + 1 : 0;
      if (windowLength > maxLength) {
        maxLength = windowLength;
        yield {
          left,
          right,
          currentSum,
          maxLength,
          action: "update_max",
          found: false,
          arraySnapshot: [...nums],
          target: k,
          k,
          window: nums.slice(left, right + 1),
          explanation: `This valid window is the longest so far, so max length becomes ${maxLength}.`,
          decision: "Update best length",
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
