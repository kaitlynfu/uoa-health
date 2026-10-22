import type { NavigationRoute } from '../types/wayfinding';
import type { GraphNode } from './indoorNavigation';

/** A surveyed floor-image placement, not the phone's starting pose. */
export type BuildingMarkerPlacement = {
    markerId: string;
    checkpointCode: string;
    floorId: number;
    x: number;
    z: number;
    forwardX: number;
    forwardZ: number;
    physicalWidthM: number;
    verified: boolean;
};

/** Each 303 floor has an independent metric GLB frame. Never bridge them in AR. */
export function buildingArRoute(route: NavigationRoute, placement: BuildingMarkerPlacement): GraphNode[] {
    if (route.destination.building_number !== '303' || !placement.markerId.startsWith('303-') ||
        placement.checkpointCode !== route.start.code || placement.floorId !== route.start.floor_id)
        throw new Error('The AR marker must belong to this Building 303 checkpoint and floor.');
    if (!placement.verified) throw new Error('This marker placement needs an on-site position and orientation check.');
    if (![placement.x, placement.z, placement.forwardX, placement.forwardZ, placement.physicalWidthM].every(Number.isFinite) ||
        placement.physicalWidthM <= 0 || placement.physicalWidthM > 1 ||
        Math.abs(Math.hypot(placement.forwardX, placement.forwardZ) - 1) > 0.001)
        throw new Error('Invalid marker dimensions or orientation.');
    if (route.locations.length < 2 || route.locations[0].id !== route.start.id ||
        route.locations.at(-1)?.id !== route.arrival_door.id)
        throw new Error('The route is missing its start or arrival door.');
    if (route.start.x !== placement.x || route.start.y !== placement.z)
        throw new Error('The fixed marker must be centred on the configured checkpoint.');
    if (route.locations.some(p => p.floor_id !== placement.floorId || p.building_id !== route.start.building_id))
        throw new Error('AR requires a fresh floor marker after changing floors. Use existing step guidance for this route.');
    const ids = new Set<string>();
    return route.locations.map(p => {
        if (p.x === null || p.y === null || !Number.isFinite(p.x) || !Number.isFinite(p.y) || ids.has(p.code))
            throw new Error('The route contains missing coordinates or repeated checkpoints.');
        ids.add(p.code);
        const dx = p.x - placement.x, dz = p.y - placement.z;
        // Same handedness as the home marker frame; no arbitrary scaling.
        return {id:p.code,label:p.name,x:placement.forwardZ*dx-placement.forwardX*dz,
            y:placement.forwardX*dx+placement.forwardZ*dz};
    });
}
