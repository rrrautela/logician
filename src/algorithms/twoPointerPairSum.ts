import type {
  ArrayAlgorithmPlugin,
  ArrayAlgorithmResult,
  ArrayStepEvent,
} from "../types/arrayAlgorithm";
import type { ArrayData } from "../types/array";

export const twoPointerPairSumAlgorithm: ArrayAlgorithmPlugin = {
  id: "two-pointer-pair-sum",
  metadata: {
    label: "Two Pointer - Pair Sum",
    family: "array",
    description: "Find a pair in a sorted array that sums to target using two pointers.",
    behaviorNote:
      "The algorithm compares the outermost pair first. If the sum is too small, the left pointer moves right. If it is too large, the right pointer moves left.",
    intuition:
      "Use the sorted order to decide which pointer movement can move the sum toward the target.",
    keyIdea:
      "A small sum can only grow by moving left rightward. A large sum can only shrink by moving right leftward.",
    timeComplexity: "O(n)",
    spaceComplexity: "O(1)",
    metricLabel: "Comparisons",
  },
  *execute(arrayData: ArrayData): Generator<ArrayStepEvent, ArrayAlgorithmResult, void> {
    const nums = [...arrayData.nums];
    const { target } = arrayData;

    if (nums.length < 2) {
      return {
        found: false,
        pair: null,
        visitedCount: 0,
        terminated: true,
        message: "Array needs at least two values.",
        metricValue: 0,
      };
    }

    let left = 0;
    let right = nums.length - 1;
    let comparisons = 0;

    while (left < right) {
      const currentSum = nums[left] + nums[right];
      comparisons += 1;

      yield {
        type: "compare",
        payload: {
          left,
          right,
          currentSum,
          target,
        },
        pointers: { left, right },
        explanation: {
          what: `Compare ${nums[left]} + ${nums[right]} against target ${target}.`,
          why: "The sorted array lets this pair tell us which direction can still help.",
          impact: `Current sum is ${currentSum}.`,
          next: "Stop if equal; otherwise move one pointer.",
        },
        decision: {
          options: ["Found target", "Move left to increase sum", "Move right to decrease sum"],
          chosen: currentSum === target
            ? "Found target"
            : currentSum < target
              ? "Move left to increase sum"
              : "Move right to decrease sum",
          reasoning: "Sorted order makes only one pointer movement capable of moving the sum toward the target.",
        },
        insightTags: ["Sorted-order decision", "Two pointers"],
      };

      if (currentSum === target) {
        yield {
          type: "found",
          payload: {
            left,
            right,
            currentSum,
            target,
          },
          pointers: { left, right },
          explanation: {
            what: `Found ${nums[left]} + ${nums[right]} = ${target}.`,
            why: "The current pair exactly matches the target.",
            impact: "The search terminates with these two indices.",
          },
          decision: {
            options: ["Return this pair", "Keep searching"],
            chosen: "Return this pair",
            reasoning: "The task asks for any valid pair, so more comparisons are unnecessary.",
          },
          insightTags: ["Match found", "Early exit"],
        };

        return {
          found: true,
          pair: [left, right],
          visitedCount: comparisons,
          terminated: true,
          message: `Pair found: ${nums[left]} + ${nums[right]} = ${target}.`,
          metricValue: comparisons,
        };
      }

      if (currentSum < target) {
        yield {
          type: "move_left",
          payload: {
            left,
            right,
            currentSum,
            target,
          },
          pointers: { left, right },
          explanation: {
            what: "Move the left pointer one step right.",
            why: "The current sum is too small, and larger values live to the right.",
            impact: "All pairs with the old left value are too small with this right pointer.",
            next: "Compare the new outer pair.",
          },
          decision: {
            options: ["Move left pointer", "Move right pointer"],
            chosen: "Move left pointer",
            reasoning: "Moving right would only make an already-small sum smaller.",
          },
          insightTags: ["Pointer elimination", "Increase sum"],
        };
        left += 1;
        continue;
      }

      yield {
        type: "move_right",
        payload: {
          left,
          right,
          currentSum,
          target,
        },
        pointers: { left, right },
        explanation: {
          what: "Move the right pointer one step left.",
          why: "The current sum is too large, and smaller values live to the left.",
          impact: "All pairs with the old right value are too large with this left pointer.",
          next: "Compare the new outer pair.",
        },
        decision: {
          options: ["Move left pointer", "Move right pointer"],
          chosen: "Move right pointer",
          reasoning: "Moving left would only make an already-large sum larger.",
        },
        insightTags: ["Pointer elimination", "Decrease sum"],
      };
      right -= 1;
    }

    return {
      found: false,
      pair: null,
      visitedCount: comparisons,
      terminated: true,
      message: "No pair found.",
      metricValue: comparisons,
    };
  },
};
