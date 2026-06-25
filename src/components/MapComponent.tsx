'use client';

import React, { useMemo, useEffect, useState, useRef } from 'react';
import Map, { Source, Layer, Marker, NavigationControl, FullscreenControl } from 'react-map-gl/maplibre';
import 'maplibre-gl/dist/maplibre-gl.css';
import { getStopCoord, FindResult, Leg } from '@/lib/routing';
import { MapPin } from 'lucide-react';

// ─── Helpers ────────────────────────────────────────────────────

function getLegColor(leg: Leg): string {
  if (leg.kind === 'metro') {
    const code = leg.route.toLowerCase();
    if (code.includes('green')) return '#16a34a';
    if (code.includes('blue')) return '#2563eb';
    return '#7c3aed';
  }
  return '#8b5cf6';
}

async function fetchRoadRoute(coords: [number, number][]): Promise<any> {
  if (coords.length < 2) return null;
  let c = coords;
  if (c.length > 80) {
    const step = Math.ceil(c.length / 80);
    c = c.filter((_, i) => i % step === 0 || i === c.length - 1);
  }
  const str = c.map(p => `${p[0]},${p[1]}`).join(';');
  try {
    const res = await fetch(`https://router.project-osrm.org/route/v1/driving/${str}?overview=full&geometries=geojson`);
    const data = await res.json();
    if (data.code === 'Ok' && data.routes?.[0]) {
      return { geometry: data.routes[0].geometry, distance: data.routes[0].distance, duration: data.routes[0].duration };
    }
  } catch (e) { console.error('OSRM failed:', e); }
  return null;
}

// Geocode a stop name via Nominatim for pinpoint accuracy (Kolkata-specific)
const geocodeCache: Record<string, [number, number] | null> = {};

async function geocodeStop(name: string): Promise<[number, number] | null> {
  if (name in geocodeCache) return geocodeCache[name];

  try {
    const query = encodeURIComponent(`${name}, Kolkata, West Bengal, India`);
    const res = await fetch(`https://nominatim.openstreetmap.org/search?q=${query}&format=json&limit=1&addressdetails=0`);
    const data = await res.json();
    if (data && data.length > 0) {
      const coord: [number, number] = [parseFloat(data[0].lon), parseFloat(data[0].lat)];
      geocodeCache[name] = coord;
      return coord;
    }
  } catch (e) { console.error('Geocode failed for', name, e); }
  
  geocodeCache[name] = null;
  return null;
}

// Get best coordinate for a stop: try dataset first, fallback to geocoding
async function getBestCoord(name: string): Promise<[number, number] | null> {
  // First check the dataset
  const dataCoord = getStopCoord(name);
  if (dataCoord) {
    // Dataset stores [lat, lng] — convert to [lng, lat] for map
    return [dataCoord[1], dataCoord[0]];
  }
  // Fallback to geocoding
  return geocodeStop(name);
}


// ─── User Location Dot ─────────────────────────────────────────

function UserDot({ lng, lat }: { lng: number; lat: number }) {
  return (
    <Marker longitude={lng} latitude={lat} anchor="center">
      <div className="relative flex items-center justify-center">
        <div className="absolute w-10 h-10 rounded-full bg-blue-500/20 animate-ping" />
        <div className="absolute w-8 h-8 rounded-full bg-blue-500/10 border border-blue-400/30" />
        <div className="relative w-3.5 h-3.5 rounded-full bg-blue-600 border-[3px] border-white shadow-lg shadow-blue-500/40 z-10" />
      </div>
    </Marker>
  );
}


// ─── Main Component ─────────────────────────────────────────────

