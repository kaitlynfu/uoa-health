import {
    Career,
    PersonalisedRecommendation,
    PersonalisedRecommendationRequest,
    Programme,
    ProgrammeRecommendation,
    ProgrammeStats,
} from "../types/programme";
import {
    NavigationDestination,
    NavigationRoute,
} from "../types/wayfinding";

const API_BASE_URL =
    process.env.EXPO_PUBLIC_API_URL ?? "http://127.0.0.1:8000";


async function wayfindingRequest<T>(path: string): Promise<T> {
    const response = await fetch(`${API_BASE_URL}${path}`);
    if (!response.ok) {
        let detail = `Request failed (${response.status})`;
        try {
            const body = await response.json();
            if (typeof body.detail === "string") {
                detail = body.detail;
            }
        } catch {
            // Keep the status-based message when the response is not JSON.
        }
        throw new Error(detail);
    }
    return response.json();
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
    const response = await fetch(`${API_BASE_URL}/programmes`);

    if (!response.ok) {
        throw new Error(`Failed to fetch programmes: ${response.status}`);
    }

    return response.json();
}


export async function getProgramme(
    id: number
): Promise<Programme> {
    const response = await fetch(
        `${API_BASE_URL}/programmes/${id}`
    );

    if (!response.ok) {
        throw new Error(`Failed to fetch programme: ${response.status}`);
    }

    return response.json();
}


export async function searchProgrammes(
    query: string
): Promise<Programme[]> {
    const response = await fetch(
        `${API_BASE_URL}/programmes/search?q=${encodeURIComponent(query)}`
    );

    if (!response.ok) {
        throw new Error(`Failed to search programmes: ${response.status}`);
    }

    return response.json();
}


export async function getProgrammeStats(): Promise<ProgrammeStats> {
    const response = await fetch(
        `${API_BASE_URL}/programmes/stats`
    );

    if (!response.ok) {
        throw new Error(
            `Failed to fetch programme stats: ${response.status}`
        );
    }

    return response.json();
}


export async function recommendProgrammes(
    query: string,
    limit: number = 5
): Promise<ProgrammeRecommendation[]> {
    const response = await fetch(
        `${API_BASE_URL}/programmes/recommend?q=${encodeURIComponent(
            query
        )}&limit=${limit}`
    );

    if (!response.ok) {
        throw new Error(
            `Failed to fetch recommendations: ${response.status}`
        );
    }

    return response.json();
}


export async function getPersonalisedRecommendations(
    request: PersonalisedRecommendationRequest
): Promise<PersonalisedRecommendation[]> {
    const response = await fetch(
        `${API_BASE_URL}/programmes/recommend/personalised`,
        {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                interests: request.interests,
                career_goals: request.career_goals,
                limit: request.limit ?? 3,
            }),
        }
    );

    if (!response.ok) {
        throw new Error(
            `Failed to fetch personalised recommendations: ${response.status}`
        );
    }

    return response.json();
}

export async function getCareers(
): Promise<Career[]> {
    const response = await fetch(
        `${API_BASE_URL}/careers`
    );

    if (!response.ok) {
        throw new Error(`Failed to fetch careers: ${response.status}`);
    }

    return response.json();
}

export async function searchCareers(
    query: string
): Promise<Career[]> {
    const response = await fetch(
        `${API_BASE_URL}/careers/search?q=${encodeURIComponent(query)}`
    );

    if (!response.ok) {
        throw new Error(`Failed to search careers: ${response.status}`);
    }

    return response.json();
}