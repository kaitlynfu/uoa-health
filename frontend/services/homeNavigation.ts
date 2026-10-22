// Deterministic shortcuts: no invented progress, recommendations or random route.
export function homeNextStep(authenticated: boolean, savedProgrammes: number, savedCareers: number) {
    if (authenticated && savedProgrammes > 0) return {
        route: 'Saves' as const, tab: 'Programmes' as const,
        title: 'Revisit saved programmes', description: 'Pick up where your exploration left off.',
    };
    if (authenticated && savedCareers > 0) return {
        route: 'Saves' as const, tab: 'Careers' as const,
        title: 'Revisit saved careers', description: 'Keep exploring the pathways you saved.',
    };
    if (authenticated) return {
        route: 'Recommendations' as const, tab: undefined,
        title: 'Find ideas for you', description: 'Explore suggestions based on your interests.',
    };
    return {
        route: 'Programmes' as const, tab: undefined,
        title: 'Explore programmes', description: 'Browse degrees, requirements and career pathways.',
    };
}

// Compass angles start at north and increase clockwise. Dragging only previews
// a direction; an explicit feature-button tap performs navigation.
export function compassDirectionIndex(angle: number): number | null {
    if (!Number.isFinite(angle)) return null;
    return Math.round((((angle % 360) + 360) % 360) / 90) % 4;
}

// Reserve the label, icon and glow before sizing the stage. A fixed stage
// height let the north label collide with the dial on wider/shorter windows.
export function compassHomeLayout(width: number, usableHeight: number, fontScale = 1) {
    const pageWidth = Math.min(width, 640);
    const horizontalPadding = pageWidth < 360 ? 16 : 22;
    const compassSize = Math.min(Math.max(pageWidth * 0.6, 215), 265);
    const featureAreaWidth = Math.min(pageWidth - horizontalPadding * 2, 390);
    const featureCircleSize = pageWidth < 360 ? 54 : 58;
    const openedCompassSize = Math.min(compassSize * 0.7, featureAreaWidth - 180, usableHeight < 760 ? 140 : 190);
    const labelScale = Math.min(Math.max(fontScale, 1), 2);
    const labelHeight = Math.ceil(17 * labelScale * (labelScale > 1.3 ? 2 : 1));
    const featureStackHeight = featureCircleSize + 7 + labelHeight;
    const edgeInset = 8;
    const dialGlow = 7;
    const clearance = 12;
    const openedHeight = Math.ceil(openedCompassSize + 2 * (edgeInset + featureStackHeight + dialGlow + clearance));
    return { horizontalPadding, compassSize, featureAreaWidth, featureCircleSize, openedCompassSize, openedHeight, featureStackHeight, edgeInset, dialGlow, clearance };
}
