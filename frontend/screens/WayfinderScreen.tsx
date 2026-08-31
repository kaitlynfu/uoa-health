import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { Pressable, SafeAreaView, StyleSheet, Text, View } from "react-native";

import { RootStackParamList } from "../navigation/AppNavigator";

type Props = NativeStackScreenProps<RootStackParamList, "Wayfinder">;

export default function WayfinderScreen({ navigation, route }: Props) {
    const checkpointCode = route.params?.checkpointCode;

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.hero}>
                <Text style={styles.eyebrow}>BUILDING 303 PILOT</Text>
                <Text style={styles.title}>Find your way indoors</Text>
                <Text style={styles.subtitle}>
                    Scan a nearby checkpoint so Wayfinder knows exactly where you are.
                </Text>
            </View>

            {checkpointCode ? (
                <View style={styles.locationCard}>
                    <View style={styles.statusDot} />
                    <View style={styles.locationCopy}>
                        <Text style={styles.cardLabel}>CURRENT CHECKPOINT</Text>
                        <Text selectable style={styles.checkpointCode}>
                            {checkpointCode}
                        </Text>
                        <Text style={styles.cardHint}>
                            Position confirmed. Scan again to start the camera-guidance preview.
                        </Text>
                    </View>
                </View>
            ) : (
                <View style={styles.emptyCard}>
                    <Text style={styles.emptyTitle}>Location not set</Text>
                    <Text style={styles.cardHint}>
                        For the first device test, scan a QR code containing TEST_START.
                    </Text>
                </View>
            )}

            <Pressable
                accessibilityRole="button"
                style={styles.primaryButton}
                onPress={() => navigation.navigate("QRScanner")}
            >
                <Text style={styles.primaryButtonText}>
                    {checkpointCode ? "Scan another checkpoint" : "Scan QR checkpoint"}
                </Text>
            </Pressable>

            <View style={styles.scopeNote}>
                <Text style={styles.scopeTitle}>MVP scope</Text>
                <Text style={styles.scopeText}>
                    One building, QR positioning, a validated route, and simple indoor guidance.
                    Outdoor maps remain a stretch goal.
                </Text>
            </View>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        padding: 24,
        backgroundColor: "#f4f7fa",
    },
    hero: {
        paddingVertical: 18,
    },
    eyebrow: {
        color: "#0057b8",
        fontSize: 12,
        fontWeight: "800",
        letterSpacing: 1.2,
    },
    title: {
        marginTop: 8,
        color: "#102a43",
        fontSize: 32,
        fontWeight: "800",
    },
    subtitle: {
        marginTop: 10,
        color: "#52667a",
        fontSize: 17,
        lineHeight: 25,
    },
    locationCard: {
        flexDirection: "row",
        marginTop: 12,
        padding: 20,
        borderWidth: 1,
        borderColor: "#b7e4d5",
        borderRadius: 18,
        backgroundColor: "#ffffff",
    },
    statusDot: {
        width: 12,
        height: 12,
        marginTop: 4,
        marginRight: 12,
        borderRadius: 6,
        backgroundColor: "#087f5b",
    },
    locationCopy: {
        flex: 1,
    },
    cardLabel: {
        color: "#587086",
        fontSize: 11,
        fontWeight: "800",
        letterSpacing: 1,
    },
    checkpointCode: {
        marginTop: 5,
        color: "#102a43",
        fontSize: 20,
        fontWeight: "800",
    },
    cardHint: {
        marginTop: 8,
        color: "#52667a",
        fontSize: 15,
        lineHeight: 21,
    },
    emptyCard: {
        marginTop: 12,
        padding: 20,
        borderWidth: 1,
        borderColor: "#d4dee8",
        borderRadius: 18,
        backgroundColor: "#ffffff",
    },
    emptyTitle: {
        color: "#243b53",
        fontSize: 18,
        fontWeight: "700",
    },
    primaryButton: {
        minHeight: 54,
        alignItems: "center",
        justifyContent: "center",
        marginTop: 18,
        paddingHorizontal: 20,
        borderRadius: 14,
        backgroundColor: "#0057b8",
    },
    primaryButtonText: {
        color: "#ffffff",
        fontSize: 17,
        fontWeight: "800",
    },
    scopeNote: {
        marginTop: 26,
        padding: 18,
        borderRadius: 16,
        backgroundColor: "#e8f2ff",
    },
    scopeTitle: {
        color: "#004c97",
        fontSize: 16,
        fontWeight: "800",
    },
    scopeText: {
        marginTop: 6,
        color: "#334e68",
        fontSize: 14,
        lineHeight: 21,
    },
});
