export type CheckpointKind = "location" | "test";

export type WayfindingCheckpoint = {
    kind: CheckpointKind;
    code: string;
    rawValue: string;
};

export type WayfindingDestination = {
    code: string;
    name: string;
    shortName: string;
    floor: string;
    building: string;
    category: "lecture" | "room" | "lab" | "facility";
    accessible: boolean;
    popular?: boolean;
};

export type NavigationLocation = {
    id: number;
    campus_id: number;
    building_id: number | null;
    floor_id: number | null;
    code: string;
    name: string;
    location_type: string;
    description: string | null;
    latitude: number | null;
    longitude: number | null;
    x: number | null;
    y: number | null;
    accessible: boolean;
    verified: boolean;
};

export type NavigationDestination = {
    id: number;
    building_id: number;
    floor_id: number;
    code: string;
    name: string;
    category: string;
    accessible: boolean;
    verified: boolean;
    building_number: string;
    floor_label: string;
    doors: NavigationLocation[];
};

export type NavigationRouteStep = {
    from_location: NavigationLocation;
    to_location: NavigationLocation;
    instruction: string;
    distance_m: number;
};

export type NavigationRoute = {
    start: NavigationLocation;
    destination: NavigationDestination;
    arrival_door: NavigationLocation;
    accessible_only: boolean;
    total_distance_m: number;
    estimated_minutes: number;
    locations: NavigationLocation[];
    steps: NavigationRouteStep[];
    data_notice: string;
};

export function toDisplayDestination(
    destination: NavigationDestination
): WayfindingDestination {
    const category: WayfindingDestination["category"] =
        destination.category === "lab" ? "lab" : "room";
    return {
        code: destination.code,
        name: destination.name,
        shortName: destination.code,
        floor: destination.floor_label,
        building: `Science Centre • Building ${destination.building_number}`,
        category,
        accessible: destination.accessible,
        popular: destination.code === "303-103" || destination.code === "303-104",
    };
}

const LOCATION_URI_PREFIX = "wayfinder://location/";
const LOCATION_CODE_PATTERN = /^[A-Z0-9]+(?:-[A-Z0-9]+)+$/;

function normaliseLocationCode(value: string): string {
    return value.trim().toUpperCase().replaceAll("_", "-");
}

/**
 * Accepts both the final wayfinder URI and bare checkpoint codes used while
 * printing/testing QR labels. Underscore codes from the original proposal are
 * normalised to the hyphenated format used by the backend seed data.
 */
export function parseWayfindingQr(value: string): WayfindingCheckpoint | null {
    const rawValue = value.trim();
    if (!rawValue) {
        return null;
    }

    if (rawValue.toUpperCase() === "TEST_START") {
        return { kind: "test", code: "TEST_START", rawValue };
    }

    let candidate = rawValue;
    if (rawValue.toLowerCase().startsWith(LOCATION_URI_PREFIX)) {
        candidate = rawValue.slice(LOCATION_URI_PREFIX.length);
        try {
            candidate = decodeURIComponent(candidate);
        } catch {
            return null;
        }
    }

    const code = normaliseLocationCode(candidate);
    if (!LOCATION_CODE_PATTERN.test(code)) {
        return null;
    }

    return { kind: "location", code, rawValue };
}
