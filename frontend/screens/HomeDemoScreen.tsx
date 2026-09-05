import { useEffect, useRef, useState } from "react";
import { useIsFocused } from "@react-navigation/native";
import { AppState, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View } from "react-native";
import HomeRouteMap from "../components/HomeRouteMap";
import { homeDestinations, homeGraph } from "../data/homeDemo";
import { HomeArView, homeArAvailable, type PoseEvent } from "../modules/wayfinder-ar";
import { alignAtStart, arrivalDwell, distance, mapToWorld, progressAt, relativeBearing, routeLength,
    shortestPath, turnAt, waypointYaw, worldToMap, type Alignment, type Point } from "../services/indoorNavigation";

export default function HomeDemoScreen() {
    const focused = useIsFocused();
    const [foreground, setForeground] = useState(AppState.currentState === "active");
    const [destination, setDestination] = useState("living");
    const [cameraOpen, setCameraOpen] = useState(false);
    const [tracking, setTracking] = useState("initializing");
    const [notice, setNotice] = useState("Stand at the red X before starting.");
    const [alignment, setAlignment] = useState<Alignment | null>(null);
    const [position, setPosition] = useState<Point | null>(null);
    const [forward, setForward] = useState<Point>({ x: 0, y: 1 });
    const [index, setIndex] = useState(1);
    const [arrived, setArrived] = useState(false);
    const [showMap, setShowMap] = useState(false);
    const lastPose = useRef<{ matrix: number[]; received: number; timestamp: number } | null>(null);
    const previousPosition = useRef<Point | null>(null);
    const nearSince = useRef<number | null>(null);
    const alignmentRef = useRef<Alignment | null>(null);
    const route = shortestPath(homeGraph, "start", destination);
    const active = focused && foreground && cameraOpen;

    function clearAlignment(message: string) {
        alignmentRef.current = null;
        setAlignment(null);
        setPosition(null);
        previousPosition.current = null;
        nearSince.current = null;
        setNotice(message);
    }

    useEffect(() => {
        const listener = AppState.addEventListener("change", state => {
            setForeground(state === "active");
            if (state !== "active") clearAlignment("Session paused. Return to X and align again.");
        });
        return () => listener.remove();
    }, []);

    useEffect(() => {
        if (!focused) {
            clearAlignment("Return to X and align again.");
            setCameraOpen(false);
            lastPose.current = null;
        }
    }, [focused]);

    useEffect(() => {
        if (!active) return;
        const timer = setInterval(() => {
            if (alignmentRef.current && (!lastPose.current || Date.now() - lastPose.current.received > 1500)) {
                clearAlignment("Camera tracking stopped. Return to X and align again.");
                setTracking("stale");
            }
        }, 500);
        return () => clearInterval(timer);
    }, [active]);

    function receivePose(event: PoseEvent) {
        if (!active) return;
        const { transform: matrix, timestamp } = event.nativeEvent;
        if (matrix.length !== 16 || !matrix.every(Number.isFinite) || !Number.isFinite(timestamp)) return;
        if (lastPose.current && timestamp <= lastPose.current.timestamp) {
            clearAlignment("AR origin changed. Return to X and align again.");
        }
        lastPose.current = { matrix, timestamp, received: Date.now() };
        const a = alignmentRef.current;
        if (!a || arrived || tracking !== "normal") return;
        const p = worldToMap(matrix[12], matrix[14], a);
        if (previousPosition.current && distance(previousPosition.current, p) > 0.9) {
            clearAlignment("Tracking position jumped. Return to X and align again.");
            return;
        }
        previousPosition.current = p;
        setPosition(p);
        setForward({ x: -a.fz * matrix[8] + a.fx * matrix[10],
            y: -a.fx * matrix[8] - a.fz * matrix[10] });
        const progress = progressAt(route, index, p);
        const arrival = arrivalDwell(nearSince.current, timestamp, progress.next, progress.offRoute < 0.8);
        nearSince.current = arrival.nearSince;
        if (arrival.reached) advance();
    }

    function advance() {
        nearSince.current = null;
        if (index >= route.length - 1) setArrived(true);
        else setIndex(i => i + 1);
    }

    function calibrate() {
        const frame = lastPose.current;
        if (tracking !== "normal" || !frame || Date.now() - frame.received > 700) {
            setNotice("Wait for fresh tracking before aligning.");
            return;
        }
        const a = alignAtStart(frame.matrix);
        if (!a) {
            setNotice("Hold the phone upright and face down the plan along the clear aisle, with the bed on your left.");
            return;
        }
        alignmentRef.current = a;
        setAlignment(a);
        setPosition({ x: 0, y: 0 });
        previousPosition.current = { x: 0, y: 0 };
        nearSince.current = null;
        setForward({ x: 0, y: 1 });
        setIndex(1);
        setArrived(false);
        setNotice("Follow the blue arrow. Distances are estimated from the mapped route.");
    }

    const progress = position ? progressAt(route, index, position) : null;
    const offRoute = (progress?.offRoute ?? 0) > 0.9;
    const canNavigate = active && alignment && tracking === "normal" && !arrived;
    const waypoint: number[] = [];
    if (canNavigate && !offRoute && route[index]) {
        const target = mapToWorld(route[index], alignment);
        const previous = route[Math.max(0, index - 1)];
        waypoint.push(target.x, target.y, target.z, waypointYaw(previous, route[index], alignment));
    }
    const angle = position && route[index] ? relativeBearing(position, route[index], forward) : 0;
    const facingHint = Math.abs(angle) > 2.3 ? "Turn around to find the waypoint" :
        Math.abs(angle) > 0.55 ? (angle > 0 ? "Look right for the waypoint" : "Look left for the waypoint") : "Waypoint ahead";

    if (!cameraOpen) return <SafeAreaView style={styles.page}>
        <ScrollView contentContainerStyle={styles.setup}>
            <Text style={styles.title}>Home route demo</Text>
            <Text style={styles.copy}>Start: the new red X in the clear aisle on the left of the Bedroom 1 plan, away from the desk. Choose where to go.</Text>
            <HomeRouteMap route={route} />
            {homeDestinations.map(item => {
                const length = routeLength(shortestPath(homeGraph, "start", item.id));
                return <Pressable key={item.id} accessibilityRole="button"
                    accessibilityState={{ selected: destination === item.id }}
                    onPress={() => setDestination(item.id)} style={[styles.destination, destination === item.id && styles.selected]}>
                    <Text style={styles.destinationName}>{item.label}</Text>
                    <Text style={styles.copy}>About {length.toFixed(1)} m</Text>
                </Pressable>;
            })}
            <Text style={styles.copy}>Draft routes follow the floor-plan scale and visible openings. Check each route is clear before walking. The arrow floats above the route; it does not detect furniture or lock itself to the floor.</Text>
            <Text style={styles.copy}>Stand at X and face down the plan along the clear aisle. The bed should be on your left and the outer wall on your right. Hold the phone upright. The first waypoint is about 1.1 m straight ahead, not beside the desk.</Text>
            {!homeArAvailable && <Text style={styles.warning}>This demo needs a new iPhone build containing the home navigation module. Route previews work here, but live AR is unavailable in this build.</Text>}
            <Pressable accessibilityRole="button" disabled={!homeArAvailable || !route.length}
                style={[styles.button, !homeArAvailable && styles.disabled]} onPress={() => {
                    clearAlignment("Stand at X and face down the plan, along the left side of the bed.");
                    lastPose.current = null;
                    setTracking("initializing");
                    setArrived(false);
                    setCameraOpen(true);
                }}><Text style={styles.buttonText}>Open camera and align at X</Text></Pressable>
        </ScrollView>
    </SafeAreaView>;

    return <View style={styles.cameraPage}>
        {HomeArView && active && <HomeArView style={StyleSheet.absoluteFill} active={active}
            waypoint={waypoint} onPose={receivePose} onStatus={({ nativeEvent }) => {
                setTracking(nativeEvent.state);
                if (nativeEvent.state !== "normal") {
                    clearAlignment(nativeEvent.message + " Return to X before aligning again.");
                } else if (!alignmentRef.current) setNotice("Tracking ready. Stand at X, face down the plan and confirm alignment.");
            }} />}
        <SafeAreaView style={styles.overlay} pointerEvents="box-none">
            <View style={styles.card}>
                <Text style={styles.whiteTitle}>{arrived ? "You've arrived" : route.at(-1)?.label}</Text>
                <Text style={styles.whiteCopy}>{arrived ? "Route completed" : alignment && progress ?
                    `About ${progress.remaining.toFixed(1)} m remaining · waypoint ${index}/${route.length - 1}` : "Starting point: Bedroom 1 · red X"}</Text>
                <Text style={styles.whiteCopy}>Tracking: {tracking === "normal" ? "Ready" : tracking}</Text>
            </View>
            <View style={styles.bottom} pointerEvents="box-none">
                {showMap && <HomeRouteMap route={route} position={position} />}
                <View style={styles.card}>
                    {!alignment ? <>
                        <Text style={styles.whiteCopy}>{notice}</Text>
                        <Pressable accessibilityRole="button" style={[styles.button, tracking !== "normal" && styles.disabled]}
                            disabled={tracking !== "normal"} onPress={calibrate}>
                            <Text style={styles.buttonText}>I'm at the new X, facing down the aisle</Text>
                        </Pressable>
                    </> : arrived ? <Text style={styles.whiteCopy}>Reached {route.at(-1)?.label}. Return to the red X before testing another destination.</Text> : offRoute ? <>
                        <Text style={styles.whiteTitle}>Pause and check the map</Text>
                        <Text style={styles.whiteCopy}>You appear away from this route segment. Do not follow an arrow through furniture or walls. Return to the route, or return to X and restart if the map has drifted.</Text>
                    </> : <>
                        <Text style={styles.whiteTitle}>{progress?.next.toFixed(1)} m to next waypoint</Text>
                        <Text style={styles.whiteCopy}>{facingHint} · {turnAt(route, index)}</Text>
                        <Text style={styles.whiteCopy}>{route[index]?.label}</Text>
                        <Pressable accessibilityRole="button" style={[styles.smallButton,
                            (!progress || progress.next > 0.8) && styles.disabled]}
                            disabled={!canNavigate || !progress || progress.next > 0.8} onPress={advance}>
                            <Text style={styles.buttonText}>Confirm nearby waypoint</Text>
                        </Pressable>
                    </>}
                    <View style={styles.actions}>
                        <Pressable accessibilityRole="button" onPress={() => setShowMap(v => !v)}><Text style={styles.link}>{showMap ? "Hide map" : "Show map"}</Text></Pressable>
                        <Pressable accessibilityRole="button" onPress={() => {
                            clearAlignment("Return to X to begin another route.");
                            setCameraOpen(false);
                        }}><Text style={styles.link}>End / choose destination</Text></Pressable>
                    </View>
                </View>
            </View>
        </SafeAreaView>
    </View>;
}

