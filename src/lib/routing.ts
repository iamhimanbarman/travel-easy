import busdata from '@/data/busdata.json';

export interface Route {
  code: string;
  kind: string;
  stops: string[];
  scope: string;
  directional: boolean;
  towards: string;
}

export interface StopData {
  name: string;
  lat: number | null;
  lng: number | null;
  routes: number;
}

export interface BusData {
  routes: Route[];
  stops?: StopData[];
  aliases?: Record<string, string>;
}

const data = busdata as BusData;

// Graph construction
const routes = data.routes;
const routeSet = routes.map((r) => new Set(r.stops));
const stopRoutes: Record<string, number[]> = {};

routes.forEach((r, i) => {
  new Set(r.stops).forEach((s) => {
    if (!stopRoutes[s]) stopRoutes[s] = [];
    stopRoutes[s].push(i);
  });
});

const routeAdj = routes.map(() => new Set<number>());

Object.values(stopRoutes).forEach((rs) => {
  for (let a = 0; a < rs.length; a++) {
    for (let b = a + 1; b < rs.length; b++) {
      routeAdj[rs[a]].add(rs[b]);
      routeAdj[rs[b]].add(rs[a]);
    }
  }
});

const coord: Record<string, [number, number]> = {};
if (data.stops) {
    data.stops.forEach((s) => {
    if (s.lat != null && s.lng != null) coord[s.name] = [s.lat, s.lng];
    });
}
const stopNames = data.stops ? data.stops.map((s) => s.name) : Array.from(new Set(routes.flatMap((r) => r.stops)));
const stopAliases = data.aliases || {};
const cleanStopKey = (v: string) => String(v).toLowerCase().replace(/\s+/g, ' ').trim();
const stopLookup: Record<string, string> = {};

stopNames.forEach((s) => {
  stopLookup[cleanStopKey(s)] = s;
});

Object.entries(stopAliases).forEach(([alias, target]) => {
  if (stopRoutes[target]) stopLookup[cleanStopKey(alias)] = target;
});

export function resolveStopName(value: string) {
  const raw = String(value).trim();
  return stopLookup[cleanStopKey(raw)] || raw;
}

export function getStopCoord(name: string): [number, number] | null {
  const resolved = resolveStopName(name);
  return coord[resolved] || null;
}

export const sortedSearchNames = Array.from(
  new Set([...stopNames, ...Object.keys(stopAliases).filter((alias) => stopRoutes[stopAliases[alias]])])
).sort((a, b) => a.localeCompare(b));

export function stopHint(name: string) {
  const target = resolveStopName(name);
  const n = stopRoutes[target] ? stopRoutes[target].length : 0;
  return `${n} route${n !== 1 ? 's' : ''}`;
}

export interface Leg {
  route: string;
  kind: string;
  scope: string;
  from: string;
  to: string;
  stops: string[];
  towards: string;
  displayFrom?: string;
  displayTo?: string;
}

export interface Journey {
  legs: Leg[];
  cost: number;
}

export interface FindResult {
  origin: string;
  dest: string;
  direct: Journey[];
  one: Journey[];
  two: Journey[];
  error?: boolean;
}

const idx = (r: number, s: string) => routes[r].stops.indexOf(s);
const isDirectionalRoute = (r: number) => routes[r].directional === true;

function canTravel(r: number, a: string, b: string) {
  const i = idx(r, a),
    j = idx(r, b);
  if (i < 0 || j < 0) return false;
  return !isDirectionalRoute(r) || i <= j;
}

function hopCost(r: number, a: string, b: string) {
  if (!canTravel(r, a, b)) return Infinity;
  const i = idx(r, a),
    j = idx(r, b);
  return isDirectionalRoute(r) ? j - i : Math.abs(i - j);
}

function seg(r: number, a: string, b: string) {
  const i = idx(r, a),
    j = idx(r, b),
    st = routes[r].stops;
  if (i < 0 || j < 0) return [];
  if (isDirectionalRoute(r) && i > j) return [];
  return i <= j ? st.slice(i, j + 1) : st.slice(j, i + 1).reverse();
}

function shared(r1: number, r2: number) {
  const out: string[] = [];
  routeSet[r1].forEach((s) => {
    if (routeSet[r2].has(s)) out.push(s);
  });
  return out;
}

function bestTransfer(r1: number, r2: number, o: string, d: string): [string | null, number] {
  let best: string | null = null,
    bc = 1e9;
  shared(r1, r2).forEach((t) => {
    if (!canTravel(r1, o, t) || !canTravel(r2, t, d)) return;
    const c = hopCost(r1, o, t) + hopCost(r2, t, d);
    if (c < bc) {
      best = t;
      bc = c;
    }
  });
  return [best, bc];
}

function leg(r: number, a: string, b: string): Leg {
  return {
    route: routes[r].code,
    kind: routes[r].kind,
    scope: routes[r].scope || 'local',
    from: a,
    to: b,
    stops: seg(r, a, b),
    towards: routes[r].towards || '',
  };
}

function routeHasMetro(r: number) {
  return routes[r].kind === 'metro';
}

function routeScopeCost(r: number) {
  if (routeHasMetro(r)) return 0;
  if (routes[r].scope === 'regional') return 3;
  return 1;
}

