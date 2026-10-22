import type { Alignment } from './indoorNavigation';

export const HOME_MARKER_ID = 'home-start-v1';
export type MarkerObservation = { name: string; transform: number[]; timestamp: number };
export type MarkerCandidate = { alignment: Alignment; since: number; last: number; samples: number };

// Floor image centre is map (0,0), printed top (-image Z) points map +Y.
// The image's +Y normal must point up. Camera position/heading are NOT inputs.
export function alignmentFromMarker(observation: MarkerObservation): Alignment | null {
    const m = observation.transform;
    if (observation.name !== HOME_MARKER_ID || !Number.isFinite(observation.timestamp) ||
        m.length !== 16 || !m.every(Number.isFinite)) return null;
    const dot = (a: number,b: number) => m[a]*m[b]+m[a+1]*m[b+1]+m[a+2]*m[b+2];
    if ([0,4,8].some(i => Math.abs(dot(i,i)-1)>0.03) ||
        Math.abs(dot(0,4))>0.03 || Math.abs(dot(0,8))>0.03 || Math.abs(dot(4,8))>0.03 ||
        m[5]<0.97 || Math.abs(m[3])+Math.abs(m[7])+Math.abs(m[11])>0.001 || Math.abs(m[15]-1)>0.001) return null;
    const determinant = m[0]*(m[5]*m[10]-m[6]*m[9])-m[4]*(m[1]*m[10]-m[2]*m[9])+m[8]*(m[1]*m[6]-m[2]*m[5]);
    if (determinant < 0.97) return null;
    const horizontal = Math.hypot(m[8],m[10]);
    return { x:m[12],z:m[14],height:m[13]+0.15,fx:-m[8]/horizontal,fz:-m[10]/horizontal };
}

// Require several fresh, mutually consistent observations; never accept a single hit.
export function observeMarker(candidate: MarkerCandidate | null, observation: MarkerObservation) {
    const alignment = alignmentFromMarker(observation);
    if (!alignment) return { candidate:null, alignment:null };
    const t = observation.timestamp;
    const old = candidate?.alignment;
    const consistent = candidate && t>candidate.last && t-candidate.last<=0.3 && old &&
        Math.hypot(old.x-alignment.x,old.z-alignment.z,old.height-alignment.height)<=0.04 &&
        old.fx*alignment.fx+old.fz*alignment.fz>=Math.cos(3*Math.PI/180);
    const next: MarkerCandidate = consistent
        ? {...candidate,last:t,samples:candidate.samples+1}
        : {alignment,since:t,last:t,samples:1};
    return { candidate:next, alignment:next.samples>=6 && t-next.since>=0.8 ? next.alignment : null };
}
