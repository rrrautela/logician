import type { AlgorithmPlugin } from "../types/algorithm";
import type { ArrayAlgorithmPlugin } from "../types/arrayAlgorithm";

interface SidebarProps {
  gridAlgorithms: AlgorithmPlugin[];
  arrayAlgorithms: ArrayAlgorithmPlugin[];
  selectedId: string;
  collapsed: boolean;
  onToggleCollapse: () => void;
  onSelectAlgorithm: (algorithmId: string) => void;
}

export function Sidebar({
  gridAlgorithms,
  arrayAlgorithms,
  selectedId,
  collapsed,
  onToggleCollapse,
  onSelectAlgorithm,
}: SidebarProps) {
  return (
    <aside className={`sidebar ${collapsed ? "collapsed" : ""}`}>
      <div className="sidebar__header">
        <div className="sidebar__branding">
          {!collapsed && <p className="eyebrow">Visualization Engine</p>}
          {!collapsed && <h1>Logician</h1>}
        </div>
        <button
          type="button"
          className="icon-button"
          onClick={onToggleCollapse}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {collapsed ? ">" : "<"}
        </button>
      </div>

      {!collapsed && (
        <>
          {gridAlgorithms.length > 0 && (
            <div className="sidebar__group">
              <p className="sidebar__label">Grid Algorithms</p>
              {gridAlgorithms.map((algorithm) => (
                <button
                  key={algorithm.id}
                  type="button"
                  className={`sidebar__item ${
                    selectedId === algorithm.id ? "active" : ""
                  }`}
                  onClick={() => onSelectAlgorithm(algorithm.id)}
                >
                  <span>{algorithm.label}</span>
                  <small>{algorithm.family}</small>
                </button>
              ))}
            </div>
          )}

          {arrayAlgorithms.length > 0 && (
            <div className="sidebar__group">
              <p className="sidebar__label">Array Algorithms</p>
              {arrayAlgorithms.map((algorithm) => (
                <button
                  key={algorithm.id}
                  type="button"
                  className={`sidebar__item ${
                    selectedId === algorithm.id ? "active" : ""
                  }`}
                  onClick={() => onSelectAlgorithm(algorithm.id)}
                >
                  <span>{algorithm.label}</span>
                  <small>{algorithm.family}</small>
                </button>
              ))}
            </div>
          )}

        </>
      )}
    </aside>
  );
}
