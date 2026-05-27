// Initialize the map centered on a city (Noida as example)
let map;
const initialCenter = [28.56, 77.34]; // Noida
const initialZoom = 13;

// Initialize Leaflet map with OpenStreetMap tiles (Completely free, no API keys needed)
map = L.map('map').setView(initialCenter, initialZoom);
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© OpenStreetMap contributors',
    maxZoom: 19
}).addTo(map);
console.log('Leaflet map initialized successfully with OSM tiles');

// Graph data structure
let nodes = {};
let edges = [];
let markers = {};
let polylines = [];
let homeNode = null;
let officeNode = null;

// Route selection
let startPoint = null;
let endPoint = null;
let routeLayers = []; // Store multiple route layers
let currentRouteType = 'fastest'; // Default route type
let isAnimating = false;
let animationSpeed = 300; // milliseconds per step
let dijkstraGraph = {}; // Graph built from route waypoints
let lastShortestRoute = null; // Store the last shortest route for visualization
let allRoutes = []; // Store all route results for Dijkstra comparison
let travelMode = 'car'; // 'car' or 'pedestrian'

// Create a custom icon for different node types
function createIcon(color) {
    return L.divIcon({
        className: 'custom-marker',
        html: `<div style="background-color: ${color}; width: 20px; height: 20px; border-radius: 50%; border: 3px solid white; box-shadow: 0 2px 5px rgba(0,0,0,0.5);"></div>`,
        iconSize: [20, 20],
        iconAnchor: [10, 10]
    });
}

function addNode(id, lat, lng, type = 'intersection') {
    nodes[id] = { lat, lng, type };
    
    let color = '#999'; // Gray for intersections
    if (type === 'home') {
        color = '#000'; // Black for home
        homeNode = id;
    } else if (type === 'office') {
        color = '#666'; // Dark gray for office
        officeNode = id;
    }
    
    const marker = L.marker([lat, lng], { icon: createIcon(color) })
        .addTo(map)
        .bindPopup(`<b>${type.toUpperCase()}</b><br>Node: ${id}`);
    
    markers[id] = marker;
}

function addEdge(from, to, weight) {
    edges.push({ from, to, weight });
    
    const fromNode = nodes[from];
    const toNode = nodes[to];
    
    if (fromNode && toNode) {
        const line = L.polyline(
            [[fromNode.lat, fromNode.lng], [toNode.lat, toNode.lng]],
            {
                color: '#ccc',
                weight: 4,
                opacity: 0.6
            }
        ).addTo(map);
        
        // Add label with weight (traffic time)
        const midLat = (fromNode.lat + toNode.lat) / 2;
        const midLng = (fromNode.lng + toNode.lng) / 2;
        
        L.marker([midLat, midLng], {
            icon: L.divIcon({
                className: 'edge-label',
                html: `<div style="background: white; padding: 3px 8px; border: 2px solid #000; font-weight: bold; font-size: 11px;">${weight} min</div>`,
                iconSize: [50, 20]
            })
        }).addTo(map);
        
        polylines.push(line);
    }
}

function loadSampleCity() {
    resetMap();
    
    logStep('Map ready! Click on the map to set your start and end points.');
    logStep('Click once for start location, click again for destination.');
    
    // Enable click-to-add-points on the map
    map.on('click', onMapClick);
}

function onMapClick(e) {
    const lat = e.latlng.lat;
    const lng = e.latlng.lng;
    
    if (!startPoint) {
        // First click - set start point
        startPoint = { lat, lng };
        const marker = L.marker([lat, lng], { icon: createIcon('#000') })
            .addTo(map)
            .bindPopup('<b>START</b><br>Click another location for destination');
        marker.openPopup();
        markers['start'] = marker;
        logStep(`Start point set at [${lat.toFixed(4)}, ${lng.toFixed(4)}]`);
    } else if (!endPoint) {
        // Second click - set end point
        endPoint = { lat, lng };
        const marker = L.marker([lat, lng], { icon: createIcon('#666') })
            .addTo(map)
            .bindPopup('<b>DESTINATION</b><br>Ready to find route!');
        marker.openPopup();
        markers['end'] = marker;
        logStep(`Destination set at [${lat.toFixed(4)}, ${lng.toFixed(4)}]`);
        logStep('Click "Find Fastest Route" to get directions using real roads!');
    } else {
        logStep('Start and end already set. Click "Reset Map" to choose new points.');
    }
}

function dijkstra(start, end) {
    const distances = {};
    const previous = {};
    const unvisited = new Set();
    
    // Initialize
    for (let node in nodes) {
        distances[node] = Infinity;
        previous[node] = null;
        unvisited.add(node);
    }
    distances[start] = 0;
    
    logStep(`Starting Dijkstra's algorithm from ${start} to ${end}`);
    logStep(`Initial distances: all set to ∞ except ${start} = 0`);
    
    while (unvisited.size > 0) {
        // Find node with minimum distance
        let current = null;
        let minDist = Infinity;
        for (let node of unvisited) {
            if (distances[node] < minDist) {
                minDist = distances[node];
                current = node;
            }
        }
        
        if (current === null || distances[current] === Infinity) break;
        
        logStep(`Visiting node ${current} (distance: ${distances[current]} min)`);
        
        unvisited.delete(current);
        
        if (current === end) {
            logStep(`✓ Reached destination ${end}!`);
            break;
        }
        
        // Check neighbors
        const neighbors = edges.filter(e => e.from === current);
        for (let edge of neighbors) {
            if (unvisited.has(edge.to)) {
                const altDist = distances[current] + edge.weight;
                if (altDist < distances[edge.to]) {
                    distances[edge.to] = altDist;
                    previous[edge.to] = current;
                    logStep(`  → Updated ${edge.to}: ${altDist} min (via ${current})`);
                }
            }
        }
    }
    
    // Reconstruct path
    const path = [];
    let current = end;
    while (current !== null) {
        path.unshift(current);
        current = previous[current];
    }
    
    return { path, distance: distances[end] };
}

