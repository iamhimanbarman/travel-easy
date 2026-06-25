'use client';

import * as React from 'react';
import { Check, ArrowDownUp, MapPin, X, BusFront, TrainFront, ChevronRight, ArrowLeft, Circle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { sortedSearchNames, stopHint, stopTypes, findRoute, FindResult, Journey, Leg } from '@/lib/routing';
import { motion, AnimatePresence } from 'framer-motion';
import { Card } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import RouteMap from './RouteMap';

// ─── Helpers ────────────────────────────────────────────────────

function getLegColor(leg: Leg): string {
  if (leg.kind === 'metro') {
    const code = leg.route.toLowerCase();
    if (code.includes('green')) return '#16a34a';
    if (code.includes('blue') || code.includes('blue line')) return '#2563eb';
    // Purple for any other metro lines
    return '#7c3aed';
  }
  return '#8b5cf6'; // Purple for buses
}

function getLegBgClass(leg: Leg): string {
  if (leg.kind === 'metro') {
    const code = leg.route.toLowerCase();
    if (code.includes('green')) return 'bg-green-600 hover:bg-green-700 text-white';
    if (code.includes('blue')) return 'bg-blue-600 hover:bg-blue-700 text-white';
    return 'bg-violet-600 hover:bg-violet-700 text-white';
  }
  return 'bg-purple-600 hover:bg-purple-700 text-white';
}

function getLegBorderClass(leg: Leg): string {
  if (leg.kind === 'metro') {
    const code = leg.route.toLowerCase();
    if (code.includes('green')) return 'border-green-500';
    if (code.includes('blue')) return 'border-blue-500';
    return 'border-violet-500';
  }
  return 'border-purple-500';
}

function getLegDotClass(leg: Leg): string {
  if (leg.kind === 'metro') {
    const code = leg.route.toLowerCase();
    if (code.includes('green')) return 'bg-green-600';
    if (code.includes('blue')) return 'bg-blue-600';
    return 'bg-violet-600';
  }
  return 'bg-purple-600';
}

function getLegTextClass(leg: Leg): string {
  if (leg.kind === 'metro') {
    const code = leg.route.toLowerCase();
    if (code.includes('green')) return 'text-green-600 dark:text-green-400';
    if (code.includes('blue')) return 'text-blue-600 dark:text-blue-400';
    return 'text-violet-600 dark:text-violet-400';
  }
  return 'text-purple-600 dark:text-purple-400';
}


// ─── Highlight Component ────────────────────────────────────────

function HighlightMatch({ text, query }: { text: string; query: string }) {
  if (!query) return <span className="truncate">{text}</span>;
  
  let escapedQuery: string;
  try {
    escapedQuery = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  } catch {
    return <span className="truncate">{text}</span>;
  }
  
  const parts = text.split(new RegExp(`(${escapedQuery})`, 'gi'));
  return (
    <span className="truncate">
      {parts.map((part, i) => {
        if (part.toLowerCase() === query.toLowerCase()) {
          const beforePart = parts.slice(0, i).join('');
          const afterPart = parts.slice(i + 1).join('');
          const isStartWord = beforePart.length === 0 || /[^a-zA-Z0-9]$/.test(beforePart);
          const isEndWord = afterPart.length === 0 || /^[^a-zA-Z0-9]/.test(afterPart);
          const isFullWordMatch = isStartWord && isEndWord;
          return (
            <span key={i} className={cn("font-semibold", isFullWordMatch ? "text-green-600 dark:text-green-400" : "text-blue-600 dark:text-blue-400")}>
              {part}
            </span>
          );
        }
        return <span key={i}>{part}</span>;
      })}
    </span>
  );
}


// ─── Stop Combobox ──────────────────────────────────────────────

const typeStyles = {
  bus: "bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 border border-transparent",
  metro: "bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800",
  combined: "bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800"
};

const itemHoverStyles = {
  bus: "hover:bg-zinc-100 dark:hover:bg-zinc-800",
  metro: "hover:bg-purple-50 dark:hover:bg-purple-900/20",
  combined: "hover:bg-blue-50 dark:hover:bg-blue-900/20"
};

function StopCombobox({ value, setValue, placeholder }: { value: string; setValue: (v: string) => void; placeholder: string }) {
  const [open, setOpen] = React.useState(false);
  const [search, setSearch] = React.useState(value);
  const inputRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => { setSearch(value); }, [value]);

  const filtered = React.useMemo(() => {
    if (!search || search.trim() === '') return [];
    const lower = search.toLowerCase();
    const matches = sortedSearchNames.filter(s => s.toLowerCase().includes(lower));
    matches.sort((a, b) => {
      const idxA = a.toLowerCase().indexOf(lower);
      const idxB = b.toLowerCase().indexOf(lower);
      return idxA !== idxB ? idxA - idxB : a.localeCompare(b);
    });
    return matches.slice(0, 50);
  }, [search]);

  return (
    <div className="relative w-full">
      <div className={cn(
        "flex w-full items-center rounded-xl h-14 px-4 text-base font-normal bg-background/50 backdrop-blur-sm border border-zinc-200 dark:border-zinc-800 shadow-sm transition-all focus-within:ring-2 focus-within:ring-purple-500/40",
        open ? "ring-2 ring-purple-500/40" : ""
      )}>
        <MapPin className="h-4 w-4 text-zinc-500 shrink-0 mr-2" />
        <input
          ref={inputRef}
          type="text"
          value={search}
          onChange={(e) => { setSearch(e.target.value); setOpen(true); if (e.target.value === '') setValue(''); }}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 200)}
          placeholder={placeholder}
          className="flex-1 bg-transparent border-none outline-none text-base placeholder:text-muted-foreground w-full h-full"
        />
        {search && (
          <button type="button" onClick={() => { setSearch(''); setValue(''); inputRef.current?.focus(); }} className="p-1 rounded-full hover:bg-zinc-200 dark:hover:bg-zinc-800 text-zinc-500 transition-colors">
            <X className="h-4 w-4 shrink-0 opacity-70" />
          </button>
        )}
      </div>

      <AnimatePresence>
        {open && filtered.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -5 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -5 }}
            transition={{ duration: 0.15 }}
            className="absolute top-[calc(100%+8px)] left-0 right-0 z-50 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-popover text-popover-foreground shadow-lg outline-none overflow-hidden"
          >
            <ScrollArea className="h-[50vh] max-h-[300px]">
              <div className="p-1">
                {filtered.map((stop) => {
                  const sType = stopTypes(stop);
                  return (
                    <div key={stop}
                      onMouseDown={(e) => { e.preventDefault(); setValue(stop); setSearch(stop); setOpen(false); }}
                      className={cn("relative flex w-full select-none items-center justify-between rounded-lg px-3 py-3 text-sm outline-none cursor-pointer transition-colors", itemHoverStyles[sType])}
                    >
                      <div className="flex items-center gap-2">
                        <Check className={cn("h-4 w-4 shrink-0 text-purple-600", value === stop ? "opacity-100" : "opacity-0")} />
                        <HighlightMatch text={stop} query={search} />
                      </div>
                      <span className={cn("text-xs px-2 py-1 rounded-full shrink-0 ml-2 font-medium", typeStyles[sType])}>
                        {stopHint(stop)}
                      </span>
                    </div>
                  );
                })}
              </div>
            </ScrollArea>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}


