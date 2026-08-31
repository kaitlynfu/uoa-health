import { Pressable, StyleSheet, Text, View } from "react-native";

import { WayfindingDestination } from "../types/wayfinding";

type Props = {
    destination: WayfindingDestination;
    onPress: () => void;
    compact?: boolean;
};

const CATEGORY_LABELS: Record<WayfindingDestination["category"], string> = {
    lecture: "LT",
    room: "RM",
    lab: "LAB",
    facility: "WC",
};

export default function WayfindingDestinationCard({
    destination,
    onPress,
    compact = false,
}: Props) {
    return (
        <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Navigate to ${destination.name}`}
            onPress={onPress}
            style={({ pressed }) => [
                styles.card,
                compact && styles.compactCard,
                pressed && styles.cardPressed,
            ]}
        >
            <View style={styles.iconTile}>
                <Text style={styles.iconText}>{CATEGORY_LABELS[destination.category]}</Text>
            </View>
            <View style={styles.copy}>
                <Text numberOfLines={1} style={styles.name}>
                    {destination.shortName}
                </Text>
                <Text numberOfLines={1} style={styles.meta}>
                    {destination.floor} · {destination.code}
                </Text>
            </View>
            <Text style={styles.chevron}>›</Text>
        </Pressable>
    );
}

const styles = StyleSheet.create({
    card: {
        minHeight: 76,
        flexDirection: "row",
        alignItems: "center",
        paddingHorizontal: 16,
        paddingVertical: 13,
        borderWidth: 1,
        borderColor: "#dce5ed",
        borderRadius: 18,
        backgroundColor: "#ffffff",
    },
    compactCard: {
        minWidth: 252,
    },
    cardPressed: {
        opacity: 0.72,
        transform: [{ scale: 0.99 }],
    },
    iconTile: {
        width: 46,
        height: 46,
        alignItems: "center",
        justifyContent: "center",
        borderRadius: 14,
        backgroundColor: "#e7f1ff",
    },
    iconText: {
        color: "#0057b8",
        fontSize: 12,
        fontWeight: "900",
        letterSpacing: 0.4,
    },
    copy: {
        flex: 1,
        marginLeft: 13,
    },
    name: {
        color: "#102a43",
        fontSize: 17,
        fontWeight: "800",
    },
    meta: {
        marginTop: 4,
        color: "#60758a",
        fontSize: 13,
        fontWeight: "500",
    },
    chevron: {
        marginLeft: 10,
        color: "#6c8297",
        fontSize: 32,
        fontWeight: "300",
        lineHeight: 34,
    },
});
