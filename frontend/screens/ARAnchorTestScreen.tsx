import { useEffect, useRef, useState } from "react";
import { useIsFocused } from "@react-navigation/native";
import {
    ExpoArView,
    getCapabilities,
    type ArViewHandle,
    type TrackingState,
} from "@stewmore/expo-ar";
import {
    ActivityIndicator,
    Pressable,
    SafeAreaView,
    StyleSheet,
    Text,
    View,
} from "react-native";

const trackingLabels: Record<TrackingState, string> = {
    initializing: "Starting",
    limited: "Limited",
    normal: "Ready",
    unavailable: "Unavailable",
};

function distanceFromOrigin(transform: number[]) {
    if (transform.length !== 16) {
        return null;
    }
    return Math.hypot(transform[12], transform[13], transform[14]);
}

export default function ARAnchorTestScreen() {
    const arViewRef = useRef<ArViewHandle>(null);
    const isFocused = useIsFocused();
    const [capabilities] = useState(() => getCapabilities());
    const [tracking, setTracking] = useState<TrackingState>("initializing");
    const [anchorId, setAnchorId] = useState<string | null>(null);
    const [placementDistance, setPlacementDistance] = useState<number | null>(null);
    const [placing, setPlacing] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const view = arViewRef.current;
        if (!view) {
            return;
        }

        if (isFocused) {
            void view.resume();
        } else {
            void view.pause();
        }
    }, [isFocused]);

    async function placeCube(x: number, y: number) {
        const view = arViewRef.current;
        if (!view || placing) {
            return;
        }
        if (tracking !== "normal") {
            setError("Wait until tracking says Ready, then try again.");
            return;
        }
        if (anchorId) {
            setError("Reset the test before placing another cube.");
            return;
        }
        if (!view.attachModel) {
            setError("This development build does not include AR object rendering.");
            return;
        }

        setPlacing(true);
        setError(null);
        let newAnchorId: string | null = null;

        try {
            const anchor = await view.addAnchor(x, y);
            if (!anchor) {
                setError("No surface found. Pan slowly, then tap a textured wall or floor.");
                return;
            }

            newAnchorId = anchor.id;
            await view.attachModel(anchor.id, "builtin:cube");
            const anchors = await view.listAnchors();
            const placedAnchor = anchors.find((item) => item.id === anchor.id);
            setAnchorId(anchor.id);
            setPlacementDistance(
                placedAnchor ? distanceFromOrigin(placedAnchor.transform) : null
            );
        } catch (placementError) {
            if (newAnchorId) {
                await view.removeAnchor(newAnchorId).catch(() => undefined);
            }
            setError(
                placementError instanceof Error
                    ? placementError.message
                    : "The cube could not be placed."
            );
        } finally {
            setPlacing(false);
        }
    }

    async function resetTest() {
        const view = arViewRef.current;
        if (!view) {
            return;
        }

        setPlacing(true);
        setError(null);
        try {
            if (anchorId && view.detachModel) {
                await view.detachModel(anchorId);
            }
            await view.reset();
            setAnchorId(null);
            setPlacementDistance(null);
            setTracking("initializing");
        } catch (resetError) {
            setError(
                resetError instanceof Error
                    ? resetError.message
                    : "The AR session could not be reset."
            );
        } finally {
            setPlacing(false);
        }
    }

    if (!capabilities.arSupported) {
        return (
            <SafeAreaView style={styles.unsupportedPage}>
                <View style={styles.unsupportedCard}>
                    <Text style={styles.unsupportedTitle}>AR is not available</Text>
                    <Text style={styles.unsupportedText}>
                        Open this test in the development build on a physical ARKit-compatible iPhone.
                    </Text>
                </View>
            </SafeAreaView>
        );
    }

    const instruction = anchorId
        ? `Cube anchored${placementDistance === null ? "" : ` about ${placementDistance.toFixed(1)} m from the start`}. Walk sideways and back while watching it.`
        : "Stand about 2 m from a textured wall or floor. Pan slowly, then tap near the crosshair.";

    return (
        <View style={styles.container}>
            <ExpoArView
                ref={arViewRef}
                style={StyleSheet.absoluteFill}
                planeDetection="both"
                depthEnabled={capabilities.depthOrLidarAvailable}
                debug
                onTrackingStateChange={(event) => {
                    setTracking(event.nativeEvent.state);
                    if (event.nativeEvent.state === "normal") {
                        setError(null);
                    }
                }}
                onTap={(event) => {
                    void placeCube(event.nativeEvent.x, event.nativeEvent.y);
                }}
                onError={(event) => setError(event.nativeEvent.message)}
            />

            <SafeAreaView style={styles.overlay} pointerEvents="box-none">
                <View style={styles.statusCard}>
                    <View style={styles.statusRow}>
                        <View
                            style={[
                                styles.statusDot,
                                tracking === "normal" && styles.statusDotReady,
                            ]}
                        />
                        <Text style={styles.statusLabel}>TRACKING</Text>
                        <Text style={styles.statusValue}>{trackingLabels[tracking]}</Text>
                    </View>
                    <Text style={styles.instruction}>{instruction}</Text>
                    {error ? <Text style={styles.errorText}>{error}</Text> : null}
                </View>

                {!anchorId ? (
                    <View style={styles.crosshair} pointerEvents="none">
                        <View style={styles.crosshairHorizontal} />
                        <View style={styles.crosshairVertical} />
                    </View>
                ) : null}

                <View style={styles.bottomArea} pointerEvents="box-none">
                    {placing ? (
                        <View style={styles.placingBadge}>
                            <ActivityIndicator color="#ffffff" size="small" />
                            <Text style={styles.placingText}>Updating AR scene…</Text>
                        </View>
                    ) : null}
                    {anchorId ? (
                        <Pressable
                            accessibilityRole="button"
                            onPress={() => void resetTest()}
                            style={({ pressed }) => [
                                styles.resetButton,
                                pressed && styles.pressed,
                            ]}
                        >
                            <Text style={styles.resetButtonText}>Reset and place again</Text>
                        </Pressable>
                    ) : (
                        <Text style={styles.tapHint}>Tap the camera view to place the teal cube</Text>
                    )}
                </View>
            </SafeAreaView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: "#06131d" },
    overlay: { flex: 1, justifyContent: "space-between", padding: 16 },
    statusCard: { padding: 15, borderRadius: 16, backgroundColor: "rgba(4, 20, 31, 0.88)" },
    statusRow: { flexDirection: "row", alignItems: "center" },
    statusDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: "#f6c344" },
    statusDotReady: { backgroundColor: "#35d39a" },
    statusLabel: { marginLeft: 8, color: "#b8cbd8", fontSize: 10, fontWeight: "900", letterSpacing: 1 },
    statusValue: { marginLeft: "auto", color: "#ffffff", fontSize: 13, fontWeight: "900" },
    instruction: { marginTop: 9, color: "#ffffff", fontSize: 14, lineHeight: 20 },
    errorText: { marginTop: 8, color: "#ffd29b", fontSize: 13, lineHeight: 18 },
    crosshair: { position: "absolute", top: "50%", left: "50%", width: 44, height: 44, marginTop: -22, marginLeft: -22 },
    crosshairHorizontal: { position: "absolute", top: 21, left: 0, width: 44, height: 2, backgroundColor: "#ffffff" },
    crosshairVertical: { position: "absolute", top: 0, left: 21, width: 2, height: 44, backgroundColor: "#ffffff" },
    bottomArea: { alignItems: "center", gap: 10 },
    placingBadge: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 13, paddingVertical: 9, borderRadius: 999, backgroundColor: "rgba(4, 20, 31, 0.86)" },
    placingText: { color: "#ffffff", fontSize: 12, fontWeight: "700" },
    tapHint: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: 999, overflow: "hidden", color: "#ffffff", backgroundColor: "rgba(4, 20, 31, 0.86)", fontSize: 13, fontWeight: "800", textAlign: "center" },
    resetButton: { paddingHorizontal: 18, paddingVertical: 13, borderRadius: 13, backgroundColor: "#087f5b" },
    resetButtonText: { color: "#ffffff", fontSize: 14, fontWeight: "900" },
    pressed: { opacity: 0.75 },
    unsupportedPage: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24, backgroundColor: "#f4f7fa" },
    unsupportedCard: { width: "100%", maxWidth: 440, padding: 26, borderRadius: 20, backgroundColor: "#ffffff" },
    unsupportedTitle: { color: "#102a43", fontSize: 24, fontWeight: "900", textAlign: "center" },
    unsupportedText: { marginTop: 9, color: "#526d82", fontSize: 15, lineHeight: 22, textAlign: "center" },
});
