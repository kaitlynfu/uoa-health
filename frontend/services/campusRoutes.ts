import type { GraphNode, Alignment } from './indoorNavigation';
import { decodeEnvironmentAlignment } from './environmentRecognition.ts';

export type CampusLeg = {
    floor:'G'|'1'; start_label:string; heading_label:string; transition:'stairs'|'elevator'|null;
    points:GraphNode[]; frame_id?:string; environment?:string; sha256?:string; captured?:boolean;
};
export type CampusRoute = {
    key:string; building:'303'; start:string; destination:string; accessible:boolean; include_gaps:boolean;
    revision:number; legs:CampusLeg[]; survey_gaps:string[]; platform?:string;
};
export type CampusSummary = Pick<CampusRoute,'key'|'start'|'destination'|'accessible'|'include_gaps'|'revision'>;
export type CampusCatalog = {
    starts:{code:string;name:string;floor:string}[]; destinations:{code:string;name:string}[]; published:CampusSummary[];
};
export async function campusRequest<T>(path:string,token:string,body?:unknown):Promise<T> {
    const controller=new AbortController(), timer=setTimeout(()=>controller.abort(),90000);
    try {
        const response=await fetch((process.env.EXPO_PUBLIC_API_URL??'http://127.0.0.1:8000')+'/navigation/campus/'+path,{
            method:body===undefined?'GET':'POST',signal:controller.signal,
            headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},
            ...(body===undefined?{}:{body:JSON.stringify(body)}),
        });
        if(!response.ok) {
            const error=await response.json().catch(()=>null);
            throw new Error(typeof error?.detail==='string'?error.detail:'Campus routes unavailable ('+response.status+'). Your draft is kept.');
        }
        return await response.json();
    } finally {clearTimeout(timer);}
}
export function validateCampusPoints(points:GraphNode[],seed:GraphNode[]) {
    if(!Array.isArray(points)||!seed.length||points.length<Math.min(2,seed.length)||points.length>100) throw new Error('Invalid waypoint count.');
    const ids=new Set<string>();
    for(const p of points) {
        if(!p||!Number.isFinite(p.x)||!Number.isFinite(p.y)||Math.abs(p.x)>200||Math.abs(p.y)>200||
            typeof p.id!=='string'||!p.id||p.id.length>100||ids.has(p.id)||typeof p.label!=='string'||!p.label||p.label.length>120)
            throw new Error('Invalid campus waypoint.');
        ids.add(p.id);
    }
    if(points[0].id!==seed[0].id||points[0].x!==0||points[0].y!==0||points.at(-1)!.id!==seed.at(-1)!.id)
        throw new Error('Keep the fixed start and floor endpoint.');
    if(points.some((p,i)=>i>0&&Math.hypot(p.x-points[i-1].x,p.y-points[i-1].y)<.1))
        throw new Error('Waypoints must be at least 10 cm apart.');
    return points;
}
export function campusBinding(route:CampusRoute,leg:CampusLeg) {
    return {version:1,building:'303',route_key:route.key,floor:leg.floor,frame_id:leg.frame_id,points:leg.points};
}
export function recogniseCampus(event:{alignment?:number[];timestamp?:number;routes?:string},route:CampusRoute,leg:CampusLeg,
    pose:{timestamp:number;received:number}|null,now:number):Alignment|null {
    const alignment=decodeEnvironmentAlignment(event.alignment);
    if(!alignment||!pose||!Number.isFinite(event.timestamp)||now<pose.received||now-pose.received>500||
        Math.abs(pose.timestamp-event.timestamp!)>.2) return null;
    const data=JSON.parse(event.routes??'null'), wanted=campusBinding(route,leg);
    if(!data||data.version!==1||data.building!=='303'||data.route_key!==wanted.route_key||
        data.floor!==wanted.floor||data.frame_id!==wanted.frame_id||
        !Array.isArray(data.points)||data.points.length!==leg.points.length||
        data.points.some((p:GraphNode,i:number)=>p.id!==leg.points[i].id||p.label!==leg.points[i].label||p.x!==leg.points[i].x||p.y!==leg.points[i].y))
        throw new Error('Wrong floor or route recording. End and download this publication again.');
    return alignment;
}
export function validateCampusRoute(route:CampusRoute) {
    if(route?.building!=='303'||!/^\w{24}$/.test(route.key)||!Number.isInteger(route.revision)||route.revision<0||
        !Array.isArray(route.legs)||!route.legs.length||route.legs.length>3) throw new Error('Invalid campus route package.');
    for(const leg of route.legs) {
        if(!['G','1'].includes(leg.floor)) throw new Error('Unsupported floor.');
        validateCampusPoints(leg.points,leg.points);
    }
    return route;
}
