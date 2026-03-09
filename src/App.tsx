import React, { useState, useMemo } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Settings as SettingsIcon, Map as MapIcon, Play, Plus, Trash2, Route as RouteIcon, Truck, MapPin, BarChart3, Download, Calendar, DollarSign, Save, Upload, RefreshCw, FileDown, FileUp } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import Papa from 'papaparse';
import { Node, Route, Vehicle, TrafficCondition } from './types';
import { calculateDistance, solveVRP, timeToMinutes } from './solver';
import { MapUpdater } from './components/MapUpdater';
import { cn } from './utils';

// Fix Leaflet default icon issue
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

const depotIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
});

const defaultNodes: Node[] = [
  { id: '1', name: 'Depot (Oishifood KK)', lat: 16.354837924440588, lng: 102.79404462419203, demand: 0, isDepot: true, readyTime: '08:00', dueTime: '18:00', serviceTime: 0 },
  { id: '2', name: 'Customer A (Hotel A)', lat: 16.429477848054145, lng: 102.83292397844323, demand: 10, isDepot: false, readyTime: '08:00', dueTime: '09:00', serviceTime: 15 },
  { id: '3', name: 'Customer B (Market B)', lat: 16.436367753739738, lng: 102.83581439488718, demand: 15, isDepot: false, readyTime: '10:00', dueTime: '14:00', serviceTime: 20 },
  { id: '4', name: 'Customer C (School C)', lat: 16.43265734637535, lng: 102.8365076670114, demand: 20, isDepot: false, readyTime: '08:00', dueTime: '10:00', serviceTime: 10 },
  { id: '5', name: 'Customer D (Shop D)', lat: 16.420676025039104, lng: 102.83764349528161, demand: 12, isDepot: false, readyTime: '08:00', dueTime: '16:00', serviceTime: 15 },
];

const defaultVehicles: Vehicle[] = [
  { id: 'v1', name: 'Truck 1 (Large)', capacity: 100, driverWage: 800, fuelCostPerKm: 6, otherExpenses: 200, startTime: '08:00', endTime: '18:00' },
  { id: 'v2', name: 'Van 1 (Medium)', capacity: 50, driverWage: 500, fuelCostPerKm: 4, otherExpenses: 100, startTime: '08:00', endTime: '18:00' },
  { id: 'v3', name: 'Van 2 (Medium)', capacity: 50, driverWage: 500, fuelCostPerKm: 4, otherExpenses: 100, startTime: '08:00', endTime: '18:00' },
];

