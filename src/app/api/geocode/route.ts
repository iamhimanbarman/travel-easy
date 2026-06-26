import { NextRequest, NextResponse } from 'next/server';

/**
 * Server-side proxy for Geoapify Geocoding.
 * Client sends: /api/geocode?q=Howrah+Station
 * Server fetches from Geoapify with the hidden API key and returns the result.
 */
export async function GET(request: NextRequest) {
  const key = process.env.GEOAPIFY_KEY;
  if (!key) {
    return NextResponse.json({ error: 'Geocoding configuration missing' }, { status: 500 });
  }

  const q = request.nextUrl.searchParams.get('q');
  if (!q) {
    return NextResponse.json({ error: 'Missing query parameter "q"' }, { status: 400 });
  }

  try {
    const text = encodeURIComponent(`${q}, West Bengal, India`);
    
    // Bias results to the greater Kolkata metropolitan region bounding box
    // Covers: Kalyani (north) to Diamond Harbour (south), Howrah (west) to Barasat/Salt Lake (east)
    const bias = 'rect:88.15,22.20,88.65,22.90';
    
    const res = await fetch(
      `https://api.geoapify.com/v1/geocode/search?text=${text}&bias=${bias}&limit=1&apiKey=${key}`
    );

    if (!res.ok) {
      return NextResponse.json({ error: 'Geocoding service error' }, { status: 502 });
    }

    const data = await res.json();
    
    // Return only the coordinates — no excess data leaks
    if (data?.features?.length > 0) {
      const [lon, lat] = data.features[0].geometry.coordinates;
      return NextResponse.json({ lon, lat }, {
        headers: { 'Cache-Control': 'public, s-maxage=604800, stale-while-revalidate=86400' }, // Cache 7 days
      });
    }

    return NextResponse.json({ lon: null, lat: null });
  } catch {
    return NextResponse.json({ error: 'Geocoding service unavailable' }, { status: 503 });
  }
}
