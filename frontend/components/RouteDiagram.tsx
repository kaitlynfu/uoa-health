import { StyleSheet, Text, View } from "react-native";

type Props = {
    destinationFloor: string;
    compact?: boolean;
};

export default function RouteDiagram({ destinationFloor, compact = false }: Props) {
    const changesFloor = destinationFloor !== "Ground floor";

    return (
        <View style={[styles.map, compact && styles.mapCompact]}>
            <View style={styles.floorLabel}>
                <Text style={styles.floorLabelText}>{destinationFloor.toUpperCase()}</Text>
            </View>
            <View style={[styles.corridor, styles.horizontal]} />
            <View style={[styles.corridor, styles.vertical]} />
            <View style={[styles.room, styles.roomOne]} />
            <View style={[styles.room, styles.roomTwo]} />
            <View style={[styles.room, styles.roomThree]} />

            <View style={styles.routeStart} />
            <View style={styles.routeVertical} />
            <View style={styles.routeCorner} />
            <View style={styles.routeHorizontal} />
            <View style={styles.routeEnd}>
                <View style={styles.routeEndCenter} />
            </View>

            <View style={styles.youLabel}>
                <Text style={styles.youLabelText}>START</Text>
            </View>
            <View style={styles.destinationLabel}>
                <Text style={styles.destinationLabelText}>DESTINATION</Text>
            </View>
            {changesFloor ? (
                <View style={styles.liftBadge}>
                    <Text style={styles.liftBadgeText}>LIFT</Text>
                </View>
            ) : null}
        </View>
    );
}

const styles = StyleSheet.create({
    map: {
        height: 245,
        overflow: "hidden",
        borderWidth: 1,
        borderColor: "#d5e0e9",
        borderRadius: 22,
        backgroundColor: "#edf3f7",
    },
    mapCompact: {
        height: 190,
    },
    floorLabel: {
        position: "absolute",
        top: 15,
        left: 15,
        zIndex: 3,
        paddingHorizontal: 9,
        paddingVertical: 5,
        borderRadius: 7,
        backgroundColor: "#ffffff",
    },
    floorLabelText: {
        color: "#486176",
        fontSize: 9,
        fontWeight: "900",
        letterSpacing: 0.8,
    },
    corridor: {
        position: "absolute",
        backgroundColor: "#ffffff",
    },
    horizontal: {
        top: "44%",
        left: 0,
        right: 0,
        height: 72,
    },
    vertical: {
        top: 0,
        bottom: 0,
        left: "28%",
        width: 66,
    },
    room: {
        position: "absolute",
        borderWidth: 1,
        borderColor: "#c7d5df",
        borderRadius: 5,
        backgroundColor: "#dce7ee",
    },
    roomOne: {
        top: 18,
        right: 18,
        width: "43%",
        height: 76,
    },
    roomTwo: {
        right: 18,
        bottom: 18,
        width: "31%",
        height: 61,
    },
    roomThree: {
        bottom: 18,
        left: 15,
        width: "21%",
        height: 60,
    },
    routeStart: {
        position: "absolute",
        left: "32.5%",
        bottom: 25,
        zIndex: 2,
        width: 18,
        height: 18,
        borderWidth: 4,
        borderColor: "#ffffff",
        borderRadius: 9,
        backgroundColor: "#0057b8",
    },
    routeVertical: {
        position: "absolute",
        left: "34.5%",
        top: "50%",
        bottom: 36,
        zIndex: 1,
        width: 7,
        borderRadius: 4,
        backgroundColor: "#1677d2",
    },
    routeCorner: {
        position: "absolute",
        top: "50%",
        left: "34.5%",
        zIndex: 1,
        width: 27,
        height: 7,
        backgroundColor: "#1677d2",
    },
    routeHorizontal: {
        position: "absolute",
        top: "50%",
        left: "39%",
        right: 38,
        zIndex: 1,
        height: 7,
        borderRadius: 4,
        backgroundColor: "#1677d2",
    },
    routeEnd: {
        position: "absolute",
        top: "46%",
        right: 27,
        zIndex: 2,
        width: 27,
        height: 27,
        alignItems: "center",
        justifyContent: "center",
        borderWidth: 3,
        borderColor: "#ffffff",
        borderRadius: 14,
        backgroundColor: "#087f5b",
    },
    routeEndCenter: {
        width: 7,
        height: 7,
        borderRadius: 4,
        backgroundColor: "#ffffff",
    },
    youLabel: {
        position: "absolute",
        left: "25%",
        bottom: 51,
        zIndex: 3,
        paddingHorizontal: 7,
        paddingVertical: 3,
        borderRadius: 5,
        backgroundColor: "#163a59",
    },
    youLabelText: {
        color: "#ffffff",
        fontSize: 8,
        fontWeight: "900",
    },
    destinationLabel: {
        position: "absolute",
        top: "34%",
        right: 14,
        zIndex: 3,
        paddingHorizontal: 7,
        paddingVertical: 3,
        borderRadius: 5,
        backgroundColor: "#075d46",
    },
    destinationLabelText: {
        color: "#ffffff",
        fontSize: 8,
        fontWeight: "900",
    },
    liftBadge: {
        position: "absolute",
        left: "39%",
        top: "38%",
        zIndex: 3,
        padding: 5,
        borderWidth: 2,
        borderColor: "#ffffff",
        borderRadius: 7,
        backgroundColor: "#6d4bb8",
    },
    liftBadgeText: {
        color: "#ffffff",
        fontSize: 8,
        fontWeight: "900",
    },
});
