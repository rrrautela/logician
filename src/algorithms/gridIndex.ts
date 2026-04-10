import type { AlgorithmPlugin } from "../types/algorithm";
import { bfsAlgorithm } from "./bfs";
import { dfsAlgorithm } from "./dfs";

export const gridAlgorithms: AlgorithmPlugin[] = [
  dfsAlgorithm,
  bfsAlgorithm,
];

export const gridAlgorithmMap = new Map<string, AlgorithmPlugin>(
  gridAlgorithms.map((algorithm) => [algorithm.id, algorithm]),
);
