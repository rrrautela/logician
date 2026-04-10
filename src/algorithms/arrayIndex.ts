import type { ArrayAlgorithmPlugin } from "../types/arrayAlgorithm";
import { kadaneMaxSubarrayAlgorithm } from "./kadaneMaxSubarray";
import { slidingWindowMaxSubarrayAlgorithm } from "./slidingWindowMaxSubarray";
import { twoPointerPairSumAlgorithm } from "./twoPointerPairSum";

export const arrayAlgorithms: ArrayAlgorithmPlugin[] = [
  twoPointerPairSumAlgorithm,
  slidingWindowMaxSubarrayAlgorithm,
  kadaneMaxSubarrayAlgorithm,
];

export const arrayAlgorithmMap = new Map<string, ArrayAlgorithmPlugin>(
  arrayAlgorithms.map((algorithm) => [algorithm.id, algorithm]),
);
