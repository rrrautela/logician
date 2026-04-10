export type CellType =
  | "empty"
  | "wall"
  | "start"
  | "end";

export type Coordinate = [number, number];

export interface Cell {
  row: number;
  col: number;
  type: CellType;
  weight: number;
  visited: boolean;
  queued: boolean;
  path: boolean;
  cycle: boolean;
  current: boolean;
  backtracked: boolean;
  failed: boolean;
  stepNumber: number | null;
}

export interface GridConfig {
  rows: number;
  cols: number;
  start: Coordinate;
  end: Coordinate;
}
