# Dijkstra's Algorithm Visualizer

A simple project to visualize Dijkstra's shortest path algorithm using both Python and JavaScript implementations.

## Features
- Visualizes Dijkstra's algorithm step-by-step
- Interactive web interface (HTML/JS)
- Python implementation for CLI or further extension
- Customizable graph and styles

## Requirements
- For web: Any modern browser
- For Python: Python 3.8+

## Getting Started
### Web Version
1. Open `main.html` in your browser.
2. Interact with the visualizer to see Dijkstra's algorithm in action.

### Python Version
1. Run the Python script:
   ```bash
   python main.py
   ```

## File Structure
- `main.html` — Web interface for visualization
- `script.js` — JavaScript logic for Dijkstra's algorithm
- `styles.css` — Styling for the web app
- `algo.js` — Additional algorithm logic
- `main.py` — Python implementation
- `IMPLEMENTATION.md` — Details about the algorithm and its implementation

## How Dijkstra's Algorithm Works
Dijkstra's algorithm finds the shortest path from a starting node to all other nodes in a graph. It works by:
- Starting at the source node
- Repeatedly choosing the node with the smallest known distance
- Updating the distances to its neighbors
- Marking nodes as visited
- Continuing until all nodes are visited

It's great for finding the shortest route in maps, networks, and more!

## License
MIT