export default function MapComponent({ result }: { result: FindResult }) {
  const [routeSegments, setRouteSegments] = useState<any[]>([]);
  const [walkGeoJson, setWalkGeoJson] = useState<any>(null);
  const [userLoc, setUserLoc] = useState<{ lat: number; lng: number } | null>(null);
  const [resolvedMarkers, setResolvedMarkers] = useState<{ name: string; coord: [number, number]; type: 'origin' | 'dest' | 'transfer' }[]>([]);
  const [resolvedLegCoords, setResolvedLegCoords] = useState<{ coords: [number, number][]; leg: Leg }[]>([]);
  const watchRef = useRef<number | null>(null);
  const isMounted = useRef(true);

  useEffect(() => {
    isMounted.current = true;
    return () => { isMounted.current = false; };
  }, []);

  // Live GPS
  useEffect(() => {
    if (!navigator.geolocation) return;
    watchRef.current = navigator.geolocation.watchPosition(
      (p) => setUserLoc({ lat: p.coords.latitude, lng: p.coords.longitude }),
      () => {},
      { enableHighAccuracy: true, maximumAge: 3000, timeout: 10000 }
    );
    return () => { if (watchRef.current !== null) navigator.geolocation.clearWatch(watchRef.current); };
  }, []);

  // Resolve all stop coordinates with geocoding for accuracy
  useEffect(() => {
    if (!result || result.error || (result.direct.length === 0 && result.one.length === 0 && result.two.length === 0)) {
      setResolvedMarkers([]);
      setResolvedLegCoords([]);
      return;
    }

    const journey = result.direct[0] || result.one[0] || result.two[0];
    if (!journey) return;

    const resolveAll = async () => {
      const mkrs: { name: string; coord: [number, number]; type: 'origin' | 'dest' | 'transfer' }[] = [];
      const legsC: { coords: [number, number][]; leg: Leg }[] = [];

      // Resolve origin
      const originCoord = await getBestCoord(result.origin);
      if (originCoord) mkrs.push({ name: result.origin, coord: originCoord, type: 'origin' });

      // Resolve each leg's stops
      for (let i = 0; i < journey.legs.length; i++) {
        const leg = journey.legs[i];
        const coords: [number, number][] = [];

        for (const stop of leg.stops) {
          const c = await getBestCoord(stop);
          if (c) coords.push(c);
        }

        legsC.push({ coords, leg });

        // Transfer markers
        if (i < journey.legs.length - 1) {
          const tc = await getBestCoord(leg.to);
          if (tc) mkrs.push({ name: leg.to, coord: tc, type: 'transfer' });
        }
      }

      // Resolve destination
      const destCoord = await getBestCoord(result.dest);
      if (destCoord) mkrs.push({ name: result.dest, coord: destCoord, type: 'dest' });

      if (isMounted.current) {
        setResolvedMarkers(mkrs);
        setResolvedLegCoords(legsC);
      }
    };

    resolveAll();
  }, [result]);

  // Fetch OSRM route for each leg
  useEffect(() => {
    if (resolvedLegCoords.length === 0) { setRouteSegments([]); return; }

    Promise.all(resolvedLegCoords.map(async (lc) => {
      if (lc.coords.length < 2) return { geojson: null, leg: lc.leg, coords: lc.coords };
      const route = await fetchRoadRoute(lc.coords);
      if (route) {
        return { geojson: { type: 'Feature', properties: {}, geometry: route.geometry }, leg: lc.leg, coords: lc.coords };
      }
      return { geojson: { type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: lc.coords } }, leg: lc.leg, coords: lc.coords };
    })).then(segs => { if (isMounted.current) setRouteSegments(segs); });
  }, [resolvedLegCoords]);

  // Walk route (user → origin)
  useEffect(() => {
    if (!userLoc || resolvedMarkers.length === 0) { setWalkGeoJson(null); return; }
    const origin = resolvedMarkers.find(m => m.type === 'origin');
    if (!origin) return;
    fetchRoadRoute([[userLoc.lng, userLoc.lat], origin.coord]).then(route => {
      if (route && isMounted.current) setWalkGeoJson({ type: 'Feature', properties: {}, geometry: route.geometry });
    });
  }, [userLoc, resolvedMarkers]);

  // Bounds
  const bounds = useMemo(() => {
    const all: [number, number][] = resolvedLegCoords.flatMap(lc => lc.coords);
    if (userLoc) all.push([userLoc.lng, userLoc.lat]);
    if (all.length === 0) return null;
    const lats = all.map(c => c[1]);
    const lngs = all.map(c => c[0]);
    return [
      [Math.min(...lngs) - 0.005, Math.min(...lats) - 0.005],
      [Math.max(...lngs) + 0.005, Math.max(...lats) + 0.005]
    ] as [[number, number], [number, number]];
  }, [resolvedLegCoords, userLoc]);

  if (!bounds || resolvedLegCoords.length === 0) return null;

  const mapStyle = {
    version: 8,
    sources: {
      'carto': { type: 'raster', tiles: ['https://a.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}@2x.png'], tileSize: 256, attribution: '&copy; CartoDB' }
    },
    layers: [{ id: 'carto-layer', type: 'raster', source: 'carto', minzoom: 0, maxzoom: 22 }]
  };

  const markerColors = { origin: '#16a34a', dest: '#ea580c', transfer: '#f59e0b' };
  const markerLabels = { origin: 'Start', dest: 'End', transfer: 'Transfer' };

  return (
    <div className="w-full h-[450px] rounded-xl overflow-hidden shadow-lg border border-zinc-200 dark:border-zinc-800 z-0">
      <Map
        initialViewState={{ bounds, fitBoundsOptions: { padding: 60 } }}
        mapStyle={mapStyle as any}
        dragRotate={true} touchPitch={true} pitchWithRotate={true} interactive={true}
      >
        <FullscreenControl position="top-right" />
        <NavigationControl position="bottom-right" showCompass={true} />

        {/* Walk route (dashed blue) */}
        {walkGeoJson && (
          <Source id="walk" type="geojson" data={{ type: 'FeatureCollection', features: [walkGeoJson] } as any}>
            <Layer id="walk-line" type="line"
              layout={{ 'line-join': 'round', 'line-cap': 'round' }}
              paint={{ 'line-color': '#3b82f6', 'line-width': 4, 'line-dasharray': [2, 3], 'line-opacity': 0.7 }}
            />
          </Source>
        )}

        {/* Per-leg route segments (each with its own color) */}
        {routeSegments.map((seg, i) => {
          if (!seg.geojson) return null;
          const color = getLegColor(seg.leg);
          return (
            <Source key={`seg-${i}`} id={`seg-${i}`} type="geojson" data={{ type: 'FeatureCollection', features: [seg.geojson] } as any}>
              <Layer id={`seg-outline-${i}`} type="line"
                layout={{ 'line-join': 'round', 'line-cap': 'round' }}
                paint={{ 'line-color': color, 'line-width': 9, 'line-opacity': 0.25 }}
              />
              <Layer id={`seg-core-${i}`} type="line"
                layout={{ 'line-join': 'round', 'line-cap': 'round' }}
                paint={{ 'line-color': color, 'line-width': 5, 'line-opacity': 1 }}
              />
            </Source>
          );
        })}

        {/* Stop markers */}
        {resolvedMarkers.map((m, i) => (
          <Marker key={`${m.name}-${i}`} longitude={m.coord[0]} latitude={m.coord[1]} anchor="bottom">
            <div className="flex flex-col items-center">
              <div className="bg-white/95 dark:bg-zinc-900/95 backdrop-blur-md px-3 py-1.5 rounded-lg shadow-lg border border-zinc-200 dark:border-zinc-700 text-xs whitespace-nowrap mb-1">
                <span className="font-bold">{m.name}</span>
                <span className="ml-1.5 text-[10px] uppercase tracking-wider font-bold" style={{ color: markerColors[m.type] }}>
                  {markerLabels[m.type]}
                </span>
              </div>
              <MapPin className="w-7 h-7 drop-shadow-xl" style={{ color: markerColors[m.type], fill: 'currentColor' }} />
            </div>
          </Marker>
        ))}

        {/* User location */}
        {userLoc && <UserDot lng={userLoc.lng} lat={userLoc.lat} />}
      </Map>
    </div>
  );
}
