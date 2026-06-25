'use client';

import dynamic from 'next/dynamic';
import { FindResult } from '@/lib/routing';

const MapComponent = dynamic(() => import('./MapComponent'), { 
  ssr: false,
  loading: () => <div className="w-full h-[400px] rounded-xl bg-zinc-200 dark:bg-zinc-800 animate-pulse" />
});

export default function RouteMap({ result }: { result: FindResult }) {
  return <MapComponent result={result} />;
}
