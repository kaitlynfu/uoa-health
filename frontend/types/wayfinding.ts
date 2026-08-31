export type CheckpointKind = "location" | "test";

export type WayfindingCheckpoint = {
    kind: CheckpointKind;
    code: string;
    rawValue: string;
};

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
