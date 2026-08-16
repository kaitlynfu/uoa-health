import {
    PersonalisedRecommendation,
    PersonalisedRecommendationRequest,
    Programme,
    ProgrammeRecommendation,
    ProgrammeStats,
} from "../types/programme";

const API_BASE_URL =
    process.env.EXPO_PUBLIC_API_URL ?? "http://127.0.0.1:8000";


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