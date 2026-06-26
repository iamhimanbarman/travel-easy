import { NextResponse } from 'next/server';

/**
 * Server-side proxy for the Geoapify Map Style JSON.
 * This keeps the API key hidden from client-side code.
 * The browser requests /api/map-style → this route fetches from Geoapify → returns the style.
 */
export async function GET() {
  const key = process.env.GEOAPIFY_KEY;
  if (!key) {
    return NextResponse.json({ error: 'Map configuration missing' }, { status: 500 });
  }

  try {
    const res = await fetch(
      `https://maps.geoapify.com/v1/styles/osm-bright-smooth/style.json?apiKey=${key}`,
      { next: { revalidate: 86400 } } // Cache for 24 hours
    );

    if (!res.ok) {
      return NextResponse.json({ error: 'Failed to load map style' }, { status: 502 });
    }

    const style = await res.json();

    return NextResponse.json(style, {
      headers: {
        'Cache-Control': 'public, s-maxage=86400, stale-while-revalidate=43200',
      },
    });
  } catch {
    return NextResponse.json({ error: 'Map service unavailable' }, { status: 503 });
  }
}
