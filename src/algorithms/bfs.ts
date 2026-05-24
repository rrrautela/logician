import type {
  AlgorithmPlugin,
  GridAlgorithmResult,
  GridStepEvent,
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
  metadata: {
    label: "Breadth-First Search",
    family: "Maze Traversal",
    description:
      "Queue-driven exploration that guarantees the shortest path on an unweighted grid.",
    behaviorNote:
      "BFS terminates when the queue is exhausted, even if no path exists. Each playback tick paints one full frontier layer.",
    timeComplexity: "O(V + E)",
    spaceComplexity: "O(V)",
    keyIdea:
      "Explore all neighbors at the current depth before moving deeper. Guarantees the shortest path in an unweighted graph.",
    metricLabel: "Path Length",
  },
  *execute(grid: Cell[][]): Generator<GridStepEvent, GridAlgorithmResult, void> {
    const start = findCellByType(grid, "start");
    const end = findCellByType(grid, "end");
    const queue: Array<[number, number, number]> = [[start[0], start[1], 1]];
    const visited = new Set<string>([coordinateKey(start)]);
    const parentMap = new Map<string, Coordinate | null>([[coordinateKey(start), null]]);
    let visitedCount = 0;

    while (queue.length > 0) {
      const layer = queue.splice(0, queue.length);
      visitedCount += layer.length;
      yield {
        type: "visit",
        payload: {
          nodes: layer.map(([row, col]) => [row, col]),
          wave: layer.length,
          stepNumber: layer[0]?.[2] ?? 1,
        },
        pointers: {
          current: layer.map(([row, col]) => [row, col] as Coordinate),
        },
        explanation: {
          what: layer.length > 1
            ? `Visit the current frontier layer of ${layer.length} cells.`
            : "Visit the next closest cell to the start.",
          why: "BFS processes all cells at one distance before moving deeper.",
          impact: "These cells are now marked visited and can seed the next frontier.",
          next: "Check whether the goal is in this layer, then enqueue unvisited neighbors.",
        },
        decision: {
          options: ["Process current layer", "Dive into one branch"],
          chosen: "Process current layer",
          reasoning: "Layer order is what guarantees shortest paths on an unweighted grid.",
        },
        insightTags: ["Breadth-first layer", "Shortest unweighted path"],
      };

      const reachedEnd = layer.find(([row, col]) => sameCoordinate([row, col], end));
      if (reachedEnd) {
        const path = reconstructPath(parentMap, end);
        for (const [index, node] of path.entries()) {
          yield {
            type: "path",
            payload: {
              nodes: [node],
              stepNumber: path.length - index,
            },
            pointers: { current: [node] },
            explanation: {
              what: "Reveal one cell from the reconstructed shortest path.",
              why: "The goal was reached in BFS layer order, so parent links trace a shortest route.",
              impact: "The path highlight grows backward from the goal to the start.",
            },
            decision: {
              options: ["Reconstruct parent path", "Continue exploring"],
              chosen: "Reconstruct parent path",
              reasoning: "The first time BFS reaches the goal is already shortest in an unweighted grid.",
            },
            insightTags: ["Parent reconstruction", "Shortest path complete"],
          };
        }

        return {
          found: true,
          path: [...path].reverse(),
          visitedCount,
          terminated: true,
          message: "BFS found the shortest path across the grid.",
          metricValue: path.length,
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
      message: "BFS exhausted the reachable grid without finding the end.",
      metricValue: 0,
    };
  },
};
