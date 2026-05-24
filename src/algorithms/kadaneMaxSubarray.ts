import type { ArrayData } from "../types/array";
import type {
  ArrayAlgorithmPlugin,
  ArrayAlgorithmResult,
  ArrayStepEvent,
} from "../types/arrayAlgorithm";

export const kadaneMaxSubarrayAlgorithm: ArrayAlgorithmPlugin = {
  id: "kadane-max-subarray",
  metadata: {
    label: "Kadane's Algorithm",
    family: "array",
    description: "Find maximum subarray sum using dynamic decision (extend or restart).",
    behaviorNote:
      "At each index, Kadane decides whether it is better to extend the current subarray or restart at the current value. That decision is what makes the algorithm efficient.",
    intuition:
      "At each value, keep only the better of two choices: extend the current run or start fresh here.",
    keyIdea:
      "A harmful running sum should be discarded because it only makes future sums worse.",
    timeComplexity: "O(n)",
    spaceComplexity: "O(1)",
    metricLabel: "Max Sum",
  },
  *execute(arrayData: ArrayData): Generator<ArrayStepEvent, ArrayAlgorithmResult, void> {
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
      type: "restart",
      payload: {
        left: 0,
        right: 0,
        currentSum,
        index: 0,
        value: nums[0],
        subarrayStart,
        subarrayEnd,
        maxSum,
        bestStart,
        bestEnd,
      },
      pointers: { currentIndex: 0, left: 0, right: 0 },
      explanation: {
        what: `Start the active subarray at index 0 with value ${nums[0]}.`,
        why: "Kadane needs a concrete running sum before it can compare extend versus restart.",
        impact: `Current sum and best sum both start at ${currentSum}.`,
        next: "Move to the next value and decide whether to extend or restart.",
      },
      decision: {
        options: ["Start at the first value", "Start with an empty subarray"],
        chosen: "Start at the first value",
        reasoning: "For non-empty maximum subarray, the best candidate must include at least one value.",
      },
      insightTags: ["Initialization", "Dynamic choice setup"],
    };

    yield {
      type: "update_max",
      payload: {
        left: 0,
        right: 0,
        currentSum,
        index: 0,
        value: nums[0],
        subarrayStart,
        subarrayEnd,
        maxSum,
        bestStart,
        bestEnd,
      },
      pointers: { currentIndex: 0, left: 0, right: 0 },
      explanation: {
        what: `Record ${maxSum} as the best sum seen so far.`,
        why: "The first element is the only complete subarray considered at this point.",
        impact: "Future active subarrays must exceed this value to replace the best answer.",
        next: "Compare the next value against extending this running sum.",
      },
      decision: {
        options: ["Record the first value", "Wait for a longer subarray"],
        chosen: "Record the first value",
        reasoning: "A single value can be the maximum subarray, especially when all values are negative.",
      },
      insightTags: ["Best-so-far"],
    };

    for (let index = 1; index < nums.length; index += 1) {
      const value = nums[index];
      const extendSum = currentSum + value;

      if (extendSum >= value) {
        currentSum = extendSum;
        subarrayEnd = index;
        yield {
          type: "extend",
          payload: {
            left: subarrayStart,
            right: subarrayEnd,
            currentSum,
            index,
            value,
            subarrayStart,
            subarrayEnd,
            maxSum,
            bestStart,
            bestEnd,
          },
          pointers: { currentIndex: index, left: subarrayStart, right: subarrayEnd },
          explanation: {
            what: `Extend the active subarray through index ${index}; current sum becomes ${currentSum}.`,
            why: `${extendSum} is at least as good as starting fresh from ${value}.`,
            impact: `The active range stays ${subarrayStart}..${subarrayEnd}.`,
            next: "Check whether this active sum improves the best answer.",
          },
          decision: {
            options: [`Extend: ${extendSum}`, `Restart: ${value}`],
            chosen: `Extend: ${extendSum}`,
            reasoning: "Keeping the previous run preserves a higher sum than discarding it.",
          },
          insightTags: ["Extend condition", "Kadane choice"],
        };
      } else {
        currentSum = value;
        subarrayStart = index;
        subarrayEnd = index;
        yield {
          type: "restart",
          payload: {
            left: subarrayStart,
            right: subarrayEnd,
            currentSum,
            index,
            value,
            subarrayStart,
            subarrayEnd,
            maxSum,
            bestStart,
            bestEnd,
          },
          pointers: { currentIndex: index, left: subarrayStart, right: subarrayEnd },
          explanation: {
            what: `Restart the active subarray at index ${index}.`,
            why: `Starting from ${value} beats extending to ${extendSum}.`,
            impact: `The active range resets to ${index}..${index} with sum ${currentSum}.`,
            next: "Check whether this new run is the best seen so far.",
          },
          decision: {
            options: [`Extend: ${extendSum}`, `Restart: ${value}`],
            chosen: `Restart: ${value}`,
            reasoning: "A harmful previous sum would only lower every future subarray that includes it.",
          },
          insightTags: ["Restart condition", "Discard harmful prefix"],
        };
      }

      if (currentSum > maxSum) {
        maxSum = currentSum;
        bestStart = subarrayStart;
        bestEnd = subarrayEnd;
        yield {
          type: "update_max",
          payload: {
            left: subarrayStart,
            right: subarrayEnd,
            currentSum,
            index,
            value,
            subarrayStart,
            subarrayEnd,
            maxSum,
            bestStart,
            bestEnd,
          },
          pointers: { currentIndex: index, left: subarrayStart, right: subarrayEnd },
          explanation: {
            what: `Promote the active subarray to the best answer with sum ${maxSum}.`,
            why: "The active sum is larger than every subarray seen earlier.",
            impact: `Best range is now ${bestStart}..${bestEnd}.`,
            next: "Continue scanning for an even stronger subarray.",
          },
          decision: {
            options: ["Keep old best", "Promote active subarray"],
            chosen: "Promote active subarray",
            reasoning: "Maximum subarray tracks the largest completed candidate seen so far.",
          },
          insightTags: ["Best-so-far", "Max update"],
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
