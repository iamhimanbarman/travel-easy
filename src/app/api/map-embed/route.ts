import { NextRequest, NextResponse } from 'next/server';

/**
 * Server-side proxy for Google Maps Embed URL.
 * Supports two modes:
 *   1. Route only:     /api/map-embed?origin=Karunamoyee&destination=Barasat
 *   2. Live location:  /api/map-embed?origin=22.57,88.40&destination=Barasat&waypoints=Karunamoyee
 */
export async function GET(request: NextRequest) {
  const key = process.env.GOOGLE_MAPS_KEY;
  if (!key) {
    return NextResponse.json({ error: 'Google Maps not configured' }, { status: 500 });
  }

  const origin = request.nextUrl.searchParams.get('origin');
  const destination = request.nextUrl.searchParams.get('destination');
  const waypoints = request.nextUrl.searchParams.get('waypoints');
  const mode = request.nextUrl.searchParams.get('mode') || 'transit';

  if (!origin || !destination) {
    return NextResponse.json({ error: 'Missing origin or destination' }, { status: 400 });
  }

  // Check if origin looks like GPS coordinates (lat,lng) — don't append city name
  const isGps = /^-?\d+(\.\d+)?,-?\d+(\.\d+)?$/.test(origin.trim());
  const originStr = isGps ? origin.trim() : `${origin}, Kolkata, West Bengal`;
  const destStr = `${destination}, Kolkata, West Bengal`;

  let embedUrl = `https://www.google.com/maps/embed/v1/directions?key=${key}&origin=${encodeURIComponent(originStr)}&destination=${encodeURIComponent(destStr)}&mode=${mode}&zoom=12`;

  // Add waypoints if provided (e.g., the "from" stop when origin is user's GPS)
  if (waypoints) {
    const wpStr = waypoints.split('|').map(wp => `${wp}, Kolkata, West Bengal`).join('|');
    embedUrl += `&waypoints=${encodeURIComponent(wpStr)}`;
  }

  return NextResponse.json({ url: embedUrl }, {
    headers: {
      'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=30',
    },
  });
}
