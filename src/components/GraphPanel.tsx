import { memo, useMemo } from "react";
import type { GraphEdge, GraphNode, GraphVisualState } from "../types/graph";

interface GraphPanelProps {
  graphState: GraphVisualState;
}

const VIEWBOX_WIDTH = 660;
const VIEWBOX_HEIGHT = 320;

export function GraphPanel({ graphState }: GraphPanelProps) {
  const { graph } = graphState;
  const nodeById = useMemo(
    () => new Map(graph.nodes.map((node) => [node.id, node])),
    [graph.nodes],
  );

  return (
    <section className="panel visualization-panel visualization-panel--stage-only">
      <div className="graph-stage">
        <div className="graph-frame">
          <svg
            className="graph-canvas"
            viewBox={`0 0 ${VIEWBOX_WIDTH} ${VIEWBOX_HEIGHT}`}
            role="img"
            aria-label="Graph visualization"
          >
            <defs>
              <marker
                id="graph-arrow"
                viewBox="0 0 10 10"
                refX="9"
                refY="5"
                markerWidth="7"
                markerHeight="7"
                orient="auto-start-reverse"
              >
                <path d="M 0 0 L 10 5 L 0 10 z" className="graph-arrowhead" />
              </marker>
            </defs>

            {graph.edges.map((edge) => {
              const fromNode = nodeById.get(edge.from);
              const toNode = nodeById.get(edge.to);
              if (!fromNode || !toNode) {
                return null;
              }

              return (
                <GraphEdgeView
                  key={edge.id}
                  edge={edge}
                  fromNode={fromNode}
                  toNode={toNode}
                  isPath={graphState.pathEdgeIds.includes(edge.id)}
                  isActive={graphState.currentEdgeId === edge.id}
                />
              );
            })}

            {graph.nodes.map((node) => {
              return (
                <GraphNodeView
                  key={node.id}
                  node={node}
                  isCurrent={graphState.currentNodeId === node.id}
                  isVisited={graphState.visitedNodeIds.includes(node.id)}
                  isFrontier={graphState.frontierNodeIds.includes(node.id)}
                  isPath={graphState.pathNodeIds.includes(node.id)}
                  isSkipped={graphState.skippedNodeIds.includes(node.id)}
                  isStart={node.id === graph.startNodeId}
                  isEnd={node.id === graph.endNodeId}
                  distance={graphState.distanceByNodeId[node.id]}
                  indegree={graphState.indegreeByNodeId[node.id]}
                  score={graphState.scoreByNodeId[node.id]}
                />
              );
            })}
          </svg>

          <div className="graph-summary">
            <div className="graph-summary__card">
              <span>Frontier</span>
              <strong>{graphState.frontierNodeIds.join(" -> ") || "Empty"}</strong>
            </div>
            <div className="graph-summary__card">
              <span>Current Path / Order</span>
              <strong>
                {(graphState.pathNodeIds.length > 0
                  ? graphState.pathNodeIds
                  : graphState.processedOrder
                ).join(" -> ") || "Not available yet"}
              </strong>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

const GraphEdgeView = memo(function GraphEdgeView({
  edge,
  fromNode,
  toNode,
  isPath,
  isActive,
}: {
  edge: GraphEdge;
  fromNode: GraphNode;
  toNode: GraphNode;
  isPath: boolean;
  isActive: boolean;
}) {
  const midX = (fromNode.x + toNode.x) / 2;
  const midY = (fromNode.y + toNode.y) / 2;

  return (
    <g>
      <line
        x1={fromNode.x}
        y1={fromNode.y}
        x2={toNode.x}
        y2={toNode.y}
        className={`graph-edge ${isPath ? "is-path" : ""} ${isActive ? "is-active" : ""}`}
        markerEnd={edge.directed ? "url(#graph-arrow)" : undefined}
      />
      <g transform={`translate(${midX}, ${midY})`}>
        <rect className="graph-weight-pill" x={-14} y={-10} rx={10} width={28} height={20} />
        <text className="graph-weight-text" textAnchor="middle" dominantBaseline="middle">
          {edge.weight ?? 1}
        </text>
      </g>
    </g>
  );
});

const GraphNodeView = memo(function GraphNodeView({
  node,
  isCurrent,
  isVisited,
  isFrontier,
  isPath,
  isSkipped,
  isStart,
  isEnd,
  distance,
  indegree,
  score,
}: {
  node: GraphNode;
  isCurrent: boolean;
  isVisited: boolean;
  isFrontier: boolean;
  isPath: boolean;
  isSkipped: boolean;
  isStart: boolean;
  isEnd: boolean;
  distance?: number;
  indegree?: number;
  score?: number;
}) {
  return (
    <g transform={`translate(${node.x}, ${node.y})`}>
      <circle
        r={26}
        className={`graph-node ${isVisited ? "is-visited" : ""} ${isFrontier ? "is-frontier" : ""} ${isPath ? "is-path" : ""} ${isCurrent ? "is-current" : ""} ${isSkipped ? "is-skipped" : ""}`}
      />
      <text className="graph-node__label" textAnchor="middle" dominantBaseline="middle">
        {node.label ?? node.id}
      </text>
      {isStart && (
        <text className="graph-node__tag graph-node__tag--start" textAnchor="middle" x={0} y={-36}>
          Start
        </text>
      )}
      {isEnd && (
        <text className="graph-node__tag graph-node__tag--end" textAnchor="middle" x={0} y={44}>
          Goal
        </text>
      )}
      {distance !== undefined && (
        <text className="graph-node__metric" textAnchor="middle" x={0} y={52}>
          d={formatMetric(distance)}
        </text>
      )}
      {indegree !== undefined && (
        <text className="graph-node__metric graph-node__metric--secondary" textAnchor="middle" x={0} y={66}>
          indegree={indegree}
        </text>
      )}
      {score !== undefined && (
        <text className="graph-node__metric graph-node__metric--secondary" textAnchor="middle" x={0} y={-48}>
          f={formatMetric(score)}
        </text>
      )}
    </g>
  );
});

function formatMetric(value: number): string {
  return Number.isFinite(value) ? `${value}` : "∞";
}
