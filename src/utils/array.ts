import type { ArrayData } from "../types/array";

export interface ArrayPreset {
  id: string;
  label: string;
  data: ArrayData;
}

export const DEFAULT_ARRAY_DATA: ArrayData = {
  nums: [1, 2, 3, 4, 6, 8, 9],
  target: 10,
};

export const DEFAULT_SLIDING_WINDOW_DATA: ArrayData = {
  nums: [2, 1, 3, 2, 4, 1],
  target: 7,
};

export const DEFAULT_KADANE_DATA: ArrayData = {
  nums: [-2, 1, -3, 4, -1, 2, 1, -5, 4],
  target: 0,
};

export function cloneArrayData(arrayData: ArrayData): ArrayData {
  return {
    nums: [...arrayData.nums],
    target: arrayData.target,
  };
}

export function getDefaultArrayDataForAlgorithm(algorithmId: string): ArrayData {
  if (algorithmId === "sliding-window-max-subarray") {
    return cloneArrayData(DEFAULT_SLIDING_WINDOW_DATA);
  }

  if (algorithmId === "kadane-max-subarray") {
    return cloneArrayData(DEFAULT_KADANE_DATA);
  }

  return cloneArrayData(DEFAULT_ARRAY_DATA);
}

export function getRandomArrayDataForAlgorithm(algorithmId: string): ArrayData {
  if (algorithmId === "two-pointer-pair-sum") {
    const nums = Array.from({ length: randomBetween(6, 9) }, () => randomBetween(1, 14))
      .sort((first, second) => first - second);
    const left = randomBetween(0, nums.length - 2);
    const right = randomBetween(left + 1, nums.length - 1);
    return { nums, target: nums[left] + nums[right] };
  }

  if (algorithmId === "sliding-window-max-subarray") {
    const nums = Array.from({ length: randomBetween(6, 9) }, () => randomBetween(1, 6));
    return { nums, target: randomBetween(6, 12) };
  }

  if (algorithmId === "kadane-max-subarray") {
    return {
      nums: Array.from({ length: randomBetween(7, 10) }, () => randomBetween(-6, 8)),
      target: 0,
    };
  }

  return getDefaultArrayDataForAlgorithm(algorithmId);
}

export function getArrayPresetsForAlgorithm(algorithmId: string): ArrayPreset[] {
  switch (algorithmId) {
    case "two-pointer-pair-sum":
      return [
        { id: "default", label: "Default Pair", data: cloneArrayData(DEFAULT_ARRAY_DATA) },
        { id: "small-target", label: "Small Target", data: { nums: [1, 2, 4, 5, 7, 11], target: 6 } },
        { id: "no-pair", label: "No Pair", data: { nums: [1, 3, 4, 6, 8, 10], target: 19 } },
      ];
    case "sliding-window-max-subarray":
      return [
        { id: "default", label: "Default Window", data: cloneArrayData(DEFAULT_SLIDING_WINDOW_DATA) },
        { id: "all-valid", label: "Entire Array Valid", data: { nums: [1, 1, 2, 1, 1], target: 8 } },
        { id: "tight-limit", label: "Frequent Shrink", data: { nums: [5, 2, 4, 1, 3], target: 5 } },
      ];
    case "kadane-max-subarray":
      return [
        { id: "default", label: "Mixed Values", data: cloneArrayData(DEFAULT_KADANE_DATA) },
        { id: "all-negatives", label: "All Negatives", data: { nums: [-8, -3, -6, -2, -5, -4], target: 0 } },
        { id: "late-surge", label: "Late Surge", data: { nums: [-2, -1, 3, 4, -1, 2], target: 0 } },
      ];
    default:
      return [{ id: "default", label: "Default", data: getDefaultArrayDataForAlgorithm(algorithmId) }];
  }
}

function randomBetween(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}
