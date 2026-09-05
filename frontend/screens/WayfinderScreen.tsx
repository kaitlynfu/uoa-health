import { useEffect, useState } from "react";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import {
    FlatList,
    Pressable,
    SafeAreaView,
    ScrollView,
    StyleSheet,
    Text,
    View,
} from "react-native";

import WayfindingDestinationCard from "../components/WayfindingDestinationCard";
import { RootStackParamList } from "../navigation/AppNavigator";
import { getNavigationDestinations } from "../services/api";
import {
    toDisplayDestination,
    WayfindingDestination,
} from "../types/wayfinding";

type Props = NativeStackScreenProps<RootStackParamList, "Wayfinder">;

export default function WayfinderScreen({ navigation, route }: Props) {
    const checkpointCode = route.params?.checkpointCode;
    const [popularDestinations, setPopularDestinations] = useState<WayfindingDestination[]>([]);
    const [destinationError, setDestinationError] = useState(false);

    useEffect(() => {
        let cancelled = false;
        getNavigationDestinations()
            .then((items) => {
                if (!cancelled) {
                    setPopularDestinations(
                        items.map(toDisplayDestination).filter((item) => item.popular)
                    );
                    setDestinationError(false);
                }
            })
            .catch(() => {
                if (!cancelled) {
                    setPopularDestinations([]);
                    setDestinationError(true);
                }
            });
        return () => {
            cancelled = true;
        };
    }, []);

    return (
        <SafeAreaView style={styles.container}>
            <ScrollView
                contentContainerStyle={styles.content}
                showsVerticalScrollIndicator={false}
            >
                <View style={styles.hero}>
                    <View style={styles.pilotBadge}>
                        <Text style={styles.pilotBadgeText}>BUILDING 303 PILOT</Text>
                    </View>
                    <Text style={styles.title}>Where do you need to go?</Text>
                    <Text style={styles.subtitle}>
                        Indoor directions for rooms and facilities in the Science Centre.
                    </Text>

                    <Pressable
                        accessibilityRole="button"
                        onPress={() => navigation.navigate("DestinationSearch", { checkpointCode })}
                        style={({ pressed }) => [styles.searchButton, pressed && styles.pressed]}
                    >
                        <Text style={styles.searchIcon}>⌕</Text>
                        <Text style={styles.searchText}>Search a room or facility</Text>
                        <Text style={styles.searchChevron}>›</Text>
                    </Pressable>
                </View>

                <View style={styles.locationSection}>
                    <View style={styles.sectionHeadingRow}>
                        <Text style={styles.sectionTitle}>Your indoor location</Text>
                        {checkpointCode ? (
                            <View style={styles.readyBadge}>
                                <Text style={styles.readyBadgeText}>READY</Text>
                            </View>
                        ) : null}
                    </View>

                    <View style={styles.locationCard}>
                        <View style={[styles.locationMarker, checkpointCode && styles.locationMarkerReady]}>
                            <View style={styles.locationMarkerCenter} />
                        </View>
                        <View style={styles.locationCopy}>
                            <Text style={styles.locationTitle}>
                                {checkpointCode ? "Checkpoint confirmed" : "Location not set"}
                            </Text>
                            <Text selectable style={styles.locationDetail}>
                                {checkpointCode
                                    ? checkpointCode
                                    : "Scan a nearby QR checkpoint before starting guidance."}
                            </Text>
                        </View>
                        <Pressable
                            accessibilityRole="button"
                            accessibilityLabel={checkpointCode ? "Rescan checkpoint" : "Scan checkpoint"}
                            onPress={() => navigation.navigate("QRScanner")}
                            style={({ pressed }) => [styles.scanButton, pressed && styles.pressed]}
                        >
                            <Text style={styles.scanButtonText}>{checkpointCode ? "Rescan" : "Scan"}</Text>
                        </Pressable>
                    </View>
                </View>

                <View style={styles.arSpikeSection}>
                    <View style={styles.arSpikeCard}>
                        <Text style={styles.arSpikeTitle}>Home route demo</Text>
                        <Text style={styles.arSpikeText}>
                            Choose a room from the red X, align your phone, and follow live AR waypoints.
                        </Text>
                        <Pressable accessibilityRole="button" onPress={() => navigation.navigate("HomeDemo")}
                            style={styles.arSpikeButton}>
                            <Text style={styles.arSpikeButtonText}>Open home routes</Text>
                        </Pressable>
                    </View>
                </View>

                <View style={styles.arSpikeSection}>
                    <View style={styles.arSpikeCard}>
                        <View style={styles.arSpikeBadge}>
                            <Text style={styles.arSpikeBadgeText}>TECHNOLOGY SPIKE</Text>
                        </View>
                        <Text style={styles.arSpikeTitle}>Test world-anchored AR</Text>
                        <Text style={styles.arSpikeText}>
                            Place a cube in the camera view and check that it stays fixed as you move.
                        </Text>
                        <Pressable
                            accessibilityRole="button"
                            onPress={() => navigation.navigate("ARAnchorTest")}
                            style={({ pressed }) => [styles.arSpikeButton, pressed && styles.pressed]}
                        >
                            <Text style={styles.arSpikeButtonText}>Open AR anchor test</Text>
                        </Pressable>
                    </View>
                </View>

                <View style={styles.popularSection}>
                    <View style={[styles.sectionHeadingRow, styles.popularHeading]}>
                        <Text style={styles.sectionTitle}>Popular destinations</Text>
                        <Pressable onPress={() => navigation.navigate("DestinationSearch", { checkpointCode })}>
                            <Text style={styles.seeAll}>See all</Text>
                        </Pressable>
                    </View>
                    <FlatList
                        horizontal
                        data={popularDestinations}
                        keyExtractor={(item) => item.code}
                        contentContainerStyle={styles.popularList}
                        ItemSeparatorComponent={() => <View style={styles.popularGap} />}
                        showsHorizontalScrollIndicator={false}
                        renderItem={({ item }) => (
                            <WayfindingDestinationCard
                                compact
                                destination={item}
                                onPress={() => navigation.navigate("RoutePreview", {
                                    destinationCode: item.code,
                                    checkpointCode,
                                })}
                            />
                        )}
                    />
                    {destinationError ? (
                        <Text style={styles.apiHint}>
                            Start the backend to load Building 303 destinations.
                        </Text>
                    ) : null}
                </View>

                <View style={styles.howItWorks}>
                    <Text style={styles.howTitle}>How indoor wayfinding works</Text>
                    <View style={styles.stepRow}>
                        <View style={styles.stepNumber}><Text style={styles.stepNumberText}>1</Text></View>
                        <View style={styles.stepCopy}>
                            <Text style={styles.stepTitle}>Choose a destination</Text>
                            <Text style={styles.stepText}>Search by room number or facility.</Text>
                        </View>
                    </View>
                    <View style={styles.stepConnector} />
                    <View style={styles.stepRow}>
                        <View style={styles.stepNumber}><Text style={styles.stepNumberText}>2</Text></View>
                        <View style={styles.stepCopy}>
                            <Text style={styles.stepTitle}>Scan your nearest checkpoint</Text>
                            <Text style={styles.stepText}>This gives the app a reliable indoor starting point.</Text>
                        </View>
                    </View>
                    <View style={styles.stepConnector} />
                    <View style={styles.stepRow}>
                        <View style={styles.stepNumber}><Text style={styles.stepNumberText}>3</Text></View>
                        <View style={styles.stepCopy}>
                            <Text style={styles.stepTitle}>Follow camera guidance</Text>
                            <Text style={styles.stepText}>Move through each instruction at your own pace.</Text>
                        </View>
                    </View>
                </View>

                <Text style={styles.prototypeNote}>
                    Building 303 graph data is unverified. Confirm routes on site before use.
                </Text>
            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: "#f5f8fb" },
    content: { paddingBottom: 34 },
    hero: { paddingHorizontal: 20, paddingTop: 22, paddingBottom: 24, backgroundColor: "#0a3151" },
    pilotBadge: { alignSelf: "flex-start", paddingHorizontal: 9, paddingVertical: 5, borderRadius: 999, backgroundColor: "#2c5575" },
    pilotBadgeText: { color: "#dbeeff", fontSize: 9, fontWeight: "900", letterSpacing: 1 },
    title: { maxWidth: 330, marginTop: 13, color: "#ffffff", fontSize: 31, fontWeight: "900", lineHeight: 38 },
    subtitle: { maxWidth: 350, marginTop: 8, color: "#c9dce9", fontSize: 15, lineHeight: 22 },
    searchButton: { minHeight: 56, flexDirection: "row", alignItems: "center", marginTop: 20, paddingHorizontal: 16, borderRadius: 16, backgroundColor: "#ffffff" },
    searchIcon: { marginRight: 10, color: "#395d77", fontSize: 28, lineHeight: 30, transform: [{ rotate: "-20deg" }] },
    searchText: { flex: 1, color: "#526b7e", fontSize: 15, fontWeight: "600" },
    searchChevron: { color: "#647e92", fontSize: 30, lineHeight: 32 },
    locationSection: { paddingHorizontal: 18, paddingTop: 22 },
    sectionHeadingRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 11 },
    sectionTitle: { color: "#173b58", fontSize: 17, fontWeight: "900" },
    readyBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 999, backgroundColor: "#dff4ec" },
    readyBadgeText: { color: "#087f5b", fontSize: 9, fontWeight: "900", letterSpacing: 0.7 },
    locationCard: { minHeight: 88, flexDirection: "row", alignItems: "center", padding: 15, borderWidth: 1, borderColor: "#d9e3eb", borderRadius: 18, backgroundColor: "#ffffff" },
    locationMarker: { width: 43, height: 43, alignItems: "center", justifyContent: "center", borderWidth: 2, borderColor: "#94a8b9", borderRadius: 22, backgroundColor: "#eef3f7" },
    locationMarkerReady: { borderColor: "#087f5b", backgroundColor: "#dff4ec" },
    locationMarkerCenter: { width: 10, height: 10, borderRadius: 5, backgroundColor: "#087f5b" },
    locationCopy: { flex: 1, marginHorizontal: 12 },
    locationTitle: { color: "#173b58", fontSize: 15, fontWeight: "800" },
    locationDetail: { marginTop: 4, color: "#6b8092", fontSize: 12, lineHeight: 17 },
    scanButton: { minWidth: 58, minHeight: 38, alignItems: "center", justifyContent: "center", paddingHorizontal: 10, borderRadius: 11, backgroundColor: "#e7f1ff" },
    scanButtonText: { color: "#0057b8", fontSize: 12, fontWeight: "900" },
    arSpikeSection: { paddingHorizontal: 18, paddingTop: 20 },
    arSpikeCard: { padding: 18, borderWidth: 1, borderColor: "#a5d8cc", borderRadius: 18, backgroundColor: "#e8f7f3" },
    arSpikeBadge: { alignSelf: "flex-start", paddingHorizontal: 8, paddingVertical: 4, borderRadius: 999, backgroundColor: "#087f5b" },
    arSpikeBadgeText: { color: "#ffffff", fontSize: 9, fontWeight: "900", letterSpacing: 0.7 },
    arSpikeTitle: { marginTop: 10, color: "#164e43", fontSize: 17, fontWeight: "900" },
    arSpikeText: { marginTop: 5, color: "#3f665e", fontSize: 13, lineHeight: 19 },
    arSpikeButton: { alignSelf: "flex-start", marginTop: 13, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 11, backgroundColor: "#087f5b" },
    arSpikeButtonText: { color: "#ffffff", fontSize: 13, fontWeight: "900" },
    popularSection: { paddingTop: 24 },
    popularHeading: { paddingHorizontal: 18 },
    popularList: { paddingHorizontal: 18, paddingBottom: 2 },
    popularGap: { width: 10 },
    apiHint: { marginHorizontal: 18, color: "#9a5b13", fontSize: 12 },
    seeAll: { color: "#0057b8", fontSize: 13, fontWeight: "800" },
    howItWorks: { marginHorizontal: 18, marginTop: 26, padding: 19, borderRadius: 20, backgroundColor: "#e8f2ff" },
    howTitle: { marginBottom: 17, color: "#0e3c64", fontSize: 17, fontWeight: "900" },
    stepRow: { flexDirection: "row", alignItems: "center" },
    stepNumber: { width: 30, height: 30, alignItems: "center", justifyContent: "center", borderRadius: 15, backgroundColor: "#0057b8" },
    stepNumberText: { color: "#ffffff", fontSize: 13, fontWeight: "900" },
    stepCopy: { flex: 1, marginLeft: 12 },
    stepTitle: { color: "#173b58", fontSize: 14, fontWeight: "800" },
    stepText: { marginTop: 2, color: "#526d82", fontSize: 12, lineHeight: 17 },
    stepConnector: { width: 2, height: 14, marginLeft: 14, backgroundColor: "#8eb9e0" },
    prototypeNote: { marginHorizontal: 28, marginTop: 18, color: "#7a8c9c", fontSize: 11, lineHeight: 16, textAlign: "center" },
    pressed: { opacity: 0.74 },
});
