import type {
  GraphAlgorithmPlugin,
  GraphAlgorithmResult,
  GraphStepEvent,
} from "../types/graphAlgorithm";
import type { Graph } from "../types/graph";
import { getNeighbors } from "../utils/graph";

function resolveEndpoints(graph: Graph): { startNodeId: string; endNodeId: string } {
  const startNodeId = graph.startNodeId ?? graph.nodes[0]?.id;
  const endNodeId = graph.endNodeId ?? graph.nodes.at(-1)?.id;

  if (!startNodeId || !endNodeId) {
    throw new Error("Dijkstra requires a graph with at least one start and end node.");
  }

  return { startNodeId, endNodeId };
}

function reconstructPath(
  parentByNodeId: Record<string, string | null>,
  endNodeId: string,
): string[] {
  const path: string[] = [];
  let current: string | null = endNodeId;

  while (current) {
    path.push(current);
    current = parentByNodeId[current] ?? null;
  }

  return path.reverse();
}

function pushByPriority(
  queue: Array<{ nodeId: string; priority: number }>,
  item: { nodeId: string; priority: number },
): void {
  queue.push(item);
  queue.sort((first, second) => first.priority - second.priority);
}

export const dijkstraAlgorithm: GraphAlgorithmPlugin = {
  id: "dijkstra",
  metadata: {
    label: "Dijkstra's Algorithm",
    family: "Graph Pathfinding",
    description:
      "Compute shortest paths on a weighted graph by always expanding the currently known cheapest frontier node.",
    behaviorNote:
      "Dijkstra repeatedly settles the smallest tentative distance. Once a node is popped with its best distance, no shorter path will appear later.",
    timeComplexity: "O((V + E) log V)",
    spaceComplexity: "O(V)",
    keyIdea:
      "The priority queue always exposes the node with the smallest known distance, so edge relaxations only ever improve tentative answers.",
    metricLabel: "Shortest Distance",
  },
  *execute(graph: Graph): Generator<GraphStepEvent, GraphAlgorithmResult, void> {
    const { startNodeId, endNodeId } = resolveEndpoints(graph);

    if (graph.edges.some((edge) => (edge.weight ?? 1) < 0)) {
      return {
        found: false,
        path: [],
        visitedCount: 0,
        terminated: true,
        message: "Dijkstra requires non-negative edge weights.",
        metricValue: 0,
      };
    }

    const distanceByNodeId = Object.fromEntries(graph.nodes.map((node) => [node.id, Number.POSITIVE_INFINITY]));
    const parentByNodeId = Object.fromEntries(graph.nodes.map((node) => [node.id, null as string | null]));
    const frontier: Array<{ nodeId: string; priority: number }> = [];
    let visitedCount = 0;

    distanceByNodeId[startNodeId] = 0;
    pushByPriority(frontier, { nodeId: startNodeId, priority: 0 });

    yield {
      type: "enqueue",
      payload: {
        nodeId: startNodeId,
        distance: 0,
        priority: 0,
      },
      pointers: {
        currentNodeId: startNodeId,
        frontierNodeIds: frontier.map((item) => item.nodeId),
      },
      explanation: {
        what: `Put ${startNodeId} in the priority queue with distance 0.`,
        why: "The source is the only node whose shortest distance is known at the start.",
        impact: "The frontier now has one candidate to expand.",
        next: "Remove the cheapest frontier node.",
      },
      decision: {
        options: ["Start from the source", "Start from every node"],
        chosen: "Start from the source",
        reasoning: "Single-source shortest path grows outward from the source distance of 0.",
      },
      insightTags: ["Initialization", "Priority queue"],
    };

    while (frontier.length > 0) {
      const current = frontier.shift()!;
      yield {
        type: "dequeue",
        payload: {
          nodeId: current.nodeId,
          distance: current.priority,
          priority: current.priority,
        },
        pointers: {
          currentNodeId: current.nodeId,
          frontierNodeIds: frontier.map((item) => item.nodeId),
        },
        explanation: {
          what: `Remove ${current.nodeId} from the queue at priority ${current.priority}.`,
          why: "Dijkstra always expands the unsettled node with the smallest tentative distance.",
          impact: "This node is now the candidate for settlement or stale-entry rejection.",
          next: "Check whether the queued distance is still current.",
        },
        decision: {
          options: ["Expand cheapest node", "Expand insertion order", "Expand goal direction"],
          chosen: "Expand cheapest node",
          reasoning: "With non-negative weights, the cheapest queued distance cannot be improved by a later longer route.",
        },
        insightTags: ["Greedy choice", "Priority queue"],
      };

      if (current.priority > distanceByNodeId[current.nodeId]) {
        yield {
          type: "skip_node",
          payload: {
            nodeId: current.nodeId,
            distance: current.priority,
            previousDistance: distanceByNodeId[current.nodeId],
          },
          pointers: {
            currentNodeId: current.nodeId,
            frontierNodeIds: frontier.map((item) => item.nodeId),
          },
          explanation: {
            what: `Skip stale entry for ${current.nodeId}.`,
            why: `The queue value ${current.priority} is worse than the known distance ${distanceByNodeId[current.nodeId]}.`,
            impact: "No distances or parents change.",
            next: "Continue with the next frontier entry.",
          },
          decision: {
            options: ["Process stale entry", "Skip stale entry"],
            chosen: "Skip stale entry",
            reasoning: "Processing an outdated worse route would repeat work without improving any shortest path.",
          },
          insightTags: ["Stale queue entry", "Edge case"],
        };
        continue;
      }

      visitedCount += 1;
      yield {
        type: "visit_node",
        payload: {
          nodeId: current.nodeId,
          distance: distanceByNodeId[current.nodeId],
        },
        pointers: {
          currentNodeId: current.nodeId,
          frontierNodeIds: frontier.map((item) => item.nodeId),
        },
        explanation: {
          what: `Settle ${current.nodeId} at distance ${distanceByNodeId[current.nodeId]}.`,
          why: "No unprocessed frontier route is cheaper.",
          impact: "Outgoing edges from this node can now relax neighbors.",
          next: current.nodeId === endNodeId ? "Reconstruct the path." : "Evaluate outgoing edges.",
        },
        decision: {
          options: ["Settle node", "Keep waiting"],
          chosen: "Settle node",
          reasoning: "The greedy invariant says the cheapest valid queue entry is final.",
        },
        insightTags: ["Greedy choice", "Settled distance"],
      };

      if (current.nodeId === endNodeId) {
        const path = reconstructPath(parentByNodeId, endNodeId);
        yield {
          type: "path_found",
          payload: {
            nodeIds: path,
            nodeId: endNodeId,
            distance: distanceByNodeId[endNodeId],
            finalPath: path,
          },
          pointers: {
            currentNodeId: endNodeId,
            frontierNodeIds: frontier.map((item) => item.nodeId),
          },
          explanation: {
            what: `Reconstruct the path to ${endNodeId}.`,
            why: "The destination was settled, so its recorded parent chain is final.",
            impact: `Shortest path cost is ${distanceByNodeId[endNodeId]}.`,
          },
          decision: {
            options: ["Stop at settled destination", "Keep exploring the graph"],
            chosen: "Stop at settled destination",
            reasoning: "Once the destination is settled, no later route can be shorter.",
          },
          insightTags: ["Shortest path complete", "Parent reconstruction"],
        };

        return {
          found: true,
          path,
          visitedCount,
          terminated: true,
          message: `Shortest path found with distance ${distanceByNodeId[endNodeId]}.`,
          metricValue: distanceByNodeId[endNodeId],
        };
      }

      for (const neighbor of getNeighbors(graph, current.nodeId)) {
        const candidateDistance = distanceByNodeId[current.nodeId] + neighbor.weight;
        const previousDistance = distanceByNodeId[neighbor.nodeId];

        yield {
          type: "relax_edge",
          payload: {
            fromId: current.nodeId,
            toId: neighbor.nodeId,
            edgeId: neighbor.edge.id,
            distance: candidateDistance,
            previousDistance: Number.isFinite(previousDistance) ? previousDistance : null,
          },
          pointers: {
            currentNodeId: current.nodeId,
            currentEdgeId: neighbor.edge.id,
            frontierNodeIds: frontier.map((item) => item.nodeId),
          },
          explanation: {
            what: `Test edge ${current.nodeId} -> ${neighbor.nodeId} with candidate distance ${candidateDistance}.`,
            why: "A neighbor improves only if this route is cheaper than its recorded distance.",
            impact: `Previous best for ${neighbor.nodeId} is ${Number.isFinite(previousDistance) ? previousDistance : "infinity"}.`,
            next: "Accept or reject the candidate distance.",
          },
          decision: {
            options: ["Accept if cheaper", "Accept every edge", "Ignore every edge"],
            chosen: "Accept if cheaper",
            reasoning: "Relaxation is valid only when it improves the tentative shortest distance.",
          },
          insightTags: ["Relaxation step"],
        };

        if (candidateDistance >= previousDistance) {
          yield {
            type: "skip_node",
            payload: {
              nodeId: neighbor.nodeId,
              fromId: current.nodeId,
              toId: neighbor.nodeId,
              edgeId: neighbor.edge.id,
              distance: candidateDistance,
              previousDistance,
            },
            pointers: {
              currentNodeId: current.nodeId,
              currentEdgeId: neighbor.edge.id,
              frontierNodeIds: frontier.map((item) => item.nodeId),
            },
            explanation: {
              what: `Keep the existing distance for ${neighbor.nodeId}.`,
              why: `${candidateDistance} is not better than ${previousDistance}.`,
              impact: "The parent map and frontier priority stay unchanged.",
              next: "Try the next outgoing edge.",
            },
            decision: {
              options: [`Use candidate ${candidateDistance}`, `Keep existing ${previousDistance}`],
              chosen: `Keep existing ${previousDistance}`,
              reasoning: "Replacing a shorter path with an equal or longer one would break shortest-path progress.",
            },
            insightTags: ["Rejected relaxation", "No-op edge"],
          };
          continue;
        }

        distanceByNodeId[neighbor.nodeId] = candidateDistance;
        parentByNodeId[neighbor.nodeId] = current.nodeId;
        yield {
          type: "update_distance",
          payload: {
            nodeId: neighbor.nodeId,
            fromId: current.nodeId,
            toId: neighbor.nodeId,
            edgeId: neighbor.edge.id,
            distance: candidateDistance,
            previousDistance: Number.isFinite(previousDistance) ? previousDistance : null,
          },
          pointers: {
            currentNodeId: neighbor.nodeId,
            currentEdgeId: neighbor.edge.id,
            frontierNodeIds: frontier.map((item) => item.nodeId),
          },
          explanation: {
            what: `Update ${neighbor.nodeId} to distance ${candidateDistance}.`,
            why: `The route through ${current.nodeId} is cheaper than ${Number.isFinite(previousDistance) ? previousDistance : "infinity"}.`,
            impact: `${current.nodeId} becomes the parent of ${neighbor.nodeId}.`,
            next: "Put the improved node into the priority queue.",
          },
          decision: {
            options: ["Keep old route", "Record shorter route"],
            chosen: "Record shorter route",
            reasoning: "Dijkstra keeps the cheapest known route to every unsettled node.",
          },
          insightTags: ["Relaxation step", "Distance update"],
        };

        pushByPriority(frontier, {
          nodeId: neighbor.nodeId,
          priority: candidateDistance,
        });
        yield {
          type: Number.isFinite(previousDistance) ? "priority_update" : "enqueue",
          payload: {
            nodeId: neighbor.nodeId,
            distance: candidateDistance,
            priority: candidateDistance,
          },
          pointers: {
            currentNodeId: neighbor.nodeId,
            frontierNodeIds: frontier.map((item) => item.nodeId),
          },
          explanation: {
            what: Number.isFinite(previousDistance)
              ? `Lower ${neighbor.nodeId}'s queue priority to ${candidateDistance}.`
              : `Add ${neighbor.nodeId} to the frontier at distance ${candidateDistance}.`,
            why: "The priority queue must expose the cheapest tentative distance next.",
            impact: `${neighbor.nodeId} is now scheduled by its improved shortest-path estimate.`,
            next: "Continue relaxing outgoing edges.",
          },
          decision: {
            options: ["Queue the improved distance", "Leave queue unchanged"],
            chosen: "Queue the improved distance",
            reasoning: "The frontier has to reflect the latest best tentative distance.",
          },
          insightTags: Number.isFinite(previousDistance)
            ? ["Priority update", "Greedy frontier"]
            : ["Frontier discovery", "Greedy frontier"],
        };
      }
    }

    return {
      found: false,
      path: [],
      visitedCount,
      terminated: true,
      message: `No path from ${startNodeId} to ${endNodeId} could be found.`,
      metricValue: 0,
    };
  },
};
