'use client';

import * as React from 'react';
import { Check, ArrowDownUp, MapPin, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { sortedSearchNames, stopHint, findRoute, FindResult } from '@/lib/routing';
import { motion, AnimatePresence } from 'framer-motion';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';

function StopCombobox({ value, setValue, placeholder }: { value: string, setValue: (v: string) => void, placeholder: string }) {
  const [open, setOpen] = React.useState(false);
  const [search, setSearch] = React.useState(value);
  const inputRef = React.useRef<HTMLInputElement>(null);
  
  React.useEffect(() => {
    setSearch(value);
  }, [value]);

  const filtered = React.useMemo(() => {
    if (!search) return sortedSearchNames.slice(0, 50);
    const lower = search.toLowerCase();
    return sortedSearchNames.filter(s => s.toLowerCase().includes(lower)).slice(0, 50);
  }, [search]);

  return (
    <div className="relative w-full">
      <div 
        className={cn(
          "flex w-full items-center rounded-md h-14 px-4 text-base font-normal bg-background/50 backdrop-blur-sm border border-zinc-200 dark:border-zinc-800 shadow-sm transition-all focus-within:ring-1 focus-within:ring-ring",
          open ? "ring-1 ring-ring" : ""
        )}
      >
        <MapPin className="h-4 w-4 text-zinc-500 shrink-0 mr-2" />
        <input
          ref={inputRef}
          type="text"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setOpen(true);
            if (e.target.value === '') setValue('');
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 200)}
          placeholder={placeholder}
          className="flex-1 bg-transparent border-none outline-none text-base placeholder:text-muted-foreground w-full h-full"
        />
        {search && (
          <button 
            type="button"
            onClick={() => { setSearch(''); setValue(''); inputRef.current?.focus(); }}
            className="p-1 rounded-full hover:bg-zinc-200 dark:hover:bg-zinc-800 text-zinc-500 transition-colors"
          >
            <X className="h-4 w-4 shrink-0 opacity-70" />
          </button>
        )}
      </div>
      
      <AnimatePresence>
        {open && filtered.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -5 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -5 }}
            transition={{ duration: 0.15 }}
            className="absolute top-[calc(100%+8px)] left-0 right-0 z-50 rounded-md border border-zinc-200 dark:border-zinc-800 bg-popover text-popover-foreground shadow-md outline-none overflow-hidden"
          >
            <ScrollArea className="h-[300px]">
              <div className="p-1">
                {filtered.map((stop) => (
                  <div
                    key={stop}
                    onClick={() => {
                      setValue(stop);
                      setSearch(stop);
                      setOpen(false);
                    }}
                    className="relative flex w-full select-none items-center justify-between rounded-sm px-2 py-3 text-sm outline-none hover:bg-accent hover:text-accent-foreground cursor-pointer transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      <Check
                        className={cn(
                          "h-4 w-4 shrink-0 text-primary",
                          value === stop ? "opacity-100" : "opacity-0"
                        )}
                      />
                      <span className="truncate">{stop}</span>
                    </div>
                    <span className="text-xs text-muted-foreground bg-zinc-100 dark:bg-zinc-800 px-2 py-1 rounded-full shrink-0 ml-2">
                      {stopHint(stop)}
                    </span>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function SearchForm() {
  const [from, setFrom] = React.useState('');
  const [to, setTo] = React.useState('');
  const [result, setResult] = React.useState<FindResult | null>(null);

  const handleSwap = () => {
    setFrom(to);
    setTo(from);
  };

  const handleSearch = () => {
    if (from && to) {
      setResult(findRoute(from, to));
    }
  };

  React.useEffect(() => {
    if (from && to) {
      handleSearch();
    }
  }, [from, to]);

  return (
    <div className="w-full max-w-xl mx-auto flex flex-col gap-6">
      <Card className="p-4 bg-white/60 dark:bg-zinc-950/60 backdrop-blur-xl border-zinc-200/50 dark:border-zinc-800/50 shadow-xl shadow-zinc-200/20 dark:shadow-none">
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
                <RouteGroup title="Direct" subtitle="one bus ride" routes={result.direct} />
                <RouteGroup title="One change" subtitle="two rides" routes={result.one} />
                <RouteGroup title="Two changes" subtitle="three rides" routes={result.two} />
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function RouteGroup({ title, subtitle, routes }: { title: string, subtitle: string, routes: any[] }) {
  if (!routes || routes.length === 0) return null;
  
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-baseline gap-2 px-2">
        <h3 className="font-semibold text-lg">{title}</h3>
        <span className="text-sm text-muted-foreground">{subtitle}</span>
      </div>
      <div className="flex flex-col gap-3">
        {routes.map((j, i) => (
          <JourneyCard key={i} journey={j} />
        ))}
      </div>
    </div>
  );
}

function JourneyCard({ journey }: { journey: any }) {
  const legs = journey.legs;
  const totalStops = legs.reduce((a: number, l: any) => a + l.stops.length - 1, 0) + 1;
  const isMetro = (l: any) => l.kind === 'metro';
  
  return (
    <Card className="overflow-hidden bg-white/80 dark:bg-zinc-950/80 backdrop-blur-sm border-zinc-200/50 dark:border-zinc-800/50 hover:shadow-md transition-shadow">
      <div className="p-4 bg-zinc-50/50 dark:bg-zinc-900/50 border-b border-zinc-100 dark:border-zinc-800 flex justify-between items-center gap-4">
        <div className="flex flex-wrap items-center gap-2">
          {legs.map((l: any, i: number) => (
            <React.Fragment key={i}>
              {i > 0 && <span className="text-zinc-400">›</span>}
              <Badge variant={isMetro(l) ? "default" : "secondary"} className={cn(isMetro(l) ? "bg-purple-600 hover:bg-purple-700" : "")}>
                {l.route} {isMetro(l) ? '(Metro)' : ''}
              </Badge>
            </React.Fragment>
          ))}
        </div>
        <div className="text-right shrink-0">
          <div className="text-sm font-medium">~{totalStops} stops</div>
          <div className="text-xs text-muted-foreground">{legs.length} ride{legs.length > 1 ? 's' : ''}</div>
        </div>
      </div>
      <div className="p-4 flex flex-col gap-4">
        {legs.map((l: any, i: number) => (
          <div key={i} className="relative pl-6">
            <div className={cn("absolute left-0 top-1 bottom-0 w-0.5", isMetro(l) ? "bg-purple-500" : "bg-zinc-200 dark:bg-zinc-700")} />
            <div className={cn("absolute left-[-3px] top-1.5 w-2 h-2 rounded-full", isMetro(l) ? "bg-purple-600" : "bg-zinc-400 dark:bg-zinc-500")} />
            {i === legs.length - 1 && (
              <div className={cn("absolute left-[-3px] bottom-0 w-2 h-2 rounded-full", isMetro(l) ? "bg-purple-600" : "bg-zinc-400 dark:bg-zinc-500")} />
            )}
            
            <div className="flex flex-col gap-1 pb-4">
              <div className="font-medium text-sm flex gap-2">
                <span>{l.displayFrom || l.from}</span>
                <span className="text-muted-foreground">→</span>
                <span>{l.displayTo || l.to}</span>
              </div>
              <div className="text-xs text-muted-foreground">
                {l.stops.length} stops • {l.kind === 'government' ? 'Gov' : l.kind === 'mini' ? 'Mini' : 'Pvt'} service {l.towards ? `• towards ${l.towards}` : ''}
              </div>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}
