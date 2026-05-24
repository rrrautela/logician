import type { GraphAlgorithmPlugin } from "../types/graphAlgorithm";
import { aStarAlgorithm } from "./aStar";
import { dijkstraAlgorithm } from "./dijkstra";
import { topologicalSortAlgorithm } from "./topologicalSort";

export const graphAlgorithms: GraphAlgorithmPlugin[] = [
  dijkstraAlgorithm,
  aStarAlgorithm,
  topologicalSortAlgorithm,
];

export const graphAlgorithmMap = new Map<string, GraphAlgorithmPlugin>(
  graphAlgorithms.map((algorithm) => [algorithm.id, algorithm]),
);