export default function App() {
  const [nodes, setNodes] = useState<Node[]>(defaultNodes);
  const [vehicles, setVehicles] = useState<Vehicle[]>(defaultVehicles);
  const [activeTab, setActiveTab] = useState<'nodes' | 'settings' | 'results' | 'dashboard'>('nodes');
  const [deliveryDate, setDeliveryDate] = useState(new Date().toISOString().split('T')[0]);
  const [trafficCondition, setTrafficCondition] = useState<TrafficCondition>('normal');
  const [routes, setRoutes] = useState<Route[]>([]);

  // Auto-calculate distance matrix
  const distanceMatrix = useMemo(() => {
    const matrix: Record<string, Record<string, number>> = {};
    nodes.forEach(n1 => {
      matrix[n1.id] = {};
      nodes.forEach(n2 => {
        if (n1.id === n2.id) {
          matrix[n1.id][n2.id] = 0;
        } else {
          matrix[n1.id][n2.id] = calculateDistance(n1.lat, n1.lng, n2.lat, n2.lng);
        }
      });
    });
    return matrix;
  }, [nodes]);

  const handleSolve = () => {
    const resultRoutes = solveVRP(nodes, distanceMatrix, vehicles, trafficCondition);
    setRoutes(resultRoutes);
    setActiveTab('dashboard');
  };

  const addNode = () => {
    const newNode: Node = {
      id: Date.now().toString(),
      name: `New Location ${nodes.length}`,
      lat: 16.4 + Math.random() * 0.1,
      lng: 102.8 + Math.random() * 0.1,
      demand: 10,
      isDepot: false,
      readyTime: '08:00',
      dueTime: '18:00',
      serviceTime: 15
    };
    setNodes([...nodes, newNode]);
  };

  const updateNode = (id: string, field: keyof Node, value: any) => {
    setNodes(nodes.map(n => n.id === id ? { ...n, [field]: value } : n));
  };

  const removeNode = (id: string) => {
    setNodes(nodes.filter(n => n.id !== id));
  };

  const addVehicle = () => {
    const newVehicle: Vehicle = {
      id: Date.now().toString(),
      name: `Vehicle ${vehicles.length + 1}`,
      capacity: 50,
      driverWage: 500,
      fuelCostPerKm: 4,
      otherExpenses: 100,
      startTime: '08:00',
      endTime: '18:00'
    };
    setVehicles([...vehicles, newVehicle]);
  };

  const updateVehicle = (id: string, field: keyof Vehicle, value: any) => {
    setVehicles(vehicles.map(v => v.id === id ? { ...v, [field]: value } : v));
  };

  const removeVehicle = (id: string) => {
    setVehicles(vehicles.filter(v => v.id !== id));
  };

  const exportConfig = () => {
    const configData = {
      nodes,
      vehicles,
      deliveryDate
    };
    const jsonContent = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(configData, null, 2));
    const link = document.createElement('a');
    link.setAttribute('href', jsonContent);
    link.setAttribute('download', `vrp_config_${deliveryDate}.json`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const importConfig = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const content = e.target?.result as string;
        const data = JSON.parse(content);
        if (data.nodes) setNodes(data.nodes);
        if (data.vehicles) setVehicles(data.vehicles);
        if (data.deliveryDate) setDeliveryDate(data.deliveryDate);
        setRoutes([]);
      } catch (err) {
        alert("Invalid configuration file");
      }
    };
    reader.readAsText(file);
    event.target.value = '';
  };

  const downloadFile = (content: string, filename: string) => {
    const blob = new Blob([new Uint8Array([0xEF, 0xBB, 0xBF]), content], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const exportNodesTemplate = () => {
    const csv = Papa.unparse([
      { id: '1', name: 'Depot (Example)', lat: 16.3548, lng: 102.7940, demand: 0, isDepot: true, readyTime: '08:00', dueTime: '18:00', serviceTime: 0 },
      { id: '2', name: 'Customer A', lat: 16.4294, lng: 102.8329, demand: 10, isDepot: false, readyTime: '09:00', dueTime: '12:00', serviceTime: 15 },
    ]);
    downloadFile(csv, 'locations_template.csv');
  };

  const importNodesCSV = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        const parsedNodes: Node[] = results.data.map((row: any) => ({
          id: row.id || Date.now().toString() + Math.random(),
          name: row.name || 'Unknown',
          lat: parseFloat(row.lat) || 0,
          lng: parseFloat(row.lng) || 0,
          demand: parseInt(row.demand) || 0,
          isDepot: String(row.isDepot).toLowerCase() === 'true',
          readyTime: row.readyTime || '08:00',
          dueTime: row.dueTime || '18:00',
          serviceTime: parseInt(row.serviceTime) || 0,
        }));
        if (parsedNodes.length > 0) setNodes(parsedNodes);
      }
    });
    event.target.value = '';
  };

  const exportVehiclesTemplate = () => {
    const csv = Papa.unparse([
      { id: 'v1', name: 'Truck 1', capacity: 100, driverWage: 800, fuelCostPerKm: 6, otherExpenses: 200, startTime: '08:00', endTime: '18:00' },
      { id: 'v2', name: 'Van 1', capacity: 50, driverWage: 500, fuelCostPerKm: 4, otherExpenses: 100, startTime: '08:00', endTime: '18:00' },
    ]);
    downloadFile(csv, 'fleet_template.csv');
  };

  const importVehiclesCSV = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        const parsedVehicles: Vehicle[] = results.data.map((row: any) => ({
          id: row.id || Date.now().toString() + Math.random(),
          name: row.name || 'Unknown',
          capacity: parseInt(row.capacity) || 0,
          driverWage: parseFloat(row.driverWage) || 0,
          fuelCostPerKm: parseFloat(row.fuelCostPerKm) || 0,
          otherExpenses: parseFloat(row.otherExpenses) || 0,
          startTime: row.startTime || '08:00',
          endTime: row.endTime || '18:00',
        }));
        if (parsedVehicles.length > 0) setVehicles(parsedVehicles);
      }
    });
    event.target.value = '';
  };

  const exportCSV = () => {
    if (routes.length === 0) return;
    const headers = ['Date', 'Vehicle', 'Capacity', 'Distance (km)', 'Load', 'Fuel Cost (THB)', 'Driver Wage (THB)', 'Other Expenses (THB)', 'Total Cost (THB)', 'Route Path'];
    const rows = routes.map(r => {
      const pathNames = r.path.map(id => nodes.find(n => n.id === id)?.name || 'Unknown').join(' -> ');
      return [
        deliveryDate,
        r.vehicleId,
        r.capacity,
        r.distance.toFixed(2),
        r.load,
        r.fuelCost.toFixed(2),
        r.driverWage.toFixed(2),
        r.otherExpenses.toFixed(2),
        r.totalCost.toFixed(2),
        `"${pathNames}"`
      ].join(',');
    });
    
    // Add summary row
    const totalDist = routes.reduce((sum, r) => sum + r.distance, 0);
    const totalLoad = routes.reduce((sum, r) => sum + r.load, 0);
    const totalFuel = routes.reduce((sum, r) => sum + r.fuelCost, 0);
    const totalWage = routes.reduce((sum, r) => sum + r.driverWage, 0);
    const totalOther = routes.reduce((sum, r) => sum + r.otherExpenses, 0);
    const totalCost = routes.reduce((sum, r) => sum + r.totalCost, 0);
    
    rows.push([]);
    rows.push(['TOTAL', '', '', totalDist.toFixed(2), totalLoad, totalFuel.toFixed(2), totalWage.toFixed(2), totalOther.toFixed(2), totalCost.toFixed(2), '']);

    const csvContent = "data:text/csv;charset=utf-8,\uFEFF" + [headers.join(','), ...rows].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `vrp_plan_${deliveryDate}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const mapBounds = useMemo(() => {
    if (nodes.length === 0) return null;
    const lats = nodes.map(n => n.lat);
    const lngs = nodes.map(n => n.lng);
    return [
      [Math.min(...lats), Math.min(...lngs)],
      [Math.max(...lats), Math.max(...lngs)]
    ] as L.LatLngBoundsExpression;
  }, [nodes]);

  function MapEvents() {
    useMapEvents({
      click(e) {
        const newNode: Node = {
          id: Date.now().toString(),
          name: `New Location ${nodes.length}`,
          lat: e.latlng.lat,
          lng: e.latlng.lng,
          demand: 10,
          isDepot: false,
          readyTime: '08:00',
          dueTime: '18:00',
          serviceTime: 15
        };
        setNodes(prev => [...prev, newNode]);
      },
    });
    return null;
  }

  // Dashboard Data
  const totalDist = routes.reduce((sum, r) => sum + r.distance, 0);
  const totalCost = routes.reduce((sum, r) => sum + r.totalCost, 0);
  const totalFuel = routes.reduce((sum, r) => sum + r.fuelCost, 0);
  const totalWage = routes.reduce((sum, r) => sum + r.driverWage, 0);
  const totalOther = routes.reduce((sum, r) => sum + r.otherExpenses, 0);

  const pieData = [
    { name: 'Fuel', value: totalFuel, color: '#3b82f6' },
    { name: 'Wage', value: totalWage, color: '#10b981' },
    { name: 'Other', value: totalOther, color: '#f59e0b' }
  ];

  const barData = routes.map(r => ({
    name: r.vehicleId,
    Fuel: parseFloat(r.fuelCost.toFixed(2)),
    Wage: parseFloat(r.driverWage.toFixed(2)),
    Other: parseFloat(r.otherExpenses.toFixed(2))
  }));

  return (
    <div className="flex h-screen w-full bg-gray-50 text-gray-900 font-sans overflow-hidden">
      {/* Left Sidebar */}
      <div className="w-1/3 min-w-[420px] max-w-[600px] bg-white border-r border-gray-200 flex flex-col shadow-lg z-10">
        <div className="p-6 border-b border-gray-200 bg-indigo-600 text-white">
          <div className="flex justify-between items-start">
            <div>
              <h1 className="text-2xl font-bold flex items-center gap-2">
                <RouteIcon className="w-6 h-6" />
                VRP Optimizer Pro
              </h1>
              <p className="text-indigo-100 text-sm mt-1">Smart Routing with Cost Analysis</p>
            </div>
            <div className="flex gap-2">
              <button onClick={exportConfig} className="p-2 bg-indigo-500 hover:bg-indigo-400 rounded-md transition-colors" title="Save Configuration">
                <Save className="w-4 h-4" />
              </button>
              <label className="p-2 bg-indigo-500 hover:bg-indigo-400 rounded-md transition-colors cursor-pointer" title="Load Configuration">
                <Upload className="w-4 h-4" />
                <input type="file" accept=".json" className="hidden" onChange={importConfig} />
              </label>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-200 bg-gray-50 overflow-x-auto no-scrollbar">
          <button
            className={cn("flex-1 whitespace-nowrap py-3 px-4 text-sm font-medium flex items-center justify-center gap-2 transition-colors", activeTab === 'nodes' ? "bg-white text-indigo-600 border-b-2 border-indigo-600" : "text-gray-500 hover:text-gray-700")}
            onClick={() => setActiveTab('nodes')}
          >
            <MapPin className="w-4 h-4" /> Locations
          </button>
          <button
            className={cn("flex-1 whitespace-nowrap py-3 px-4 text-sm font-medium flex items-center justify-center gap-2 transition-colors", activeTab === 'settings' ? "bg-white text-indigo-600 border-b-2 border-indigo-600" : "text-gray-500 hover:text-gray-700")}
            onClick={() => setActiveTab('settings')}
          >
            <SettingsIcon className="w-4 h-4" /> Fleet
          </button>
          <button
            className={cn("flex-1 whitespace-nowrap py-3 px-4 text-sm font-medium flex items-center justify-center gap-2 transition-colors", activeTab === 'results' ? "bg-white text-indigo-600 border-b-2 border-indigo-600" : "text-gray-500 hover:text-gray-700")}
            onClick={() => setActiveTab('results')}
          >
            <MapIcon className="w-4 h-4" /> Routes
          </button>
          <button
            className={cn("flex-1 whitespace-nowrap py-3 px-4 text-sm font-medium flex items-center justify-center gap-2 transition-colors", activeTab === 'dashboard' ? "bg-white text-indigo-600 border-b-2 border-indigo-600" : "text-gray-500 hover:text-gray-700")}
            onClick={() => setActiveTab('dashboard')}
          >
            <BarChart3 className="w-4 h-4" /> Dashboard
          </button>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto p-6">
          {activeTab === 'nodes' && (
            <div className="space-y-6">
              <div className="flex justify-between items-center">
                <h2 className="text-lg font-semibold text-gray-800">Locations & Constraints</h2>
                <div className="flex gap-2">
                  <button onClick={exportNodesTemplate} className="flex items-center gap-1 text-sm bg-gray-100 text-gray-600 px-3 py-1.5 rounded-md hover:bg-gray-200 transition-colors" title="Download CSV Template">
                    <FileDown className="w-4 h-4" /> Template
                  </button>
                  <label className="flex items-center gap-1 text-sm bg-gray-100 text-gray-600 px-3 py-1.5 rounded-md hover:bg-gray-200 transition-colors cursor-pointer" title="Import from CSV">
                    <FileUp className="w-4 h-4" /> Import
                    <input type="file" accept=".csv" className="hidden" onChange={importNodesCSV} />
                  </label>
                  <button onClick={addNode} className="flex items-center gap-1 text-sm bg-indigo-50 text-indigo-600 px-3 py-1.5 rounded-md hover:bg-indigo-100 transition-colors">
                    <Plus className="w-4 h-4" /> Add Node
                  </button>
                </div>
              </div>
              
              <div className="space-y-4">
                {nodes.map((node, idx) => (
                  <div key={node.id} className={cn("p-4 rounded-xl border", node.isDepot ? "bg-red-50 border-red-200" : "bg-white border-gray-200 shadow-sm")}>
                    <div className="flex justify-between items-start mb-3">
                      <div className="flex items-center gap-2">
                        <span className={cn("w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white", node.isDepot ? "bg-red-500" : "bg-gray-800")}>
                          {node.isDepot ? 'D' : idx}
                        </span>
                        <input 
                          type="text" 
                          value={node.name} 
                          onChange={(e) => updateNode(node.id, 'name', e.target.value)}
                          className="font-medium bg-transparent border-none focus:ring-0 p-0 text-gray-800"
                        />
                      </div>
                      {!node.isDepot && (
                        <button onClick={() => removeNode(node.id)} className="text-gray-400 hover:text-red-500">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                    
                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <div>
                        <label className="block text-xs text-gray-500 mb-1">Lat, Lng</label>
                        <div className="flex gap-2">
                          <input type="number" value={node.lat.toFixed(4)} onChange={(e) => updateNode(node.id, 'lat', parseFloat(e.target.value))} className="w-full border-gray-300 rounded-md shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm px-2 py-1 border" />
                          <input type="number" value={node.lng.toFixed(4)} onChange={(e) => updateNode(node.id, 'lng', parseFloat(e.target.value))} className="w-full border-gray-300 rounded-md shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm px-2 py-1 border" />
                        </div>
                      </div>
                      {!node.isDepot && (
                        <>
                          <div>
                            <label className="block text-xs text-gray-500 mb-1">Demand (Units)</label>
                            <input type="number" value={node.demand} onChange={(e) => updateNode(node.id, 'demand', parseInt(e.target.value) || 0)} className="w-full border-gray-300 rounded-md shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm px-2 py-1 border" />
                          </div>
                          <div>
                            <label className="block text-xs text-gray-500 mb-1">Time Window (Ready - Due)</label>
                            <div className="flex gap-2">
                              <input type="time" value={node.readyTime || '08:00'} onChange={(e) => updateNode(node.id, 'readyTime', e.target.value)} className="w-full border-gray-300 rounded-md shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm px-2 py-1 border" />
                              <input type="time" value={node.dueTime || '18:00'} onChange={(e) => updateNode(node.id, 'dueTime', e.target.value)} className="w-full border-gray-300 rounded-md shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm px-2 py-1 border" />
                            </div>
                          </div>
                          <div>
                            <label className="block text-xs text-gray-500 mb-1">Service Time (mins)</label>
                            <input type="number" value={node.serviceTime || 0} onChange={(e) => updateNode(node.id, 'serviceTime', parseInt(e.target.value) || 0)} className="w-full border-gray-300 rounded-md shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm px-2 py-1 border" />
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'settings' && (
            <div className="space-y-6">
              <div className="flex justify-between items-center">
                <h2 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
                  <Truck className="w-5 h-5"/> Vehicle Fleet & Costs
                </h2>
                <div className="flex gap-2">
                  <button onClick={exportVehiclesTemplate} className="flex items-center gap-1 text-sm bg-gray-100 text-gray-600 px-3 py-1.5 rounded-md hover:bg-gray-200 transition-colors" title="Download CSV Template">
                    <FileDown className="w-4 h-4" /> Template
                  </button>
                  <label className="flex items-center gap-1 text-sm bg-gray-100 text-gray-600 px-3 py-1.5 rounded-md hover:bg-gray-200 transition-colors cursor-pointer" title="Import from CSV">
                    <FileUp className="w-4 h-4" /> Import
                    <input type="file" accept=".csv" className="hidden" onChange={importVehiclesCSV} />
                  </label>
                  <button onClick={addVehicle} className="flex items-center gap-1 text-sm bg-indigo-50 text-indigo-600 px-3 py-1.5 rounded-md hover:bg-indigo-100 transition-colors">
                    <Plus className="w-4 h-4" /> Add Vehicle
                  </button>
                </div>
              </div>

              <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm mb-4">
                <label className="block text-sm text-gray-600 mb-1">Delivery Date</label>
                <div className="relative">
                  <Calendar className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                  <input type="date" value={deliveryDate} onChange={e => setDeliveryDate(e.target.value)} className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 text-sm" />
                </div>
              </div>

              <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm mb-4">
                <label className="block text-sm text-gray-600 mb-2">Traffic Condition</label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    onClick={() => setTrafficCondition('out_of_town')}
                    className={cn(
                      "py-2 px-3 text-sm rounded-lg border font-medium transition-colors",
                      trafficCondition === 'out_of_town' 
                        ? "bg-indigo-50 border-indigo-200 text-indigo-700" 
                        : "bg-white border-gray-200 text-gray-600 hover:bg-gray-50"
                    )}
                  >
                    Out of Town
                    <span className="block text-xs font-normal opacity-70 mt-0.5">1 min/km</span>
                  </button>
                  <button
                    onClick={() => setTrafficCondition('normal')}
                    className={cn(
                      "py-2 px-3 text-sm rounded-lg border font-medium transition-colors",
                      trafficCondition === 'normal' 
                        ? "bg-indigo-50 border-indigo-200 text-indigo-700" 
                        : "bg-white border-gray-200 text-gray-600 hover:bg-gray-50"
                    )}
                  >
                    Normal
                    <span className="block text-xs font-normal opacity-70 mt-0.5">2 min/km</span>
                  </button>
                  <button
                    onClick={() => setTrafficCondition('heavy')}
                    className={cn(
                      "py-2 px-3 text-sm rounded-lg border font-medium transition-colors",
                      trafficCondition === 'heavy' 
                        ? "bg-indigo-50 border-indigo-200 text-indigo-700" 
                        : "bg-white border-gray-200 text-gray-600 hover:bg-gray-50"
                    )}
                  >
                    Heavy
                    <span className="block text-xs font-normal opacity-70 mt-0.5">3 min/km</span>
                  </button>
                </div>
              </div>
              
              <div className="space-y-4">
                {vehicles.map((vehicle, idx) => (
                  <div key={vehicle.id} className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm space-y-3">
                    <div className="flex justify-between items-center border-b pb-2">
                      <div className="flex items-center gap-2">
                        <span className="w-6 h-6 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center text-xs font-bold">
                          {idx + 1}
                        </span>
                        <input 
                          type="text" 
                          value={vehicle.name} 
                          onChange={(e) => updateVehicle(vehicle.id, 'name', e.target.value)}
                          className="font-semibold text-gray-900 bg-transparent border-none focus:ring-0 p-0"
                          placeholder="Vehicle Name"
                        />
                      </div>
                      {vehicles.length > 1 && (
                        <button onClick={() => removeVehicle(vehicle.id)} className="text-gray-400 hover:text-red-500">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs text-gray-500 mb-1">Capacity (Units)</label>
                        <input type="number" value={vehicle.capacity} onChange={e => updateVehicle(vehicle.id, 'capacity', parseInt(e.target.value)||0)} className="w-full px-3 py-1.5 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 text-sm" />
                      </div>
                      <div>
                        <label className="block text-xs text-gray-500 mb-1">Working Hours (Start - End)</label>
                        <div className="flex gap-2">
                          <input type="time" value={vehicle.startTime || '08:00'} onChange={e => updateVehicle(vehicle.id, 'startTime', e.target.value)} className="w-full px-2 py-1.5 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 text-sm" />
                          <input type="time" value={vehicle.endTime || '18:00'} onChange={e => updateVehicle(vehicle.id, 'endTime', e.target.value)} className="w-full px-2 py-1.5 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 text-sm" />
                        </div>
                      </div>
                      <div>
                        <label className="block text-xs text-gray-500 mb-1">Fuel Cost (THB/km)</label>
                        <div className="relative">
                          <DollarSign className="w-3 h-3 absolute left-2.5 top-1/2 transform -translate-y-1/2 text-gray-400" />
                          <input type="number" value={vehicle.fuelCostPerKm} onChange={e => updateVehicle(vehicle.id, 'fuelCostPerKm', parseFloat(e.target.value)||0)} className="w-full pl-7 pr-3 py-1.5 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 text-sm" />
                        </div>
                      </div>
                      <div>
                        <label className="block text-xs text-gray-500 mb-1">Driver Wage (THB/route)</label>
                        <div className="relative">
                          <DollarSign className="w-3 h-3 absolute left-2.5 top-1/2 transform -translate-y-1/2 text-gray-400" />
                          <input type="number" value={vehicle.driverWage} onChange={e => updateVehicle(vehicle.id, 'driverWage', parseFloat(e.target.value)||0)} className="w-full pl-7 pr-3 py-1.5 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 text-sm" />
                        </div>
                      </div>
                      <div>
                        <label className="block text-xs text-gray-500 mb-1">Other Expenses (THB/route)</label>
                        <div className="relative">
                          <DollarSign className="w-3 h-3 absolute left-2.5 top-1/2 transform -translate-y-1/2 text-gray-400" />
                          <input type="number" value={vehicle.otherExpenses} onChange={e => updateVehicle(vehicle.id, 'otherExpenses', parseFloat(e.target.value)||0)} className="w-full pl-7 pr-3 py-1.5 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 text-sm" />
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'results' && (
            <div className="space-y-6">
              <div className="flex justify-between items-center">
                <h2 className="text-lg font-semibold text-gray-800">Route Details</h2>
                <button onClick={exportCSV} className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white px-3 py-1.5 rounded-lg text-sm font-medium transition-colors">
                  <Download className="w-4 h-4" /> Export CSV
                </button>
              </div>
              
              {routes.length === 0 ? (
                <div className="text-center py-10 text-gray-500 bg-gray-50 rounded-lg border border-dashed border-gray-300">
                  <RouteIcon className="w-10 h-10 mx-auto mb-3 text-gray-400" />
                  <p>No routes generated yet.</p>
                  <p className="text-sm mt-1">Click "Solve VRP" to generate routes.</p>
                </div>
              ) : (
                <div className="space-y-6">
                  {/* Gantt Chart */}
                  {(() => {
                    let minTime = 24 * 60;
                    let maxTime = 0;

                    routes.forEach(route => {
                      route.schedule.forEach(stop => {
                        const arr = timeToMinutes(stop.arrivalTime);
                        const dep = timeToMinutes(stop.departureTime);
                        if (arr < minTime) minTime = arr;
                        if (dep > maxTime) maxTime = dep;
                      });
                    });

                    if (minTime > maxTime) {
                      minTime = 8 * 60;
                      maxTime = 18 * 60;
                    } else {
                      minTime = Math.floor(minTime / 60) * 60;
                      maxTime = Math.ceil(maxTime / 60) * 60;
                    }

                    const totalMinutes = maxTime - minTime || 60;
                    const timeMarkers = [];
                    for (let t = minTime; t <= maxTime; t += 60) {
                      timeMarkers.push(t);
                    }

                    const customerColors = ['#f87171', '#fb923c', '#fbbf24', '#a3e635', '#4ade80', '#34d399', '#2dd4bf', '#38bdf8', '#818cf8', '#a78bfa', '#e879f9', '#fb7185'];

                    return (
                      <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm overflow-x-auto">
                        <h3 className="text-sm font-semibold text-gray-800 mb-4 flex items-center gap-2">
                          <Calendar className="w-4 h-4" /> Gantt Chart
                        </h3>
                        <div className="min-w-[600px]">
                          {/* Header with time markers */}
                          <div className="flex relative h-6 mb-2 border-b border-gray-200">
                            <div className="w-24 shrink-0"></div>
                            <div className="flex-1 relative">
                              {timeMarkers.map(t => (
                                <div key={t} className="absolute top-0 text-xs text-gray-500 transform -translate-x-1/2" style={{ left: `${((t - minTime) / totalMinutes) * 100}%` }}>
                                  {`${Math.floor(t / 60).toString().padStart(2, '0')}:00`}
                                </div>
                              ))}
                            </div>
                          </div>
                          
                          {/* Rows for each vehicle */}
                          <div className="space-y-4 relative pb-2">
                            {/* Grid lines */}
                            <div className="absolute inset-0 left-24 flex pointer-events-none">
                              <div className="flex-1 relative">
                                {timeMarkers.map(t => (
                                  <div key={t} className="absolute top-0 bottom-0 border-l border-gray-100" style={{ left: `${((t - minTime) / totalMinutes) * 100}%` }}></div>
                                ))}
                              </div>
                            </div>

                            {routes.map((route, i) => (
                              <div key={i} className="flex items-center relative z-10">
                                <div className="w-24 shrink-0 text-xs font-medium text-gray-700 truncate pr-2" title={route.vehicleId}>
                                  {route.vehicleId}
                                </div>
                                <div className="flex-1 relative h-8 bg-gray-50 rounded-md border border-gray-100">
                                  {route.schedule.map((stop, idx) => {
                                    if (idx === 0) {
                                      // First depot departure
                                      const dep = timeToMinutes(stop.departureTime);
                                      const left = ((dep - minTime) / totalMinutes) * 100;
                                      return (
                                        <div 
                                          key={idx}
                                          className="absolute top-1/2 w-2 h-2 bg-red-500 rounded-full transform -translate-y-1/2 -translate-x-1/2"
                                          style={{ left: `${left}%` }}
                                          title={`Depot Departure\nDep: ${stop.departureTime}`}
                                        />
                                      );
                                    }
                                    
                                    const node = nodes.find(n => n.id === stop.nodeId);
                                    if (!node) return null;
                                    
                                    const prevStop = route.schedule[idx - 1];
                                    const prevDep = timeToMinutes(prevStop.departureTime);
                                    const arr = timeToMinutes(stop.arrivalTime);
                                    const dep = timeToMinutes(stop.departureTime);
                                    
                                    const driveLeft = ((prevDep - minTime) / totalMinutes) * 100;
                                    const driveWidth = ((arr - prevDep) / totalMinutes) * 100;
                                    
                                    const serviceLeft = ((arr - minTime) / totalMinutes) * 100;
                                    const serviceWidth = ((dep - arr) / totalMinutes) * 100;

                                    if (node.isDepot) {
                                      return (
                                        <React.Fragment key={idx}>
                                          <div 
                                            className="absolute top-1/2 h-0.5 bg-gray-300 transform -translate-y-1/2"
                                            style={{ left: `${driveLeft}%`, width: `${driveWidth}%` }}
                                          />
                                          <div 
                                            className="absolute top-1/2 w-2 h-2 bg-red-500 rounded-full transform -translate-y-1/2 -translate-x-1/2"
                                            style={{ left: `${serviceLeft}%` }}
                                            title={`Return to Depot\nArr: ${stop.arrivalTime}`}
                                          />
                                        </React.Fragment>
                                      );
                                    }
                                    
                                    // Use a consistent color based on node id
                                    let hash = 0;
                                    for (let i = 0; i < node.id.length; i++) hash = node.id.charCodeAt(i) + ((hash << 5) - hash);
                                    const color = customerColors[Math.abs(hash) % customerColors.length];
                                    
                                    const waitLeft = ((arr - minTime) / totalMinutes) * 100;
                                    const waitWidth = (stop.waitingTime / totalMinutes) * 100;
                                    
                                    const actualServiceLeft = (((arr + stop.waitingTime) - minTime) / totalMinutes) * 100;
                                    const actualServiceWidth = (((dep - (arr + stop.waitingTime))) / totalMinutes) * 100;

                                    return (
                                      <React.Fragment key={idx}>
                                        <div 
                                          className="absolute top-1/2 h-0.5 bg-gray-300 transform -translate-y-1/2"
                                          style={{ left: `${driveLeft}%`, width: `${driveWidth}%` }}
                                        />
                                        {stop.waitingTime > 0 && (
                                          <div 
                                            className="absolute top-1/2 h-1 bg-amber-400 transform -translate-y-1/2 rounded-full"
                                            style={{ left: `${waitLeft}%`, width: `${waitWidth}%` }}
                                            title={`Waiting Time: ${stop.waitingTime}m`}
                                          />
                                        )}
                                        <div 
                                          className="absolute top-1 bottom-1 rounded shadow-sm flex items-center justify-center overflow-hidden border border-black/10 text-[10px] text-white font-medium px-1 whitespace-nowrap cursor-help transition-all hover:opacity-90 hover:shadow-md"
                                          style={{ left: `${actualServiceLeft}%`, width: `${Math.max(actualServiceWidth, 0.5)}%`, backgroundColor: color }}
                                          title={`${node.name}\nArr: ${stop.arrivalTime}\nDep: ${stop.departureTime}\nWait: ${stop.waitingTime}m`}
                                        >
                                          <span className="truncate w-full text-center">{node.name}</span>
                                        </div>
                                      </React.Fragment>
                                    );
                                  })}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    );
                  })()}

                  <div className="space-y-4">
                  {routes.map((route, i) => (
                    <div key={i} className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
                      <div className="px-4 py-3 border-b border-gray-100 flex justify-between items-center" style={{ borderLeft: `4px solid ${route.color}` }}>
                        <h3 className="font-semibold flex items-center gap-2">
                          <Truck className="w-4 h-4" style={{ color: route.color }} />
                          {route.vehicleId}
                        </h3>
                        <div className="text-sm text-gray-500 flex gap-4">
                          <span>Load: {route.load}/{route.capacity}</span>
                          <span>{route.distance.toFixed(1)} km</span>
                          <span className="font-medium text-green-600">฿{route.totalCost.toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
                        </div>
                      </div>
                      <div className="p-4 bg-gray-50">
                        <div className="space-y-2 text-sm">
                          {route.schedule.map((stop, idx) => {
                            const node = nodes.find(n => n.id === stop.nodeId);
                            return (
                              <div key={`${i}-${idx}`} className="flex items-center gap-3">
                                <div className="w-20 text-right text-gray-500 font-mono text-xs">
                                  {stop.arrivalTime}
                                </div>
                                <div className="flex-1 flex items-center gap-2">
                                  <span className={cn("px-2 py-1 rounded-md border text-xs", node?.isDepot ? "bg-red-100 border-red-200 text-red-800 font-medium" : "bg-white border-gray-200 text-gray-700")}>
                                    {node?.name}
                                  </span>
                                  {stop.waitingTime > 0 && (
                                    <span className="text-xs text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200">
                                      Wait {Math.round(stop.waitingTime)}m
                                    </span>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === 'dashboard' && (
            <div className="space-y-6">
              <div className="flex justify-between items-center">
                <h2 className="text-lg font-semibold text-gray-800">Dashboard & Summary</h2>
                <button onClick={exportCSV} className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white px-3 py-1.5 rounded-lg text-sm font-medium transition-colors">
                  <Download className="w-4 h-4" /> Export CSV
                </button>
              </div>

              {routes.length === 0 ? (
                <div className="text-center py-10 text-gray-500 bg-gray-50 rounded-lg border border-dashed border-gray-300">
                  <BarChart3 className="w-10 h-10 mx-auto mb-3 text-gray-400" />
                  <p>No data to display.</p>
                  <p className="text-sm mt-1">Solve VRP first to see the dashboard.</p>
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
                      <p className="text-sm text-gray-500 font-medium">Total Cost</p>
                      <p className="text-2xl font-bold text-gray-900">฿{totalCost.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</p>
                    </div>
                    <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
                      <p className="text-sm text-gray-500 font-medium">Total Distance</p>
                      <p className="text-2xl font-bold text-gray-900">{totalDist.toFixed(2)} km</p>
                    </div>
                    <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
                      <p className="text-sm text-gray-500 font-medium">Avg Cost / km</p>
                      <p className="text-2xl font-bold text-gray-900">฿{(totalCost / (totalDist || 1)).toFixed(2)}</p>
                    </div>
                    <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
                      <p className="text-sm text-gray-500 font-medium">Vehicles Used</p>
                      <p className="text-2xl font-bold text-gray-900">{routes.length}</p>
                    </div>
                  </div>

                  <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
                    <h3 className="text-sm font-medium text-gray-700 mb-4">Cost Breakdown</h3>
                    <div className="h-48">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie data={pieData} cx="50%" cy="50%" innerRadius={40} outerRadius={80} paddingAngle={5} dataKey="value">
                            {pieData.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={entry.color} />
                            ))}
                          </Pie>
                          <RechartsTooltip formatter={(value: number) => `฿${value.toFixed(2)}`} />
                          <Legend />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                  </div>

                  <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
                    <h3 className="text-sm font-medium text-gray-700 mb-4">Cost per Vehicle</h3>
                    <div className="h-64">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={barData}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} />
                          <XAxis dataKey="name" textAnchor="end" height={60} interval={0} tick={{fontSize: 12}} />
                          <YAxis tick={{fontSize: 12}} tickFormatter={(value) => `฿${value}`} />
                          <RechartsTooltip formatter={(value: number) => `฿${value.toFixed(2)}`} />
                          <Legend />
                          <Bar dataKey="Fuel" stackId="a" fill="#3b82f6" />
                          <Bar dataKey="Wage" stackId="a" fill="#10b981" />
                          <Bar dataKey="Other" stackId="a" fill="#f59e0b" />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                </>
              )}
            </div>
          )}
        </div>

        {/* Bottom Action Bar */}
        <div className="p-4 border-t border-gray-200 bg-white flex gap-2">
          <button 
            onClick={() => { setRoutes([]); setActiveTab('nodes'); }}
            className="px-4 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium rounded-xl shadow-sm transition-all flex items-center justify-center gap-2"
            title="Clear Results & Edit"
          >
            <RefreshCw className="w-5 h-5" />
          </button>
          <button 
            onClick={handleSolve}
            className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 px-4 rounded-xl shadow-md transition-all flex items-center justify-center gap-2"
          >
            <Play className="w-5 h-5" />
            Solve VRP & Calculate Costs
          </button>
        </div>
      </div>

      {/* Right Map Area */}
      <div className="flex-1 relative z-0">
        <div className="absolute top-4 left-1/2 transform -translate-x-1/2 z-[1000] bg-white/90 backdrop-blur-sm px-4 py-2 rounded-full shadow-md border border-gray-200 text-sm font-medium text-gray-700 pointer-events-none flex items-center gap-2">
          <MapPin className="w-4 h-4 text-indigo-600" />
          Click anywhere on the map to add a new customer, or drag existing markers.
        </div>
        <MapContainer center={[13.7563, 100.5018]} zoom={10} className="w-full h-full">
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
          />
          <MapUpdater bounds={mapBounds} />
          <MapEvents />
          
          {nodes.map((node, idx) => (
            <Marker 
              key={node.id} 
              position={[node.lat, node.lng]}
              draggable={true}
              eventHandlers={{
                dragend: (e) => {
                  const marker = e.target;
                  const position = marker.getLatLng();
                  updateNode(node.id, 'lat', position.lat);
                  updateNode(node.id, 'lng', position.lng);
                },
              }}
              {...(node.isDepot ? { icon: depotIcon } : {})}
            >
              <Popup>
                <div className="font-sans">
                  <strong className="block text-base">{node.name}</strong>
                  <span className="text-sm text-gray-500 block mt-1">Demand: {node.demand}</span>
                </div>
              </Popup>
            </Marker>
          ))}

          {routes.map((route, i) => {
            const positions = route.path.map(nodeId => {
              const node = nodes.find(n => n.id === nodeId);
              return [node!.lat, node!.lng] as [number, number];
            });
            return (
              <Polyline 
                key={i} 
                positions={positions} 
                color={route.color} 
                weight={4} 
                opacity={0.8}
                dashArray={route.vehicleId.includes('2') ? '10, 10' : undefined}
              />
            );
          })}
        </MapContainer>
      </div>
    </div>
  );
}
