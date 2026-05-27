graph = {
    'A': {'B': 4, 'C': 4},
    'B': {'A': 4, 'C': 2},
    'C': {'A': 4, 'B': 2, 'D': 3, 'E': 1, 'F': 6},
    'D': {'C': 3, 'F': 2},
    'E': {'C': 1, 'F': 3},
    'F': {'C': 6, 'D': 2, 'E': 3},
}

def dijkstra(graph, start, end):
    shortest_distance = {vertex: float('infinity') for vertex in graph}
    shortest_distance[start] = 0

    predecessor = {vertex: None for vertex in graph}

    unvisited_vertices = list(graph)

    while unvisited_vertices:

        current_vertex = min(unvisited_vertices, key = lambda vertex: shortest_distance[vertex])

        for neighbour, weight in graph[current_vertex].items():
            if shortest_distance[current_vertex] + weight < shortest_distance[neighbour]:
                shortest_distance[neighbour] = shortest_distance[current_vertex] + weight
                predecessor[neighbour] = current_vertex
        
        unvisited_vertices.remove(current_vertex)

    path = []
    while end:
        path.append(end)
        end = predecessor[end]

    path.reverse()
    return shortest_distance, path 


# Function to get input from user
start = input("Enter the start vertex: ").upper()
end = input("Enter the end vertex: ").upper()

# Call dijkstra function
distance, path = dijkstra(graph, start, end)

print(f"Shortest path from {start} to {end}: {path}")
print(f"Shortest distance from {start} to {end}: {distance[end]}")
