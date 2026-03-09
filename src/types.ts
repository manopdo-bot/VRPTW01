export interface Vehicle {
  id: string;
  name: string;
  capacity: number;
  driverWage: number; // THB per route
  fuelCostPerKm: number; // THB per km
  otherExpenses: number; // THB per route
  startTime: string; // e.g. "08:00"
  endTime: string; // e.g. "18:00"
}

export interface Node {
  id: string;
  name: string;
  lat: number;
  lng: number;
  demand: number;
  isDepot: boolean;
  readyTime: string; // e.g. "08:00"
  dueTime: string; // e.g. "17:00"
  serviceTime: number; // in minutes
}

export type TrafficCondition = 'normal' | 'heavy' | 'out_of_town';

export interface RouteSchedule {
  nodeId: string;
  arrivalTime: string;
  departureTime: string;
  waitingTime: number;
}

export interface Route {
  vehicleId: string;
  capacity: number;
  path: string[]; // Node IDs
  distance: number;
  load: number;
  color: string;
  fuelCost: number;
  driverWage: number;
  otherExpenses: number;
  totalCost: number;
  schedule: RouteSchedule[];
  totalTimeMinutes: number;
}

export interface VRPResult {
  routes: Route[];
  totalDistance: number;
}
