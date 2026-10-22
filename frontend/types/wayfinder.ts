// Frontend-only types for the Wayfinder feature. Kept separate from
// types/programme.ts since none of this comes from the backend (yet).

export type TransportMode = "walk" | "bicycle" | "bus" | "car";

export interface RouteStop {
    label: string;
    duration: string | null;
}

export interface EtaSummary {
    arrivalWindow: string;
    stops: RouteStop[];
}
