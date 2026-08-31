import { useRef, useState } from "react";
import { useIsFocused } from "@react-navigation/native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import {
    CameraView,
    type BarcodeScanningResult,
    useCameraPermissions,
} from "expo-camera";
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
import {
    parseWayfindingQr,
    type WayfindingCheckpoint,
} from "../types/wayfinding";

type Props = NativeStackScreenProps<RootStackParamList, "QRScanner">;

export default function QRScannerScreen({ navigation }: Props) {
    const [permission, requestPermission] = useCameraPermissions();
    const [checkpoint, setCheckpoint] = useState<WayfindingCheckpoint | null>(null);
    const [invalidValue, setInvalidValue] = useState<string | null>(null);
    const scanLocked = useRef(false);
    const isFocused = useIsFocused();

    function handleBarcodeScanned(result: BarcodeScanningResult) {
        if (scanLocked.current) {
            return;
        }

        scanLocked.current = true;
        const parsed = parseWayfindingQr(result.data);
        if (parsed) {
            setCheckpoint(parsed);
            setInvalidValue(null);
        } else {
            setInvalidValue(result.data);
        }
    }

    function resetScanner() {
        setCheckpoint(null);
        setInvalidValue(null);
        scanLocked.current = false;
    }

    function confirmCheckpoint() {
        if (!checkpoint) {
            return;
        }
        navigation.navigate("CameraGuidance", { checkpointCode: checkpoint.code });
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
                    <Text style={styles.heading}>Camera access needed</Text>
                    <Text style={styles.bodyText}>
                        Wayfinder uses the camera only to read location QR checkpoints.
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
                </View>
            </SafeAreaView>
        );
    }

    const hasResult = Boolean(checkpoint || invalidValue);

    return (
        <View style={styles.container}>
            {isFocused && !hasResult ? (
                <CameraView
                    style={StyleSheet.absoluteFill}
                    facing="back"
                    barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
                    onBarcodeScanned={handleBarcodeScanned}
                />
            ) : (
                <View style={styles.cameraPaused} />
            )}

            {!hasResult ? (
                <SafeAreaView style={styles.overlay} pointerEvents="box-none">
                    <View style={styles.instructionCard}>
                        <Text style={styles.overlayTitle}>Scan a checkpoint</Text>
                        <Text style={styles.overlayText}>
                            Point the camera at a Wayfinder QR label.
                        </Text>
                    </View>
                    <View style={styles.scanFrame} accessibilityLabel="QR scanning area">
                        <View style={[styles.corner, styles.topLeft]} />
                        <View style={[styles.corner, styles.topRight]} />
                        <View style={[styles.corner, styles.bottomLeft]} />
                        <View style={[styles.corner, styles.bottomRight]} />
                    </View>
                    <Text style={styles.hint}>Hold still—the scan happens automatically.</Text>
                </SafeAreaView>
            ) : (
                <SafeAreaView style={styles.resultPage}>
                    <View style={styles.resultCard}>
                        <Text
                            style={[
                                styles.resultIcon,
                                !checkpoint && styles.resultIconInvalid,
                            ]}
                        >
                            {checkpoint ? "✓" : "!"}
                        </Text>
                        <Text style={styles.heading}>
                            {checkpoint ? "Checkpoint found" : "Not a Wayfinder code"}
                        </Text>
                        <Text style={styles.bodyText}>
                            {checkpoint
                                ? checkpoint.kind === "test"
                                    ? "The TEST_START proof-of-concept code scanned successfully."
                                    : "Your indoor position is now known."
                                : "Use a QR label beginning with wayfinder://location/ or a printed location code."}
                        </Text>
                        {checkpoint ? (
                            <View style={styles.codeBadge}>
                                <Text selectable style={styles.codeText}>
                                    {checkpoint.code}
                                </Text>
                            </View>
                        ) : null}
                        <View style={styles.buttonGroup}>
                            {checkpoint ? (
                                <Pressable
                                    accessibilityRole="button"
                                    style={styles.primaryButton}
                                    onPress={confirmCheckpoint}
                                >
                                    <Text style={styles.primaryButtonText}>Use this checkpoint</Text>
                                </Pressable>
                            ) : null}
                            <Pressable
                                accessibilityRole="button"
                                style={styles.secondaryButton}
                                onPress={resetScanner}
                            >
                                <Text style={styles.secondaryButtonText}>Scan again</Text>
                            </Pressable>
                        </View>
                    </View>
                </SafeAreaView>
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
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
    cameraPaused: {
        flex: 1,
        backgroundColor: "#e9f0f5",
    },
    overlay: {
        flex: 1,
        alignItems: "center",
        justifyContent: "space-between",
        paddingHorizontal: 24,
        paddingVertical: 36,
        backgroundColor: "rgba(2, 12, 22, 0.28)",
    },
    instructionCard: {
        width: "100%",
        maxWidth: 420,
        padding: 18,
        borderRadius: 18,
        backgroundColor: "rgba(5, 18, 31, 0.88)",
    },
    overlayTitle: {
        color: "#ffffff",
        fontSize: 24,
        fontWeight: "700",
        textAlign: "center",
    },
    overlayText: {
        marginTop: 6,
        color: "#d7e5ef",
        fontSize: 16,
        textAlign: "center",
    },
    scanFrame: {
        width: 246,
        height: 246,
    },
    corner: {
        position: "absolute",
        width: 48,
        height: 48,
        borderColor: "#ffffff",
    },
    topLeft: {
        top: 0,
        left: 0,
        borderTopWidth: 5,
        borderLeftWidth: 5,
        borderTopLeftRadius: 16,
    },
    topRight: {
        top: 0,
        right: 0,
        borderTopWidth: 5,
        borderRightWidth: 5,
        borderTopRightRadius: 16,
    },
    bottomLeft: {
        bottom: 0,
        left: 0,
        borderBottomWidth: 5,
        borderLeftWidth: 5,
        borderBottomLeftRadius: 16,
    },
    bottomRight: {
        right: 0,
        bottom: 0,
        borderRightWidth: 5,
        borderBottomWidth: 5,
        borderBottomRightRadius: 16,
    },
    hint: {
        color: "#ffffff",
        fontSize: 15,
        fontWeight: "600",
        textAlign: "center",
        textShadowColor: "rgba(0, 0, 0, 0.8)",
        textShadowOffset: { width: 0, height: 1 },
        textShadowRadius: 3,
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
        marginBottom: 10,
    },
    resultPage: {
        flex: 1,
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
    },
    resultCard: {
        width: "100%",
        maxWidth: 440,
        alignItems: "center",
        padding: 28,
        borderRadius: 22,
        backgroundColor: "#ffffff",
    },
    resultIcon: {
        width: 58,
        height: 58,
        borderRadius: 29,
        color: "#ffffff",
        backgroundColor: "#087f5b",
        fontSize: 36,
        fontWeight: "800",
        lineHeight: 56,
        textAlign: "center",
        overflow: "hidden",
    },
    resultIconInvalid: {
        backgroundColor: "#c2413b",
    },
    heading: {
        marginTop: 14,
        color: "#102a43",
        fontSize: 25,
        fontWeight: "700",
        textAlign: "center",
    },
    bodyText: {
        marginTop: 10,
        color: "#52667a",
        fontSize: 16,
        lineHeight: 23,
        textAlign: "center",
    },
    codeBadge: {
        marginTop: 18,
        paddingHorizontal: 16,
        paddingVertical: 10,
        borderRadius: 10,
        backgroundColor: "#e8f2ff",
    },
    codeText: {
        color: "#004c97",
        fontSize: 16,
        fontWeight: "700",
    },
    buttonGroup: {
        width: "100%",
        marginTop: 24,
        gap: 10,
    },
    primaryButton: {
        minHeight: 50,
        alignItems: "center",
        justifyContent: "center",
        paddingHorizontal: 20,
        borderRadius: 12,
        backgroundColor: "#0057b8",
    },
    primaryButtonText: {
        color: "#ffffff",
        fontSize: 16,
        fontWeight: "700",
    },
    secondaryButton: {
        minHeight: 48,
        alignItems: "center",
        justifyContent: "center",
        paddingHorizontal: 20,
        borderWidth: 1,
        borderColor: "#9fb3c8",
        borderRadius: 12,
        backgroundColor: "#ffffff",
    },
    secondaryButtonText: {
        color: "#243b53",
        fontSize: 16,
        fontWeight: "700",
    },
});
