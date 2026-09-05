import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { HOME_SCALE, HOME_START_PIXEL, homeRooms } from "../data/homeDemo";
import type { Point } from "../services/indoorNavigation";

// A schematic preview: room outlines provide orientation, not wall collision geometry.
export default function HomeRouteMap({ route, position }: { route: Point[]; position?: Point | null }) {
    const [width, setWidth] = useState(300);
    const scale = width / 1400;
    const pixel = (p: Point) => ({ x: (p.x * HOME_SCALE + HOME_START_PIXEL.x) * scale,
        y: (p.y * HOME_SCALE + HOME_START_PIXEL.y - 140) * scale });
    const points = route.map(pixel);
    const player = position ? pixel(position) : null;
    return <View accessibilityLabel="Schematic route from the red X through the rooms"
        onLayout={e => setWidth(e.nativeEvent.layout.width)} style={[styles.map, { height: width * 0.7 }]}>
        {homeRooms.map(room => <View key={room.name} style={[styles.room, {
            left: room.x * scale, top: (room.y - 140) * scale,
            width: room.width * scale, height: room.height * scale,
        }]}><Text style={styles.label}>{room.name}</Text></View>)}
        {points.slice(1).map((p, i) => {
            const a = points[i], length = Math.hypot(p.x - a.x, p.y - a.y);
            return <View key={`line-${i}`} style={[styles.line, {
                left: (a.x + p.x) / 2 - length / 2, top: (a.y + p.y) / 2 - 1.5,
                width: length, transform: [{ rotate: `${Math.atan2(p.y - a.y, p.x - a.x)}rad` }],
            }]} />;
        })}
        {points.map((p, i) => <View key={i} style={[styles.dot,
            { left: p.x - 3, top: p.y - 3 }, i === 0 && styles.start]} />)}
        {player && <View style={[styles.player, { left: player.x - 5, top: player.y - 5 }]} />}
    </View>;
}

const styles = StyleSheet.create({
    map: { width: "100%", backgroundColor: "#f3f7fa", borderRadius: 12, overflow: "hidden" },
    room: { position: "absolute", borderWidth: 1, borderColor: "#c0cbd5", backgroundColor: "#e4ecf2", alignItems: "center", justifyContent: "center" },
    label: { fontSize: 8, color: "#526476", textAlign: "center" },
    line: { position: "absolute", height: 3, backgroundColor: "#176de5" },
    dot: { position: "absolute", width: 6, height: 6, borderRadius: 3, backgroundColor: "#176de5" },
    start: { backgroundColor: "#dc2626", width: 8, height: 8 },
    player: { position: "absolute", width: 10, height: 10, borderRadius: 5, borderWidth: 2, borderColor: "white", backgroundColor: "#00875f" },
});
