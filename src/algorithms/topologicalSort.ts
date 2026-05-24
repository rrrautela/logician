import type {
  GraphAlgorithmPlugin,
  GraphAlgorithmResult,
  GraphStepEvent,
} from "../types/graphAlgorithm";
import type { Graph } from "../types/graph";
import { getDirectedOutgoingEdges } from "../utils/graph";

function cloneIndegreeMap(graph: Graph): Record<string, number> {
  const indegreeByNodeId = Object.fromEntries(graph.nodes.map((node) => [node.id, 0]));

  for (const edge of graph.edges) {
    if (!edge.directed) {
      continue;
    }

    indegreeByNodeId[edge.to] = (indegreeByNodeId[edge.to] ?? 0) + 1;
  }

  return indegreeByNodeId;
}

export const topologicalSortAlgorithm: GraphAlgorithmPlugin = {
  id: "topological-sort",
  metadata: {
    label: "Topological Sort",
    family: "Graph Ordering",
    description:
      "Produce a valid dependency order for a directed acyclic graph using Kahn's queue-based algorithm.",
    behaviorNote:
      "Nodes with indegree 0 are ready to process. Removing them decreases the indegree of their outgoing neighbors until new nodes become ready.",
    timeComplexity: "O(V + E)",
    spaceComplexity: "O(V)",
    keyIdea:
      "A node can appear in the ordering only after all incoming dependencies are removed, which is exactly what indegree counts encode.",
    metricLabel: "Order Size",
  },
  *execute(graph: Graph): Generator<GraphStepEvent, GraphAlgorithmResult, void> {
    if (graph.edges.some((edge) => !edge.directed)) {
      return {
        found: false,
        path: [],
        visitedCount: 0,
        terminated: true,
        message: "Topological sort requires all edges to be directed.",
        metricValue: 0,
      };
    }

    const indegreeByNodeId = cloneIndegreeMap(graph);
    const queue = graph.nodes
      .filter((node) => indegreeByNodeId[node.id] === 0)
      .map((node) => node.id);
    const order: string[] = [];

    for (const nodeId of queue) {
      yield {
        type: "enqueue",
        payload: {
          nodeId,
          indegree: 0,
          orderIndex: order.length,
        },
        pointers: {
          currentNodeId: nodeId,
          frontierNodeIds: [...queue],
        },
        explanation: {
          what: `Put ${nodeId} in the ready queue.`,
          why: "Its indegree is 0, so no prerequisites block it.",
          impact: "It can appear next in a valid topological order.",
          next: "Process zero-indegree nodes from the queue.",
        },
        decision: {
          options: ["Queue zero-indegree node", "Wait for incoming edges"],
          chosen: "Queue zero-indegree node",
          reasoning: "A node with no remaining incoming dependencies is safe to process.",
        },
        insightTags: ["Zero indegree", "Dependency ready"],
      };
    }

    while (queue.length > 0) {
      const nodeId = queue.shift()!;
      yield {
        type: "dequeue",
        payload: {
          nodeId,
          indegree: indegreeByNodeId[nodeId],
          orderIndex: order.length,
        },
        pointers: {
          currentNodeId: nodeId,
          frontierNodeIds: [...queue],
        },
        explanation: {
          what: `Remove ${nodeId} from the ready queue.`,
          why: "It has no remaining prerequisites.",
          impact: "It is ready to be committed to the ordering.",
          next: "Append it and remove its outgoing dependencies.",
        },
        decision: {
          options: ["Process ready node", "Process blocked node"],
          chosen: "Process ready node",
          reasoning: "Topological order can only include nodes whose prerequisites are gone.",
        },
        insightTags: ["Zero indegree", "Kahn queue"],
      };

      order.push(nodeId);
      yield {
        type: "visit_node",
        payload: {
          nodeId,
          indegree: indegreeByNodeId[nodeId],
          orderIndex: order.length,
        },
        pointers: {
          currentNodeId: nodeId,
          frontierNodeIds: [...queue],
        },
        explanation: {
          what: `Append ${nodeId} at position ${order.length}.`,
          why: "It is dependency-free at this moment.",
          impact: "Its outgoing edges can now be removed from downstream indegrees.",
          next: "Update each dependent neighbor.",
        },
        decision: {
          options: ["Commit node", "Keep it pending"],
          chosen: "Commit node",
          reasoning: "A ready node is valid anywhere after already-processed prerequisites.",
        },
        insightTags: ["Topological order", "Dependency ready"],
      };

      for (const edge of getDirectedOutgoingEdges(graph, nodeId)) {
        const nextNodeId = edge.to;
        const previousIndegree = indegreeByNodeId[nextNodeId];
        const nextIndegree = previousIndegree - 1;

        yield {
          type: "relax_edge",
          payload: {
            fromId: nodeId,
            toId: nextNodeId,
            edgeId: edge.id,
            previousIndegree,
            indegree: nextIndegree,
          },
          pointers: {
            currentNodeId: nodeId,
            currentEdgeId: edge.id,
            frontierNodeIds: [...queue],
          },
          explanation: {
            what: `Remove dependency ${nodeId} -> ${nextNodeId}.`,
            why: `${nodeId} has been processed, so it no longer blocks ${nextNodeId}.`,
            impact: `${nextNodeId}'s indegree can drop from ${previousIndegree} to ${nextIndegree}.`,
            next: "Store the new indegree.",
          },
          decision: {
            options: ["Decrease downstream indegree", "Leave dependency count unchanged"],
            chosen: "Decrease downstream indegree",
            reasoning: "Processing a prerequisite removes one incoming blocker from each dependent node.",
          },
          insightTags: ["Indegree update", "Dependency removal"],
        };

        indegreeByNodeId[nextNodeId] = nextIndegree;
        yield {
          type: "update_indegree",
          payload: {
            nodeId: nextNodeId,
            fromId: nodeId,
            toId: nextNodeId,
            edgeId: edge.id,
            previousIndegree,
            indegree: nextIndegree,
          },
          pointers: {
            currentNodeId: nextNodeId,
            currentEdgeId: edge.id,
            frontierNodeIds: [...queue],
          },
          explanation: {
            what: `Set ${nextNodeId}'s indegree to ${nextIndegree}.`,
            why: "The dependency count must reflect removed prerequisites.",
            impact: nextIndegree === 0
              ? `${nextNodeId} is now ready.`
              : `${nextNodeId} is still blocked by ${nextIndegree} prerequisite(s).`,
            next: nextIndegree === 0 ? "Queue the node." : "Continue removing dependencies.",
          },
          decision: {
            options: ["Mark ready if zero", "Queue regardless of indegree"],
            chosen: "Mark ready if zero",
            reasoning: "Only zero-indegree nodes can be safely emitted next.",
          },
          insightTags: ["Indegree update"],
        };

        if (nextIndegree === 0) {
          queue.push(nextNodeId);
          yield {
            type: "enqueue",
            payload: {
              nodeId: nextNodeId,
              indegree: 0,
              orderIndex: order.length,
            },
            pointers: {
              currentNodeId: nextNodeId,
              frontierNodeIds: [...queue],
            },
            explanation: {
              what: `Queue ${nextNodeId} as newly ready.`,
              why: "Its indegree reached 0.",
              impact: "It can now be processed in topological order.",
              next: "Process it when it reaches the front of the ready queue.",
            },
            decision: {
              options: ["Queue newly ready node", "Delay blocked node"],
              chosen: "Queue newly ready node",
              reasoning: "Zero indegree means all prerequisites already appear earlier in the order.",
            },
            insightTags: ["Zero indegree", "Dependency ready"],
          };
        }
      }
    }

    if (order.length !== graph.nodes.length) {
      return {
        found: false,
        path: order,
        visitedCount: order.length,
        terminated: true,
        message: "Topological sort failed because the graph still contains a cycle.",
        metricValue: order.length,
      };
    }

    yield {
      type: "path_found",
      payload: {
        finalPath: order,
        nodeIds: order,
        orderIndex: order.length,
      },
      pointers: {
        currentNodeId: order.at(-1) ?? null,
        frontierNodeIds: [],
      },
      explanation: {
        what: "Finalize the topological order.",
        why: "Every node was removed without encountering a cycle.",
        impact: "The collected order respects all directed dependencies.",
      },
      decision: {
        options: ["Accept order", "Report cycle"],
        chosen: "Accept order",
        reasoning: "Processing all nodes proves no dependency cycle blocked the queue.",
      },
      insightTags: ["Valid order", "Cycle check passed"],
    };

    return {
      found: true,
      path: order,
      visitedCount: order.length,
      terminated: true,
      message: `Topological order computed for ${order.length} nodes.`,
      metricValue: order.length,
    };
  },
};
