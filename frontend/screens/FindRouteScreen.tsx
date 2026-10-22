import { useEffect, useMemo, useState, type ComponentProps } from "react";
import {
    ActivityIndicator,
    Linking,
    Modal,
    Platform,
    Pressable,
    ScrollView,
    SectionList,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { NativeStackScreenProps } from "@react-navigation/native-stack";

import PageHeader from "../components/PageHeader";
import { RootStackParamList } from "../navigation/AppNavigator";
import { getBuildingRoute, getNavigationBuildings } from "../services/api";
import { formatDistance, formatDuration, mapsDirectionsUrl, type TravelMode } from "../services/campusNavigation";
import type { BuildingRoute, NavigationBuilding } from "../types/wayfinding";

type Props = NativeStackScreenProps<RootStackParamList, "FindRoute">;
type IoniconName = ComponentProps<typeof Ionicons>["name"];
type PickerTarget = "from" | "to";

const OFFICIAL_MAP_URL = "https://maps.auckland.ac.nz";
const MODES: { mode: TravelMode; label: string; icon: IoniconName }[] = [
    { mode: "walk", label: "Walk", icon: "walk-outline" },
    { mode: "transit", label: "Public transport", icon: "bus-outline" },
    { mode: "drive", label: "Drive", icon: "car-outline" },
];

export default function FindRouteScreen({ navigation, route }: Props) {
    const insets = useSafeAreaInsets();
    const [buildings, setBuildings] = useState<NavigationBuilding[]>([]);
    const [loadingBuildings, setLoadingBuildings] = useState(true);
    const [buildingsError, setBuildingsError] = useState("");
    const [attempt, setAttempt] = useState(0);

    // A null start means "my current location"; Maps then routes from GPS.
    const [from, setFrom] = useState<NavigationBuilding | null>(null);
    const [to, setTo] = useState<NavigationBuilding | null>(null);
    const [mode, setMode] = useState<TravelMode>("walk");
    const [picker, setPicker] = useState<PickerTarget | null>(null);

    const [plan, setPlan] = useState<BuildingRoute | null>(null);
    const [planning, setPlanning] = useState(false);
    const [planError, setPlanError] = useState("");

    useEffect(() => {
        let active = true;
        setLoadingBuildings(true);
        setBuildingsError("");
        getNavigationBuildings()
            .then((items) => {
                if (!active) return;
                setBuildings(items);
                const wanted = route.params?.destination;
                if (wanted) setTo(items.find((item) => item.number === wanted) ?? null);
            })
            .catch(() => { if (active) setBuildingsError("Could not load campus buildings."); })
            .finally(() => { if (active) setLoadingBuildings(false); });
        return () => { active = false; };
    }, [attempt, route.params?.destination]);

    useEffect(() => {
        setPlan(null);
        setPlanError("");
        setPlanning(false);
        if (!from || !to) return;
        let active = true;
        setPlanning(true);
        getBuildingRoute(from.id, to.id)
            .then((result) => { if (active) setPlan(result); })
            .catch((error) => { if (active) setPlanError(error instanceof Error ? error.message : "Could not plan this route."); })
            .finally(() => { if (active) setPlanning(false); });
        return () => { active = false; };
    }, [from, to]);

    function choose(target: PickerTarget, building: NavigationBuilding | null) {
        if (target === "from") setFrom(building);
        else setTo(building);
        setPicker(null);
    }

    function swap() {
        if (!from || !to) return;
        setFrom(to);
        setTo(from);
    }

    function startDirections() {
        if (!to) return;
        Linking.openURL(mapsDirectionsUrl({
            platform: Platform.OS,
            origin: from?.maps_query ?? null,
            destination: to.maps_query,
            mode,
        })).catch(() => setPlanError("Could not open your maps app."));
    }

    return (
        <SafeAreaView edges={['top','left','right']} style={styles.container}>
            <ScrollView contentContainerStyle={[styles.scrollContent, { paddingBottom: 120 + insets.bottom }]} showsVerticalScrollIndicator={false}>
                <PageHeader
                    title="Outdoor wayfinder"
                    description="Pick where you're going. We'll plan the route, then open Maps for live turn-by-turn directions."
                    navigation={navigation}
                    background={true}
                    leftIcon="back"
                />

                <View style={styles.tripCard}>
                    <PlaceRow
                        label="From"
                        icon="radio-button-on"
                        iconColor="#52B3B1"
                        value={from ? `${from.number} · ${from.name}` : "My current location"}
                        muted={false}
                        onPress={() => setPicker("from")}
                    />
                    <View style={styles.tripDivider}/>
                    <PlaceRow
                        label="To"
                        icon="location"
                        iconColor="#52B3B1"
                        value={to ? `${to.number} · ${to.name}` : "Choose a building"}
                        muted={!to}
                        onPress={() => setPicker("to")}
                    />
                    {from && to ? (
                        <TouchableOpacity style={styles.swapButton} accessibilityRole="button" accessibilityLabel="Swap start and destination" onPress={swap}>
                            <Ionicons name="swap-vertical" size={20} color="#52B3B1"/>
                        </TouchableOpacity>
                    ) : null}
                </View>

                {loadingBuildings ? <ActivityIndicator style={styles.spacer} color="#52B3B1"/> : null}
                {buildingsError ? (
                    <View style={styles.errorCard}>
                        <Text style={styles.errorText}>{buildingsError}</Text>
                        <TouchableOpacity accessibilityRole="button" onPress={() => setAttempt((value) => value + 1)}>
                            <Text style={styles.link}>Try again</Text>
                        </TouchableOpacity>
                    </View>
                ) : null}

                <Text style={styles.sectionLabel}>How are you getting there?</Text>
                <View style={styles.modeRow}>
                    {MODES.map((item) => {
                        const selected = item.mode === mode;
                        return (
                            <TouchableOpacity
                                key={item.mode}
                                accessibilityRole="button"
                                accessibilityState={{ selected }}
                                style={[styles.modeChip, selected && styles.modeChipSelected]}
                                onPress={() => setMode(item.mode)}
                            >
                                <Ionicons name={item.icon} size={20} color={selected ? "#173b39" : "#287d7b"}/>
                                <Text style={[styles.modeText, selected && styles.modeTextSelected]}>{item.label}</Text>
                            </TouchableOpacity>
                        );
                    })}
                </View>

                {!to ? (
                    <EmptyHint icon="map-outline" text="Choose a destination building to see your route."/>
                ) : !from ? (
                    <EmptyHint
                        icon="locate-outline"
                        text={`Maps will plan the route to ${to.name} from where you are now. Choose a start building to preview the route here.`}
                    />
                ) : null}

                {planning ? <ActivityIndicator style={styles.spacer} color="#52B3B1"/> : null}
                {planError ? <View style={styles.errorCard}><Text style={styles.errorText}>{planError}</Text></View> : null}

                {plan ? <RouteSummary plan={plan} mode={mode} onUseTransit={() => setMode("transit")}/> : null}

                <TouchableOpacity accessibilityRole="link" style={styles.officialLink} onPress={() => Linking.openURL(OFFICIAL_MAP_URL)}>
                    <Ionicons name="open-outline" size={16} color="#287d7b"/>
                    <Text style={styles.link}>Open the official University map</Text>
                </TouchableOpacity>
            </ScrollView>

            <View style={[styles.footer, { paddingBottom: Math.max(24, insets.bottom + 12) }]}>
                <TouchableOpacity
                    accessibilityRole="button"
                    accessibilityState={{ disabled: !to }}
                    disabled={!to}
                    style={[styles.startButton, !to && styles.startButtonDisabled]}
                    onPress={startDirections}
                >
                    <Ionicons name="navigate" size={20} color="#173b39"/>
                    <Text style={styles.startText}>Start directions in Maps</Text>
                </TouchableOpacity>
            </View>

            <BuildingPicker
                target={picker}
                buildings={buildings}
                exclude={picker === "from" ? to : from}
                onClose={() => setPicker(null)}
                onChoose={choose}
            />
        </SafeAreaView>
    );
}

function PlaceRow({ label, icon, iconColor, value, muted, onPress }: {
    label: string; icon: IoniconName; iconColor: string; value: string; muted: boolean; onPress: () => void;
}) {
    return (
        <TouchableOpacity style={styles.placeRow} accessibilityRole="button" accessibilityLabel={`${label}: ${value}`} onPress={onPress}>
            <Ionicons name={icon} size={20} color={iconColor}/>
            <View style={styles.placeText}>
                <Text style={styles.placeLabel}>{label}</Text>
                <Text style={[styles.placeValue, muted && styles.placeValueMuted]} numberOfLines={1}>{value}</Text>
            </View>
        </TouchableOpacity>
    );
}

function EmptyHint({ icon, text }: { icon: IoniconName; text: string }) {
    return (
        <View style={styles.hintCard}>
            <View style={styles.hintIcon}><Ionicons name={icon} size={22} color="#52B3B1"/></View>
            <Text style={styles.hintText}>{text}</Text>
        </View>
    );
}

function RouteSummary({ plan, mode, onUseTransit }: { plan: BuildingRoute; mode: TravelMode; onUseTransit: () => void }) {
    const estimated = plan.route_source === "estimate";
    return (
        <View>
            <View style={styles.summaryCard}>
                <View style={styles.summaryTop}>
                    <View>
                        <Text style={styles.summaryTime}>{formatDuration(plan.estimated_minutes)}</Text>
                        <Text style={styles.summaryMeta}>{formatDistance(plan.total_distance_m)} walk{estimated ? " (estimated)" : ""}</Text>
                    </View>
                    <View style={styles.summaryIcon}><Ionicons name="walk" size={26} color="#52B3B1"/></View>
                </View>
                <View style={styles.badgeRow}>
                    <Badge icon={plan.same_campus ? "business-outline" : "git-compare-outline"} text={plan.same_campus ? plan.from_building.campus_name : "Different campuses"}/>
                    <Badge icon={estimated ? "analytics-outline" : "checkmark-circle-outline"} text={estimated ? "Estimated route" : "Campus path"}/>
                </View>
            </View>

            {plan.recommended_mode === "transit" && mode === "walk" ? (
                <View style={styles.tipCard}>
                    <Ionicons name="bus-outline" size={20} color="#52B3B1"/>
                    <Text style={styles.tipText}>That's a long walk. Public transport may be quicker.</Text>
                    <TouchableOpacity accessibilityRole="button" onPress={onUseTransit}><Text style={styles.link}>Use it</Text></TouchableOpacity>
                </View>
            ) : null}

            <Text style={styles.sectionLabel}>Route</Text>
            <View style={styles.stepsCard}>
                {plan.steps.map((step, index) => (
                    <View key={index} style={styles.stepRow}>
                        <View style={styles.stepRail}>
                            <View style={[styles.stepDot, index === plan.steps.length - 1 && styles.stepDotLast]}>
                                <Text style={[styles.stepNumber, index === plan.steps.length - 1 && styles.stepNumberLast]}>{index + 1}</Text>
                            </View>
                            {index < plan.steps.length - 1 ? <View style={styles.stepLine}/> : null}
                        </View>
                        <View style={styles.stepBody}>
                            <Text style={styles.stepText}>{step.instruction}</Text>
                            {step.distance_m > 0 ? <Text style={styles.stepDistance}>{formatDistance(step.distance_m)}</Text> : null}
                        </View>
                    </View>
                ))}
            </View>
            <Text style={styles.notice}>{plan.data_notice}</Text>
        </View>
    );
}

function Badge({ icon, text }: { icon: IoniconName; text: string }) {
    return (
        <View style={styles.badge}>
            <Ionicons name={icon} size={14} color="#52B3B1"/>
            <Text style={styles.badgeText}>{text}</Text>
        </View>
    );
}

function BuildingPicker({ target, buildings, exclude, onClose, onChoose }: {
    target: PickerTarget | null;
    buildings: NavigationBuilding[];
    exclude: NavigationBuilding | null;
    onClose: () => void;
    onChoose: (target: PickerTarget, building: NavigationBuilding | null) => void;
}) {
    const insets = useSafeAreaInsets();
    const [query, setQuery] = useState("");
    useEffect(() => { if (target) setQuery(""); }, [target]);

    const sections = useMemo(() => {
        const term = query.trim().toLowerCase();
        const grouped = new Map<string, NavigationBuilding[]>();
        for (const building of buildings) {
            if (exclude && building.id === exclude.id) continue;
            const haystack = `${building.number} ${building.name} ${building.address ?? ""} ${building.campus_name}`.toLowerCase();
            if (term && !haystack.includes(term)) continue;
            grouped.set(building.campus_name, [...(grouped.get(building.campus_name) ?? []), building]);
        }
        return [...grouped].map(([title, data]) => ({ title, data }));
    }, [buildings, exclude, query]);

    return (
        <Modal visible={target !== null} transparent animationType="slide" onRequestClose={onClose}>
            <View style={styles.sheetBackdrop}>
                <Pressable style={styles.sheetDismiss} accessibilityRole="button" accessibilityLabel="Close building list" onPress={onClose}/>
                <View style={[styles.sheet, { paddingBottom: Math.max(24, insets.bottom + 12) }]}>
                    <View style={styles.sheetHeader}>
                        <Text style={styles.sheetTitle}>{target === "from" ? "Starting from" : "Going to"}</Text>
                        <TouchableOpacity accessibilityRole="button" accessibilityLabel="Close" onPress={onClose}>
                            <Ionicons name="close" size={24} color="#52B3B1"/>
                        </TouchableOpacity>
                    </View>
                    <View style={styles.searchBox}>
                        <Ionicons name="search" size={18} color="#888"/>
                        <TextInput
                            style={styles.searchInput}
                            placeholder="Building name, number or street"
                            placeholderTextColor="#999"
                            value={query}
                            onChangeText={setQuery}
                            accessibilityLabel="Search buildings"
                        />
                    </View>
                    <SectionList
                        sections={sections}
                        keyExtractor={(item) => String(item.id)}
                        keyboardShouldPersistTaps="handled"
                        ListHeaderComponent={target === "from" ? (
                            <TouchableOpacity style={styles.buildingRow} accessibilityRole="button" onPress={() => onChoose("from", null)}>
                                <View style={[styles.buildingBadge, styles.currentBadge]}><Ionicons name="locate" size={18} color="#173b39"/></View>
                                <View style={styles.buildingText}>
                                    <Text style={styles.buildingName}>My current location</Text>
                                    <Text style={styles.buildingAddress}>Maps uses your phone's GPS</Text>
                                </View>
                            </TouchableOpacity>
                        ) : null}
                        ListEmptyComponent={<Text style={styles.emptyList}>No buildings match "{query}".</Text>}
                        renderSectionHeader={({ section }) => <Text style={styles.sheetSection}>{section.title}</Text>}
                        renderItem={({ item }) => (
                            <TouchableOpacity style={styles.buildingRow} accessibilityRole="button" onPress={() => onChoose(target ?? "to", item)}>
                                <View style={styles.buildingBadge}><Text style={styles.buildingNumber}>{item.number}</Text></View>
                                <View style={styles.buildingText}>
                                    <Text style={styles.buildingName}>{item.name}</Text>
                                    {item.address ? <Text style={styles.buildingAddress}>{item.address}</Text> : null}
                                </View>
                            </TouchableOpacity>
                        )}
                    />
                </View>
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, width: "100%", maxWidth: 640, alignSelf: "center", backgroundColor: "white" },
    scrollContent: { paddingBottom: 120 },
    header: { backgroundColor: "#CFEFED", paddingBottom: 44 },
    headerText: { paddingHorizontal: "7%" },
    title: { fontSize: 24, fontWeight: "700", color: "#111" },
    subtitle: { fontSize: 14, color: "#466b68", lineHeight: 21, marginTop: 8 },

    tripCard: {
        marginHorizontal: "7%", marginTop: 16, backgroundColor: "white",
        borderRadius: 18, borderWidth: 1, borderColor: "#EEEEEE", paddingHorizontal: 16,
        shadowColor: "#000", shadowOpacity: 0.06, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 2,
    },
    placeRow: { flexDirection: "row", alignItems: "center", minHeight: 64, paddingRight: 44 },
    placeText: { flex: 1, marginLeft: 14 },
    placeLabel: { fontSize: 12, color: "#888", fontWeight: "600" },
    placeValue: { fontSize: 15, color: "#111", fontWeight: "600", marginTop: 2 },
    placeValueMuted: { color: "#999", fontWeight: "500" },
    tripDivider: { height: 1, backgroundColor: "#EEEEEE", marginLeft: 34 },
    swapButton: {
        position: "absolute", right: 12, top: 42, width: 44, height: 44, borderRadius: 22,
        backgroundColor: "#E8F6F6", alignItems: "center", justifyContent: "center",
    },

    sectionLabel: { marginHorizontal: "7%", marginTop: 24, marginBottom: 10, fontSize: 15, fontWeight: "700", color: "#111" },
    modeRow: { flexDirection: "row", gap: 8, marginHorizontal: "7%" },
    modeChip: {
        flex: 1, minHeight: 64, borderRadius: 14, borderWidth: 1, borderColor: "#EEEEEE",
        backgroundColor: "white", alignItems: "center", justifyContent: "center", gap: 4, paddingHorizontal: 4,
    },
    modeChipSelected: { backgroundColor: "#52B3B1", borderColor: "#52B3B1" },
    modeText: { fontSize: 12, fontWeight: "600", color: "#287d7b", textAlign: "center" },
    modeTextSelected: { color: "#173b39" },

    hintCard: {
        flexDirection: "row", alignItems: "center", gap: 12, marginHorizontal: "7%", marginTop: 20,
        backgroundColor: "#E8F6F6", borderRadius: 18, padding: 16,
    },
    hintIcon: { width: 40, height: 40, borderRadius: 20, backgroundColor: "white", alignItems: "center", justifyContent: "center" },
    hintText: { flex: 1, fontSize: 14, color: "#2f4f4d", lineHeight: 20 },

    summaryCard: { marginHorizontal: "7%", marginTop: 20, backgroundColor: "#CFEFED", borderRadius: 18, padding: 18 },
    summaryTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
    summaryTime: { fontSize: 28, fontWeight: "800", color: "#173b39" },
    summaryMeta: { fontSize: 14, color: "#466b68", marginTop: 2 },
    summaryIcon: { width: 52, height: 52, borderRadius: 26, backgroundColor: "white", alignItems: "center", justifyContent: "center" },
    badgeRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 14 },
    badge: {
        flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: "white",
        borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5,
    },
    badgeText: { fontSize: 12, fontWeight: "600", color: "#52B3B1" },

    tipCard: {
        flexDirection: "row", alignItems: "center", gap: 10, marginHorizontal: "7%", marginTop: 12,
        borderRadius: 14, borderWidth: 1, borderColor: "#CFEFED", backgroundColor: "#E8F6F6", padding: 12,
    },
    tipText: { flex: 1, fontSize: 13, color: "#2f4f4d" },

    stepsCard: { marginHorizontal: "7%", borderRadius: 18, borderWidth: 1, borderColor: "#EEEEEE", padding: 16 },
    stepRow: { flexDirection: "row" },
    stepRail: { width: 28, alignItems: "center" },
    stepDot: { width: 26, height: 26, borderRadius: 13, backgroundColor: "#E8F6F6", alignItems: "center", justifyContent: "center" },
    stepDotLast: { backgroundColor: "#52B3B1" },
    stepNumber: { fontSize: 12, fontWeight: "700", color: "#52B3B1" },
    stepNumberLast: { color: "#173b39" },
    stepLine: { width: 2, flex: 1, minHeight: 14, backgroundColor: "#CFEFED", marginVertical: 2 },
    stepBody: { flex: 1, marginLeft: 12, paddingBottom: 16 },
    stepText: { fontSize: 14, color: "#111", lineHeight: 20 },
    stepDistance: { fontSize: 12, color: "#888", marginTop: 2 },
    notice: { marginHorizontal: "7%", marginTop: 10, fontSize: 12, color: "#777", lineHeight: 17 },

    errorCard: { marginHorizontal: "7%", marginTop: 16, borderRadius: 14, backgroundColor: "#FDECEA", padding: 14, gap: 6 },
    errorText: { fontSize: 14, color: "#8A1C14" },
    link: { fontSize: 14, fontWeight: "700", color: "#287d7b" },
    officialLink: { flexDirection: "row", alignItems: "center", gap: 6, marginHorizontal: "7%", marginTop: 20, minHeight: 44 },
    spacer: { marginTop: 20 },

    footer: {
        position: "absolute", left: 0, right: 0, bottom: 0, paddingHorizontal: "7%", paddingTop: 12, paddingBottom: 24,
        backgroundColor: "white", borderTopWidth: 1, borderTopColor: "#EEEEEE",
    },
    startButton: {
        height: 54, borderRadius: 14, backgroundColor: "#52B3B1",
        flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
    },
    startButtonDisabled: { backgroundColor: "#A9CFCE" },
    startText: { fontSize: 16, fontWeight: "700", color: "#173b39" },

    sheetBackdrop: { flex: 1, backgroundColor: "rgba(13, 64, 90, 0.45)", justifyContent: "flex-end" },
    sheetDismiss: { flex: 1 },
    sheet: {
        maxHeight: "80%", backgroundColor: "white", borderTopLeftRadius: 18, borderTopRightRadius: 18,
        paddingHorizontal: 20, paddingTop: 18, paddingBottom: 24,
    },
    sheetHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 12 },
    sheetTitle: { fontSize: 18, fontWeight: "700", color: "#111" },
    searchBox: {
        flexDirection: "row", alignItems: "center", gap: 8, borderRadius: 14, backgroundColor: "#F4F7F7",
        paddingHorizontal: 12, marginBottom: 8,
    },
    searchInput: { flex: 1, minHeight: 46, fontSize: 15, color: "#111" },
    sheetSection: { fontSize: 12, fontWeight: "700", color: "#888", textTransform: "uppercase", letterSpacing: 0.6, marginTop: 14, marginBottom: 6, backgroundColor: "white" },
    buildingRow: { flexDirection: "row", alignItems: "center", minHeight: 58, gap: 12 },
    buildingBadge: { minWidth: 46, height: 36, borderRadius: 12, backgroundColor: "#E8F6F6", alignItems: "center", justifyContent: "center", paddingHorizontal: 6 },
    currentBadge: { backgroundColor: "#52B3B1" },
    buildingNumber: { fontSize: 13, fontWeight: "800", color: "#52B3B1" },
    buildingText: { flex: 1 },
    buildingName: { fontSize: 15, fontWeight: "600", color: "#111" },
    buildingAddress: { fontSize: 12, color: "#777", marginTop: 2 },
    emptyList: { fontSize: 14, color: "#777", paddingVertical: 20, textAlign: "center" },
});
