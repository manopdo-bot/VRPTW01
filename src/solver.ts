import { Node, Route, Vehicle, RouteSchedule, TrafficCondition } from './types';

export function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // Radius of the earth in km
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export function timeToMinutes(time: string): number {
  if (!time) return 0;
  const [h, m] = time.split(':').map(Number);
  return h * 60 + (m || 0);
}

export function minutesToTime(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
}

function getSpeedKmh(condition: TrafficCondition): number {
  switch (condition) {
    case 'out_of_town': return 60; // 1 min/km
    case 'normal': return 30;      // 2 min/km
    case 'heavy': return 20;       // 3 min/km
    default: return 30;
  }
}

const COLORS = ['#3b82f6', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#06b6d4'];

function evaluateRoute(
  path: string[],
  nodesMap: Record<string, Node>,
  distanceMatrix: Record<string, Record<string, number>>,
  vehicle: Vehicle,
  trafficCondition: TrafficCondition
): { valid: boolean; distance: number; totalTime: number; schedule: RouteSchedule[]; load: number } {
  let currentTime = timeToMinutes(vehicle.startTime || "08:00");
  const vehicleEndTime = timeToMinutes(vehicle.endTime || "18:00");
  let distance = 0;
  let load = 0;
  const schedule: RouteSchedule[] = [];

  let currentNodeId = path[0];
  schedule.push({
    nodeId: currentNodeId,
    arrivalTime: minutesToTime(currentTime),
    departureTime: minutesToTime(currentTime),
    waitingTime: 0
  });

  for (let i = 1; i < path.length; i++) {
    const nextNodeId = path[i];
    const nextNode = nodesMap[nextNodeId];
    const dist = distanceMatrix[currentNodeId][nextNodeId];
    
    distance += dist;
    if (!nextNode.isDepot) {
      load += nextNode.demand || 0;
    }

    if (load > vehicle.capacity) return { valid: false, distance: 0, totalTime: 0, schedule: [], load: 0 };

    const speedKmh = getSpeedKmh(trafficCondition);
    const travelTime = (dist / speedKmh) * 60;
    let arrivalTime = currentTime + travelTime;
    let waitingTime = 0;

    const readyTime = nextNode.isDepot ? 0 : timeToMinutes(nextNode.readyTime || "00:00");
    const dueTime = nextNode.isDepot ? vehicleEndTime : timeToMinutes(nextNode.dueTime || "23:59");

    if (arrivalTime < readyTime) {
      waitingTime = readyTime - arrivalTime;
      arrivalTime = readyTime;
    }

    if (arrivalTime > dueTime) return { valid: false, distance: 0, totalTime: 0, schedule: [], load: 0 };

    const serviceTime = nextNode.isDepot ? 0 : (nextNode.serviceTime || 0);
    const departureTime = arrivalTime + serviceTime;

    if (departureTime > vehicleEndTime) return { valid: false, distance: 0, totalTime: 0, schedule: [], load: 0 };

    schedule.push({
      nodeId: nextNodeId,
      arrivalTime: minutesToTime(arrivalTime),
      departureTime: minutesToTime(departureTime),
      waitingTime
    });

    currentTime = departureTime;
    currentNodeId = nextNodeId;
  }

  return {
    valid: true,
    distance,
    totalTime: currentTime - timeToMinutes(vehicle.startTime || "08:00"),
    schedule,
    load
  };
}

export function solveVRP(
  nodes: Node[],
  distanceMatrix: Record<string, Record<string, number>>,
  vehicles: Vehicle[],
  trafficCondition: TrafficCondition = 'normal'
): Route[] {
  const depot = nodes.find(n => n.isDepot);
  if (!depot) return [];

  const unvisited = nodes.filter(n => !n.isDepot);
  const routes: Route[] = [];
  
  // Sort vehicles by capacity descending to use largest vehicles first
  const sortedVehicles = [...vehicles].sort((a, b) => b.capacity - a.capacity);
  let currentVehicleIdx = 0;

  const nodesMap = nodes.reduce((acc, n) => {
    acc[n.id] = n;
    return acc;
  }, {} as Record<string, Node>);

  while (unvisited.length > 0 && currentVehicleIdx < sortedVehicles.length) {
    const vehicle = sortedVehicles[currentVehicleIdx];
    
    // Initialize route with Depot -> Depot
    let currentPath = [depot.id, depot.id];

    // VRPTW Insertion Heuristic (Solomon I1-like)
    let canInsert = true;
    while (canInsert && unvisited.length > 0) {
      canInsert = false;
      let bestInsertion: { nodeIdx: number; pos: number; path: string[]; evalResult: ReturnType<typeof evaluateRoute> } | null = null;
      let bestCost = Infinity;

      const currentEval = evaluateRoute(currentPath, nodesMap, distanceMatrix, vehicle, trafficCondition);

      for (let i = 0; i < unvisited.length; i++) {
        const candidate = unvisited[i];

        // Try inserting at every possible position (between depot and depot)
        for (let pos = 1; pos < currentPath.length; pos++) {
          const testPath = [...currentPath];
          testPath.splice(pos, 0, candidate.id);
          
          const evalResult = evaluateRoute(testPath, nodesMap, distanceMatrix, vehicle, trafficCondition);
          
          if (evalResult.valid) {
            // Cost function: increase in distance + penalty for time increase
            const distanceIncrease = evalResult.distance - currentEval.distance;
            const timeIncrease = evalResult.totalTime - currentEval.totalTime;
            
            // Weight distance heavily, but also consider time
            const cost = distanceIncrease + (timeIncrease * 0.1);

            if (cost < bestCost) {
              bestCost = cost;
              bestInsertion = {
                nodeIdx: i,
                pos: pos,
                path: testPath,
                evalResult: evalResult
              };
            }
          }
        }
      }

      if (bestInsertion) {
        currentPath = bestInsertion.path;
        unvisited.splice(bestInsertion.nodeIdx, 1);
        canInsert = true;
      }
    }

    if (currentPath.length > 2) { // More than just Depot -> Depot
      const finalEval = evaluateRoute(currentPath, nodesMap, distanceMatrix, vehicle, trafficCondition);
      
      const route: Route = {
        vehicleId: vehicle.name,
        capacity: vehicle.capacity,
        path: currentPath,
        distance: finalEval.distance,
        load: finalEval.load,
        color: COLORS[currentVehicleIdx % COLORS.length],
        fuelCost: finalEval.distance * vehicle.fuelCostPerKm,
        driverWage: vehicle.driverWage,
        otherExpenses: vehicle.otherExpenses,
        totalCost: (finalEval.distance * vehicle.fuelCostPerKm) + vehicle.driverWage + vehicle.otherExpenses,
        schedule: finalEval.schedule,
        totalTimeMinutes: finalEval.totalTime
      };
      
      routes.push(route);
    }
    
    currentVehicleIdx++;
  }

  return routes;
}
