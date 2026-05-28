# Dijkstra Faithful Replay Implementation (OSRM Integration)

## What Changed

The Dijkstra visualization now uses **Open Source Routing Machine (OSRM) step data** (mapped to the maneuver structure) instead of approximating distances, making it a "faithful replay" of real-world road network routing.

All commercial MapQuest JS SDK libraries and CSS have been replaced by the completely free and open-source **Leaflet.js** and **OpenStreetMap** tile layers.

## How It Works

### Mapping Infrastructure
- **Tiles**: OpenStreetMap (`https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png`)
- **Directions API**: OSRM Demo API (`https://router.project-osrm.org/route/v1/`)
- **Profiles**: `driving` (for Car travel mode) and `foot` (for Walk travel mode)
- **Parameters**: `overview=full`, `geometries=geojson`, `steps=true`, `alternatives=true`

### Maneuver-Based Routing
- Uses OSRM's turn-by-turn `legs[0].steps` data directly.
- An adapter function `mapOSRMToMapQuest(osrmRoute, startPoint, endPoint)` transforms OSRM steps into the standard maneuver structure expected by the visualizer:
  - Each step becomes a node in the graph.
  - OSRM step coordinates (GeoJSON longitude-first format) are converted to Latitude-Longitude arrays.
  - Step distances (meters) are converted to miles for processing, matching the visualizer's display conversion mathematical ratio.
  - Narratives are generated dynamically from step modifiers and names (e.g., "Turn right onto 5th Avenue").
- Result: Dijkstra's computed distance and travel time **faithfully match the real road values reported by OSRM**.

## Graph Building: `buildGraphFromManeuvers(route)`

```javascript
// Creates a graph from OSRM steps
{
  graph: {
    maneuver_0: {
      coord: [lat, lng],
      neighbors: {
        maneuver_1: { distance: 0.5, time: 30 }  // 0.5 km, 30 sec
      }
    }
  },
  nodeIds: ['maneuver_0', 'maneuver_1', ...],
  totalDistance: 5.2,  // OSRM's total (km)
  totalTime: 360       // OSRM's total (seconds)
}
```

## Visualization Updates

### When Using Maneuvers
- Log shows: `✓ Using OSRM road step data (exact distances & times)`
- Displays: `📊 OSRM Route: 5.20 km, 6 min`
- Dijkstra steps show both: `(2.50 km, 3 min)`
- Final result: `📏 Dijkstra Distance: 5.20 km` + `⏱️  Dijkstra Time: 6 min`
- Statistics panel shows time and distance

### Fallback (Polyline Sampling)
- If steps are unavailable, it falls back to the polyline sampling method.
- Log shows: `ℹ️ Maneuvers unavailable, using polyline sampling`
- Only shows distance (no time data)

## Testing

1. Start server:
```bash
python3 -m http.server 8000
```

2. Open http://localhost:8000/index.html

3. Follow these steps:
   - Click "Enable Route Selection"
   - Click map twice (start → destination)
   - Choose Car 🚗 or Walk 🚶
   - Click "Get Real Directions"
   - Click "Visualize Dijkstra"

4. Verify:
   - Log shows "Using OSRM road step data"
   - OSRM route distance/time is displayed
   - Dijkstra's final distance/time matches OSRM's values
   - Statistics panel shows both metrics

## Why This Matters

- **Completely Free**: No API keys, sign-ups, or MapQuest JS SDK accounts required.
- **Educational**: Shows how Dijkstra works with real-world road network data.
- **Accurate**: No straight-line approximations—uses exact road segment distances.
- **Complete**: Tracks both distance AND time metrics.
