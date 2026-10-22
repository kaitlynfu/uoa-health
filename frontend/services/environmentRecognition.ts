import type { Alignment, GraphNode, Point } from './indoorNavigation';
import {decodeRoutes, type SavedRoutes} from './routeEditor.ts';

export function recognisedAlignment(event: {alignment?:number[];timestamp?:number;sessionID?:string;routes?:string},
    frame: {timestamp:number;received:number} | null, generated:SavedRoutes, destination:string, now:number): Alignment | null {
    const a=decodeEnvironmentAlignment(event.alignment);
    if(!a || !frame || !Number.isFinite(now) || !Number.isFinite(event.timestamp) ||
        !Number.isFinite(frame.timestamp) || !Number.isFinite(frame.received) || now<frame.received ||
        now-frame.received>500 || Math.abs(frame.timestamp-event.timestamp!)>.2) return null;
    if(!event.sessionID || !event.routes) throw new Error('Missing room coordinate frame');
    const snapshot=decodeRoutes(event.routes,generated);
    if(!snapshot[destination]) throw new Error('Destination missing from room coordinate frame');
    // Validate the archive without returning its route snapshot: the caller keeps
    // the current published route fetched from the API, not this older geometry.
    return a;
}

export function decodeEnvironmentAlignment(values: number[] | undefined): Alignment | null {
    if(!Array.isArray(values) || values.length!==5 || !values.every(Number.isFinite) ||
        Math.abs(Math.hypot(values[3],values[4])-1)>0.02) return null;
    return {x:values[0],z:values[1],height:values[2],fx:values[3],fz:values[4]};
}

// Joining a known route is separate from recognising the room. Only join a nearby
// segment; a far-off/ambiguous user must return to the start, not get a wall shortcut.
export function routeJoinIndex(route: GraphNode[], p: Point) {
    if(!Number.isFinite(p.x) || !Number.isFinite(p.y)) return 0;
    let best=Infinity, target=0;
    const candidates:{index:number;distance:number}[]=[];
    for(let i=1;i<route.length;i++) {
        const a=route[i-1],b=route[i],dx=b.x-a.x,dy=b.y-a.y;
        const length=dx*dx+dy*dy;
        const t=length ? Math.max(0,Math.min(1,((p.x-a.x)*dx+(p.y-a.y)*dy)/length)) : 0;
        const d=Math.hypot(p.x-a.x-t*dx,p.y-a.y-t*dy);
        candidates.push({index:i,distance:d});
        if(d<best) {best=d;target=i;}
    }
    // Nearby non-adjacent segments could be a crossing/parallel corridor. Don't
    // silently skip a loop or choose a different corridor on weak proximity alone.
    const ambiguous=candidates.some(c=>Math.abs(c.index-target)>1 && c.distance<=0.6 && c.distance-best<0.15);
    return best<=0.6 && !ambiguous ? target : 0;
}
