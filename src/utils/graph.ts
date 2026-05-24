import type { Graph, GraphEdge, GraphNeighbor, GraphNode } from "../types/graph";

interface CreateGraphOptions {
  nodes: GraphNode[];
  edges?: Array<Omit<GraphEdge, "id"> & { id?: string }>;
  startNodeId?: string;
  endNodeId?: string;
}

interface AddEdgeInput extends Omit<GraphEdge, "id"> {
  id?: string;
}

export function createGraph({
  nodes,
  edges = [],
  startNodeId,
  endNodeId,
}: CreateGraphOptions): Graph {
  const normalizedEdges = edges.map((edge, index) => ({
    ...edge,
    id: edge.id ?? `${edge.from}->${edge.to}:${index}`,
    weight: edge.weight ?? 1,
  }));

  return {
    nodes: nodes.map((node) => ({ ...node, metadata: node.metadata ? { ...node.metadata } : undefined })),
    edges: normalizedEdges,
    adjacencyList: buildAdjacencyList(nodes, normalizedEdges),
    startNodeId,
    endNodeId,
  };
}

export function cloneGraph(graph: Graph): Graph {
  return createGraph({
    nodes: graph.nodes.map((node) => ({
      ...node,
      metadata: node.metadata ? { ...node.metadata } : undefined,
    })),
    edges: graph.edges.map((edge) => ({ ...edge })),
    startNodeId: graph.startNodeId,
    endNodeId: graph.endNodeId,
  });
}

export function addEdge(graph: Graph, edge: AddEdgeInput): Graph {
  return createGraph({
    nodes: graph.nodes,
    edges: [
      ...graph.edges,
      {
        ...edge,
        id: edge.id ?? `${edge.from}->${edge.to}:${graph.edges.length}`,
      },
    ],
    startNodeId: graph.startNodeId,
    endNodeId: graph.endNodeId,
  });
}

export function getNeighbors(graph: Graph, nodeId: string): GraphNeighbor[] {
  return graph.adjacencyList[nodeId] ? [...graph.adjacencyList[nodeId]] : [];
}

export function resetTraversalState(graph: Graph): Graph {
  return cloneGraph(graph);
}

export function getNodeById(graph: Graph, nodeId: string): GraphNode {
  const node = graph.nodes.find((entry) => entry.id === nodeId);
  if (!node) {
    throw new Error(`Node "${nodeId}" not found in graph.`);
  }

  return node;
}

export function getEdgeById(graph: Graph, edgeId: string): GraphEdge | undefined {
  return graph.edges.find((edge) => edge.id === edgeId);
}

export function getDirectedOutgoingEdges(graph: Graph, nodeId: string): GraphEdge[] {
  return graph.edges.filter((edge) => edge.from === nodeId);
}

export function createDemoGraph(): Graph {
  return createGraph({
    nodes: [
      { id: "A", label: "A", x: 80, y: 140 },
      { id: "B", label: "B", x: 240, y: 60 },
      { id: "C", label: "C", x: 240, y: 220 },
      { id: "D", label: "D", x: 420, y: 140 },
      { id: "E", label: "E", x: 580, y: 60 },
      { id: "F", label: "F", x: 580, y: 220 },
    ],
    edges: [
      { from: "A", to: "B", weight: 2, directed: true },
      { from: "A", to: "C", weight: 4, directed: true },
      { from: "B", to: "D", weight: 3, directed: true },
      { from: "B", to: "E", weight: 7, directed: true },
      { from: "C", to: "D", weight: 1, directed: true },
      { from: "C", to: "F", weight: 6, directed: true },
      { from: "D", to: "E", weight: 2, directed: true },
      { from: "D", to: "F", weight: 2, directed: true },
      { from: "E", to: "F", weight: 1, directed: true },
    ],
    startNodeId: "A",
    endNodeId: "F",
  });
}

function buildAdjacencyList(
  nodes: GraphNode[],
  edges: GraphEdge[],
): Record<string, GraphNeighbor[]> {
  const adjacency: Record<string, GraphNeighbor[]> = Object.fromEntries(
    nodes.map((node) => [node.id, []]),
  );

  for (const edge of edges) {
    adjacency[edge.from]?.push({
      nodeId: edge.to,
      edge,
      weight: edge.weight ?? 1,
    });

    if (!edge.directed) {
      adjacency[edge.to]?.push({
        nodeId: edge.from,
        edge,
        weight: edge.weight ?? 1,
      });
    }
  }

  return adjacency;
}
