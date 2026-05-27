function dijkstra(graph, startNode, endNode) {
  const costs = {}; // Stores shortest distances
  const parents = {}; // Stores predecessors for path reconstruction
  const processed = new Set(); // Stores visited nodes

  // Initialize costs and parents
  for (const node in graph) {
    costs[node] = node === startNode ? 0 : Infinity;
    parents[node] = null;
  }

  let currentNode = findLowestCostNode(costs, processed);

  while (currentNode) {
    const cost = costs[currentNode];
    const neighbors = graph[currentNode];

    for (const neighbor in neighbors) {
      const newCost = cost + neighbors[neighbor];
      if (newCost < costs[neighbor]) {
        costs[neighbor] = newCost;
        parents[neighbor] = currentNode;
      }
    }
    processed.add(currentNode);
    currentNode = findLowestCostNode(costs, processed);
  }

  // Reconstruct path
  const path = [];
  let current = endNode;
  while (current) {
    path.unshift(current);
    current = parents[current];
  }

  return { distance: costs[endNode], path: path };
}

function findLowestCostNode(costs, processed) {
  let lowestCost = Infinity;
  let lowestCostNode = null;

  for (const node in costs) {
    const cost = costs[node];
    if (cost < lowestCost && !processed.has(node)) {
      lowestCost = cost;
      lowestCostNode = node;
    }
  }
  return lowestCostNode;
}

// Example usage:
const graph = {
  start: { A: 5, B: 2 },
  A: { C: 4, D: 2 },
  B: { A: 8, D: 7 },
  C: { D: 6, finish: 3 },
  D: { finish: 1 },
  finish: {},
};

const result = dijkstra(graph, 'start', 'finish');
console.log(result); // { distance: 8, path: [ 'start', 'A', 'D', 'finish' ] }