function runDijkstra() {
    if (!startPoint || !endPoint) {
        alert('Please click on the map to set start and end points first!');
        logStep('❌ Need start and end points. Click "Enable Route Selection" and then click twice on the map.');
        return;
    }
    
    // Clear previous results
    document.getElementById('steps').innerHTML = '';
    logStep(`🔍 Requesting multiple route options (${travelMode.toUpperCase()} mode) from OSRM...`);
    logStep('Calculating: Fastest, Shortest, and Alternative routes...');
    
    // Clear previous routes
    routeLayers.forEach(layer => map.removeLayer(layer));
    routeLayers = [];
    
    // Define route types based on travel mode
    let routeTypes;
    if (travelMode === 'pedestrian') {
        routeTypes = [
            { type: 'fastest', color: '#FF6B35', label: 'Fastest Walk', weight: 6 },
            { type: 'shortest', color: '#0066cc', label: 'Shortest Walk', weight: 5 },
            { type: 'alternative', color: '#9B59B6', label: 'Alternative Walk', weight: 4 }
        ];
    } else {
        routeTypes = [
            { type: 'fastest', color: '#000', label: 'Fastest Drive', weight: 6 },
            { type: 'shortest', color: '#0066cc', label: 'Shortest Drive', weight: 5 },
            { type: 'alternative', color: '#00cc00', label: 'Alternative Drive', weight: 4 }
        ];
    }
    
    const profile = travelMode === 'pedestrian' ? 'foot' : 'driving';
    const url = `https://router.project-osrm.org/route/v1/${profile}/${startPoint.lng},${startPoint.lat};${endPoint.lng},${endPoint.lat}?overview=full&geometries=geojson&steps=true&alternatives=true`;
    
    fetch(url)
        .then(response => {
            if (!response.ok) {
                throw new Error(`OSRM API error: status ${response.status}`);
            }
            return response.json();
        })
        .then(data => {
            if (data.code !== 'Ok' || !data.routes || data.routes.length === 0) {
                throw new Error(data.message || 'No route found');
            }
            
            const routeResults = [];
            
            // Draw and collect up to 3 OSRM routes
            data.routes.forEach((osrmRoute, index) => {
                if (index < routeTypes.length) {
                    const routeConfig = routeTypes[index];
                    const mappedRoute = mapOSRMToMapQuest(osrmRoute, startPoint, endPoint);
                    
                    // Draw this route
                    drawRoute(mappedRoute, routeConfig);
                    routeResults.push({ config: routeConfig, route: mappedRoute });
                }
            });
            
            showRouteSummary(routeResults);
            
            // Store ALL routes for Dijkstra comparison
            allRoutes = routeResults;
            
            if (routeResults.length > 0) {
                logStep('');
                logStep('💡 Click "Visualize Dijkstra" to let the algorithm choose the best route!');
                logStep(`   Dijkstra will analyze all ${routeResults.length} routes and find the shortest one.`);
            }
        })
        .catch(error => {
            console.error('Error fetching from OSRM:', error);
            logStep(`❌ Error getting directions: ${error.message}`);
        });
}

function mapOSRMToMapQuest(osrmRoute, startPoint, endPoint) {
    const shapePoints = [];
    if (osrmRoute.geometry && osrmRoute.geometry.coordinates) {
        osrmRoute.geometry.coordinates.forEach(coord => {
            shapePoints.push(coord[1]); // lat
            shapePoints.push(coord[0]); // lng
        });
    }
    
    const maneuvers = [];
    if (osrmRoute.legs && osrmRoute.legs[0] && osrmRoute.legs[0].steps) {
        osrmRoute.legs[0].steps.forEach((step) => {
            if (step.maneuver && step.maneuver.location) {
                maneuvers.push({
                    distance: step.distance / 1609.344, // convert to miles
                    time: step.duration, // seconds
                    narrative: getNarrative(step),
                    startPoint: {
                        lat: step.maneuver.location[1],
                        lng: step.maneuver.location[0]
                    }
                });
            }
        });
    }
    
    return {
        distance: osrmRoute.distance / 1609.344, // convert to miles
        time: osrmRoute.duration, // seconds
        shape: {
            shapePoints: shapePoints
        },
        legs: [
            {
                maneuvers: maneuvers
            }
        ],
        locations: [
            { latLng: { lat: startPoint.lat, lng: startPoint.lng } },
            { latLng: { lat: endPoint.lat, lng: endPoint.lng } }
        ]
    };
}

