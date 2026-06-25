'use client';

import React, { useMemo } from 'react';
import Map, { Source, Layer, Marker } from 'react-map-gl/maplibre';
import 'maplibre-gl/dist/maplibre-gl.css';
import { getStopCoord, FindResult } from '@/lib/routing';
import { MapPin } from 'lucide-react';

export default function MapComponent({ result }: { result: FindResult }) {
  if (!result || result.error || (result.direct.length === 0 && result.one.length === 0 && result.two.length === 0)) {
    return null;
  }

  const bestJourney = result.direct[0] || result.one[0] || result.two[0];
  if (!bestJourney) return null;

  const pathCoords: [number, number][] = [];
  const markers: { name: string; coord: [number, number]; isTransfer: boolean }[] = [];

  const originCoord = getStopCoord(result.origin);
  const destCoord = getStopCoord(result.dest);

  if (originCoord) markers.push({ name: result.origin, coord: originCoord, isTransfer: false });

  bestJourney.legs.forEach((leg, i) => {
    leg.stops.forEach((stopName) => {
      const coord = getStopCoord(stopName);
      if (coord) pathCoords.push([coord[1], coord[0]]); // maplibre uses [lng, lat]
    });

    if (i < bestJourney.legs.length - 1) {
      const transferCoord = getStopCoord(leg.to);
      if (transferCoord) {
        markers.push({ name: leg.to, coord: transferCoord, isTransfer: true });
      }
    }
  });

  if (destCoord) markers.push({ name: result.dest, coord: destCoord, isTransfer: false });

  // Calculate bounds
  const bounds = useMemo(() => {
    if (pathCoords.length === 0) return null;
    const lats = pathCoords.map(c => c[1]);
    const lngs = pathCoords.map(c => c[0]);
    return [
      [Math.min(...lngs), Math.min(...lats)],
      [Math.max(...lngs), Math.max(...lats)]
    ] as [[number, number], [number, number]];
  }, [pathCoords]);

  const geojson = {
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

  if (!bounds) return null;

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
    <div className="w-full h-[400px] rounded-xl overflow-hidden shadow-md border border-zinc-200 dark:border-zinc-800 z-0 relative group">
      <div className="absolute top-2 left-2 z-10 bg-white/80 dark:bg-zinc-900/80 backdrop-blur-sm px-3 py-1.5 rounded-full text-xs font-medium border border-zinc-200 dark:border-zinc-800 shadow-sm pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity">
        Right-click & drag (or 2-finger twist) to rotate
      </div>
      <Map
        initialViewState={{
          bounds: bounds,
          fitBoundsOptions: { padding: 50 }
        }}
        mapStyle={mapStyle as any}
        dragRotate={true}
        touchPitch={true}
        pitchWithRotate={true}
        interactive={true}
      >
        <Source id="route" type="geojson" data={geojson as any}>
          <Layer
            id="lineLayer"
            type="line"
            layout={{
              'line-join': 'round',
              'line-cap': 'round'
            }}
            paint={{
              'line-color': '#8b5cf6',
              'line-width': 5,
              'line-opacity': 0.8
            }}
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
              <div className="bg-white dark:bg-zinc-900 px-2 py-1 rounded-md shadow-sm border border-zinc-200 dark:border-zinc-800 text-xs font-medium whitespace-nowrap mb-1">
                {marker.name}
              </div>
              <MapPin 
                className="w-6 h-6 drop-shadow-md" 
                style={{ 
                  color: marker.isTransfer ? '#f59e0b' : (idx === 0 ? '#16a34a' : '#2563eb'),
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