function routeOrder(a: number, b: number, o: string, d: string) {
  if (routeHasMetro(a) !== routeHasMetro(b)) return routeHasMetro(a) ? -1 : 1;
  if (routeScopeCost(a) !== routeScopeCost(b)) return routeScopeCost(a) - routeScopeCost(b);
  return hopCost(a, o, d) - hopCost(b, o, d);
}

function candOrder(a: any, b: any) {
  if (a.metro !== b.metro) return a.metro ? -1 : 1;
  if ((a.metroLegs || 0) !== (b.metroLegs || 0)) return (b.metroLegs || 0) - (a.metroLegs || 0);
  if ((a.scope || 0) !== (b.scope || 0)) return (a.scope || 0) - (b.scope || 0);
  return a.cost - b.cost;
}

export function findRoute(oRaw: string, dRaw: string): FindResult {
  const o = resolveStopName(oRaw);
  const d = resolveStopName(dRaw);
  const res: FindResult = { origin: o, dest: d, direct: [], one: [], two: [] };
  if (!stopRoutes[o] || !stopRoutes[d]) {
    res.error = true;
    return res;
  }
  const start = stopRoutes[o],
    end = new Set(stopRoutes[d]);

  // direct
  start
    .filter((r) => end.has(r) && canTravel(r, o, d))
    .sort((a, b) => routeOrder(a, b, o, d))
    .forEach((r) => res.direct.push({ legs: [leg(r, o, d)], cost: hopCost(r, o, d) }));

  // one transfer
  const seen = new Set<string>();
  const c1: any[] = [];
  start.forEach((r1) => {
    routeAdj[r1].forEach((r2) => {
      if (r1 === r2 || !end.has(r2)) return;
      const [t, cost] = bestTransfer(r1, r2, o, d);
      if (t == null || t === o || t === d) return;
      const key = `${r1}|${r2}|${t}`;
      if (seen.has(key)) return;
      seen.add(key);
      c1.push({
        cost,
        r1,
        r2,
        t,
        scope: routeScopeCost(r1) + routeScopeCost(r2),
        metro: routeHasMetro(r1) || routeHasMetro(r2),
        metroLegs: (routeHasMetro(r1) ? 1 : 0) + (routeHasMetro(r2) ? 1 : 0),
      });
    });
  });
  c1.sort(candOrder)
    .slice(0, 10)
    .forEach((x) => {
      res.one.push({ legs: [leg(x.r1, o, x.t), leg(x.r2, x.t, d)], cost: x.cost });
    });

  // two transfers
  if (res.direct.length + res.one.length < 3) {
    const seen2 = new Set<string>();
    const c2: any[] = [];
    start.forEach((r1) => {
      stopRoutes[d].forEach((r3) => {
        if (r3 === r1) return;
        routeAdj[r1].forEach((r2) => {
          if (r2 === r1 || r2 === r3 || !routeAdj[r3].has(r2)) return;
          if (end.has(r2) || start.includes(r2)) return;
          const key = r1 + '|' + r2 + '|' + r3;
          if (seen2.has(key)) return;
          const s12 = shared(r1, r2),
            s23 = shared(r2, r3);
          let bt: [string, string] | null = null,
            bc = 1e9;
          s12.forEach((a) =>
            s23.forEach((b) => {
              if (new Set([o, a, b, d]).size < 4) return;
              if (!canTravel(r1, o, a) || !canTravel(r2, a, b) || !canTravel(r3, b, d)) return;
              const cc = hopCost(r1, o, a) + hopCost(r2, a, b) + hopCost(r3, b, d);
              if (cc < bc) {
                bc = cc;
                bt = [a, b];
              }
            })
          );
          if (!bt) return;
          seen2.add(key);
          c2.push({
            cost: bc,
            r1,
            r2,
            r3,
            a: bt[0],
            b: bt[1],
            scope: routeScopeCost(r1) + routeScopeCost(r2) + routeScopeCost(r3),
            metro: routeHasMetro(r1) || routeHasMetro(r2) || routeHasMetro(r3),
            metroLegs: (routeHasMetro(r1) ? 1 : 0) + (routeHasMetro(r2) ? 1 : 0) + (routeHasMetro(r3) ? 1 : 0),
          });
        });
      });
    });
    c2.sort(candOrder)
      .slice(0, 6)
      .forEach((x) => {
        res.two.push({ legs: [leg(x.r1, o, x.a), leg(x.r2, x.a, x.b), leg(x.r3, x.b, d)], cost: x.cost });
      });
  }
  
  return applyEndpointLabels(res, oRaw, dRaw);
}

function applyEndpointLabels(res: FindResult, fromRaw: string, toRaw: string) {
  if (res.error) return res;
  const fromLabel = cleanStopKey(fromRaw) !== cleanStopKey(res.origin) ? fromRaw : res.origin;
  const toLabel = cleanStopKey(toRaw) !== cleanStopKey(res.dest) ? toRaw : res.dest;
  [...res.direct, ...res.one, ...res.two].forEach((j) => {
    if (j.legs[0]) j.legs[0].displayFrom = fromLabel;
    const last = j.legs[j.legs.length - 1];
    if (last) last.displayTo = toLabel;
  });
  return res;
}
