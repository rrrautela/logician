import { useEffect, useRef, useState } from "react";
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
    <section className="panel visualization-panel">
      <div className="panel__header">
        <div>
          <p className="eyebrow">Grid State</p>
          <h2>Interactive maze surface</h2>
          <p className="grid-hint">Click cells to toggle walls.</p>
        </div>
        <div className="legend">
          <LegendSwatch label="Visited" tone="visited" />
          <LegendSwatch label="Path" tone="path" />
          <LegendSwatch label="Wall" tone="wall" />
          <LegendSwatch label="Current" tone="current" />
        </div>
      </div>

      <div className="grid-stage" ref={stageRef}>
        <div className="grid-frame">
          <div className="grid-board" style={boardStyle}>
            {grid.flat().map((cell) => (
              <button
                key={`${cell.row}-${cell.col}`}
                type="button"
                className={`grid-cell ${cell.type} ${
                  cell.weight > 1 ? "is-weighted" : ""
                } ${
                  cell.visited ? "is-visited" : ""
                } ${cell.queued ? "is-queued" : ""} ${cell.path ? "is-path" : ""} ${
                  cell.cycle ? "is-cycle" : ""
                } ${
                  cell.current ? "is-current" : ""
                } ${cell.backtracked ? "is-backtracked" : ""} ${
                  cell.failed ? "is-failed" : ""
                }`}
                aria-label={`Cell ${cell.row}, ${cell.col} (${cell.type})`}
                onClick={() => onEditCell(cell.row, cell.col)}
              >
                <span>{getCellLabel(cell)}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
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

function LegendSwatch({
  label,
  tone,
}: {
  label: string;
  tone:
    | "visited"
    | "path"
    | "wall"
    | "current";
}) {
  return (
    <div className="legend__item">
      <span className={`legend__swatch legend__swatch--${tone}`} />
      <span>{label}</span>
    </div>
  );
}
