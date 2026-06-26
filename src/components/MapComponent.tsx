'use client';

import React, { useEffect, useState, useRef } from 'react';
import { FindResult } from '@/lib/routing';

export default function MapComponent({ result }: { result: FindResult }) {
  const [embedUrl, setEmbedUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(false);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

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

    setIsLoading(true);
    setError(false);

    // Fetch the embed URL from our server-side proxy (API key hidden)
    fetch(`/api/map-embed?origin=${encodeURIComponent(result.origin)}&destination=${encodeURIComponent(result.dest)}&mode=transit`)
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
  }, [result]);

  if (!result || result.error) return null;

  const hasRoutes = result.direct.length > 0 || result.one.length > 0 || result.two.length > 0;
  if (!hasRoutes) return null;

  return (
    <div className="w-full rounded-xl overflow-hidden shadow-lg border border-zinc-200 dark:border-zinc-800 relative">
      {/* Loading state */}
      {isLoading && (
        <div className="w-full h-[450px] flex items-center justify-center bg-zinc-50 dark:bg-zinc-900">
          <div className="flex flex-col items-center gap-3">
            <div className="w-8 h-8 border-3 border-purple-600 border-t-transparent rounded-full animate-spin" />
            <span className="text-sm text-muted-foreground font-medium">Loading Google Maps…</span>
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
  );
}
