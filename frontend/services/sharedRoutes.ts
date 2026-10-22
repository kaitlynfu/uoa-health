import type { GraphNode } from './indoorNavigation';
import { validateRoute } from './routeEditor.ts';

export type SharedRoute = { destination: string; marker: string; revision: number; points: GraphNode[] | null };
export async function routeRequest<T>(path: string, token?: string, body?: unknown): Promise<T> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);
    try {
        const response = await fetch((process.env.EXPO_PUBLIC_API_URL ?? 'http://127.0.0.1:8000') + '/navigation/' + path, {
            method: body === undefined ? 'GET' : 'POST', signal: controller.signal,
            headers: { ...(token ? { Authorization: 'Bearer ' + token } : {}), 'Content-Type': 'application/json' },
            ...(body === undefined ? {} : { body: JSON.stringify(body) }),
        });
        if (!response.ok) {
            if (response.status === 409) throw new Error('Someone published a newer route. Keep your local draft, then start a new session to review the latest version.');
            if (response.status === 401 || response.status === 403) throw new Error('Sign in with an authorised route-editor account.');
            throw new Error('Shared routes unavailable (' + response.status + '). Your local draft is unchanged.');
        }
        return await response.json();
    } finally { clearTimeout(timeout); }
}
export function checkedSharedRoute(value: SharedRoute, destination: string, generated: GraphNode[]) {
    if (value.destination !== destination || value.marker !== 'home-start-v1' || !Number.isInteger(value.revision) || value.revision < 0 ||
        (value.revision === 0 ? value.points !== null : !value.points)) throw new Error('Incompatible shared route.');
    return value.points ? validateRoute(value.points, generated) : generated;
}
