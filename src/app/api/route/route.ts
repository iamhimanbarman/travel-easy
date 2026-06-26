import { NextRequest, NextResponse } from 'next/server';

/**
 * Server-side proxy for Geoapify Routing API.
 * Client sends: /api/route?waypoints=lat1,lon1|lat2,lon2|...
 * Server fetches driving route from Geoapify with the hidden API key.
 */
export async function GET(request: NextRequest) {
  const key = process.env.GEOAPIFY_KEY;
  if (!key) {
    return NextResponse.json({ error: 'Routing configuration missing' }, { status: 500 });
  }

  const waypoints = request.nextUrl.searchParams.get('waypoints');
  if (!waypoints) {
    return NextResponse.json({ error: 'Missing "waypoints" parameter' }, { status: 400 });
  }

  try {
    const res = await fetch(
      `https://api.geoapify.com/v1/routing?waypoints=${encodeURIComponent(waypoints)}&mode=drive&apiKey=${key}`
    );

    if (!res.ok) {
      return NextResponse.json({ error: 'Routing service error' }, { status: 502 });
    }

    const data = await res.json();

    // Extract only the geometry for the best route
    if (data?.features?.length > 0) {
      const geometry = data.features[0].geometry;
      const props = data.features[0].properties;
      return NextResponse.json({
        geometry,
        distance: props?.distance ?? 0,
        time: props?.time ?? 0,
      }, {
        headers: { 'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=1800' },
      });
    }

    return NextResponse.json({ geometry: null, distance: 0, time: 0 });
  } catch {
    return NextResponse.json({ error: 'Routing service unavailable' }, { status: 503 });
  }
}