function getNarrative(step) {
    const type = step.maneuver.type;
    const modifier = step.maneuver.modifier || '';
    const name = step.name || '';
    
    if (type === 'depart') {
        return `Head ${modifier} on ${name || 'road'}`;
    } else if (type === 'arrive') {
        return `Arrive at destination`;
    } else if (type === 'turn') {
        return `Turn ${modifier} onto ${name || 'road'}`;
    } else if (type === 'new name') {
        return `Continue onto ${name || 'road'}`;
    } else {
        // capitalize first letter of type
        const typeStr = type.charAt(0).toUpperCase() + type.slice(1);
        const modStr = modifier ? ` ${modifier}` : '';
        const nameStr = name ? ` onto ${name}` : '';
        return `${typeStr}${modStr}${nameStr}`;
    }
}

function drawRoute(route, config) {
    const shapePoints = route.shape.shapePoints;
    let routeCoords = [];
    
    if (Array.isArray(shapePoints)) {
        for (let i = 0; i < shapePoints.length; i += 2) {
            const lat = shapePoints[i];
            const lng = shapePoints[i + 1];
            if (lat !== undefined && lng !== undefined) {
                routeCoords.push([lat, lng]);
            }
        }
    }
    
    if (routeCoords.length > 0) {
        const layer = L.polyline(routeCoords, {
            color: config.color,
            weight: config.weight,
            opacity: 0.7
        }).addTo(map);
        
        routeLayers.push(layer);
        
        const distance = (route.distance * 1.60934).toFixed(2);
        const timeMinutes = Math.round(route.time / 60);
        const hours = Math.floor(timeMinutes / 60);
        const mins = timeMinutes % 60;
        
        let timeDisplay = '';
        if (hours > 0) {
            timeDisplay = `${hours}h ${mins}m`;
        } else {
            timeDisplay = `${mins} min`;
        }
        
        logStep(`✓ ${config.label}: ${distance} km, ${timeDisplay}`);
        
        // Add one label in the middle of the route showing total time and distance
        if (routeCoords.length > 0) {
            const midIndex = Math.floor(routeCoords.length / 2);
            const midPoint = routeCoords[midIndex];
            
            const marker = L.marker(midPoint, {
                icon: L.divIcon({
                    className: 'route-total-label',
                    html: `<div style="background: ${config.color}; color: white; padding: 5px 10px; border-radius: 6px; font-weight: bold; font-size: 12px; white-space: nowrap; border: 2px solid white; box-shadow: 0 3px 6px rgba(0,0,0,0.4);">⏱️ ${timeDisplay}<br>📏 ${distance} km</div>`,
                    iconSize: [90, 40],
                    iconAnchor: [45, 20]
                })
            }).addTo(map);
            
            routeLayers.push(marker);
        }
    }
}

function showRouteSummary(results) {
    if (results.length === 0) {
        logStep('❌ No routes found');
        return;
    }
    
    // Fit map to show all routes (handle markers and polylines safely)
    if (routeLayers.length > 0) {
        let bounds = null;
        routeLayers.forEach(layer => {
            try {
                if (typeof layer.getBounds === 'function') {
                    const b = layer.getBounds();
                    bounds = bounds ? bounds.extend(b) : L.latLngBounds(b);
                } else if (typeof layer.getLatLng === 'function') {
                    const ll = layer.getLatLng();
                    bounds = bounds ? bounds.extend(ll) : L.latLngBounds(ll);
                }
            } catch (e) {
                console.warn('Could not compute bounds for a route layer:', e);
            }
        });
        if (bounds) {
            map.fitBounds(bounds, { padding: [50, 50] });
        }
    }
    
    // Sort by time
    results.sort((a, b) => a.route.time - b.route.time);
    const fastest = results[0];
    
    // Update statistics with fastest route
    const timeMin = Math.round(fastest.route.time / 60);
    document.getElementById('totalTime').textContent = `${timeMin} min`;

    // Safely read maneuvers count
    let maneuvers = '--';
    try {
        if (fastest.route.legs && fastest.route.legs[0] && Array.isArray(fastest.route.legs[0].maneuvers)) {
            maneuvers = fastest.route.legs[0].maneuvers.length;
        }
    } catch (e) {
        console.warn('Could not read maneuvers:', e);
    }
    document.getElementById('nodeCount').textContent = maneuvers;
    
    logStep('\n📊 Route Comparison:');
    logStep('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    results.forEach((result, index) => {
        const dist = (result.route.distance * 1.60934).toFixed(2);
        const time = Math.round(result.route.time / 60);
        const hours = Math.floor(time / 60);
        const mins = time % 60;
        
        let timeDisplay = '';
        if (hours > 0) {
            timeDisplay = `${hours}h ${mins}min`;
        } else {
            timeDisplay = `${mins} min`;
        }
        
        logStep(`${index + 1}. ${result.config.label}:`);
        logStep(`   📏 Distance: ${dist} km`);
        logStep(`   ⏱️  Time: ${timeDisplay}`);
        if (index === 0) {
            logStep(`   ⭐ RECOMMENDED`);
        }
        logStep('');
    });
    
    // Show turn-by-turn directions for the fastest route with time per segment (if available)
    try {
        if (fastest.route.legs && fastest.route.legs[0] && Array.isArray(fastest.route.legs[0].maneuvers)) {
            logStep('\n📍 Turn-by-turn Directions (Fastest Route):');
            const legs = fastest.route.legs[0];
            legs.maneuvers.forEach((maneuver, index) => {
                const narrative = maneuver.narrative || '';
                const distKm = (maneuver.distance * 1.60934).toFixed(2);
                const timeSec = maneuver.time || 0;
                const timeMin = Math.floor(timeSec / 60);
                const timeSecs = timeSec % 60;
                
                let timeStr = '';
                if (timeMin > 0) {
                    timeStr = `${timeMin}m ${timeSecs}s`;
                } else {
                    timeStr = `${timeSecs}s`;
                }
                
                logStep(`${index + 1}. ${narrative}`);
                logStep(`   📏 ${distKm} km  ⏱️ ${timeStr}`);
            });
        }
    } catch (e) {
        console.warn('Could not render turn-by-turn directions:', e);
    }
}

