'use client';

import React, { useMemo, useEffect, useState, useCallback, useRef } from 'react';
import Map, { Source, Layer, Marker, NavigationControl, FullscreenControl, GeolocateControl, useMap } from 'react-map-gl/maplibre';
import 'maplibre-gl/dist/maplibre-gl.css';
import { getStopCoord, FindResult } from '@/lib/routing';
import { MapPin, Navigation, Locate } from 'lucide-react';

// Fetch exact road route from OSRM
async function fetchRoadRoute(coords: [number, number][]): Promise<any> {
  if (coords.length < 2) return null;

  // OSRM handles max ~100 coordinates per request
  let coordsToRoute = coords;
  if (coordsToRoute.length > 80) {
    const step = Math.ceil(coordsToRoute.length / 80);
    coordsToRoute = coordsToRoute.filter((_, i) => i % step === 0 || i === coordsToRoute.length - 1);
  }

  const coordsString = coordsToRoute.map(c => `${c[0]},${c[1]}`).join(';');

  try {
    const res = await fetch(`https://router.project-osrm.org/route/v1/driving/${coordsString}?overview=full&geometries=geojson`);
    const data = await res.json();
    if (data.code === 'Ok' && data.routes?.[0]) {
      return {
        geometry: data.routes[0].geometry,
        distance: data.routes[0].distance,
        duration: data.routes[0].duration
      };
    }
  } catch (e) {
    console.error('OSRM routing failed:', e);
  }
  return null;
}

// Animated pulsing dot for user location
function UserLocationDot({ longitude, latitude, heading }: { longitude: number; latitude: number; heading: number | null }) {
  return (
    <Marker longitude={longitude} latitude={latitude} anchor="center">
      <div className="relative flex items-center justify-center">
        {/* Accuracy pulse ring */}
        <div className="absolute w-12 h-12 rounded-full bg-blue-500/20 animate-ping" />
        {/* Solid accuracy circle */}
        <div className="absolute w-10 h-10 rounded-full bg-blue-500/10 border border-blue-400/30" />
        {/* Core dot */}
        <div className="relative w-4 h-4 rounded-full bg-blue-600 border-[3px] border-white shadow-lg shadow-blue-500/40 z-10" />
        {/* Heading indicator */}
        {heading !== null && (
          <div
            className="absolute w-0 h-0 z-20"
            style={{
              top: '-8px',
              borderLeft: '5px solid transparent',
              borderRight: '5px solid transparent',
              borderBottom: '10px solid #2563eb',
              transform: `rotate(${heading}deg)`,
              transformOrigin: 'center 12px',
            }}
          />
        )}
      </div>
    </Marker>
  );
}

// Info badge overlay
function RouteSummaryBadge({ distance, duration, label }: { distance: number; duration: number; label: string }) {
  const distKm = (distance / 1000).toFixed(1);
  const durMin = Math.round(duration / 60);
  return (
    <div className="bg-white/90 dark:bg-zinc-900/90 backdrop-blur-md px-3 py-2 rounded-lg shadow-lg border border-zinc-200 dark:border-zinc-800">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">{label}</div>
      <div className="flex items-center gap-3 mt-0.5">
        <span className="text-sm font-bold">{distKm} km</span>
        <span className="text-xs text-muted-foreground">•</span>
        <span className="text-sm font-bold">{durMin} min</span>
      </div>
    </div>
  );
}