// ─── Route Badge (capsule) ──────────────────────────────────────

function RouteBadge({ leg }: { leg: Leg }) {
  const isMetro = leg.kind === 'metro';
  return (
    <span className={cn("inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold shadow-sm whitespace-nowrap", getLegBgClass(leg))}>
      {isMetro ? <TrainFront className="w-3.5 h-3.5" /> : <BusFront className="w-3.5 h-3.5" />}
      {leg.route}
    </span>
  );
}


// ─── Journey Card (search results) ─────────────────────────────

function JourneyCard({ journey, onClick }: { journey: Journey; onClick: () => void }) {
  const legs = journey.legs;
  const totalStops = legs.reduce((a, l) => a + l.stops.length - 1, 0) + 1;

  return (
    <Card
      className="overflow-hidden bg-white/80 dark:bg-zinc-950/80 backdrop-blur-sm border-zinc-200/50 dark:border-zinc-800/50 hover:shadow-lg hover:border-purple-300 dark:hover:border-purple-800 transition-all cursor-pointer active:scale-[0.98]"
      onClick={onClick}
    >
      <div className="p-4 flex justify-between items-center gap-4">
        <div className="flex flex-col gap-2.5 min-w-0">
          {/* Route badges */}
          <div className="flex flex-wrap items-center gap-2">
            {legs.map((l, i) => (
              <React.Fragment key={i}>
                {i > 0 && <span className="text-zinc-400 text-xs">→</span>}
                <RouteBadge leg={l} />
              </React.Fragment>
            ))}
          </div>
          {/* From → To */}
          <div className="text-sm text-muted-foreground truncate">
            {legs[0].displayFrom || legs[0].from} → {legs[legs.length - 1].displayTo || legs[legs.length - 1].to}
          </div>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <div className="text-right">
            <div className="text-sm font-semibold">~{totalStops} stops</div>
            <div className="text-xs text-muted-foreground">{legs.length} ride{legs.length > 1 ? 's' : ''}</div>
          </div>
          <ChevronRight className="w-5 h-5 text-zinc-400" />
        </div>
      </div>
    </Card>
  );
}


