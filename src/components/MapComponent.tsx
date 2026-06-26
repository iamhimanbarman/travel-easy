'use client';

import React, { useEffect, useState, useRef } from 'react';
import { FindResult } from '@/lib/routing';
import { MapPin, Navigation } from 'lucide-react';

export default function MapComponent({ result }: { result: FindResult }) {
  const [embedUrl, setEmbedUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(false);
  const [useLiveLocation, setUseLiveLocation] = useState(false);
  const [userLoc, setUserLoc] = useState<{ lat: number; lng: number } | null>(null);
  const [locError, setLocError] = useState(false);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  // Fetch user location if toggle is enabled
  useEffect(() => {
    if (useLiveLocation && !userLoc && navigator.geolocation) {
      setIsLoading(true);
      navigator.geolocation.getCurrentPosition(
        (p) => {
          if (mountedRef.current) {
            setUserLoc({ lat: p.coords.latitude, lng: p.coords.longitude });
            setLocError(false);
          }
        },
        () => {
          if (mountedRef.current) {
            setLocError(true);
            setUseLiveLocation(false);
            setIsLoading(false);
          }
        },
        { enableHighAccuracy: true }
      );
    }
  }, [useLiveLocation, userLoc]);

  useEffect(() => {
    if (!result || result.error) {
      setEmbedUrl(null);
      setIsLoading(false);
      return;
    }

    const hasRoutes = result.direct.length > 0 || result.one.length > 0 || result.two.length > 0;
    if (!hasRoutes) {
      setEmbedUrl(null);
      setIsLoading(false);
      return;
    }

    // Wait for location if toggle is on but we don't have it yet
    if (useLiveLocation && !userLoc) {
      return;
    }

    setIsLoading(true);
    setError(false);

    // Build URL parameters
    let originParam = result.origin;
    let waypointsParam = '';

    if (useLiveLocation && userLoc) {
      originParam = `${userLoc.lat},${userLoc.lng}`;
      waypointsParam = `&waypoints=${encodeURIComponent(result.origin)}`;
    }

    const query = `origin=${encodeURIComponent(originParam)}&destination=${encodeURIComponent(result.dest)}&mode=transit${waypointsParam}`;

    // Fetch the embed URL from our server-side proxy (API key hidden)
    fetch(`/api/map-embed?${query}`)
      .then(res => {
        if (!res.ok) throw new Error('Failed to load map');
        return res.json();
      })
      .then(data => {
        if (mountedRef.current && data.url) {
          setEmbedUrl(data.url);
          setIsLoading(false);
        }
      })
      .catch(() => {
        if (mountedRef.current) {
          setError(true);
          setIsLoading(false);
        }
      });
  }, [result, useLiveLocation, userLoc]);

  if (!result || result.error) return null;

  const hasRoutes = result.direct.length > 0 || result.one.length > 0 || result.two.length > 0;
  if (!hasRoutes) return null;

  return (
    <div className="w-full flex flex-col gap-3">
      {/* Live Location Toggle */}
      <div className="flex items-center justify-between bg-white dark:bg-zinc-950 px-4 py-3 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-sm">
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-lg ${useLiveLocation ? 'bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400' : 'bg-zinc-100 text-zinc-500 dark:bg-zinc-900 dark:text-zinc-400'}`}>
            <Navigation className="w-5 h-5" />
          </div>
          <div className="flex flex-col">
            <span className="font-semibold text-sm">Navigate from my location</span>
            <span className="text-xs text-muted-foreground">
              {locError ? 'Location access denied' : 'Show directions to the first stop'}
            </span>
          </div>
        </div>
        <button
          onClick={() => setUseLiveLocation(!useLiveLocation)}
          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${useLiveLocation ? 'bg-blue-600' : 'bg-zinc-300 dark:bg-zinc-700'}`}
        >
          <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${useLiveLocation ? 'translate-x-6' : 'translate-x-1'}`} />
        </button>
      </div>

      <div className="w-full rounded-xl overflow-hidden shadow-lg border border-zinc-200 dark:border-zinc-800 relative">
        {/* Loading state */}
        {isLoading && (
          <div className="w-full h-[450px] flex items-center justify-center bg-zinc-50 dark:bg-zinc-900">
            <div className="flex flex-col items-center gap-3">
              <div className="w-8 h-8 border-3 border-purple-600 border-t-transparent rounded-full animate-spin" />
              <span className="text-sm text-muted-foreground font-medium">
                {useLiveLocation && !userLoc ? 'Locating you...' : 'Loading Google Maps…'}
              </span>
            </div>
          </div>
        )}

        {/* Error state */}
        {error && !isLoading && (
          <div className="w-full h-[200px] flex items-center justify-center bg-zinc-50 dark:bg-zinc-900">
            <span className="text-sm text-muted-foreground">Unable to load map. Please try again.</span>
          </div>
        )}

        {/* Google Maps Embed */}
        {embedUrl && !error && (
          <iframe
            src={embedUrl}
            width="100%"
            height="450"
            style={{ border: 0, display: isLoading ? 'none' : 'block' }}
            allowFullScreen
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
            onLoad={() => setIsLoading(false)}
            title={`Route from ${result.origin} to ${result.dest}`}
          />
        )}
      </div>
    </div>
  );
}
