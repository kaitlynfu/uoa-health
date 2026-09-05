import { useEffect, useRef, useState } from "react";
import { useIsFocused } from "@react-navigation/native";
import { AppState, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View } from "react-native";
import HomeRouteMap from "../components/HomeRouteMap";
import { homeDestinations, homeGraph } from "../data/homeDemo";
import { HomeArView, markerArAvailable, type PoseEvent, type MarkerEvent } from "../modules/wayfinder-ar";
import { observeMarker, type MarkerCandidate } from "../services/markerAlignment";
import { arrivalDwell, distance, mapToWorld, progressAt, relativeBearing, routeLength,
    shortestPath, turnAt, waypointYaw, worldToMap, type Alignment, type Point } from "../services/indoorNavigation";

export default function HomeDemoScreen() {
    const focused = useIsFocused();
    const [foreground, setForeground] = useState(AppState.currentState === "active");
    const [destination, setDestination] = useState("living");
    const [cameraOpen, setCameraOpen] = useState(false);
    const [tracking, setTracking] = useState("initializing");
    const [notice, setNotice] = useState("Scan the fixed HOME START floor marker before starting.");
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
    const candidate = useRef<MarkerCandidate | null>(null);
    const route = shortestPath(homeGraph, "start", destination);
    const active = focused && foreground && cameraOpen;

    function clearAlignment(message: string) {
        candidate.current = null;
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
            if (state !== "active") clearAlignment("Session paused. Scan the fixed marker again.");
        });
        return () => listener.remove();
    }, []);

    useEffect(() => {
        if (!focused) {
            clearAlignment("Scan the fixed marker again.");
            setCameraOpen(false);
            lastPose.current = null;
        }
    }, [focused]);

    useEffect(() => {
        if (!active) return;
        const timer = setInterval(() => {
            if (alignmentRef.current && (!lastPose.current || Date.now() - lastPose.current.received > 1500)) {
                clearAlignment("Camera tracking stopped. Scan the fixed marker again.");
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
            clearAlignment("AR origin changed. Scan the fixed marker again.");
        }
        lastPose.current = { matrix, timestamp, received: Date.now() };
        const a = alignmentRef.current;
        if (!a || arrived || tracking !== "normal") return;
        const p = worldToMap(matrix[12], matrix[14], a);
        if (previousPosition.current && distance(previousPosition.current, p) > 0.9) {
            clearAlignment("Tracking position jumped. Scan the fixed marker again.");
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

    function receiveMarker(event: MarkerEvent) {
        if (!active || alignmentRef.current || tracking !== "normal") return;
        const frame = lastPose.current;
        const observation = event.nativeEvent;
        if (!frame || Date.now()-frame.received>500 || Math.abs(frame.timestamp-observation.timestamp)>0.2) {
            candidate.current = null;
            return;
        }
        const result = observeMarker(candidate.current, observation);
        candidate.current = result.candidate;
        const a = result.alignment;
        if (!a) {
            setNotice(result.candidate ? "Marker found. Hold it fully in view until alignment is stable…" :
                "Show the whole HOME START marker, lying flat on the floor.");
            return;
        }
        const p = worldToMap(frame.matrix[12],frame.matrix[14],a);
        if (Math.hypot(p.x,p.y)>2.5) {
            candidate.current = null;
            setNotice("Move closer to the marker to begin; do not stand on it.");
            return;
        }
        alignmentRef.current = a;
        setAlignment(a);
        setPosition(p);
        previousPosition.current = p;
        nearSince.current = null;
        setForward({x:-a.fz*frame.matrix[8]+a.fx*frame.matrix[10],y:-a.fx*frame.matrix[8]-a.fz*frame.matrix[10]});
        setIndex(Math.hypot(p.x,p.y)<=0.6 ? 1 : 0);
        setArrived(false);
        setNotice("Aligned to the fixed marker. Route distances remain estimates.");
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
            <Text style={styles.title}>Home route demo · Marker v1</Text>
            <Text style={styles.copy}>Start: fixed HOME START marker centred at the new red X in the clear aisle in Bedroom 1. Choose where to go.</Text>
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
            <Text style={styles.copy}>Print docs/home-start-marker.html at 100% and measure the square: 20 × 20 cm. Tape it flat on the floor, centre at X, with its small black top arrow pointing down the plan along the aisle. Do not move or duplicate it.</Text>
            <Text style={styles.copy}>Scan from nearby, from any direction. The marker determines route placement, not where you stand. Arrows stay hidden until it is recognised steadily. Draft routes still need clearance checks; there is no furniture detection. Arrows sit 15 cm above the marker's floor level.</Text>
            {!markerArAvailable && <Text style={styles.warning}>This installed app does not contain Marker v1. Rebuild on your Mac; reloading JavaScript alone cannot add image tracking.</Text>}
            <Pressable accessibilityRole="button" disabled={!markerArAvailable || !route.length}
                style={[styles.button, !markerArAvailable && styles.disabled]} onPress={() => {
                    clearAlignment("Point the camera at the fixed HOME START floor marker.");
                    lastPose.current = null;
                    setTracking("initializing");
                    setArrived(false);
                    setCameraOpen(true);
                }}><Text style={styles.buttonText}>Open camera and scan fixed marker</Text></Pressable>
        </ScrollView>
    </SafeAreaView>;

    return <View style={styles.cameraPage}>
        {HomeArView && active && <HomeArView style={StyleSheet.absoluteFill} active={active}
            waypoint={waypoint} onPose={receivePose} onMarker={receiveMarker} onStatus={({ nativeEvent }) => {
                setTracking(nativeEvent.state);
                if (nativeEvent.state !== "normal") {
                    clearAlignment(nativeEvent.message + " Scan the fixed marker again.");
                } else if (!alignmentRef.current) setNotice("Camera tracking ready. Scan HOME START to locate the route.");
            }} />}
        <SafeAreaView style={styles.overlay} pointerEvents="box-none">
            <View style={styles.card}>
                <Text style={styles.whiteTitle}>{arrived ? "You've arrived" : route.at(-1)?.label}</Text>
                <Text style={styles.whiteCopy}>{arrived ? "Route completed" : alignment && progress ?
                    `About ${progress.remaining.toFixed(1)} m remaining · waypoint ${index}/${route.length - 1}` : "Scan fixed HOME START marker"}</Text>
                <Text style={styles.whiteCopy}>Camera tracking: {tracking === "normal" ? "Ready" : tracking} · Map: {alignment ? "Marker aligned" : "Not located"}</Text>
            </View>
            <View style={styles.bottom} pointerEvents="box-none">
                {showMap && <HomeRouteMap route={route} position={position} />}
                <View style={styles.card}>
                    {!alignment ? <>
                        <Text style={styles.whiteCopy}>{notice}</Text>
                        <Text style={styles.whiteCopy}>No manual override. Keep the entire 20 cm floor marker visible and well lit. Its top must point down the plan.</Text>
                    </> : arrived ? <Text style={styles.whiteCopy}>Reached {route.at(-1)?.label}. Scan the fixed marker again before testing another destination.</Text> : offRoute ? <>
                        <Text style={styles.whiteTitle}>Pause and check the map</Text>
                        <Text style={styles.whiteCopy}>{index === 0 ? "Marker aligned. Move beside the floor marker to join the start of the route; do not step on the paper." : "You appear away from this route segment. Do not follow an arrow through furniture or walls. Return to the route, or end and scan the fixed marker again if the map has drifted."}</Text>
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
                            clearAlignment("Scan the fixed marker to begin another route.");
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