export default function MapComponent({ result }: { result: FindResult }) {
  const [routeGeoJson, setRouteGeoJson] = useState<any>(null);
  const [walkGeoJson, setWalkGeoJson] = useState<any>(null);
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number; heading: number | null } | null>(null);
  const [routeInfo, setRouteInfo] = useState<{ distance: number; duration: number } | null>(null);
  const [walkInfo, setWalkInfo] = useState<{ distance: number; duration: number } | null>(null);
  const watchIdRef = useRef<number | null>(null);

  // ─── Live GPS tracking ────────────────────────────────────────
  useEffect(() => {
    if (!navigator.geolocation) return;

    const onSuccess = (pos: GeolocationPosition) => {
      setUserLocation({
        lat: pos.coords.latitude,
        lng: pos.coords.longitude,
        heading: pos.coords.heading,
      });
    };

    const onError = (err: GeolocationPositionError) => {
      console.warn('Geolocation error:', err.message);
    };

    // Start continuous tracking
    watchIdRef.current = navigator.geolocation.watchPosition(onSuccess, onError, {
      enableHighAccuracy: true,
      maximumAge: 3000,
      timeout: 10000,
    });

    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }
    };
  }, []);

  // ─── Extract stop coordinates ─────────────────────────────────
  const { pathCoords, markers } = useMemo(() => {
    const coords: [number, number][] = [];
    const mkrs: { name: string; coord: [number, number]; type: 'origin' | 'dest' | 'transfer' }[] = [];

    if (!result || result.error || (result.direct.length === 0 && result.one.length === 0 && result.two.length === 0)) {
      return { pathCoords: coords, markers: mkrs };
    }

    const bestJourney = result.direct[0] || result.one[0] || result.two[0];
    if (!bestJourney) return { pathCoords: coords, markers: mkrs };

    const originCoord = getStopCoord(result.origin);
    const destCoord = getStopCoord(result.dest);

    if (originCoord) mkrs.push({ name: result.origin, coord: originCoord, type: 'origin' });

    bestJourney.legs.forEach((leg: any, i: number) => {
      leg.stops.forEach((stopName: string) => {
        const coord = getStopCoord(stopName);
        if (coord) coords.push([coord[1], coord[0]]); // [lng, lat]
      });

      if (i < bestJourney.legs.length - 1) {
        const transferCoord = getStopCoord(leg.to);
        if (transferCoord) {
          mkrs.push({ name: leg.to, coord: transferCoord, type: 'transfer' });
        }
      }
    });

    if (destCoord) mkrs.push({ name: result.dest, coord: destCoord, type: 'dest' });

    return { pathCoords: coords, markers: mkrs };
  }, [result]);

  // ─── Fetch exact road route (from → to) ──────────────────────
  useEffect(() => {
    if (pathCoords.length < 2) { setRouteGeoJson(null); setRouteInfo(null); return; }

    fetchRoadRoute(pathCoords).then(route => {
      if (route) {
        setRouteGeoJson({
          type: 'FeatureCollection',
          features: [{ type: 'Feature', properties: {}, geometry: route.geometry }]
        });
        setRouteInfo({ distance: route.distance, duration: route.duration });
      }
    });
  }, [pathCoords]);

  // ─── Fetch walk route (user location → from stop) ────────────
  useEffect(() => {
    if (!userLocation || markers.length === 0) { setWalkGeoJson(null); setWalkInfo(null); return; }

    const originMarker = markers.find(m => m.type === 'origin');
    if (!originMarker) return;

    const walkCoords: [number, number][] = [
      [userLocation.lng, userLocation.lat],
      [originMarker.coord[1], originMarker.coord[0]] // [lng, lat]
    ];

    fetchRoadRoute(walkCoords).then(route => {
      if (route) {
        setWalkGeoJson({
          type: 'FeatureCollection',
          features: [{ type: 'Feature', properties: {}, geometry: route.geometry }]
        });
        setWalkInfo({ distance: route.distance, duration: route.duration });
      }
    });
  }, [userLocation, markers]);

  // ─── Compute map bounds ───────────────────────────────────────
  const bounds = useMemo(() => {
    const allCoords = [...pathCoords];
    if (userLocation) allCoords.push([userLocation.lng, userLocation.lat]);

    if (allCoords.length === 0) return null;
    const lats = allCoords.map(c => c[1]);
    const lngs = allCoords.map(c => c[0]);
    return [
      [Math.min(...lngs) - 0.005, Math.min(...lats) - 0.005],
      [Math.max(...lngs) + 0.005, Math.max(...lats) + 0.005]
    ] as [[number, number], [number, number]];
  }, [pathCoords, userLocation]);

  if (!bounds || pathCoords.length === 0) return null;

  // Fallback straight-line geojson
  const fallbackGeoJson = {
    type: 'FeatureCollection',
    features: [{ type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: pathCoords } }]
  };

  const currentGeoJson = routeGeoJson || fallbackGeoJson;

  const mapStyle = {
    version: 8,
    sources: {
      'carto-voyager': {
        type: 'raster',
        tiles: ['https://a.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}@2x.png'],
        tileSize: 256,
        attribution: '&copy; <a href="https://carto.com/">CartoDB</a> &copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>'
      }
    },
    layers: [
      { id: 'carto-voyager-layer', type: 'raster', source: 'carto-voyager', minzoom: 0, maxzoom: 22 }
    ]
  };

  const markerColors = { origin: '#16a34a', dest: '#ea580c', transfer: '#f59e0b' };
  const markerLabels = { origin: 'Start', dest: 'End', transfer: 'Transfer' };

  return (
    <div className="w-full rounded-xl overflow-hidden shadow-lg border border-zinc-200 dark:border-zinc-800 z-0 relative">
      {/* Info badges */}
      <div className="absolute top-3 left-3 z-10 flex flex-col gap-2">
        {walkInfo && <RouteSummaryBadge distance={walkInfo.distance} duration={walkInfo.duration} label="Walk to stop" />}
        {routeInfo && <RouteSummaryBadge distance={routeInfo.distance} duration={routeInfo.duration} label="Bus / Metro route" />}
      </div>

      <div className="h-[500px]">
        <Map
          initialViewState={{
            bounds: bounds,
            fitBoundsOptions: { padding: 60 }
          }}
          mapStyle={mapStyle as any}
          dragRotate={true}
          touchPitch={true}
          pitchWithRotate={true}
          interactive={true}
        >
          <FullscreenControl position="top-right" />
          <NavigationControl position="bottom-right" showCompass={true} />

          {/* ── Walk route (dashed blue line: user → from) ── */}
          {walkGeoJson && (
            <Source id="walk-route" type="geojson" data={walkGeoJson}>
              <Layer
                id="walkLine"
                type="line"
                layout={{ 'line-join': 'round', 'line-cap': 'round' }}
                paint={{
                  'line-color': '#3b82f6',
                  'line-width': 4,
                  'line-dasharray': [2, 3],
                  'line-opacity': 0.8
                }}
              />
            </Source>
          )}

          {/* ── Main route (solid purple line: from → to) ── */}
          <Source id="main-route" type="geojson" data={currentGeoJson}>
            <Layer
              id="routeOutline"
              type="line"
              layout={{ 'line-join': 'round', 'line-cap': 'round' }}
              paint={{ 'line-color': '#4c1d95', 'line-width': 9, 'line-opacity': 0.35 }}
            />
            <Layer
              id="routeCore"
              type="line"
              layout={{ 'line-join': 'round', 'line-cap': 'round' }}
              paint={{ 'line-color': '#8b5cf6', 'line-width': 5, 'line-opacity': 1 }}
            />
          </Source>

          {/* ── Stop markers ── */}
          {markers.map((marker, idx) => (
            <Marker
              key={`${marker.name}-${idx}`}
              longitude={marker.coord[1]}
              latitude={marker.coord[0]}
              anchor="bottom"
            >
              <div className="flex flex-col items-center animate-in fade-in slide-in-from-bottom-2 duration-300">
                <div className="bg-white/95 dark:bg-zinc-900/95 backdrop-blur-md px-3 py-1.5 rounded-lg shadow-lg border border-zinc-200 dark:border-zinc-700 text-xs whitespace-nowrap mb-1">
                  <span className="font-bold">{marker.name}</span>
                  <span className="ml-1.5 text-[10px] uppercase tracking-wider font-semibold" style={{ color: markerColors[marker.type] }}>
                    {markerLabels[marker.type]}
                  </span>
                </div>
                <MapPin
                  className="w-8 h-8 drop-shadow-xl"
                  style={{ color: markerColors[marker.type], fill: 'currentColor' }}
                />
              </div>
            </Marker>
          ))}

          {/* ── Live user location ── */}
          {userLocation && (
            <UserLocationDot
              longitude={userLocation.lng}
              latitude={userLocation.lat}
              heading={userLocation.heading}
            />
          )}
        </Map>
      </div>
    </div>
  );
}
