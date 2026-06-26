'use client';

import MapComponent from './MapComponent';
import { FindResult } from '@/lib/routing';

export default function RouteMap({ result }: { result: FindResult }) {
  return <MapComponent result={result} />;
}
