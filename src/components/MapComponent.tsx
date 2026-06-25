'use client';

import React, { useMemo, useEffect, useState } from 'react';
import Map, { Source, Layer, Marker, NavigationControl, FullscreenControl, GeolocateControl } from 'react-map-gl/maplibre';
import 'maplibre-gl/dist/maplibre-gl.css';
import { getStopCoord, FindResult } from '@/lib/routing';
import { MapPin } from 'lucide-react';

export default function MapComponent({ result }: { result: FindResult }) {
  const [routeGeoJson, setRouteGeoJson] = useState<any>(null);

  const { pathCoords, markers } = useMemo(() => {
    const coords: [number, number][] = [];
    const mkrs: { name: string; coord: [number, number]; isTransfer: boolean }[] = [];

    if (!result || result.error || (result.direct.length === 0 && result.one.length === 0 && result.two.length === 0)) {
      return { pathCoords: coords, markers: mkrs };
    }

    const bestJourney = result.direct[0] || result.one[0] || result.two[0];
    if (!bestJourney) return { pathCoords: coords, markers: mkrs };

    const originCoord = getStopCoord(result.origin);
    const destCoord = getStopCoord(result.dest);

    if (originCoord) mkrs.push({ name: result.origin, coord: originCoord, isTransfer: false });

    bestJourney.legs.forEach((leg: any, i: number) => {
      leg.stops.forEach((stopName: string) => {
        const coord = getStopCoord(stopName);
        if (coord) coords.push([coord[1], coord[0]]); // maplibre uses [lng, lat]
      });

      if (i < bestJourney.legs.length - 1) {
        const transferCoord = getStopCoord(leg.to);
        if (transferCoord) {
          mkrs.push({ name: leg.to, coord: transferCoord, isTransfer: true });
        }
      }
    });

    if (destCoord) mkrs.push({ name: result.dest, coord: destCoord, isTransfer: false });

    return { pathCoords: coords, markers: mkrs };
  }, [result]);

  useEffect(() => {
    if (pathCoords.length === 0) {
      setRouteGeoJson(null);
      return;
    }

    // OSRM handles max 100 coordinates per request
    let coordsToRoute = pathCoords;
    if (coordsToRoute.length > 90) {
      const step = Math.ceil(coordsToRoute.length / 90);
      coordsToRoute = coordsToRoute.filter((_, i) => i % step === 0 || i === coordsToRoute.length - 1);
    }

    const coordsString = coordsToRoute.map(c => `${c[0]},${c[1]}`).join(';');
    
    // Fetch exact road-snapped route from OSRM
    fetch(`https://router.project-osrm.org/route/v1/driving/${coordsString}?overview=full&geometries=geojson`)
      .then(res => res.json())
      .then(data => {
        if (data.code === 'Ok' && data.routes && data.routes[0]) {
          setRouteGeoJson({
            type: 'FeatureCollection',
            features: [
              {
                type: 'Feature',
                properties: {},
                geometry: data.routes[0].geometry
              }
            ]
          });
        }
      })
      .catch(e => console.error("Failed to fetch exact road route:", e));
  }, [pathCoords]);

  const bounds = useMemo(() => {
    if (pathCoords.length === 0) return null;
    const lats = pathCoords.map(c => c[1]);
    const lngs = pathCoords.map(c => c[0]);
    return [
      [Math.min(...lngs), Math.min(...lats)],
      [Math.max(...lngs), Math.max(...lats)]
    ] as [[number, number], [number, number]];
  }, [pathCoords]);

  if (!bounds || pathCoords.length === 0) return null;

  const fallbackGeojson = {
    type: 'FeatureCollection',
    features: [
      {
        type: 'Feature',
        properties: {},
        geometry: {
          type: 'LineString',
          coordinates: pathCoords
        }
      }
    ]
  };

  const currentGeoJson = routeGeoJson || fallbackGeojson;

  // Premium map style
  const mapStyle = {
    version: 8,
    sources: {
      'carto-voyager': {
        type: 'raster',
        tiles: ['https://a.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}@2x.png'],
        tileSize: 256,
        attribution: '&copy; CartoDB'
      }
    },
    layers: [
      {
        id: 'carto-voyager-layer',
        type: 'raster',
        source: 'carto-voyager',
        minzoom: 0,
        maxzoom: 22
      }
    ]
  };

  return (
    <div className="w-full h-[450px] rounded-xl overflow-hidden shadow-lg border border-zinc-200 dark:border-zinc-800 z-0 relative group">
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
        <GeolocateControl position="bottom-right" />

        <Source id="route" type="geojson" data={currentGeoJson as any}>
          {/* Outer glow/border for the route */}
          <Layer
            id="lineLayer-outline"
            type="line"
            layout={{ 'line-join': 'round', 'line-cap': 'round' }}
            paint={{ 'line-color': '#4c1d95', 'line-width': 8, 'line-opacity': 0.5 }}
          />
          {/* Inner core route line */}
          <Layer
            id="lineLayer-core"
            type="line"
            layout={{ 'line-join': 'round', 'line-cap': 'round' }}
            paint={{ 'line-color': '#8b5cf6', 'line-width': 4, 'line-opacity': 1 }}
          />
        </Source>

        {markers.map((marker, idx) => (
          <Marker 
            key={`${marker.name}-${idx}`} 
            longitude={marker.coord[1]} 
            latitude={marker.coord[0]} 
            anchor="bottom"
          >
            <div className="flex flex-col items-center">
              <div className="bg-white dark:bg-zinc-900 px-3 py-1.5 rounded-lg shadow-md border border-zinc-200 dark:border-zinc-800 text-xs font-bold whitespace-nowrap mb-1">
                {marker.name}
              </div>
              <MapPin 
                className="w-8 h-8 drop-shadow-xl" 
                style={{ 
                  color: marker.isTransfer ? '#f59e0b' : (idx === 0 ? '#16a34a' : '#ea580c'),
                  fill: 'currentColor'
                }} 
              />
            </div>
          </Marker>
        ))}
      </Map>
    </div>
  );
}