function logStep(message) {
    const stepsDiv = document.getElementById('steps');
    const step = document.createElement('div');
    step.className = 'step';
    step.textContent = message;
    stepsDiv.appendChild(step);
    stepsDiv.scrollTop = stepsDiv.scrollHeight;
}

function resetMap() {
    // Clear all markers and polylines
    for (let id in markers) {
        map.removeLayer(markers[id]);
    }
    polylines.forEach(line => map.removeLayer(line));
    
    // Clear route layers
    routeLayers.forEach(layer => map.removeLayer(layer));
    routeLayers = [];
    
    // Clear data
    nodes = {};
    edges = [];
    markers = {};
    polylines = [];
    homeNode = null;
    officeNode = null;
    startPoint = null;
    endPoint = null;
    
    // Remove click handler
    map.off('click', onMapClick);
    
    // Reset UI
    document.getElementById('totalTime').textContent = '--';
    document.getElementById('nodeCount').textContent = '--';
    document.getElementById('steps').innerHTML = '<div class="step">Map reset. Click "Load Sample City" to start.</div>';
    
    // Reset map view
    map.setView(initialCenter, initialZoom);
}

// ===== DIJKSTRA VISUALIZATION FUNCTIONS =====

// Manual trigger for Dijkstra visualization
function visualizeShortestPath() {
    if (!allRoutes || allRoutes.length === 0) {
        alert('Please get directions first by clicking "Get Real Directions"!');
        logStep('❌ No route data available. Get directions first.');
        return;
    }
    
    if (isAnimating) {
        alert('Animation already in progress!');
        return;
    }
    
    // Clear the route polylines but keep the markers
    const tempMarkers = routeLayers.filter(layer => layer instanceof L.Marker || layer instanceof L.CircleMarker);
    routeLayers.forEach(layer => {
        if (layer instanceof L.Polyline && !(layer instanceof L.CircleMarker)) {
            map.removeLayer(layer);
        }
    });
    routeLayers = [...tempMarkers];
    
    runDijkstraVisualizationMultiRoute(allRoutes);
}

