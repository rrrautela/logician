import type { ArrayData } from "../types/array";
import type { ArrayAlgorithmPlugin, ArrayAlgorithmResult, ArrayAlgorithmStep } from "../types/arrayAlgorithm";

export const kadaneMaxSubarrayAlgorithm: ArrayAlgorithmPlugin = {
  id: "kadane-max-subarray",
  label: "Kadane's Algorithm",
  family: "array",
  description: "Find maximum subarray sum using dynamic decision (extend or restart).",
  behaviorNote:
    "At each index, Kadane decides whether it is better to extend the current subarray or restart at the current value. That decision is what makes the algorithm efficient.",
  intuition: "At each value, keep only the better of two choices: extend the current run or start fresh here.",
  keyIdea: "A harmful running sum should be discarded because it only makes future sums worse.",
  timeComplexity: "O(n)",
  spaceComplexity: "O(1)",
  metricLabel: "Max Sum",
  *run(arrayData: ArrayData): Generator<ArrayAlgorithmStep, ArrayAlgorithmResult, void> {
    const nums = [...arrayData.nums];

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

    let currentSum = nums[0];
    let maxSum = nums[0];
    let subarrayStart = 0;
    let subarrayEnd = 0;
    let bestStart = 0;
    let bestEnd = 0;

    yield {
      left: 0,
      right: 0,
      currentSum,
      maxSum,
      action: "restart",
      found: false,
      arraySnapshot: [...nums],
      target: 0,
      index: 0,
      value: nums[0],
      subarrayStart,
      subarrayEnd,
      bestStart,
      bestEnd,
      explanation: "The first value starts the first active subarray by default.",
      decision: "Start first subarray",
    };

    yield {
      left: 0,
      right: 0,
      currentSum,
      maxSum,
      action: "update_max",
      found: false,
      arraySnapshot: [...nums],
      target: 0,
      index: 0,
      value: nums[0],
      subarrayStart,
      subarrayEnd,
      bestStart,
      bestEnd,
      explanation: "The first value is also the best subarray sum seen so far.",
      decision: "Initialize best sum",
    };

    for (let index = 1; index < nums.length; index += 1) {
      const value = nums[index];
      const extendSum = currentSum + value;

      if (extendSum >= value) {
        currentSum = extendSum;
        subarrayEnd = index;
        yield {
          left: subarrayStart,
          right: subarrayEnd,
          currentSum,
          maxSum,
          action: "extend",
          found: false,
          arraySnapshot: [...nums],
          target: 0,
          index,
          value,
          subarrayStart,
          subarrayEnd,
          bestStart,
          bestEnd,
          explanation: "Continuing the previous subarray gives a better sum than starting fresh at this index.",
          decision: "Extend previous subarray",
        };
      } else {
        currentSum = value;
        subarrayStart = index;
        subarrayEnd = index;
        yield {
          left: subarrayStart,
          right: subarrayEnd,
          currentSum,
          maxSum,
          action: "restart",
          found: false,
          arraySnapshot: [...nums],
          target: 0,
          index,
          value,
          subarrayStart,
          subarrayEnd,
          bestStart,
          bestEnd,
          explanation: "Starting fresh here beats carrying the old sum forward, so the subarray restarts.",
          decision: "Restart at current index",
        };
      }

      if (currentSum > maxSum) {
        maxSum = currentSum;
        bestStart = subarrayStart;
        bestEnd = subarrayEnd;
        yield {
          left: subarrayStart,
          right: subarrayEnd,
          currentSum,
          maxSum,
          action: "update_max",
          found: false,
          arraySnapshot: [...nums],
          target: 0,
          index,
          value,
          subarrayStart,
          subarrayEnd,
          bestStart,
          bestEnd,
          explanation: `The current subarray improves the best sum so far, so max sum becomes ${maxSum}.`,
          decision: "Update best subarray",
        };
      }
    }

    return {
      found: true,
      pair: null,
      visitedCount: nums.length,
      terminated: true,
      message: `Maximum subarray sum is ${maxSum}.`,
      metricValue: maxSum,
    };
  },
};
