import type { GraphNode, Point } from './indoorNavigation';

export type SavedRoutes = Record<string, GraphNode[]>;
export const ROUTE_STORAGE_KEY = 'home-routes-marker-v1';
const validPoint = (p: Point) => Number.isFinite(p.x) && Number.isFinite(p.y) && Math.abs(p.x)<=30 && Math.abs(p.y)<=30;
export function validateRoute(route: GraphNode[], generated: GraphNode[]) {
    if (!Array.isArray(route) || route.length<2 || route.length>100 || !generated.length) throw new Error('Route must contain 2–100 waypoints.');
    const ids = new Set<string>();
    for (const p of route) {
        if (!p || !validPoint(p) || typeof p.id!=='string' || !p.id || p.id.length>100 ||
            typeof p.label!=='string' || !p.label || p.label.length>120 || ids.has(p.id)) throw new Error('Invalid waypoint data.');
        ids.add(p.id);
    }
    const start=route[0], end=route.at(-1)!;
    if(start.id!==generated[0].id || start.x!==generated[0].x || start.y!==generated[0].y ||
        end.id!==generated.at(-1)!.id) throw new Error('Keep the fixed marker start and destination identity.');
    for(let i=1;i<route.length;i++) if(Math.hypot(route[i].x-route[i-1].x,route[i].y-route[i-1].y)<0.1)
        throw new Error('Neighbouring waypoints must be at least 10 cm apart.');
    return route;
}
export function moveWaypoint(route: GraphNode[], index: number, p: Point) {
    if(index<=0 || index>=route.length || !validPoint(p)) return route;
    return route.map((n,i)=>i===index ? {...n,x:p.x,y:p.y} : n);
}
export function insertWaypoint(route: GraphNode[], selected: number, p: Point, id: string) {
    if(!validPoint(p) || route.length>=100 || route.some(n=>n.id===id)) return route;
    const after=Math.max(0,Math.min(selected,route.length-2));
    return [...route.slice(0,after+1),{id,label:'Custom waypoint',x:p.x,y:p.y},...route.slice(after+1)];
}
export function deleteWaypoint(route: GraphNode[], index: number) {
    return index<=0 || index>=route.length-1 ? route : route.filter((_,i)=>i!==index);
}
// Map has image-down Y; physical right relative to forward is (-fy, fx).
export function nudgePoint(p: Point, forward: Point, right: number, ahead: number): Point {
    const length=Math.hypot(forward.x,forward.y);
    if(length<0.2) return p;
    const fx=forward.x/length,fy=forward.y/length;
    return {x:p.x-fy*right+fx*ahead,y:p.y+fx*right+fy*ahead};
}
export function decodeRoutes(raw: string | null, generated: SavedRoutes): SavedRoutes {
    if(!raw) return {};
    if(raw.length>200_000) throw new Error('Saved routes are too large.');
    const data=JSON.parse(raw);
    if(data?.version!==1 || data?.marker!=='home-start-v1' || !data.routes || typeof data.routes!=='object' || Array.isArray(data.routes))
        throw new Error('Saved routes have an incompatible format.');
    const result: SavedRoutes={};
    for(const [id,route] of Object.entries(data.routes)) {
        if(!Object.hasOwn(generated,id)) throw new Error('Unknown saved destination.');
        result[id]=validateRoute(route as GraphNode[],generated[id]);
    }
    return result;
}
export function encodeRoutes(routes: SavedRoutes, generated: SavedRoutes) {
    const raw=JSON.stringify({version:1,marker:'home-start-v1',routes});
    decodeRoutes(raw,generated);
    return raw;
}
