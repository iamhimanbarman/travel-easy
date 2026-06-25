'use client';

import { useEffect, useRef } from 'react';
import { MapContainer, TileLayer, Polyline, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { getStopCoord, FindResult } from '@/lib/routing';

// Fix Leaflet's default icon path issues
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

// A component to automatically fit the map bounds to the polyline
function MapBounds({ bounds }: { bounds: L.LatLngBounds }) {
  const map = useMap();
  useEffect(() => {
    if (bounds.isValid()) {
      map.fitBounds(bounds, { padding: [50, 50] });
    }
  }, [bounds, map]);
  return null;
}

export default function MapComponent({ result }: { result: FindResult }) {
  if (!result || result.error || (result.direct.length === 0 && result.one.length === 0 && result.two.length === 0)) {
    return null;
  }

  // Choose the best journey to plot (first direct, or first one-change, or first two-change)
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
      if (coord) pathCoords.push(coord);
    });

    // Mark transfer points
    if (i < bestJourney.legs.length - 1) {
      const transferCoord = getStopCoord(leg.to);
      if (transferCoord) {
        markers.push({ name: leg.to, coord: transferCoord, isTransfer: true });
      }
    }
  });

  if (destCoord) markers.push({ name: result.dest, coord: destCoord, isTransfer: false });

  const bounds = L.latLngBounds(pathCoords.length > 0 ? pathCoords : (originCoord && destCoord ? [originCoord, destCoord] : []));

  // If we can't find coordinates, don't show the map
  if (!bounds.isValid()) return null;

  return (
    <div className="w-full h-[400px] rounded-xl overflow-hidden shadow-md border border-zinc-200 dark:border-zinc-800 z-0">
      <MapContainer 
        center={originCoord || [22.5726, 88.3639]} // Default to Kolkata center
        zoom={12} 
        style={{ width: '100%', height: '100%' }}
        scrollWheelZoom={false}
      >
        <TileLayer
          attribution='&copy; <a href="https://carto.com/">CartoDB</a>'
          url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
        />
        
        {pathCoords.length > 0 && (
          <Polyline positions={pathCoords} pathOptions={{ color: '#8b5cf6', weight: 4, opacity: 0.8 }} />
        )}

        {markers.map((marker, idx) => (
          <Marker key={`${marker.name}-${idx}`} position={marker.coord}>
            <Popup>
              <span className="font-semibold">{marker.name}</span>
              {marker.isTransfer && <span className="block text-xs text-muted-foreground">Transfer</span>}
              {idx === 0 && !marker.isTransfer && <span className="block text-xs text-green-600">Origin</span>}
              {idx === markers.length - 1 && !marker.isTransfer && <span className="block text-xs text-blue-600">Destination</span>}
            </Popup>
          </Marker>
        ))}

        <MapBounds bounds={bounds} />
      </MapContainer>
    </div>
  );
}
