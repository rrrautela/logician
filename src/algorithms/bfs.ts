import type {
  AlgorithmPlugin,
  AlgorithmResult,
  AlgorithmStep,
} from "../types/algorithm";
import type { Cell, Coordinate } from "../types/grid";
import { findCellByType, getNeighbors, sameCoordinate } from "../utils/grid";

function coordinateKey([row, col]: Coordinate): string {
  return `${row}:${col}`;
}

function reconstructPath(
  parentMap: Map<string, Coordinate | null>,
  end: Coordinate,
): Coordinate[] {
  const path: Coordinate[] = [];
  let current: Coordinate | null = end;

  while (current) {
    path.push(current);
    current = parentMap.get(coordinateKey(current)) ?? null;
  }

  return path;
}

export const bfsAlgorithm: AlgorithmPlugin = {
  id: "bfs",
  label: "Breadth-First Search",
  family: "Maze Traversal",
  description:
    "Queue-driven exploration that guarantees the shortest path on an unweighted grid.",
  behaviorNote:
    "BFS terminates when the queue is exhausted, even if no path exists. Each playback tick paints one full frontier layer.",
  *run(grid: Cell[][]): Generator<AlgorithmStep, AlgorithmResult, void> {
    const start = findCellByType(grid, "start");
    const end = findCellByType(grid, "end");
    const queue: Array<[number, number, number]> = [[start[0], start[1], 1]];
    const visited = new Set<string>([coordinateKey(start)]);
    const parentMap = new Map<string, Coordinate | null>([
      [coordinateKey(start), null],
    ]);
    let visitedCount = 0;

    while (queue.length > 0) {
      const layer = queue.splice(0, queue.length);
      visitedCount += layer.length;
      yield {
        type: "visit",
        nodes: layer.map(([row, col]) => [row, col]),
        wave: layer.length,
        stepNumber: layer[0]?.[2] ?? 1,
      };

      const reachedEnd = layer.find(([row, col]) => sameCoordinate([row, col], end));
      if (reachedEnd) {
        const path = reconstructPath(parentMap, end);
        for (const [index, node] of path.entries()) {
          yield {
            type: "path",
            node,
            stepNumber: path.length - index,
          };
        }

        return {
          found: true,
          path: [...path].reverse(),
          visitedCount,
          terminated: true,
        };
      }

      for (const [row, col, stepNumber] of layer) {
        for (const neighbor of getNeighbors(grid, [row, col])) {
          const key = coordinateKey(neighbor);
          if (visited.has(key)) {
            continue;
          }

          visited.add(key);
          parentMap.set(key, [row, col]);
          queue.push([neighbor[0], neighbor[1], stepNumber + 1]);
        }
      }
    }

    return {
      found: false,
      path: [],
      visitedCount,
      terminated: true,
    };
  },
};
