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

export const dfsAlgorithm: AlgorithmPlugin = {
  id: "dfs",
  metadata: {
    label: "Depth-First Search",
    family: "Maze Traversal",
    description:
      "Stack-like recursive traversal that drills deeply before backtracking.",
    behaviorNote:
      "This mirrors recursive DFS: nodes are visited deeply, and backtracking unwinds when a branch ends.",
    timeComplexity: "O(V + E)",
    spaceComplexity: "O(V)",
    keyIdea:
      "Explore as deep as possible along each branch before backtracking. Recursion holds the active path.",
    metricLabel: "Path Length",
  },
  *execute(grid: Cell[][]): Generator<GridStepEvent, GridAlgorithmResult, void> {
    const start = findCellByType(grid, "start");
    const end = findCellByType(grid, "end");
    const activePath: Coordinate[] = [];
    const pathSet = new Set<string>();
    let visitedCount = 0;

    function* traverse(
      node: Coordinate,
      stepNumber: number,
    ): Generator<GridStepEvent, boolean, void> {
      activePath.push(node);
      pathSet.add(coordinateKey(node));
      visitedCount += 1;

      yield {
        type: "visit",
        payload: {
          nodes: [node],
          stepNumber,
        },
        pointers: { current: [node] },
        explanation: {
          what: `Visit cell ${node[0]}, ${node[1]} on the active branch.`,
          why: "DFS follows one branch as far as it can before trying siblings.",
          impact: "The recursion stack now includes this cell.",
          next: "Try an unvisited neighbor or backtrack if none remain.",
        },
        decision: {
          options: ["Move deeper", "Explore all siblings first"],
          chosen: "Move deeper",
          reasoning: "Depth-first search prioritizes the active branch until it is exhausted.",
        },
        insightTags: ["Depth-first choice", "Recursion stack"],
      };

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
      yield {
        type: "backtrack",
        payload: {
          nodes: [node],
          stepNumber,
        },
        pointers: { current: [node] },
        explanation: {
          what: `Backtrack from cell ${node[0]}, ${node[1]}.`,
          why: "Every walkable neighbor from this cell has failed to reach the goal.",
          impact: "The cell leaves the active recursion path.",
          next: "Resume from the previous decision point.",
        },
        decision: {
          options: ["Backtrack", "Keep this cell active"],
          chosen: "Backtrack",
          reasoning: "Keeping an exhausted branch active would block DFS from trying alternatives.",
        },
        insightTags: ["Backtracking", "Dead end"],
      };
      return false;
    }

    const found = yield* traverse(start, 1);

    if (found) {
      const reversePath = [...activePath].reverse();
      for (const [index, node] of reversePath.entries()) {
        yield {
          type: "path",
          payload: {
            nodes: [node],
            stepNumber: activePath.length - index,
          },
          pointers: { current: [node] },
          explanation: {
            what: "Highlight a cell from the discovered DFS route.",
            why: "The active recursion stack contains the path from start to goal.",
            impact: "The visual path becomes readable from start to end.",
          },
          decision: {
            options: ["Reveal active stack", "Search for shortest path"],
            chosen: "Reveal active stack",
            reasoning: "DFS finds a valid path, not necessarily the shortest one.",
          },
          insightTags: ["Path reveal", "Valid path"],
        };
      }

      return {
        found: true,
        path: [...activePath],
        visitedCount,
        terminated: true,
        message: "DFS reached the end and highlighted one valid path.",
        metricValue: activePath.length,
      };
    }

    yield {
      type: "fail",
      payload: {
        nodes: [start],
      },
      pointers: { current: [start] },
      explanation: {
        what: "Mark the search as failed.",
        why: "All reachable branches were exhausted without reaching the goal.",
        impact: "No path exists through the current open cells.",
      },
      decision: {
        options: ["Terminate", "Keep searching"],
        chosen: "Terminate",
        reasoning: "The recursion has no unexplored reachable cells left.",
      },
      insightTags: ["No path", "Edge case"],
    };

    return {
      found: false,
      path: [],
      visitedCount,
      terminated: true,
      message: "DFS could not find a route to the end.",
      metricValue: 0,
    };
  },
};
