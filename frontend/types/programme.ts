export interface Programme {
    id: number;
    name: string;
    faculty: string | null;
    description: string | null;
    duration: string | null;
    entry_requirements: string | null;
    career_pathways: string | null;
    programme_url: string | null;
    image_url: string | null;
}

export interface ProgrammeStats {
    total_programmes: number;
    programmes_with_descriptions: number;
    programmes_with_career_pathways: number;
    programmes_with_entry_requirements: number;
}

export interface ProgrammeRecommendation extends Programme {
    match_score: number;
    matched_keywords: string[];
}

export interface PersonalisedRecommendationRequest {
    interests: string[];
    career_goals: string[];
    limit?: number;
}

export interface PersonalisedRecommendation extends Programme {
    match_score: number;
    matched_interests: string[];
    matched_career_goals: string[];
    reason: string;
}