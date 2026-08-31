import { useState } from "react";
import { useIsFocused } from "@react-navigation/native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { CameraView, useCameraPermissions } from "expo-camera";
import {
    ActivityIndicator,
    Linking,
    Pressable,
    SafeAreaView,
    StyleSheet,
    Text,
    View,
} from "react-native";

import { RootStackParamList } from "../navigation/AppNavigator";
import { getDemoDestination } from "../data/wayfindingDemo";

type Props = NativeStackScreenProps<RootStackParamList, "CameraGuidance">;

type GuidanceStep = {
    arrow: string;
    instruction: string;
    detail: string;
};

const DEMO_STEPS: GuidanceStep[] = [
    {
        arrow: "↑",
        instruction: "Continue straight",
        detail: "Walk approximately 8 metres along the corridor.",
    },
    {
        arrow: "→",
        instruction: "Turn right",
        detail: "Turn at the end of the corridor.",
    },
    {
        arrow: "↑",
        instruction: "Continue to the destination",
        detail: "The destination is approximately 5 metres ahead.",
    },
];

export default function CameraGuidanceScreen({ navigation, route }: Props) {
    const [permission, requestPermission] = useCameraPermissions();
    const [stepIndex, setStepIndex] = useState(0);
    const [arrived, setArrived] = useState(false);
    const isFocused = useIsFocused();
    const checkpointCode = route.params.checkpointCode;
    const destination = getDemoDestination(route.params.destinationCode);
    const currentStep = DEMO_STEPS[stepIndex];
    const isLastStep = stepIndex === DEMO_STEPS.length - 1;

    function leaveGuidance() {
        navigation.navigate("Wayfinder", { checkpointCode });
    }

    function advanceGuidance() {
        if (isLastStep) {
            setArrived(true);
            return;
        }
        setStepIndex((current) => current + 1);
    }

    if (!permission) {
        return (
            <View style={styles.centered}>
                <ActivityIndicator size="large" color="#0057b8" />
                <Text style={styles.loadingText}>Checking camera access…</Text>
            </View>
        );
    }

    if (!permission.granted) {
        return (
            <SafeAreaView style={styles.permissionPage}>
                <View style={styles.permissionCard}>
                    <Text style={styles.permissionIcon}>▣</Text>
                    <Text style={styles.permissionHeading}>Camera access needed</Text>
                    <Text style={styles.permissionText}>
                        Camera guidance places route instructions over the live corridor view.
                    </Text>
                    <Pressable
                        accessibilityRole="button"
                        style={styles.primaryButton}
                        onPress={
                            permission.canAskAgain
                                ? requestPermission
                                : () => Linking.openSettings()
                        }
                    >
                        <Text style={styles.primaryButtonText}>
                            {permission.canAskAgain ? "Allow camera" : "Open settings"}
                        </Text>
                    </Pressable>
                    <Pressable
                        accessibilityRole="button"
                        style={styles.textButton}
                        onPress={leaveGuidance}
                    >
                        <Text style={styles.textButtonText}>Return to Wayfinder</Text>
                    </Pressable>
                </View>
            </SafeAreaView>
        );
    }

    if (arrived) {
        return (
            <SafeAreaView style={styles.arrivalPage}>
                <View style={styles.arrivalCard}>
                    <View style={styles.arrivalIcon}>
                        <Text style={styles.arrivalIconText}>✓</Text>
                    </View>
                    <Text style={styles.arrivalEyebrow}>ROUTE COMPLETE</Text>
                    <Text style={styles.arrivalTitle}>You’ve arrived</Text>
                    <Text style={styles.arrivalText}>
                        You have reached {destination.name} on {destination.floor}.
                    </Text>
                    <Pressable
                        accessibilityRole="button"
                        style={styles.primaryButton}
                        onPress={leaveGuidance}
                    >
                        <Text style={styles.primaryButtonText}>Return to Wayfinder</Text>
                    </Pressable>
                </View>
            </SafeAreaView>
        );
    }

    return (
        <View style={styles.container}>
            {isFocused ? (
                <CameraView style={StyleSheet.absoluteFill} facing="back" />
            ) : (
                <View style={styles.cameraPaused} />
            )}

            <SafeAreaView style={styles.overlay} pointerEvents="box-none">
                <View style={styles.topCard}>
                    <View style={styles.prototypeBadge}>
                        <Text style={styles.prototypeBadgeText}>MANUAL PROTOTYPE</Text>
                    </View>
                    <Text style={styles.checkpointLabel}>Starting checkpoint</Text>
                    <Text selectable style={styles.checkpointCode}>
                        {destination.shortName} · {destination.floor}
                    </Text>
                    <Text style={styles.prototypeNote}>
                        Starting at {checkpointCode}. Use Next instruction for this prototype.
                    </Text>
                </View>

                <View style={styles.arrowArea} accessibilityLabel={currentStep.instruction}>
                    <Text style={styles.arrow}>{currentStep.arrow}</Text>
                </View>

                <View style={styles.bottomCard}>
                    <Text style={styles.progress}>
                        STEP {stepIndex + 1} OF {DEMO_STEPS.length}
                    </Text>
                    <Text style={styles.instruction}>{currentStep.instruction}</Text>
                    <Text style={styles.detail}>{currentStep.detail}</Text>

                    <Pressable
                        accessibilityRole="button"
                        style={styles.primaryButton}
                        onPress={advanceGuidance}
                    >
                        <Text style={styles.primaryButtonText}>
                            {isLastStep ? "I’ve arrived" : "Next instruction"}
                        </Text>
                    </Pressable>
                    <Pressable
                        accessibilityRole="button"
                        style={styles.textButton}
                        onPress={leaveGuidance}
                    >
                        <Text style={styles.cancelButtonText}>End preview</Text>
                    </Pressable>
                </View>
            </SafeAreaView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: "#071522",
    },
    cameraPaused: {
        flex: 1,
        backgroundColor: "#071522",
    },
    centered: {
        flex: 1,
        alignItems: "center",
        justifyContent: "center",
        gap: 12,
        backgroundColor: "#f4f7fa",
    },
    loadingText: {
        color: "#334155",
        fontSize: 16,
    },
    overlay: {
        flex: 1,
        justifyContent: "space-between",
        paddingHorizontal: 18,
        paddingVertical: 16,
        backgroundColor: "rgba(2, 12, 22, 0.18)",
    },
    topCard: {
        width: "100%",
        maxWidth: 480,
        alignSelf: "center",
        padding: 16,
        borderRadius: 18,
        backgroundColor: "rgba(5, 18, 31, 0.88)",
    },
    prototypeBadge: {
        alignSelf: "flex-start",
        paddingHorizontal: 9,
        paddingVertical: 5,
        borderRadius: 999,
        backgroundColor: "#f6c344",
    },
    prototypeBadgeText: {
        color: "#17212b",
        fontSize: 10,
        fontWeight: "900",
        letterSpacing: 0.8,
    },
    checkpointLabel: {
        marginTop: 11,
        color: "#b9cbd8",
        fontSize: 12,
        fontWeight: "700",
    },
    checkpointCode: {
        marginTop: 2,
        color: "#ffffff",
        fontSize: 18,
        fontWeight: "800",
    },
    prototypeNote: {
        marginTop: 7,
        color: "#d7e5ef",
        fontSize: 13,
        lineHeight: 18,
    },
    arrowArea: {
        alignSelf: "center",
        width: 156,
        height: 156,
        alignItems: "center",
        justifyContent: "center",
        borderWidth: 3,
        borderColor: "rgba(255, 255, 255, 0.85)",
        borderRadius: 78,
        backgroundColor: "rgba(0, 87, 184, 0.78)",
        shadowColor: "#000000",
        shadowOpacity: 0.38,
        shadowRadius: 12,
        shadowOffset: { width: 0, height: 5 },
    },
    arrow: {
        marginTop: -8,
        color: "#ffffff",
        fontSize: 112,
        fontWeight: "500",
        lineHeight: 126,
        textAlign: "center",
        textShadowColor: "rgba(0, 0, 0, 0.3)",
        textShadowOffset: { width: 0, height: 2 },
        textShadowRadius: 3,
    },
    bottomCard: {
        width: "100%",
        maxWidth: 480,
        alignSelf: "center",
        padding: 18,
        borderRadius: 20,
        backgroundColor: "rgba(255, 255, 255, 0.96)",
    },
    progress: {
        color: "#0057b8",
        fontSize: 11,
        fontWeight: "900",
        letterSpacing: 1,
    },
    instruction: {
        marginTop: 6,
        color: "#102a43",
        fontSize: 26,
        fontWeight: "800",
    },
    detail: {
        marginTop: 6,
        marginBottom: 4,
        color: "#52667a",
        fontSize: 15,
        lineHeight: 21,
    },
    primaryButton: {
        width: "100%",
        minHeight: 52,
        alignItems: "center",
        justifyContent: "center",
        marginTop: 16,
        paddingHorizontal: 20,
        borderRadius: 13,
        backgroundColor: "#0057b8",
    },
    primaryButtonText: {
        color: "#ffffff",
        fontSize: 16,
        fontWeight: "800",
    },
    textButton: {
        minHeight: 44,
        alignItems: "center",
        justifyContent: "center",
        marginTop: 4,
    },
    textButtonText: {
        color: "#0057b8",
        fontSize: 15,
        fontWeight: "700",
    },
    cancelButtonText: {
        color: "#415a70",
        fontSize: 15,
        fontWeight: "700",
    },
    permissionPage: {
        flex: 1,
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
        backgroundColor: "#f4f7fa",
    },
    permissionCard: {
        width: "100%",
        maxWidth: 440,
        alignItems: "center",
        padding: 28,
        borderRadius: 22,
        backgroundColor: "#ffffff",
    },
    permissionIcon: {
        color: "#0057b8",
        fontSize: 46,
    },
    permissionHeading: {
        marginTop: 12,
        color: "#102a43",
        fontSize: 25,
        fontWeight: "800",
        textAlign: "center",
    },
    permissionText: {
        marginTop: 10,
        color: "#52667a",
        fontSize: 16,
        lineHeight: 23,
        textAlign: "center",
    },
    arrivalPage: {
        flex: 1,
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
        backgroundColor: "#eaf7f2",
    },
    arrivalCard: {
        width: "100%",
        maxWidth: 440,
        alignItems: "center",
        padding: 30,
        borderRadius: 24,
        backgroundColor: "#ffffff",
    },
    arrivalIcon: {
        width: 68,
        height: 68,
        alignItems: "center",
        justifyContent: "center",
        borderRadius: 34,
        backgroundColor: "#087f5b",
    },
    arrivalIconText: {
        color: "#ffffff",
        fontSize: 42,
        fontWeight: "800",
        lineHeight: 48,
    },
    arrivalEyebrow: {
        marginTop: 18,
        color: "#087f5b",
        fontSize: 11,
        fontWeight: "900",
        letterSpacing: 1.2,
    },
    arrivalTitle: {
        marginTop: 6,
        color: "#102a43",
        fontSize: 30,
        fontWeight: "800",
        textAlign: "center",
    },
    arrivalText: {
        marginTop: 10,
        color: "#52667a",
        fontSize: 16,
        lineHeight: 23,
        textAlign: "center",
    },
});
