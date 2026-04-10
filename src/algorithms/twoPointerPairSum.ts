import type { ArrayAlgorithmPlugin, ArrayAlgorithmResult, ArrayAlgorithmStep } from "../types/arrayAlgorithm";
import type { ArrayData } from "../types/array";

export const twoPointerPairSumAlgorithm: ArrayAlgorithmPlugin = {
  id: "two-pointer-pair-sum",
  label: "Two Pointer - Pair Sum",
  family: "array",
  description: "Find a pair in a sorted array that sums to target using two pointers.",
  behaviorNote:
    "The algorithm compares the outermost pair first. If the sum is too small, the left pointer moves right. If it is too large, the right pointer moves left.",
  intuition: "Use the sorted order to decide which pointer movement can move the sum toward the target.",
  keyIdea: "A small sum can only grow by moving left rightward. A large sum can only shrink by moving right leftward.",
  timeComplexity: "O(n)",
  spaceComplexity: "O(1)",
  metricLabel: "Comparisons",
  *run(arrayData: ArrayData): Generator<ArrayAlgorithmStep, ArrayAlgorithmResult, void> {
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
        left,
        right,
        currentSum,
        action: "checking",
        found: false,
        arraySnapshot: [...nums],
        target,
        explanation: `Checking whether ${nums[left]} + ${nums[right]} reaches the target ${target}.`,
        decision: "Compare current pair against target",
      };

      if (currentSum === target) {
        yield {
          left,
          right,
          currentSum,
          action: "found",
          found: true,
          arraySnapshot: [...nums],
          target,
          explanation: "The pair exactly matches the target, so the search can stop.",
          decision: "Pair found",
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
          left,
          right,
          currentSum,
          action: "move_left",
          found: false,
          arraySnapshot: [...nums],
          target,
          explanation: "Sum is less than the target, so moving the left pointer right is the only way to increase it.",
          decision: "Move left pointer",
        };
        left += 1;
        continue;
      }

      yield {
        left,
        right,
        currentSum,
        action: "move_right",
        found: false,
        arraySnapshot: [...nums],
        target,
        explanation: "Sum is greater than the target, so moving the right pointer left is the only way to decrease it.",
        decision: "Move right pointer",
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
