import { NativeStackScreenProps } from "@react-navigation/native-stack";
import {
    Pressable,
    SafeAreaView,
    ScrollView,
    StyleSheet,
    Text,
    View,
} from "react-native";

import RouteDiagram from "../components/RouteDiagram";
import { getDemoDestination } from "../data/wayfindingDemo";
import { RootStackParamList } from "../navigation/AppNavigator";

type Props = NativeStackScreenProps<RootStackParamList, "RoutePreview">;

export default function RoutePreviewScreen({ navigation, route }: Props) {
    const { destinationCode, checkpointCode } = route.params;
    const destination = getDemoDestination(destinationCode);
    const startLabel = checkpointCode === "TEST_START"
        ? "Test checkpoint"
        : checkpointCode ?? "Scan a checkpoint";
    const hasStart = Boolean(checkpointCode);
    const changesFloor = destination.floor !== "Ground floor";
    const estimatedMinutes = changesFloor ? 3 : 2;
    const estimatedMetres = changesFloor ? 31 : 19;

    function continueRoute() {
        if (!checkpointCode) {
            navigation.navigate("QRScanner", { destinationCode });
            return;
        }

        navigation.navigate("CameraGuidance", {
            checkpointCode,
            destinationCode,
        });
    }

    return (
        <SafeAreaView style={styles.container}>
            <ScrollView
                contentContainerStyle={styles.content}
                showsVerticalScrollIndicator={false}
            >
                <View style={styles.demoNotice}>
                    <Text style={styles.demoNoticeTitle}>UI PROTOTYPE</Text>
                    <Text style={styles.demoNoticeText}>
                        Route geometry and timing are sample data for phone testing.
                    </Text>
                </View>

                <View style={styles.destinationHeader}>
                    <Text style={styles.eyebrow}>DESTINATION</Text>
                    <Text style={styles.title}>{destination.shortName}</Text>
                    <Text style={styles.subtitle}>
                        {destination.floor} · {destination.building}
                    </Text>
                </View>

                <RouteDiagram destinationFloor={destination.floor} />

                <View style={styles.metrics}>
                    <View style={styles.metric}>
                        <Text style={styles.metricValue}>{estimatedMinutes} min</Text>
                        <Text style={styles.metricLabel}>Estimated time</Text>
                    </View>
                    <View style={styles.metricDivider} />
                    <View style={styles.metric}>
                        <Text style={styles.metricValue}>{estimatedMetres} m</Text>
                        <Text style={styles.metricLabel}>Walking distance</Text>
                    </View>
                    <View style={styles.metricDivider} />
                    <View style={styles.metric}>
                        <Text style={styles.metricValue}>{changesFloor ? "Lift" : "Same"}</Text>
                        <Text style={styles.metricLabel}>{changesFloor ? "Floor change" : "floor"}</Text>
                    </View>
                </View>

                <View style={styles.routeCard}>
                    <View style={styles.timeline}>
                        <View style={[styles.timelineDot, hasStart && styles.timelineDotReady]} />
                        <View style={styles.timelineLine} />
                        <View style={[styles.timelineDot, styles.timelineDotEnd]} />
                    </View>
                    <View style={styles.routeCopy}>
                        <View>
                            <Text style={styles.routeLabel}>STARTING POINT</Text>
                            <Text style={styles.routeValue}>{startLabel}</Text>
                            <Text style={styles.routeHint}>
                                {hasStart ? "Indoor position confirmed" : "Required before guidance starts"}
                            </Text>
                        </View>
                        <View style={styles.destinationCopy}>
                            <Text style={styles.routeLabel}>DESTINATION</Text>
                            <Text style={styles.routeValue}>{destination.name}</Text>
                            <Text style={styles.routeHint}>{destination.floor}</Text>
                        </View>
                    </View>
                </View>
            </ScrollView>

            <View style={styles.actionBar}>
                <Pressable
                    accessibilityRole="button"
                    onPress={continueRoute}
                    style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed]}
                >
                    <Text style={styles.primaryButtonText}>
                        {hasStart ? "Start camera guidance" : "Scan starting checkpoint"}
                    </Text>
                </Pressable>
                <Text style={styles.actionHint}>
                    {hasStart ? "Follow one instruction at a time" : "Look for a blue Wayfinder QR label"}
                </Text>
            </View>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: "#f5f8fb",
    },
    content: {
        padding: 18,
        paddingBottom: 28,
    },
    demoNotice: {
        flexDirection: "row",
        alignItems: "center",
        paddingHorizontal: 12,
        paddingVertical: 10,
        borderRadius: 12,
        backgroundColor: "#fff3cf",
    },
    demoNoticeTitle: {
        color: "#72510a",
        fontSize: 10,
        fontWeight: "900",
        letterSpacing: 0.7,
    },
    demoNoticeText: {
        flex: 1,
        marginLeft: 9,
        color: "#735b25",
        fontSize: 12,
        lineHeight: 17,
    },
    destinationHeader: {
        paddingVertical: 20,
    },
    eyebrow: {
        color: "#0057b8",
        fontSize: 11,
        fontWeight: "900",
        letterSpacing: 1,
    },
    title: {
        marginTop: 5,
        color: "#102a43",
        fontSize: 30,
        fontWeight: "900",
    },
    subtitle: {
        marginTop: 6,
        color: "#5f7488",
        fontSize: 14,
        lineHeight: 20,
    },
    metrics: {
        flexDirection: "row",
        alignItems: "center",
        marginTop: 14,
        paddingVertical: 15,
        borderWidth: 1,
        borderColor: "#dce5ed",
        borderRadius: 16,
        backgroundColor: "#ffffff",
    },
    metric: {
        flex: 1,
        alignItems: "center",
    },
    metricValue: {
        color: "#173b58",
        fontSize: 16,
        fontWeight: "900",
    },
    metricLabel: {
        marginTop: 3,
        color: "#708496",
        fontSize: 10,
        fontWeight: "600",
        textAlign: "center",
    },
    metricDivider: {
        width: 1,
        height: 31,
        backgroundColor: "#dce5ed",
    },
    routeCard: {
        flexDirection: "row",
        marginTop: 14,
        padding: 18,
        borderWidth: 1,
        borderColor: "#dce5ed",
        borderRadius: 18,
        backgroundColor: "#ffffff",
    },
    timeline: {
        alignItems: "center",
        width: 24,
        paddingTop: 4,
        paddingBottom: 4,
    },
    timelineDot: {
        width: 14,
        height: 14,
        borderWidth: 3,
        borderColor: "#8da1b2",
        borderRadius: 7,
        backgroundColor: "#ffffff",
    },
    timelineDotReady: {
        borderColor: "#0057b8",
        backgroundColor: "#0057b8",
    },
    timelineLine: {
        flex: 1,
        width: 3,
        minHeight: 58,
        backgroundColor: "#c9d5df",
    },
    timelineDotEnd: {
        borderColor: "#087f5b",
        backgroundColor: "#087f5b",
    },
    routeCopy: {
        flex: 1,
        marginLeft: 12,
    },
    routeLabel: {
        color: "#718598",
        fontSize: 10,
        fontWeight: "900",
        letterSpacing: 0.8,
    },
    routeValue: {
        marginTop: 3,
        color: "#173b58",
        fontSize: 15,
        fontWeight: "800",
    },
    routeHint: {
        marginTop: 2,
        color: "#718598",
        fontSize: 12,
    },
    destinationCopy: {
        marginTop: 30,
    },
    actionBar: {
        paddingHorizontal: 18,
        paddingTop: 12,
        paddingBottom: 12,
        borderTopWidth: 1,
        borderTopColor: "#dce5ed",
        backgroundColor: "#ffffff",
    },
    primaryButton: {
        minHeight: 54,
        alignItems: "center",
        justifyContent: "center",
        borderRadius: 15,
        backgroundColor: "#0057b8",
    },
    primaryButtonText: {
        color: "#ffffff",
        fontSize: 16,
        fontWeight: "900",
    },
    pressed: {
        opacity: 0.76,
    },
    actionHint: {
        marginTop: 7,
        color: "#718598",
        fontSize: 11,
        textAlign: "center",
    },
});
