import { useEffect, useMemo, useState } from "react";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import {
    ActivityIndicator,
    FlatList,
    Pressable,
    SafeAreaView,
    StyleSheet,
    Text,
    TextInput,
    View,
} from "react-native";

import WayfindingDestinationCard from "../components/WayfindingDestinationCard";
import { RootStackParamList } from "../navigation/AppNavigator";
import { getNavigationDestinations } from "../services/api";
import {
    NavigationDestination,
    toDisplayDestination,
} from "../types/wayfinding";

type Props = NativeStackScreenProps<RootStackParamList, "DestinationSearch">;
type Filter = "all" | "lab" | "tutorial";

const FILTERS: { key: Filter; label: string }[] = [
    { key: "all", label: "All places" },
    { key: "lab", label: "Labs" },
    { key: "tutorial", label: "Tutorial rooms" },
];

export default function DestinationSearchScreen({ navigation, route }: Props) {
    const checkpointCode = route.params?.checkpointCode;
    const [query, setQuery] = useState("");
    const [filter, setFilter] = useState<Filter>("all");
    const [destinations, setDestinations] = useState<NavigationDestination[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [retryCount, setRetryCount] = useState(0);

    useEffect(() => {
        let cancelled = false;
        const timer = setTimeout(async () => {
            setLoading(true);
            setError(null);
            try {
                const items = await getNavigationDestinations(query);
                if (!cancelled) {
                    setDestinations(items);
                }
            } catch (requestError) {
                if (!cancelled) {
                    setDestinations([]);
                    setError(
                        requestError instanceof Error
                            ? requestError.message
                            : "Unable to load destinations"
                    );
                }
            } finally {
                if (!cancelled) {
                    setLoading(false);
                }
            }
        }, 250);
        return () => {
            cancelled = true;
            clearTimeout(timer);
        };
    }, [query, retryCount]);

    const results = useMemo(() => {
        return destinations.filter((destination) => {
            const matchesFilter =
                filter === "all"
                || (filter === "lab" && destination.category === "lab")
                || (filter === "tutorial" && destination.category === "tutorial_room");
            return matchesFilter;
        });
    }, [destinations, filter]);

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.searchSection}>
                <View style={styles.searchBox}>
                    <Text style={styles.searchIcon}>⌕</Text>
                    <TextInput
                        accessibilityLabel="Search rooms and facilities"
                        autoCapitalize="characters"
                        autoCorrect={false}
                        clearButtonMode="while-editing"
                        onChangeText={setQuery}
                        placeholder="Search room, lecture theatre, facility…"
                        placeholderTextColor="#75899b"
                        returnKeyType="search"
                        style={styles.input}
                        value={query}
                    />
                </View>

                <FlatList
                    horizontal
                    data={FILTERS}
                    keyExtractor={(item) => item.key}
                    contentContainerStyle={styles.filters}
                    showsHorizontalScrollIndicator={false}
                    renderItem={({ item }) => {
                        const active = item.key === filter;
                        return (
                            <Pressable
                                accessibilityRole="button"
                                onPress={() => setFilter(item.key)}
                                style={[styles.filter, active && styles.filterActive]}
                            >
                                <Text style={[styles.filterText, active && styles.filterTextActive]}>
                                    {item.label}
                                </Text>
                            </Pressable>
                        );
                    }}
                />
            </View>

            <FlatList
                data={results}
                keyExtractor={(item) => item.code}
                keyboardShouldPersistTaps="handled"
                contentContainerStyle={styles.results}
                ItemSeparatorComponent={() => <View style={styles.separator} />}
                ListHeaderComponent={(
                    <View style={styles.resultsHeader}>
                        <View>
                            <Text style={styles.eyebrow}>BUILDING 303</Text>
                            <Text style={styles.heading}>Where are you going?</Text>
                        </View>
                        <View style={styles.demoBadge}>
                            <Text style={styles.demoBadgeText}>UNVERIFIED</Text>
                        </View>
                    </View>
                )}
                ListEmptyComponent={(
                    <View style={styles.emptyState}>
                        {loading ? (
                            <>
                                <ActivityIndicator size="large" color="#0057b8" />
                                <Text style={styles.emptyText}>Loading Building 303…</Text>
                            </>
                        ) : error ? (
                            <>
                                <Text style={styles.emptyTitle}>Couldn’t reach the wayfinding API</Text>
                                <Text style={styles.emptyText}>{error}</Text>
                                <Pressable
                                    accessibilityRole="button"
                                    onPress={() => setRetryCount((value) => value + 1)}
                                    style={styles.retryButton}
                                >
                                    <Text style={styles.retryButtonText}>Try again</Text>
                                </Pressable>
                            </>
                        ) : (
                            <>
                                <Text style={styles.emptyTitle}>No places found</Text>
                                <Text style={styles.emptyText}>
                                    Try a room number such as 303-103 or clear the filter.
                                </Text>
                            </>
                        )}
                    </View>
                )}
                renderItem={({ item }) => (
                    <WayfindingDestinationCard
                        destination={toDisplayDestination(item)}
                        onPress={() => navigation.navigate("RoutePreview", {
                            destinationCode: item.code,
                            checkpointCode,
                        })}
                    />
                )}
            />
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: "#f5f8fb",
    },
    searchSection: {
        paddingTop: 14,
        borderBottomWidth: 1,
        borderBottomColor: "#e1e8ef",
        backgroundColor: "#ffffff",
    },
    searchBox: {
        minHeight: 52,
        flexDirection: "row",
        alignItems: "center",
        marginHorizontal: 18,
        paddingHorizontal: 15,
        borderWidth: 1,
        borderColor: "#cdd9e3",
        borderRadius: 16,
        backgroundColor: "#f8fafc",
    },
    searchIcon: {
        marginRight: 10,
        color: "#526d82",
        fontSize: 27,
        lineHeight: 29,
        transform: [{ rotate: "-20deg" }],
    },
    input: {
        flex: 1,
        color: "#102a43",
        fontSize: 15,
        fontWeight: "600",
    },
    filters: {
        gap: 8,
        paddingHorizontal: 18,
        paddingVertical: 13,
    },
    filter: {
        paddingHorizontal: 15,
        paddingVertical: 9,
        borderWidth: 1,
        borderColor: "#cfdbe5",
        borderRadius: 999,
        backgroundColor: "#ffffff",
    },
    filterActive: {
        borderColor: "#0057b8",
        backgroundColor: "#0057b8",
    },
    filterText: {
        color: "#405a70",
        fontSize: 13,
        fontWeight: "700",
    },
    filterTextActive: {
        color: "#ffffff",
    },
    results: {
        flexGrow: 1,
        padding: 18,
        paddingBottom: 36,
    },
    resultsHeader: {
        flexDirection: "row",
        alignItems: "flex-start",
        justifyContent: "space-between",
        marginBottom: 18,
    },
    eyebrow: {
        color: "#0057b8",
        fontSize: 11,
        fontWeight: "900",
        letterSpacing: 1,
    },
    heading: {
        marginTop: 5,
        color: "#102a43",
        fontSize: 25,
        fontWeight: "900",
    },
    demoBadge: {
        paddingHorizontal: 8,
        paddingVertical: 5,
        borderRadius: 999,
        backgroundColor: "#fff0c2",
    },
    demoBadgeText: {
        color: "#73510b",
        fontSize: 9,
        fontWeight: "900",
        letterSpacing: 0.7,
    },
    separator: {
        height: 10,
    },
    emptyState: {
        alignItems: "center",
        marginTop: 52,
        padding: 28,
    },
    emptyTitle: {
        color: "#243b53",
        fontSize: 19,
        fontWeight: "800",
    },
    emptyText: {
        marginTop: 8,
        color: "#60758a",
        fontSize: 15,
        lineHeight: 22,
        textAlign: "center",
    },
    retryButton: {
        marginTop: 16,
        paddingHorizontal: 18,
        paddingVertical: 11,
        borderRadius: 12,
        backgroundColor: "#0057b8",
    },
    retryButtonText: {
        color: "#ffffff",
        fontSize: 14,
        fontWeight: "800",
    },
});
