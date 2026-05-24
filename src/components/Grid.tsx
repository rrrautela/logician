import { memo, useEffect, useRef, useState } from "react";
import type { Cell } from "../types/grid";

interface GridProps {
  grid: Cell[][];
  onEditCell: (row: number, col: number) => void;
}

export function Grid({
  grid,
  onEditCell,
}: GridProps) {
  const stageRef = useRef<HTMLDivElement | null>(null);
  const [cellSize, setCellSize] = useState(28);
  const columns = grid[0]?.length ?? 0;
  const rows = grid.length;
  const gap = 4;
  const framePadding = 16;
  const maxBoardSize = 860;

  useEffect(() => {
    const stage = stageRef.current;
    if (!stage || columns === 0 || rows === 0) {
      return;
    }

    const updateCellSize = () => {
      const { width, height } = stage.getBoundingClientRect();
      const availableWidth = Math.max(
        0,
        Math.min(width - framePadding * 2, maxBoardSize) - gap * (columns - 1),
      );
      const availableHeight = Math.max(
        0,
        Math.min(height - framePadding * 2, maxBoardSize) - gap * (rows - 1),
      );
      const nextCellSize = Math.max(
        16,
        Math.floor(Math.min(availableWidth / columns, availableHeight / rows)),
      );

      setCellSize(nextCellSize);
    };

    updateCellSize();

    const observer = new ResizeObserver(() => {
      updateCellSize();
    });

    observer.observe(stage);

    return () => {
      observer.disconnect();
    };
  }, [columns, rows]);

  const boardStyle = {
    gridTemplateColumns: `repeat(${columns}, ${cellSize}px)`,
    gridAutoRows: `${cellSize}px`,
  };

  return (
    <section className="panel visualization-panel visualization-panel--stage-only">
      <div className="grid-stage" ref={stageRef}>
        <div className="grid-frame">
          <div className="grid-board" style={boardStyle}>
            {grid.flat().map((cell) => (
              <GridCellView
                key={`${cell.row}-${cell.col}`}
                cell={cell}
                onEditCell={onEditCell}
              />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

const GridCellView = memo(function GridCellView({
  cell,
  onEditCell,
}: {
  cell: Cell;
  onEditCell: (row: number, col: number) => void;
}) {
  return (
    <button
      type="button"
      className={getCellClassName(cell)}
      aria-label={`Cell ${cell.row}, ${cell.col} (${cell.type})`}
      onClick={() => onEditCell(cell.row, cell.col)}
    >
      <span>{getCellLabel(cell)}</span>
    </button>
  );
});

function getCellClassName(cell: Cell): string {
  return `grid-cell ${cell.type} ${
    cell.weight > 1 ? "is-weighted" : ""
  } ${
    cell.visited ? "is-visited" : ""
  } ${
    cell.queued ? "is-queued" : ""
  } ${
    cell.path ? "is-path" : ""
  } ${
    cell.cycle ? "is-cycle" : ""
  } ${
    cell.current ? "is-current" : ""
  } ${
    cell.backtracked ? "is-backtracked" : ""
  } ${
    cell.failed ? "is-failed" : ""
  }`;
}

function getCellLabel(cell: Cell): string {
  if (cell.type === "start") {
    return "S";
  }

  if (cell.type === "end") {
    return "E";
  }

  if (cell.stepNumber !== null && (cell.visited || cell.path || cell.current || cell.queued)) {
    return `${cell.stepNumber}`;
  }

  return "";
}