// ─── Route Group ────────────────────────────────────────────────

function RouteGroup({ title, subtitle, routes, onSelect }: { title: string; subtitle: string; routes: Journey[]; onSelect: (j: Journey) => void }) {
  if (!routes || routes.length === 0) return null;
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-baseline gap-2 px-1">
        <h3 className="font-semibold text-lg">{title}</h3>
        <span className="text-sm text-muted-foreground">{subtitle}</span>
      </div>
      <div className="flex flex-col gap-3">
        {routes.map((j, i) => (
          <JourneyCard key={i} journey={j} onClick={() => onSelect(j)} />
        ))}
      </div>
    </div>
  );
}


// ─── Route Detail Page ──────────────────────────────────────────

function RouteDetailPage({ journey, result, onBack }: { journey: Journey; result: FindResult; onBack: () => void }) {
  const legs = journey.legs;
  const totalStops = legs.reduce((a, l) => a + l.stops.length - 1, 0) + 1;

  return (
    <motion.div
      initial={{ opacity: 0, x: 40 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 40 }}
      transition={{ duration: 0.25, ease: 'easeOut' }}
      className="w-full max-w-xl mx-auto flex flex-col gap-5"
    >
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={onBack} className="shrink-0 rounded-full hover:bg-zinc-100 dark:hover:bg-zinc-900">
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div className="min-w-0">
          <h2 className="font-bold text-lg truncate">Route Details</h2>
          <p className="text-sm text-muted-foreground truncate">{result.origin} → {result.dest}</p>
        </div>
      </div>

      {/* Summary Card */}
      <Card className="p-4 bg-white/80 dark:bg-zinc-950/80 backdrop-blur-sm border-zinc-200/50 dark:border-zinc-800/50 overflow-visible">
        <div className="flex flex-wrap items-center gap-2 mb-3">
          {legs.map((l, i) => (
            <React.Fragment key={i}>
              {i > 0 && <span className="text-zinc-400 text-sm">→</span>}
              <RouteBadge leg={l} />
            </React.Fragment>
          ))}
        </div>
        <div className="flex gap-4 text-sm text-muted-foreground">
          <span>~{totalStops} stops</span>
          <span>•</span>
          <span>{legs.length} ride{legs.length > 1 ? 's' : ''}</span>
        </div>
      </Card>

      {/* Map */}
      <RouteMap result={{ ...result, direct: [journey], one: [], two: [] }} />

      {/* Leg-by-leg stop list */}
      <div className="flex flex-col gap-0">
        {legs.map((leg, legIdx) => (
          <div key={legIdx} className="flex flex-col">
            {/* Leg header */}
            <div className="flex items-center gap-3 px-3 py-3">
              <RouteBadge leg={leg} />
              <span className="text-xs text-muted-foreground">
                {leg.kind === 'metro' ? 'Metro' : leg.kind === 'government' ? 'Gov Bus' : leg.kind === 'mini' ? 'Mini Bus' : 'Pvt Bus'}
                {leg.towards ? ` • towards ${leg.towards}` : ''}
              </span>
            </div>

            {/* Stops */}
            <div className="ml-6 relative">
              {/* Vertical line */}
              <div className={cn("absolute left-[7px] top-3 bottom-3 w-[3px] rounded-full", getLegBorderClass(leg))} style={{ backgroundColor: getLegColor(leg), opacity: 0.3 }} />

              {leg.stops.map((stop, stopIdx) => {
                const isFirst = stopIdx === 0;
                const isLast = stopIdx === leg.stops.length - 1;
                const isTerminal = isFirst || isLast;

                return (
                  <div key={stopIdx} className="flex items-center gap-3 py-2 relative">
                    {/* Dot */}
                    <div className="relative z-10 flex items-center justify-center w-4 h-4 shrink-0">
                      {isTerminal ? (
                        <div className={cn("w-4 h-4 rounded-full border-[3px] bg-white dark:bg-zinc-950")} style={{ borderColor: getLegColor(leg) }} />
                      ) : (
                        <div className="w-2 h-2 rounded-full" style={{ backgroundColor: getLegColor(leg), opacity: 0.5 }} />
                      )}
                    </div>
                    {/* Stop name */}
                    <span className={cn("text-sm", isTerminal ? "font-semibold" : "text-muted-foreground")}>
                      {stop}
                    </span>
                    {/* Transfer badge */}
                    {isLast && legIdx < legs.length - 1 && (
                      <span className="ml-auto text-[10px] uppercase tracking-wider font-bold text-amber-600 dark:text-amber-400 bg-amber-100 dark:bg-amber-900/30 px-2 py-0.5 rounded-full">
                        Transfer
                      </span>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Transfer gap indicator */}
            {legIdx < legs.length - 1 && (
              <div className="ml-6 flex items-center gap-2 py-2 pl-[3px]">
                <div className="w-3 border-t-2 border-dashed border-amber-500" />
                <span className="text-[10px] uppercase text-amber-600 dark:text-amber-400 font-semibold tracking-wider">Change here</span>
              </div>
            )}
          </div>
        ))}
      </div>
    </motion.div>
  );
}


// ─── Main SearchForm ────────────────────────────────────────────

export default function SearchForm() {
  const [from, setFrom] = React.useState('');
  const [to, setTo] = React.useState('');
  const [result, setResult] = React.useState<FindResult | null>(null);
  const [selectedJourney, setSelectedJourney] = React.useState<Journey | null>(null);

  const handleSwap = () => { setFrom(to); setTo(from); };

  React.useEffect(() => {
    if (from && to) {
      setResult(findRoute(from, to));
      setSelectedJourney(null);
    } else {
      setResult(null);
      setSelectedJourney(null);
    }
  }, [from, to]);

  // ── Detail page ──
  if (selectedJourney && result) {
    return (
      <AnimatePresence mode="wait">
        <RouteDetailPage
          key="detail"
          journey={selectedJourney}
          result={result}
          onBack={() => setSelectedJourney(null)}
        />
      </AnimatePresence>
    );
  }

  // ── Search page ──
  return (
    <div className="w-full max-w-xl mx-auto flex flex-col gap-6">
      <Card className="p-4 bg-white/60 dark:bg-zinc-950/60 backdrop-blur-xl border-zinc-200/50 dark:border-zinc-800/50 shadow-xl shadow-zinc-200/20 dark:shadow-none overflow-visible">
        <div className="relative flex flex-col gap-3">
          <StopCombobox value={from} setValue={setFrom} placeholder="Where from?" />

          <div className="absolute left-[26px] top-[56px] bottom-[56px] w-[2px] bg-zinc-200 dark:bg-zinc-800 z-0 hidden sm:block" />

          <div className="flex justify-center -my-2 relative z-10">
            <Button
              variant="secondary"
              size="icon"
              className="rounded-full h-10 w-10 border-4 border-white dark:border-zinc-950 bg-zinc-100 dark:bg-zinc-900 hover:bg-zinc-200 dark:hover:bg-zinc-800 shadow-sm"
              onClick={handleSwap}
            >
              <ArrowDownUp className="h-4 w-4" />
            </Button>
          </div>

          <StopCombobox value={to} setValue={setTo} placeholder="Where to?" />
        </div>
      </Card>

      <AnimatePresence mode="wait">
        {result && (
          <motion.div
            key={`${from}-${to}`}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="flex flex-col gap-6"
          >
            {result.error ? (
              <div className="text-center p-8 text-muted-foreground">
                <p>Stop not recognised.</p>
                <p className="text-sm">Please choose both stands from the suggestions list.</p>
              </div>
            ) : result.direct.length === 0 && result.one.length === 0 && result.two.length === 0 ? (
              <div className="text-center p-8 text-muted-foreground">
                <p>No route found in this dataset.</p>
                <p className="text-sm">These two stands aren't connected within two changes in the loaded routes.</p>
              </div>
            ) : (
              <div className="flex flex-col gap-8">
                <RouteGroup title="Direct" subtitle="one bus ride" routes={result.direct} onSelect={setSelectedJourney} />
                <RouteGroup title="One change" subtitle="two rides" routes={result.one} onSelect={setSelectedJourney} />
                <RouteGroup title="Two changes" subtitle="three rides" routes={result.two} onSelect={setSelectedJourney} />
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
