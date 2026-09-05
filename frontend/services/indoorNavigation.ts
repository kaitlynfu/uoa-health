// Pure geometry shared by the home demo and future building route adapters.
export type Point = { x: number; y: number };
export type GraphNode = Point & { id: string; label: string };
export type Graph = { nodes: GraphNode[]; edges: [string, string][] };
export type Alignment = { x: number; z: number; height: number; fx: number; fz: number };

export const distance = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y);

export function shortestPath(graph: Graph, start: string, end: string): GraphNode[] {
    const nodes = new Map(graph.nodes.map(n => [n.id, n]));
    if (!nodes.has(start) || !nodes.has(end)) return [];
    const costs = new Map<string, number>([[start, 0]]);
    const previous = new Map<string, string>();
    const pending = new Set(nodes.keys());
    while (pending.size) {
        const current = [...pending].reduce((a, b) =>
            (costs.get(a) ?? Infinity) <= (costs.get(b) ?? Infinity) ? a : b);
        if (!Number.isFinite(costs.get(current))) break;
        pending.delete(current);
        if (current === end) {
            const result = [nodes.get(current)!];
            let cursor = current;
            while (previous.has(cursor)) {
                cursor = previous.get(cursor)!;
                result.unshift(nodes.get(cursor)!);
            }
            return result;
        }
        for (const [a, b] of graph.edges) {
            const next = a === current ? b : b === current ? a : null;
            if (!next || !pending.has(next) || !nodes.has(next)) continue;
            const cost = costs.get(current)! + distance(nodes.get(current)!, nodes.get(next)!);
            if (cost < (costs.get(next) ?? Infinity)) {
                costs.set(next, cost);
                previous.set(next, current);
            }
        }
    }
    return [];
}

export function routeLength(route: Point[]) {
    return route.slice(1).reduce((sum, p, i) => sum + distance(route[i], p), 0);
}

// ARKit poses are column-major; camera looks along its negative Z axis.
// Map +X = right on the plan; map +Y = down the plan (the agreed starting heading).
export function alignAtStart(matrix: number[]): Alignment | null {
    if (matrix.length !== 16 || !matrix.every(Number.isFinite)) return null;
    const horizontal = Math.hypot(matrix[8], matrix[10]);
    if (horizontal < 0.65) return null; // Do not calibrate while pointing at the floor.
    return { x: matrix[12], z: matrix[14], height: matrix[13] - 0.9,
        fx: -matrix[8] / horizontal, fz: -matrix[10] / horizontal };
}

export function mapToWorld(point: Point, alignment: Alignment) {
    const { x, z, height, fx, fz } = alignment;
    return { x: x - fz * point.x + fx * point.y, y: height,
        z: z + fx * point.x + fz * point.y };
}

export function worldToMap(x: number, z: number, a: Alignment): Point {
    const dx = x - a.x, dz = z - a.z;
    return { x: -a.fz * dx + a.fx * dz, y: a.fx * dx + a.fz * dz };
}

export function segmentDistance(p: Point, a: Point, b: Point) {
    const dx = b.x - a.x, dy = b.y - a.y;
    const lengthSquared = dx * dx + dy * dy;
    const t = lengthSquared ? Math.max(0, Math.min(1,
        ((p.x - a.x) * dx + (p.y - a.y) * dy) / lengthSquared)) : 0;
    return distance(p, { x: a.x + t * dx, y: a.y + t * dy });
}

export function progressAt(route: Point[], index: number, position: Point) {
    if (!route.length || index >= route.length) return { next: 0, remaining: 0, offRoute: 0 };
    const next = distance(position, route[index]);
    return { next, remaining: next + routeLength(route.slice(index)),
        offRoute: segmentDistance(position, route[Math.max(0, index - 1)], route[index]) };
}

export function relativeBearing(position: Point, target: Point, forward: Point) {
    const dx = target.x - position.x, dy = target.y - position.y;
    // Positive angles are to the right on the floor plan.
    return Math.atan2(forward.y * dx - forward.x * dy, forward.x * dx + forward.y * dy);
}

export function arrivalDwell(nearSince: number | null, timestamp: number, nextDistance: number,
    trackingValid: boolean): { nearSince: number | null; reached: boolean } {
    if (!trackingValid || !Number.isFinite(timestamp) || !Number.isFinite(nextDistance) ||
        nextDistance < 0 || nextDistance > 0.45) return { nearSince: null, reached: false };
    const since = nearSince !== null && nearSince <= timestamp ? nearSince : timestamp;
    const reached = timestamp - since >= 0.3;
    return { nearSince: reached ? null : since, reached };
}

export function turnAt(route: Point[], index: number): string {
    if (index >= route.length - 1) return "Destination ahead";
    const a = route[Math.max(0, index - 1)], b = route[index], c = route[index + 1];
    const angle = relativeBearing(b, c, { x: b.x - a.x, y: b.y - a.y });
    if (Math.abs(angle) < Math.PI / 6) return "Continue straight";
    if (Math.abs(angle) > Math.PI * 5 / 6) return "Turn around";
    return angle > 0 ? "Then turn right" : "Then turn left";
}