const styles = StyleSheet.create({
    page: { flex: 1, backgroundColor: "#f5f8fb" },
    setup: { padding: 20, gap: 12, paddingBottom: 40 },
    title: { color: "#173b58", fontSize: 28, fontWeight: "800" },
    copy: { color: "#496173", fontSize: 14, lineHeight: 20 },
    destination: { borderWidth: 1, borderColor: "#cad7e3", padding: 14, borderRadius: 12, backgroundColor: "white" },
    selected: { borderColor: "#176de5", backgroundColor: "#e8f2ff" },
    destinationName: { color: "#173b58", fontSize: 16, fontWeight: "700" },
    warning: { color: "#854d0e", fontSize: 14, lineHeight: 20 },
    button: { marginTop: 10, backgroundColor: "#176de5", padding: 16, borderRadius: 12, alignItems: "center" },
    buttonText: { color: "white", fontWeight: "700", textAlign: "center" },
    disabled: { opacity: 0.4 },
    cameraPage: { flex: 1, backgroundColor: "#06131d" },
    overlay: { flex: 1, padding: 16, justifyContent: "space-between" },
    card: { borderRadius: 16, padding: 16, backgroundColor: "rgba(4,20,31,0.93)", gap: 6 },
    whiteTitle: { fontSize: 22, fontWeight: "800", color: "white" },
    whiteCopy: { fontSize: 14, lineHeight: 20, color: "#d5e4ef" },
    bottom: { gap: 10 },
    actions: { flexDirection: "row", justifyContent: "space-between", paddingTop: 14, gap: 10 },
    link: { color: "#91c5ff", fontSize: 12, fontWeight: "700", paddingVertical: 6 },
    smallButton: { padding: 10, backgroundColor: "#235073", borderRadius: 10, marginTop: 8 },
});
