import type {
    PersonalisedRecommendation,
    PersonalisedRecommendationRequest,
    Programme,
    ProgrammeRecommendation,
    ProgrammeStats,
} from "../types/programme";
export { getCareers, searchCareers } from './careerAdapter.ts';
import type {
    BuildingRoute,
    NavigationBuilding,
    NavigationDestination,
    NavigationRoute,
} from "../types/wayfinding";
import { studentRequest } from './studentApi.ts';

async function wayfindingRequest<T>(path: string): Promise<T> {
    return studentRequest<T>(path);
}


export async function getNavigationDestinations(
    query: string = ""
): Promise<NavigationDestination[]> {
    const parameters = new URLSearchParams({ building: "303" });
    if (query.trim()) {
        parameters.set("q", query.trim());
    }
    return wayfindingRequest<NavigationDestination[]>(
        `/navigation/destinations?${parameters.toString()}`
    );
}


export async function getNavigationRoute(
    startCode: string,
    destinationCode: string,
    accessibleOnly: boolean = false
): Promise<NavigationRoute> {
    const parameters = new URLSearchParams({
        start: startCode,
        destination: destinationCode,
        accessible_only: String(accessibleOnly),
    });
    return wayfindingRequest<NavigationRoute>(
        `/navigation/route?${parameters.toString()}`
    );
}


export async function getProgrammes(): Promise<Programme[]> {
    return studentRequest<Programme[]>('/programmes');
}


export async function getProgramme(
    id: number
): Promise<Programme> {
    return studentRequest<Programme>(`/programmes/${id}`);
}


export async function searchProgrammes(
    query: string
): Promise<Programme[]> {
    return studentRequest<Programme[]>(`/programmes/search?q=${encodeURIComponent(query)}`);
}


export async function getProgrammeStats(): Promise<ProgrammeStats> {
    return studentRequest<ProgrammeStats>('/programmes/stats');
}


export async function recommendProgrammes(
    query: string,
    limit: number = 5
): Promise<ProgrammeRecommendation[]> {
    return studentRequest<ProgrammeRecommendation[]>(`/programmes/recommend?q=${encodeURIComponent(query)}&limit=${limit}`);
}


export async function getPersonalisedRecommendations(
    request: PersonalisedRecommendationRequest
): Promise<PersonalisedRecommendation[]> {
    return studentRequest<PersonalisedRecommendation[]>('/programmes/recommend/personalised', undefined, 'POST', {
        interests: request.interests, career_goals: request.career_goals, limit: request.limit ?? 3,
    });
}


export async function getNavigationBuildings(
    query: string = ""
): Promise<NavigationBuilding[]> {
    const parameters = new URLSearchParams();
    if (query.trim()) {
        parameters.set("q", query.trim());
    }
    const suffix = parameters.toString() ? `?${parameters.toString()}` : "";
    return wayfindingRequest<NavigationBuilding[]>(`/navigation/buildings${suffix}`);
}


export async function getBuildingRoute(
    fromBuildingId: number,
    toBuildingId: number,
    accessibleOnly: boolean = false
): Promise<BuildingRoute> {
    const parameters = new URLSearchParams({
        from: String(fromBuildingId),
        to: String(toBuildingId),
        accessible_only: String(accessibleOnly),
    });
    return wayfindingRequest<BuildingRoute>(
        `/navigation/building-route?${parameters.toString()}`
    );
}
