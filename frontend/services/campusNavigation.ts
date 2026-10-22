// Helpers for building-to-building directions. Kept free of React Native
// imports so they can be unit tested with plain Node.

export type TravelMode = "walk" | "transit" | "drive";

type DirectionsRequest = {
    platform: string;
    // null starts from the phone's current location.
    origin: string | null;
    destination: string;
    mode: TravelMode;
};

const APPLE_MODES: Record<TravelMode, string> = { walk: "w", transit: "r", drive: "d" };
const GOOGLE_MODES: Record<TravelMode, string> = { walk: "walking", transit: "transit", drive: "driving" };

// Apple Maps on iPhone, Google Maps everywhere else (Android and web).
export function mapsDirectionsUrl({ platform, origin, destination, mode }: DirectionsRequest): string {
    if (platform === "ios") {
        const parameters = new URLSearchParams({ daddr: destination, dirflg: APPLE_MODES[mode] });
        if (origin) parameters.set("saddr", origin);
        return `https://maps.apple.com/?${parameters.toString()}`;
    }
    const parameters = new URLSearchParams({ api: "1", destination, travelmode: GOOGLE_MODES[mode] });
    if (origin) parameters.set("origin", origin);
    return `https://www.google.com/maps/dir/?${parameters.toString()}`;
}

export function formatDistance(metres: number): string {
    if (metres < 1000) return `${Math.max(10, Math.round(metres / 10) * 10)} m`;
    return `${(metres / 1000).toFixed(1)} km`;
}

export function formatDuration(minutes: number): string {
    if (minutes < 60) return `${Math.max(1, minutes)} min`;
    const hours = Math.floor(minutes / 60);
    const rest = minutes % 60;
    return rest ? `${hours} hr ${rest} min` : `${hours} hr`;
}
