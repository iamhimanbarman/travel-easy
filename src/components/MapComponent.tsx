'use client';

import React, { useMemo, useEffect, useState, useRef, useCallback } from 'react';
import MapGL, { Source, Layer, Marker, NavigationControl, FullscreenControl } from 'react-map-gl/maplibre';
import 'maplibre-gl/dist/maplibre-gl.css';
import { getStopCoord, FindResult, Leg } from '@/lib/routing';
import { MapPin } from 'lucide-react';


// ─── Color System ───────────────────────────────────────────────

function getLegColor(leg: Leg): string {
  if (leg.kind === 'metro') {
    const code = leg.route.toLowerCase();
    if (code.includes('green')) return '#16a34a';
    if (code.includes('blue')) return '#2563eb';
    return '#7c3aed';
  }
  return '#8b5cf6';
}


// ─── Geocoding (via server proxy — key hidden) ──────────────────

const geocodeCache: Record<string, [number, number] | null> = {};

async function geocodeStop(name: string): Promise<[number, number] | null> {
  if (name in geocodeCache) return geocodeCache[name];

  try {
    const res = await fetch(`/api/geocode?q=${encodeURIComponent(name)}`);
    if (!res.ok) { geocodeCache[name] = null; return null; }
    
    const data = await res.json();
    if (data.lon != null && data.lat != null) {
      const coord: [number, number] = [data.lon, data.lat];
      geocodeCache[name] = coord;
      return coord;
    }
  } catch (e) {
    console.error('Geocode failed for', name, e);
  }

  geocodeCache[name] = null;
  return null;
}

async function getBestCoord(name: string): Promise<[number, number] | null> {
  // Always try geocoding first — dataset coordinates are often inaccurate
  const geocoded = await geocodeStop(name);
  if (geocoded) return geocoded;
  
  // Fallback to dataset if geocoding fails
  const dataCoord = getStopCoord(name);
  if (dataCoord) return [dataCoord[1], dataCoord[0]]; // [lng, lat]
  
  return null;
}


// ─── Routing (via server proxy — key hidden) ────────────────────

async function fetchRoute(coords: [number, number][]): Promise<any> {
  if (coords.length < 2) return null;

  // Downsample if too many waypoints
  let c = coords;
  if (c.length > 25) {
    const step = Math.ceil(c.length / 25);
    c = c.filter((_, i) => i % step === 0 || i === c.length - 1);
  }

  // Try Geoapify proxy first (key hidden on server)
  try {
    const waypoints = c.map(p => `${p[1]},${p[0]}`).join('|');
    const res = await fetch(`/api/route?waypoints=${encodeURIComponent(waypoints)}`);
    if (res.ok) {
      const data = await res.json();
      if (data.geometry) {
        return { geometry: data.geometry, distance: data.distance, time: data.time };
      }
    }
  } catch { /* fall through to OSRM */ }

  // Fallback: OSRM (no API key needed)
  try {
    let osrmCoords = c;
    if (osrmCoords.length > 80) {
      const step = Math.ceil(osrmCoords.length / 80);
      osrmCoords = osrmCoords.filter((_, i) => i % step === 0 || i === osrmCoords.length - 1);
    }
    const str = osrmCoords.map(p => `${p[0]},${p[1]}`).join(';');
    const res = await fetch(`https://router.project-osrm.org/route/v1/driving/${str}?overview=full&geometries=geojson`);
    const data = await res.json();
    if (data.code === 'Ok' && data.routes?.[0]) {
      return { geometry: data.routes[0].geometry, distance: data.routes[0].distance, time: data.routes[0].duration };
    }
  } catch (e) { console.error('OSRM fallback failed:', e); }

  return null;
}


// ─── User Location Dot ─────────────────────────────────────────

function UserDot({ lng, lat }: { lng: number; lat: number }) {
  return (
    <Marker longitude={lng} latitude={lat} anchor="center">
      <div className="relative flex items-center justify-center">
        <div className="absolute w-12 h-12 rounded-full bg-blue-500/15 animate-ping" />
        <div className="absolute w-9 h-9 rounded-full bg-blue-500/10 border border-blue-400/25" />
        <div className="relative w-4 h-4 rounded-full bg-blue-600 border-[3px] border-white shadow-lg shadow-blue-500/50 z-10" />
      </div>
    </Marker>
  );
}


// ─── Stop Marker ────────────────────────────────────────────────

const MARKER_COLORS = { origin: '#16a34a', dest: '#ea580c', transfer: '#f59e0b' } as const;
const MARKER_LABELS = { origin: 'START', dest: 'END', transfer: 'TRANSFER' } as const;

