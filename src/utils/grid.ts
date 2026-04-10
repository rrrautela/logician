import type { Cell, Coordinate, GridConfig } from "../types/grid";

const RENDER_FLAGS = {
  visited: false,
  queued: false,
  path: false,
  cycle: false,
  current: false,
  backtracked: false,
  failed: false,
  stepNumber: null,
} as const;

export function createCell(
  row: number,
  col: number,
  type: Cell["type"] = "empty",
  weight = 1,
): Cell {
  return {
    row,
    col,
    type,
    weight,
    ...RENDER_FLAGS,
  };
}

export function createGrid(config: GridConfig): Cell[][] {
  const { rows, cols, start, end } = config;
  return Array.from({ length: rows }, (_, row) =>
    Array.from({ length: cols }, (_, col) => {
      if (row === start[0] && col === start[1]) {
        return createCell(row, col, "start");
      }
      if (row === end[0] && col === end[1]) {
        return createCell(row, col, "end");
      }
      return createCell(row, col);
    }),
  );
}

export function cloneGrid(grid: Cell[][]): Cell[][] {
  return grid.map((row) => row.map((cell) => ({ ...cell })));
}

export function clearTraversalState(grid: Cell[][]): Cell[][] {
  return grid.map((row) =>
    row.map((cell) => ({
      ...cell,
      ...RENDER_FLAGS,
    })),
  );
}

export function generateRandomGrid(
  config: GridConfig,
  wallDensity = 0.24,
): Cell[][] {
  const grid = createGrid(config);

  return grid.map((row) =>
    row.map((cell) => {
      if (cell.type === "start" || cell.type === "end") {
        return cell;
      }

      if (Math.random() < wallDensity) {
        return { ...cell, type: "wall" as const, weight: 1 };
      }

      return cell;
    }),
  );
}

export function toggleWall(
  grid: Cell[][],
  rowIndex: number,
  colIndex: number,
): Cell[][] {
  return grid.map((row) =>
    row.map((cell) => {
      if (cell.row !== rowIndex || cell.col !== colIndex) {
        return cell;
      }

      if (cell.type === "start" || cell.type === "end") {
        return cell;
      }

      return {
        ...cell,
        type: cell.type === "wall" ? "empty" : "wall",
        weight: 1,
      };
    }),
  );
}

export function findCellByType(
  grid: Cell[][],
  target: Cell["type"],
): Coordinate {
  for (const row of grid) {
    for (const cell of row) {
      if (cell.type === target) {
        return [cell.row, cell.col];
      }
    }
  }

  throw new Error(`Cell type "${target}" not found in grid`);
}

export function isWalkable(grid: Cell[][], row: number, col: number): boolean {
  return Boolean(grid[row]?.[col]) && grid[row][col].type !== "wall";
}

export function getNeighbors(
  grid: Cell[][],
  [row, col]: Coordinate,
): Coordinate[] {
  const candidates: Coordinate[] = [
    [row - 1, col],
    [row, col + 1],
    [row + 1, col],
    [row, col - 1],
  ];

  return candidates.filter(([nextRow, nextCol]) =>
    isWalkable(grid, nextRow, nextCol),
  );
}

export function sameCoordinate(
  first: Coordinate,
  second: Coordinate,
): boolean {
  return first[0] === second[0] && first[1] === second[1];
}
