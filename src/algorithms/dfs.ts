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

export const dfsAlgorithm: AlgorithmPlugin = {
  id: "dfs",
  label: "Depth-First Search",
  family: "Maze Traversal",
  description:
    "Stack-like recursive traversal that drills deeply before backtracking.",
  behaviorNote:
    "This mirrors the original recursive DFS feel: cells get numbered by depth, and backtracking clears them again. With no path, it can keep cycling forever.",
  timeComplexity: "O(V + E)",
  spaceComplexity: "O(V)",
  keyIdea: "Explore as deep as possible along each branch before backtracking. Uses a stack (or recursion) to track the exploration frontier.",
  *run(grid: Cell[][]): Generator<AlgorithmStep, AlgorithmResult, void> {
    const start = findCellByType(grid, "start");
    const end = findCellByType(grid, "end");
    const activePath: Coordinate[] = [];
    const pathSet = new Set<string>();
    let visitedCount = 0;

    function* traverse(
      node: Coordinate,
      stepNumber: number,
    ): Generator<AlgorithmStep, boolean, void> {
      activePath.push(node);
      pathSet.add(coordinateKey(node));
      visitedCount += 1;
      yield { type: "visit", node, stepNumber };

      if (sameCoordinate(node, end)) {
        return true;
      }

      for (const neighbor of getNeighbors(grid, node)) {
        if (pathSet.has(coordinateKey(neighbor))) {
          continue;
        }

        const found = yield* traverse(neighbor, stepNumber + 1);
        if (found) {
          return true;
        }
      }

      activePath.pop();
      pathSet.delete(coordinateKey(node));
      yield { type: "backtrack", node, stepNumber };
      return false;
    }

    const found = yield* traverse(start, 1);

    if (found) {
      const reversePath = [...activePath].reverse();
      for (const [index, node] of reversePath.entries()) {
        yield {
          type: "path",
          node,
          stepNumber: activePath.length - index,
        };
      }

      return {
        found: true,
        path: [...activePath],
        visitedCount,
        terminated: true,
      };
    }

    while (true) {
      yield { type: "fail", node: start };
    }
  },
};