function StopMarker({ name, coord, type }: { name: string; coord: [number, number]; type: 'origin' | 'dest' | 'transfer' }) {
  const color = MARKER_COLORS[type];
  return (
    <Marker longitude={coord[0]} latitude={coord[1]} anchor="bottom">
      <div className="flex flex-col items-center group">
        <div className="bg-white/95 dark:bg-zinc-900/95 backdrop-blur-md px-3 py-1.5 rounded-lg shadow-lg border border-zinc-200/80 dark:border-zinc-700/80 text-xs whitespace-nowrap mb-1 opacity-90 group-hover:opacity-100 transition-opacity">
          <span className="font-bold text-zinc-900 dark:text-zinc-100">{name}</span>
          <span className="ml-1.5 text-[9px] uppercase tracking-widest font-extrabold" style={{ color }}>
            {MARKER_LABELS[type]}
          </span>
        </div>
        <MapPin className="w-7 h-7 drop-shadow-xl" style={{ color, fill: 'currentColor' }} />
      </div>
    </Marker>
  );
}


// ─── Main Component ─────────────────────────────────────────────

interface MarkerData { name: string; coord: [number, number]; type: 'origin' | 'dest' | 'transfer' }
interface LegCoordData { coords: [number, number][]; leg: Leg }
interface SegmentData { geojson: any; leg: Leg }

