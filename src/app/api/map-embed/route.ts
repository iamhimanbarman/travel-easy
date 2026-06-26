import { NextRequest, NextResponse } from 'next/server';

/**
 * Server-side proxy for Google Maps Embed URL.
 * Client sends: /api/map-embed?origin=Karunamoyee&destination=Barasat
 * Server returns the full embed URL with the hidden API key.
 */
export async function GET(request: NextRequest) {
  const key = process.env.GOOGLE_MAPS_KEY;
  if (!key) {
    return NextResponse.json({ error: 'Google Maps not configured' }, { status: 500 });
  }

  const origin = request.nextUrl.searchParams.get('origin');
  const destination = request.nextUrl.searchParams.get('destination');
  const mode = request.nextUrl.searchParams.get('mode') || 'transit';

  if (!origin || !destination) {
    return NextResponse.json({ error: 'Missing origin or destination' }, { status: 400 });
  }

  // Build the Google Maps Embed API URL with directions
  const embedUrl = `https://www.google.com/maps/embed/v1/directions?key=${key}&origin=${encodeURIComponent(origin + ', Kolkata, West Bengal')}&destination=${encodeURIComponent(destination + ', Kolkata, West Bengal')}&mode=${mode}&zoom=12`;

  return NextResponse.json({ url: embedUrl }, {
    headers: {
      'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=1800',
    },
  });
}