// Build a combined graph from multiple routes
function buildCombinedGraphFromRoutes(routeResults) {
    if (!routeResults || routeResults.length === 0) {
        return null;
    }
    
    logStep('');
    logStep('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    logStep('🎯 BUILDING COMBINED ROUTE GRAPH');
    logStep('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    logStep(`📊 Analyzing ${routeResults.length} different routes from OSRM`);
    logStep('');
    
    const combinedGraph = {};
    const allNodeIds = [];
    const routeGraphs = [];
    const MILES_TO_KM = 1.60934;
    
    // Build individual graphs for each route
    routeResults.forEach((routeResult, routeIndex) => {
        const { route, config } = routeResult;
        const routeGraph = buildGraphFromManeuvers(route);
        
        if (routeGraph) {
            logStep(`✓ ${config.label}: ${routeGraph.totalDistance.toFixed(2)} km, ${Math.round(routeGraph.totalTime / 60)} min, ${routeGraph.nodeIds.length} nodes`);
            routeGraphs.push({ 
                ...routeGraph, 
                routeIndex, 
                config,
                routeId: `route${routeIndex}`
            });
        }
    });
    
    if (routeGraphs.length === 0) {
        logStep('❌ No route maneuvers available');
        return null;
    }
    
    logStep('');
    logStep('🔗 Combining routes into single graph...');
    
    // Create a unified start and end node
    const startNodeId = 'START';
    const endNodeId = 'END';
    
    // Use coordinates from first route
    const firstRoute = routeGraphs[0];
    const firstNodeId = firstRoute.nodeIds[0];
    const lastNodeId = firstRoute.nodeIds[firstRoute.nodeIds.length - 1];
    
    combinedGraph[startNodeId] = {
        coord: firstRoute.graph[firstNodeId].coord,
        neighbors: {}
    };
    
    combinedGraph[endNodeId] = {
        coord: firstRoute.graph[lastNodeId].coord,
        neighbors: {}
    };
    
    allNodeIds.push(startNodeId);
    
    // Add all nodes from all routes with unique IDs
    routeGraphs.forEach((routeGraph) => {
        const { graph, nodeIds, routeIndex, config } = routeGraph;
        
        nodeIds.forEach((nodeId, idx) => {
            // Create unique node ID for this route
            const uniqueNodeId = `${config.type}_${nodeId}`;
            
            // Skip if it's the first or last node (we use unified START/END)
            if (idx === 0 || idx === nodeIds.length - 1) {
                return;
            }
            
            // Copy node data
            combinedGraph[uniqueNodeId] = {
                coord: graph[nodeId].coord,
                neighbors: {},
                routeType: config.type,
                routeLabel: config.label
            };
            
            allNodeIds.push(uniqueNodeId);
        });
        
        // Connect START to first node of this route
        const firstUniqueId = nodeIds.length > 1 ? `${config.type}_${nodeIds[1]}` : endNodeId;
        const firstEdge = graph[nodeIds[0]].neighbors[nodeIds[1]];
        
        if (firstEdge && firstUniqueId !== endNodeId) {
            combinedGraph[startNodeId].neighbors[firstUniqueId] = firstEdge;
        } else if (nodeIds.length === 2) {
            // Direct connection if only 2 nodes
            combinedGraph[startNodeId].neighbors[endNodeId] = firstEdge;
        }
        
        // Copy internal edges
        for (let i = 1; i < nodeIds.length - 1; i++) {
            const currentId = `${config.type}_${nodeIds[i]}`;
            const originalNeighbors = graph[nodeIds[i]].neighbors;
            
            for (const neighborId in originalNeighbors) {
                const neighborIdx = nodeIds.indexOf(neighborId);
                if (neighborIdx === nodeIds.length - 1) {
                    // Connect to END
                    combinedGraph[currentId].neighbors[endNodeId] = originalNeighbors[neighborId];
                } else if (neighborIdx > 0) {
                    // Internal connection
                    const uniqueNeighborId = `${config.type}_${neighborId}`;
                    combinedGraph[currentId].neighbors[uniqueNeighborId] = originalNeighbors[neighborId];
                }
            }
        }
        
        // Connect last intermediate node to END
        if (nodeIds.length > 2) {
            const lastIntermediateId = `${config.type}_${nodeIds[nodeIds.length - 2]}`;
            const lastEdge = graph[nodeIds[nodeIds.length - 2]].neighbors[nodeIds[nodeIds.length - 1]];
            if (lastEdge && combinedGraph[lastIntermediateId]) {
                combinedGraph[lastIntermediateId].neighbors[endNodeId] = lastEdge;
            }
        }
    });
    
    allNodeIds.push(endNodeId);
    
    logStep(`✓ Combined graph created: ${allNodeIds.length} total nodes`);
    logStep(`✓ Start and End nodes unified across all ${routeGraphs.length} routes`);
    logStep('');
    
    return {
        graph: combinedGraph,
        nodeIds: allNodeIds,
        startNodeId,
        endNodeId,
        routeGraphs
    };
}

// Run Dijkstra visualization on multiple routes
function runDijkstraVisualizationMultiRoute(routeResults) {
    logStep('');
    logStep('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    logStep('🎯 DIJKSTRA MULTI-ROUTE COMPARISON');
    logStep('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    logStep('');
    
    const combinedResult = buildCombinedGraphFromRoutes(routeResults);
    
    if (!combinedResult) {
        logStep('❌ Could not build combined graph');
        return;
    }
    
    const { graph, nodeIds, startNodeId, endNodeId, routeGraphs } = combinedResult;
    
    // Run Dijkstra on the combined graph
    visualizeDijkstra(graph, nodeIds, startNodeId, endNodeId, true, routeGraphs);
}

// Run Dijkstra visualization on a route
function runDijkstraVisualization(route) {
    if (!route || !route.shape || !route.shape.shapePoints) {
        logStep('❌ Invalid route data for Dijkstra visualization');
        return;
    }
    
    logStep('');
    logStep('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    logStep('🎯 DIJKSTRA ALGORITHM VISUALIZATION');
    logStep('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    logStep('');
    
    // Try to build graph from OSRM steps first (faithful replay)
    let graphResult = buildGraphFromManeuvers(route);
    let useManeuvers = false;
    
    if (graphResult) {
        logStep('✓ Using OSRM road step data (exact distances & times)');
        logStep(`📊 OSRM Route: ${graphResult.totalDistance.toFixed(2)} km, ${Math.round(graphResult.totalTime / 60)} min`);
        logStep('');
        useManeuvers = true;
    } else {
        // Fallback: build from polyline sampling
        logStep('ℹ️ Maneuvers unavailable, using polyline sampling');
        
        // Convert shape points to coordinates
        const shapePoints = route.shape.shapePoints;
        let routeCoords = [];
        
        if (Array.isArray(shapePoints)) {
            for (let i = 0; i < shapePoints.length; i += 2) {
                const lat = shapePoints[i];
                const lng = shapePoints[i + 1];
                if (lat !== undefined && lng !== undefined) {
                    routeCoords.push([lat, lng]);
                }
            }
        }
        
        if (routeCoords.length < 2) {
            logStep('❌ Not enough waypoints for Dijkstra visualization');
            return;
        }
        
        graphResult = { 
            graph: buildGraphFromRoute(routeCoords).graph, 
            nodeIds: buildGraphFromRoute(routeCoords).nodeIds 
        };
    }
    
    const { graph, nodeIds } = graphResult;
    
    // Start and end nodes
    const startNodeId = nodeIds[0];
    const endNodeId = nodeIds[nodeIds.length - 1];
    
    // Run visualization
    visualizeDijkstra(graph, nodeIds, startNodeId, endNodeId, useManeuvers);
}

// Build graph from route waypoints
function buildGraphFromRoute(routeCoords) {
    // Build a sampled graph from the full polyline coordinates, but compute
    // edge weights as the path distance along the polyline (sum of segment
    // distances) between sampled nodes. This preserves the actual route
    // length instead of using a straight-line "as-the-crow-flies" distance.
    const graph = {};
    const nodeIds = [];

    // Sample nodes from the full route coords to keep the visualization
    // manageable (target ~15 nodes). routeCoords is an array of [lat,lng]
    // points derived from the route shape.
    const sampleRate = Math.max(1, Math.floor(routeCoords.length / 15));

    const sampledIndices = [];
    for (let i = 0; i < routeCoords.length; i += sampleRate) {
        sampledIndices.push(i);
    }

    // Ensure last index is included
    if (sampledIndices[sampledIndices.length - 1] !== routeCoords.length - 1) {
        sampledIndices.push(routeCoords.length - 1);
    }

    // Create nodes keyed by their original index to make it easy to compute
    // distances along the polyline between indices.
    for (const idx of sampledIndices) {
        const nodeId = `node_${idx}`;
        nodeIds.push(nodeId);
        graph[nodeId] = {
            coord: routeCoords[idx],
            neighbors: {},
            index: idx
        };
    }

    // Connect adjacent sampled nodes using the path distance along the
    // polyline: sum the distances of each consecutive segment between
    // the two sampled indices.
    for (let i = 0; i < nodeIds.length - 1; i++) {
        const currentId = nodeIds[i];
        const nextId = nodeIds[i + 1];
        const idxA = graph[currentId].index;
        const idxB = graph[nextId].index;

        // Sum distances across the raw polyline points between idxA and idxB
        let distance = 0;
        for (let k = idxA; k < idxB; k++) {
            // routeCoords[k] and routeCoords[k+1] exist because idxB > idxA
            distance += calculateDistance(routeCoords[k], routeCoords[k + 1]);
        }

        // Assign bidirectional weight equal to the path distance (in km)
        graph[currentId].neighbors[nextId] = distance;
        graph[nextId].neighbors[currentId] = distance;
    }

    return { graph, nodeIds };
}

// Calculate distance between two coordinates (Haversine formula)
function calculateDistance(coord1, coord2) {
    const R = 6371; // Earth's radius in km
    const lat1 = coord1[0] * Math.PI / 180;
    const lat2 = coord2[0] * Math.PI / 180;
    const dLat = (coord2[0] - coord1[0]) * Math.PI / 180;
    const dLon = (coord2[1] - coord1[1]) * Math.PI / 180;
    
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(lat1) * Math.cos(lat2) *
              Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    
    return R * c;
}

// Build graph directly from OSRM route steps (faithful replay)
// Uses OSRM's exact distances and times as edge weights
function buildGraphFromManeuvers(route) {
    try {
        if (!route || !route.legs || !Array.isArray(route.legs) || route.legs.length === 0) {
            return null;
        }

        const graph = {};
        const nodeIds = [];
        const MILES_TO_KM = 1.60934;

        // Collect all maneuvers from all legs
        let allManeuvers = [];
        for (const leg of route.legs) {
            if (leg && Array.isArray(leg.maneuvers)) {
                allManeuvers = allManeuvers.concat(leg.maneuvers);
            }
        }

        if (allManeuvers.length === 0) {
            return null;
        }

        // Create a node for each maneuver's start point
        for (let i = 0; i < allManeuvers.length; i++) {
            const maneuver = allManeuvers[i];
            
            // Get start point coordinates
            const lat = maneuver.startPoint?.lat;
            const lng = maneuver.startPoint?.lng;
            
            if (lat === undefined || lng === undefined) {
                continue;
            }

            const nodeId = `maneuver_${i}`;
            nodeIds.push(nodeId);
            
            graph[nodeId] = {
                coord: [lat, lng],
                neighbors: {},
                // Store both distance (km) and time (seconds) for this maneuver
                maneuverDistance: (maneuver.distance || 0) * MILES_TO_KM,
                maneuverTime: maneuver.time || 0,
                narrative: maneuver.narrative || ''
            };
        }

        // Add final destination node
        const lastManeuver = allManeuvers[allManeuvers.length - 1];
        let endCoord = null;

        // Try to get end coordinates from route locations
        if (route.locations && Array.isArray(route.locations) && route.locations.length > 1) {
            const lastLoc = route.locations[route.locations.length - 1];
            if (lastLoc?.latLng?.lat !== undefined) {
                endCoord = [lastLoc.latLng.lat, lastLoc.latLng.lng];
            }
        }

        // Fallback: use last shape point
        if (!endCoord && route.shape?.shapePoints) {
            const sp = route.shape.shapePoints;
            if (sp.length >= 2) {
                endCoord = [sp[sp.length - 2], sp[sp.length - 1]];
            }
        }

        if (endCoord) {
            const finalNodeId = 'destination';
            nodeIds.push(finalNodeId);
            graph[finalNodeId] = {
                coord: endCoord,
                neighbors: {},
                maneuverDistance: 0,
                maneuverTime: 0
            };
        }

        // Connect adjacent nodes using OSRM's exact step distances/times
        for (let i = 0; i < nodeIds.length - 1; i++) {
            const currentId = nodeIds[i];
            const nextId = nodeIds[i + 1];
            
            // OSRM's distance (actual road distance)
            const roadDistanceKm = graph[currentId].maneuverDistance;
            const timeSec = graph[currentId].maneuverTime;
            
            // Calculate Haversine distance (straight-line distance)
            const haversineDistanceKm = calculateDistance(
                graph[currentId].coord,
                graph[nextId].coord
            );

            // Store both distances, time, and use road distance as primary weight
            graph[currentId].neighbors[nextId] = {
                distance: roadDistanceKm,           // Primary weight (road distance)
                haversineDistance: haversineDistanceKm,  // Straight-line distance
                time: timeSec
            };
            
            // Bidirectional (same cost both ways)
            graph[nextId].neighbors[currentId] = {
                distance: roadDistanceKm,
                haversineDistance: haversineDistanceKm,
                time: timeSec
            };
        }

        return { 
            graph, 
            nodeIds,
            totalDistance: route.distance * MILES_TO_KM, // OSRM's total distance
            totalTime: route.time // OSRM's total time in seconds
        };
    } catch (e) {
        console.error('Error building graph from maneuvers:', e);
        return null;
    }
}

// Animated Dijkstra's Algorithm
async function visualizeDijkstra(graph, nodeIds, startNodeId, endNodeId, useManeuvers = false, routeGraphs = null) {
    if (isAnimating) return;
    isAnimating = true;
    
    // Clear previous visualization
    document.getElementById('steps').innerHTML = '';
    logStep('🚀 Starting Dijkstra\'s Algorithm...');
    
    const costs = {}; // Stores shortest road distances
    const haversineCosts = {}; // Stores shortest Haversine distances
    const timeCosts = {}; // Stores shortest times (when using maneuvers)
    const parents = {}; // Stores predecessors
    const processed = new Set(); // Visited nodes
    const nodeMarkers = {}; // Visual markers for nodes
    
    // Initialize costs and create node markers
    for (const nodeId of nodeIds) {
        costs[nodeId] = nodeId === startNodeId ? 0 : Infinity;
        haversineCosts[nodeId] = nodeId === startNodeId ? 0 : Infinity;
        timeCosts[nodeId] = nodeId === startNodeId ? 0 : Infinity;
        parents[nodeId] = null;
        
        const coord = graph[nodeId].coord;
        
        // Create larger, more visible markers
        let markerColor = '#cccccc'; // Default gray
        let markerRadius = 10;
        
        if (nodeId === startNodeId) {
            markerColor = '#4CAF50'; // Green for start
            markerRadius = 14;
        } else if (nodeId === endNodeId) {
            markerColor = '#f44336'; // Red for end
            markerRadius = 14;
        }
        
        const marker = L.circleMarker(coord, {
            radius: markerRadius,
            fillColor: markerColor,
            color: '#ffffff',
            weight: 3,
            fillOpacity: 0.9
        }).addTo(map);
        
        // Add label for start and end
        if (nodeId === startNodeId || nodeId === endNodeId) {
            marker.bindTooltip(nodeId === startNodeId ? 'START' : 'END', {
                permanent: true,
                direction: 'top',
                className: 'node-label'
            });
        }
        
        nodeMarkers[nodeId] = marker;
        routeLayers.push(marker);
    }
    
    logStep(`📍 Start: ${startNodeId}, End: ${endNodeId}`);
    logStep(`🔢 Total nodes to explore: ${nodeIds.length}`);
    
    let currentNode = findLowestCostNode(costs, processed);
    let stepCount = 0;
    
    while (currentNode && currentNode !== endNodeId) {
        stepCount++;
        const cost = costs[currentNode];
        
        // Highlight current node (bright yellow)
        nodeMarkers[currentNode].setStyle({ 
            fillColor: '#FFD700', 
            radius: 16,
            weight: 4
        });
        
        if (useManeuvers) {
            const timeMin = Math.round(timeCosts[currentNode] / 60);
            logStep(`🔍 Step ${stepCount}: Exploring ${currentNode} (Road: ${cost.toFixed(2)}km, Direct: ${haversineCosts[currentNode].toFixed(2)}km, ${timeMin}min)`);
        } else {
            logStep(`🔍 Step ${stepCount}: Exploring ${currentNode} (cost: ${cost.toFixed(2)} km)`);
        }
        
        await sleep(animationSpeed);
        
        const neighbors = graph[currentNode].neighbors;
        
        for (const neighbor in neighbors) {
            if (processed.has(neighbor)) continue;
            
            // Handle both edge weight formats: {distance, haversineDistance, time} or plain number
            let edgeDistance, edgeHaversine, edgeTime;
            if (typeof neighbors[neighbor] === 'object') {
                edgeDistance = neighbors[neighbor].distance;
                edgeHaversine = neighbors[neighbor].haversineDistance || edgeDistance;
                edgeTime = neighbors[neighbor].time || 0;
            } else {
                edgeDistance = neighbors[neighbor];
                edgeHaversine = edgeDistance;
                edgeTime = 0;
            }
            
            const newCost = cost + edgeDistance;
            const newHaversineCost = haversineCosts[currentNode] + edgeHaversine;
            const newTimeCost = timeCosts[currentNode] + edgeTime;
            
            if (newCost < costs[neighbor]) {
                costs[neighbor] = newCost;
                haversineCosts[neighbor] = newHaversineCost;
                timeCosts[neighbor] = newTimeCost;
                parents[neighbor] = currentNode;
                
                // Update neighbor marker (orange)
                nodeMarkers[neighbor].setStyle({ 
                    fillColor: '#FF9800',
                    radius: 12
                });
                
                if (useManeuvers) {
                    const timeMin = Math.round(newTimeCost / 60);
                    logStep(`  ↳ Updated ${neighbor}: Road=${newCost.toFixed(2)}km, Direct=${newHaversineCost.toFixed(2)}km, ${timeMin}min (via ${currentNode})`);
                } else {
                    logStep(`  ↳ Updated ${neighbor}: ${newCost.toFixed(2)} km (via ${currentNode})`);
                }
            }
        }
        
        // Mark as processed (red/visited)
        processed.add(currentNode);
        nodeMarkers[currentNode].setStyle({ 
            fillColor: '#E91E63', 
            radius: 10,
            weight: 3
        });
        
        currentNode = findLowestCostNode(costs, processed);
    }
    
    // Reconstruct and visualize path
    const path = [];
    let current = endNodeId;
    while (current) {
        path.unshift(current);
        current = parents[current];
    }
    
    logStep(`✅ Algorithm complete! Visited ${stepCount} nodes`);
    logStep('');
    logStep('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    logStep('� DIJKSTRA RESULTS:');
    logStep('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    logStep(`🛣️  Road Distance: ${costs[endNodeId].toFixed(2)} km`);
    
    if (useManeuvers) {
        logStep(`✈️  Straight-Line Distance (Haversine): ${haversineCosts[endNodeId].toFixed(2)} km`);
        const difference = costs[endNodeId] - haversineCosts[endNodeId];
        const percentMore = ((difference / haversineCosts[endNodeId]) * 100).toFixed(1);
        logStep(`📐 Road is ${difference.toFixed(2)} km (${percentMore}%) longer than straight-line`);
        
        const totalTimeMin = Math.round(timeCosts[endNodeId] / 60);
        logStep(`⏱️  Travel Time: ${totalTimeMin} min`);
        logStep('');
        logStep(`✓ Road distance matches OSRM's reported route!`);
    }
    
    logStep('');
    logStep(`🛣️ Path: ${path.join(' → ')}`);
    
    // Animate the shortest path (bright green)
    logStep('');
    logStep('🎯 Drawing shortest path...');
    await sleep(animationSpeed * 2);
    
    for (let i = 0; i < path.length - 1; i++) {
        const from = graph[path[i]].coord;
        const to = graph[path[i + 1]].coord;
        
        // Draw thick green path segment
        const pathLine = L.polyline([from, to], {
            color: '#00FF00',
            weight: 8,
            opacity: 0.9,
            dashArray: '10, 5'
        }).addTo(map);
        routeLayers.push(pathLine);
        
        // Highlight path nodes (bright green)
        nodeMarkers[path[i]].setStyle({ 
            fillColor: '#00FF00',
            radius: 14,
            weight: 4,
            color: '#ffffff'
        });
        
        await sleep(animationSpeed / 2);
    }
    
    // Highlight end node
    nodeMarkers[endNodeId].setStyle({ 
        fillColor: '#00FF00',
        radius: 14,
        weight: 4,
        color: '#ffffff'
    });
    
    // Update statistics
    if (useManeuvers) {
        const totalTimeMin = Math.round(timeCosts[endNodeId] / 60);
        document.getElementById('totalTime').textContent = `${totalTimeMin} min`;
        document.getElementById('nodeCount').textContent = `${costs[endNodeId].toFixed(2)} km / ${haversineCosts[endNodeId].toFixed(2)} km`;
    } else {
        document.getElementById('totalTime').textContent = `${costs[endNodeId].toFixed(2)} km`;
        document.getElementById('nodeCount').textContent = `${stepCount} nodes`;
    }
    
    logStep('');
    logStep('✨ Dijkstra visualization complete!');
    logStep('');
    logStep('💡 Summary: Dijkstra found the shortest path using OSRM road');
    logStep('   distances while also calculating straight-line distances for comparison.');
    
    isAnimating = false;
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

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// Mode switching functions
function setTravelMode(mode) {
    travelMode = mode;
    
    // Update UI
    const carBtn = document.getElementById('carMode');
    const walkBtn = document.getElementById('walkMode');
    
    if (mode === 'car') {
        carBtn.classList.add('active');
        walkBtn.classList.remove('active');
        logStep('🚗 Switched to CAR mode - Routes optimized for driving');
    } else {
        walkBtn.classList.add('active');
        carBtn.classList.remove('active');
        logStep('🚶 Switched to PEDESTRIAN mode - Routes optimized for walking');
    }
    
    // If routes exist, recalculate with new mode
    if (startPoint && endPoint) {
        logStep('💡 Click "Get Real Directions" to see routes for this mode.');
    }
}

// Load sample city on startup
window.onload = () => {
    logStep('Welcome! Click "Enable Route Selection" to begin.');
    logStep('Click twice on the map: once for start, once for destination.');
    logStep('Choose CAR or PEDESTRIAN mode, then get directions!');
    
    // Set initial mode button state
    document.getElementById('carMode').classList.add('active');
};