export default function MapComponent({ result }: { result: FindResult }) {
  const [mapStyle, setMapStyle] = useState<any>(null);
  const [routeSegments, setRouteSegments] = useState<SegmentData[]>([]);
  const [walkGeoJson, setWalkGeoJson] = useState<any>(null);
  const [userLoc, setUserLoc] = useState<{ lat: number; lng: number } | null>(null);
  const [resolvedMarkers, setResolvedMarkers] = useState<MarkerData[]>([]);
  const [resolvedLegCoords, setResolvedLegCoords] = useState<LegCoordData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const watchRef = useRef<number | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  // ── Load map style from server proxy (key stays hidden) ──
  useEffect(() => {
    // Fallback raster style if Geoapify proxy is unavailable
    const fallbackStyle = {
      version: 8 as const,
      sources: {
        'carto': { type: 'raster' as const, tiles: ['https://a.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}@2x.png'], tileSize: 256, attribution: '&copy; CartoDB &copy; OSM' }
      },
      layers: [{ id: 'carto-layer', type: 'raster' as const, source: 'carto', minzoom: 0, maxzoom: 22 }]
    };

    fetch('/api/map-style')
      .then(r => {
        if (!r.ok) throw new Error('Style proxy unavailable');
        return r.json();
      })
      .then(style => { if (mountedRef.current) setMapStyle(style); })
      .catch(() => { if (mountedRef.current) setMapStyle(fallbackStyle); });
  }, []);

  // ── Live GPS tracking ──
  useEffect(() => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) return;
    watchRef.current = navigator.geolocation.watchPosition(
      (p) => { if (mountedRef.current) setUserLoc({ lat: p.coords.latitude, lng: p.coords.longitude }); },
      () => {},
      { enableHighAccuracy: true, maximumAge: 3000, timeout: 10000 }
    );
    return () => { if (watchRef.current !== null) navigator.geolocation.clearWatch(watchRef.current); };
  }, []);

  // ── Resolve key waypoint coordinates (leg start/end only) ──
  useEffect(() => {
    if (!result || result.error || (result.direct.length === 0 && result.one.length === 0 && result.two.length === 0)) {
      setResolvedMarkers([]); setResolvedLegCoords([]); setIsLoading(false);
      return;
    }

    const journey = result.direct[0] || result.one[0] || result.two[0];
    if (!journey) { setIsLoading(false); return; }

    setIsLoading(true);

    (async () => {
      const mkrs: MarkerData[] = [];
      const legsC: LegCoordData[] = [];

      // Geocode the origin
      const originCoord = await getBestCoord(result.origin);
      if (originCoord) mkrs.push({ name: result.origin, coord: originCoord, type: 'origin' });

      for (let i = 0; i < journey.legs.length; i++) {
        const leg = journey.legs[i];

        // Only geocode the START and END of each leg (accurate key waypoints)
        const legFrom = await getBestCoord(leg.from);
        const legTo = await getBestCoord(leg.to);
        
        const coords: [number, number][] = [];
        if (legFrom) coords.push(legFrom);
        if (legTo) coords.push(legTo);

        legsC.push({ coords, leg });

        // Transfer markers
        if (i < journey.legs.length - 1 && legTo) {
          mkrs.push({ name: leg.to, coord: legTo, type: 'transfer' });
        }
      }

      // Geocode the destination
      const destCoord = await getBestCoord(result.dest);
      if (destCoord) mkrs.push({ name: result.dest, coord: destCoord, type: 'dest' });

      if (mountedRef.current) {
        setResolvedMarkers(mkrs);
        setResolvedLegCoords(legsC);
      }
    })();
  }, [result]);

  // ── Fetch road-accurate routes per leg ──
  useEffect(() => {
    if (resolvedLegCoords.length === 0) { setRouteSegments([]); setIsLoading(false); return; }

    (async () => {
      const segs: SegmentData[] = [];

      for (const lc of resolvedLegCoords) {
        if (lc.coords.length < 2) { segs.push({ geojson: null, leg: lc.leg }); continue; }

        const route = await fetchRoute(lc.coords);
        if (route?.geometry) {
          segs.push({ geojson: { type: 'Feature', properties: {}, geometry: route.geometry }, leg: lc.leg });
        } else {
          // Fallback to straight line
          segs.push({ geojson: { type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: lc.coords } }, leg: lc.leg });
        }
      }

      if (mountedRef.current) { setRouteSegments(segs); setIsLoading(false); }
    })();
  }, [resolvedLegCoords]);

  // ── Walk route (user → first stop) ──
  useEffect(() => {
    if (!userLoc || resolvedMarkers.length === 0) { setWalkGeoJson(null); return; }
    const origin = resolvedMarkers.find(m => m.type === 'origin');
    if (!origin) return;

    fetchRoute([[userLoc.lng, userLoc.lat], origin.coord]).then(route => {
      if (route?.geometry && mountedRef.current) {
        setWalkGeoJson({ type: 'Feature', properties: {}, geometry: route.geometry });
      }
    });
  }, [userLoc, resolvedMarkers]);

  // ── Compute map bounds ──
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

  // ── Render states ──
  if (!mapStyle || !bounds || resolvedLegCoords.length === 0) {
    if (isLoading && result && !result.error) {
      return (
        <div className="w-full h-[450px] rounded-xl overflow-hidden shadow-lg border border-zinc-200 dark:border-zinc-800 flex items-center justify-center bg-zinc-50 dark:bg-zinc-900">
          <div className="flex flex-col items-center gap-3">
            <div className="w-8 h-8 border-3 border-purple-600 border-t-transparent rounded-full animate-spin" />
            <span className="text-sm text-muted-foreground font-medium">Loading map…</span>
          </div>
        </div>
      );
    }
    return null;
  }

  return (
    <div className="w-full h-[450px] rounded-xl overflow-hidden shadow-lg border border-zinc-200 dark:border-zinc-800 z-0 relative">
      <MapGL
        initialViewState={{ bounds, fitBoundsOptions: { padding: 60 } }}
        mapStyle={mapStyle}
        dragRotate={true}
        touchPitch={true}
        pitchWithRotate={true}
        interactive={true}
      >
        <FullscreenControl position="top-right" />
        <NavigationControl position="bottom-right" showCompass visualizePitch />

        {/* Walk route — dashed blue */}
        {walkGeoJson && (
          <Source id="walk" type="geojson" data={{ type: 'FeatureCollection', features: [walkGeoJson] } as any}>
            <Layer id="walk-line" type="line"
              layout={{ 'line-join': 'round', 'line-cap': 'round' }}
              paint={{ 'line-color': '#3b82f6', 'line-width': 4, 'line-dasharray': [2, 3], 'line-opacity': 0.7 }}
            />
          </Source>
        )}

        {/* Per-leg route segments — each with transport-specific color */}
        {routeSegments.map((seg, i) => {
          if (!seg.geojson) return null;
          const color = getLegColor(seg.leg);
          return (
            <Source key={`seg-${i}`} id={`seg-${i}`} type="geojson" data={{ type: 'FeatureCollection', features: [seg.geojson] } as any}>
              <Layer id={`seg-glow-${i}`} type="line"
                layout={{ 'line-join': 'round', 'line-cap': 'round' }}
                paint={{ 'line-color': color, 'line-width': 10, 'line-opacity': 0.2 }}
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
          <StopMarker key={`${m.name}-${i}`} name={m.name} coord={m.coord} type={m.type} />
        ))}

        {/* User live location */}
        {userLoc && <UserDot lng={userLoc.lng} lat={userLoc.lat} />}
      </MapGL>
    </div>
  );
}
