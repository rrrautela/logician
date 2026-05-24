import type {
  GraphAlgorithmPlugin,
  GraphAlgorithmResult,
  GraphStepEvent,
} from "../types/graphAlgorithm";
import type { Graph, GraphNode } from "../types/graph";
import { getNeighbors, getNodeById } from "../utils/graph";

export type GraphHeuristic = (node: GraphNode, goal: GraphNode) => number;

export const zeroHeuristic: GraphHeuristic = () => 0;

export const manhattanHeuristic: GraphHeuristic = (node, goal) =>
  Math.abs(node.x - goal.x) + Math.abs(node.y - goal.y);

function resolveEndpoints(graph: Graph): { startNodeId: string; endNodeId: string } {
  const startNodeId = graph.startNodeId ?? graph.nodes[0]?.id;
  const endNodeId = graph.endNodeId ?? graph.nodes.at(-1)?.id;

  if (!startNodeId || !endNodeId) {
    throw new Error("A* requires a graph with at least one start and end node.");
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

export function createAStarAlgorithm(options?: {
  id?: string;
  label?: string;
  heuristic?: GraphHeuristic;
  heuristicName?: string;
}): GraphAlgorithmPlugin {
  const heuristic = options?.heuristic ?? zeroHeuristic;
  const heuristicName = options?.heuristicName ?? "Zero";

  return {
    id: options?.id ?? "a-star-search",
    metadata: {
      label: options?.label ?? "A* Search",
      family: "Graph Pathfinding",
      description:
        "Use both path cost so far and a heuristic estimate to prioritize promising routes toward the goal.",
      behaviorNote:
        "A* ranks frontier nodes by f(n) = g(n) + h(n). With a zero heuristic, the algorithm behaves exactly like Dijkstra.",
      timeComplexity: "O((V + E) log V)",
      spaceComplexity: "O(V)",
      keyIdea:
        `A* blends exact distance-so-far with the ${heuristicName.toLowerCase()} heuristic so the search aims toward the goal instead of exploring uniformly.`,
      metricLabel: "Path Cost",
    },
    *execute(graph: Graph): Generator<GraphStepEvent, GraphAlgorithmResult, void> {
      const { startNodeId, endNodeId } = resolveEndpoints(graph);

      if (graph.edges.some((edge) => (edge.weight ?? 1) < 0)) {
        return {
          found: false,
          path: [],
          visitedCount: 0,
          terminated: true,
          message: "A* requires non-negative edge weights.",
          metricValue: 0,
        };
      }

      const goalNode = getNodeById(graph, endNodeId);
      const gScore = Object.fromEntries(graph.nodes.map((node) => [node.id, Number.POSITIVE_INFINITY]));
      const fScore = Object.fromEntries(graph.nodes.map((node) => [node.id, Number.POSITIVE_INFINITY]));
      const parentByNodeId = Object.fromEntries(graph.nodes.map((node) => [node.id, null as string | null]));
      const frontier: Array<{ nodeId: string; priority: number }> = [];
      let visitedCount = 0;

      const startHeuristic = heuristic(getNodeById(graph, startNodeId), goalNode);
      gScore[startNodeId] = 0;
      fScore[startNodeId] = startHeuristic;
      pushByPriority(frontier, { nodeId: startNodeId, priority: fScore[startNodeId] });

      yield {
        type: "enqueue",
        payload: {
          nodeId: startNodeId,
          distance: 0,
          heuristic: startHeuristic,
          gScore: 0,
          hScore: startHeuristic,
          fScore: fScore[startNodeId],
          priority: fScore[startNodeId],
        },
        pointers: {
          currentNodeId: startNodeId,
          frontierNodeIds: frontier.map((item) => item.nodeId),
        },
        explanation: {
          what: `Seed ${startNodeId} with f = 0 + ${startHeuristic} = ${fScore[startNodeId]}.`,
          why: "A* starts from the source and ranks candidates by real cost plus heuristic.",
          impact: "The frontier has its first prioritized route.",
          next: "Expand the lowest f-score node.",
        },
        decision: {
          options: ["Start at source", "Start at goal", "Start everywhere"],
          chosen: "Start at source",
          reasoning: "The path cost g is known only at the source.",
        },
        insightTags: ["Initialization", "A* priority"],
      };

      while (frontier.length > 0) {
        const current = frontier.shift()!;
        const knownScore = fScore[current.nodeId];

        yield {
          type: "dequeue",
          payload: {
            nodeId: current.nodeId,
            priority: current.priority,
            gScore: gScore[current.nodeId],
            fScore: knownScore,
          },
          pointers: {
            currentNodeId: current.nodeId,
            frontierNodeIds: frontier.map((item) => item.nodeId),
          },
          explanation: {
            what: `Remove ${current.nodeId} with f-score ${current.priority}.`,
            why: "A* expands the frontier route with the best estimated total cost.",
            impact: "This node becomes the next candidate to validate and expand.",
            next: "Reject stale scores or visit the node.",
          },
          decision: {
            options: ["Expand lowest f-score", "Expand lowest h-score", "Expand insertion order"],
            chosen: "Expand lowest f-score",
            reasoning: "f = g + h balances actual path cost with goal-directed estimate.",
          },
          insightTags: ["Heuristic choice", "Priority queue"],
        };

        if (current.priority > knownScore) {
          yield {
            type: "skip_node",
            payload: {
              nodeId: current.nodeId,
              priority: current.priority,
              previousDistance: knownScore,
            },
            pointers: {
              currentNodeId: current.nodeId,
              frontierNodeIds: frontier.map((item) => item.nodeId),
            },
            explanation: {
              what: `Skip stale frontier entry for ${current.nodeId}.`,
              why: `The queued score ${current.priority} is worse than the known f-score ${knownScore}.`,
              impact: "No route data changes.",
              next: "Continue with the next frontier item.",
            },
            decision: {
              options: ["Process stale route", "Skip stale route"],
              chosen: "Skip stale route",
              reasoning: "A stale route cannot improve the current best estimate.",
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
            distance: gScore[current.nodeId],
            gScore: gScore[current.nodeId],
            fScore: fScore[current.nodeId],
          },
          pointers: {
            currentNodeId: current.nodeId,
            frontierNodeIds: frontier.map((item) => item.nodeId),
          },
          explanation: {
            what: `Visit ${current.nodeId} with g=${gScore[current.nodeId]} and f=${fScore[current.nodeId]}.`,
            why: "It is the best-ranked route available right now.",
            impact: "Its outgoing edges can improve neighboring routes.",
            next: current.nodeId === endNodeId ? "Reconstruct the path." : "Evaluate outgoing edges.",
          },
          decision: {
            options: ["Expand this candidate", "Delay it"],
            chosen: "Expand this candidate",
            reasoning: "A* trusts the lowest f-score as the most promising next route.",
          },
          insightTags: ["A* expansion", "Heuristic choice"],
        };

        if (current.nodeId === endNodeId) {
          const path = reconstructPath(parentByNodeId, endNodeId);
          yield {
            type: "path_found",
            payload: {
              nodeIds: path,
              nodeId: endNodeId,
              distance: gScore[endNodeId],
              gScore: gScore[endNodeId],
              fScore: fScore[endNodeId],
              finalPath: path,
            },
            pointers: {
              currentNodeId: endNodeId,
              frontierNodeIds: frontier.map((item) => item.nodeId),
            },
            explanation: {
              what: `Reconstruct the path to ${endNodeId}.`,
              why: "The goal was selected from the frontier as the best current candidate.",
              impact: `Final path cost is ${gScore[endNodeId]}.`,
            },
            decision: {
              options: ["Stop at goal", "Keep exploring"],
              chosen: "Stop at goal",
              reasoning: "With an admissible heuristic, selecting the goal finalizes the optimal path.",
            },
            insightTags: ["Goal reached", "Parent reconstruction"],
          };

          return {
            found: true,
            path,
            visitedCount,
            terminated: true,
            message: `A* found a path with total cost ${gScore[endNodeId]}.`,
            metricValue: gScore[endNodeId],
          };
        }

        for (const neighbor of getNeighbors(graph, current.nodeId)) {
          const neighborNode = getNodeById(graph, neighbor.nodeId);
          const tentativeG = gScore[current.nodeId] + neighbor.weight;
          const previousG = gScore[neighbor.nodeId];
          const heuristicScore = heuristic(neighborNode, goalNode);
          const candidateF = tentativeG + heuristicScore;

          yield {
            type: "relax_edge",
            payload: {
              fromId: current.nodeId,
              toId: neighbor.nodeId,
              edgeId: neighbor.edge.id,
              distance: tentativeG,
              previousDistance: Number.isFinite(previousG) ? previousG : null,
              heuristic: heuristicScore,
              gScore: tentativeG,
              hScore: heuristicScore,
              fScore: candidateF,
            },
            pointers: {
              currentNodeId: current.nodeId,
              currentEdgeId: neighbor.edge.id,
              frontierNodeIds: frontier.map((item) => item.nodeId),
            },
            explanation: {
              what: `Evaluate ${current.nodeId} -> ${neighbor.nodeId}: g=${tentativeG}, h=${heuristicScore}, f=${candidateF}.`,
              why: "A* accepts a neighbor route only when its real cost improves.",
              impact: `Previous g for ${neighbor.nodeId} is ${Number.isFinite(previousG) ? previousG : "infinity"}.`,
              next: "Accept or reject this route.",
            },
            decision: {
              options: ["Accept if g improves", "Accept if h is small", "Accept every edge"],
              chosen: "Accept if g improves",
              reasoning: "The parent map must represent the cheapest known real path to each node.",
            },
            insightTags: ["Relaxation step", "Heuristic scoring"],
          };

          if (tentativeG >= previousG) {
            yield {
              type: "skip_node",
              payload: {
                nodeId: neighbor.nodeId,
                fromId: current.nodeId,
                toId: neighbor.nodeId,
                edgeId: neighbor.edge.id,
                distance: tentativeG,
                previousDistance: previousG,
                heuristic: heuristicScore,
                gScore: tentativeG,
                hScore: heuristicScore,
                fScore: candidateF,
              },
              pointers: {
                currentNodeId: current.nodeId,
                currentEdgeId: neighbor.edge.id,
                frontierNodeIds: frontier.map((item) => item.nodeId),
              },
              explanation: {
                what: `Reject the route to ${neighbor.nodeId}.`,
                why: `Tentative g=${tentativeG} is not better than known g=${previousG}.`,
                impact: "Parent and priority stay unchanged.",
                next: "Try the next edge.",
              },
              decision: {
                options: [`Use g=${tentativeG}`, `Keep g=${previousG}`],
                chosen: `Keep g=${previousG}`,
                reasoning: "A worse real path should not replace a better one, even if its heuristic looks attractive.",
              },
              insightTags: ["Rejected relaxation"],
            };
            continue;
          }

          gScore[neighbor.nodeId] = tentativeG;
          fScore[neighbor.nodeId] = candidateF;
          parentByNodeId[neighbor.nodeId] = current.nodeId;
          yield {
            type: "update_distance",
            payload: {
              nodeId: neighbor.nodeId,
              fromId: current.nodeId,
              toId: neighbor.nodeId,
              edgeId: neighbor.edge.id,
              distance: tentativeG,
              previousDistance: Number.isFinite(previousG) ? previousG : null,
              heuristic: heuristicScore,
              gScore: tentativeG,
              hScore: heuristicScore,
              fScore: candidateF,
            },
            pointers: {
              currentNodeId: neighbor.nodeId,
              currentEdgeId: neighbor.edge.id,
              frontierNodeIds: frontier.map((item) => item.nodeId),
            },
            explanation: {
              what: `Record a better route to ${neighbor.nodeId}.`,
              why: `The real cost improves to g=${tentativeG}.`,
              impact: `${current.nodeId} becomes the parent and f-score becomes ${candidateF}.`,
              next: "Queue the improved candidate.",
            },
            decision: {
              options: ["Keep old route", "Record better route"],
              chosen: "Record better route",
              reasoning: "A* keeps the cheapest real path found before applying heuristic priority.",
            },
            insightTags: ["Distance update", "A* priority"],
          };

          pushByPriority(frontier, { nodeId: neighbor.nodeId, priority: candidateF });
          yield {
            type: Number.isFinite(previousG) ? "priority_update" : "enqueue",
            payload: {
              nodeId: neighbor.nodeId,
              distance: tentativeG,
              heuristic: heuristicScore,
              gScore: tentativeG,
              hScore: heuristicScore,
              fScore: candidateF,
              priority: candidateF,
            },
            pointers: {
              currentNodeId: neighbor.nodeId,
              frontierNodeIds: frontier.map((item) => item.nodeId),
            },
            explanation: {
              what: Number.isFinite(previousG)
                ? `Lower ${neighbor.nodeId}'s frontier priority to f=${candidateF}.`
                : `Add ${neighbor.nodeId} to the frontier with f=${candidateF}.`,
              why: "The frontier must rank the improved total estimate.",
              impact: `${neighbor.nodeId} can now be selected by its updated f-score.`,
              next: "Continue searching the most promising route.",
            },
            decision: {
              options: ["Queue improved candidate", "Leave frontier unchanged"],
              chosen: "Queue improved candidate",
              reasoning: "The priority queue is the mechanism that makes A* goal-directed.",
            },
            insightTags: Number.isFinite(previousG)
              ? ["Priority update", "A* priority"]
              : ["Frontier discovery", "A* priority"],
          };
        }
      }

      return {
        found: false,
        path: [],
        visitedCount,
        terminated: true,
        message: `A* could not reach ${endNodeId} from ${startNodeId}.`,
        metricValue: 0,
      };
    },
  };
}

export const aStarAlgorithm = createAStarAlgorithm();
