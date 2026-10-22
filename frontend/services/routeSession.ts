import { alignAtStart, segmentDistance, type GraphNode, type Point } from './indoorNavigation.ts';

export function roomSaveStatus(s: {saving:boolean; aligned:boolean; world:boolean; busy:boolean; routeError:boolean; ready:boolean; mapped:boolean}) {
    if(s.saving) return 'Saving room…';
    if(!s.aligned) return s.world?'Cannot save: waiting for room recognition':'Cannot save: align at HOME START first';
    if(s.busy) return 'Cannot save: route operation in progress';
    if(s.routeError) return 'Cannot save: saved route data needs attention';
    if(!s.ready) return 'Cannot save: waiting for reliable tracking';
    if(!s.mapped) return 'Recording: look around the surroundings slowly';
    return 'Save room recording';
}

export function manualTestAlignment(matrix: number[], measuredPhoneHeight: number) {
    if (!Number.isFinite(measuredPhoneHeight) || measuredPhoneHeight < .2 || measuredPhoneHeight > 2.5) return null;
    const alignment = alignAtStart(matrix);
    return alignment ? {...alignment, height: matrix[13] - measuredPhoneHeight + .15} : null;
}

/** Joining a route never moves its geometry to the user's current position. */
export function routeJoinIndex(route: GraphNode[], position: Point, tolerance = .8): number {
    let best = Infinity, index = 0;
    for (let i=1; i<route.length; i++) {
        const distance = segmentDistance(position, route[i-1], route[i]);
        if (distance < best) { best=distance; index=i; }
    }
    // Off-route: return to the configured start, never invent a shortcut.
    return best <= tolerance ? index : 0;
}

export function canReuseAlignment(aligned: boolean, active: boolean, tracking: string, received: number | undefined, now: number) {
    return aligned && active && tracking === 'normal' && received !== undefined && now >= received && now-received < 700;
}
