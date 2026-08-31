import { useMemo, useState } from "react";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import {
    FlatList,
    Pressable,
    SafeAreaView,
    StyleSheet,
    Text,
    TextInput,
    View,
} from "react-native";

import WayfindingDestinationCard from "../components/WayfindingDestinationCard";
import { DEMO_DESTINATIONS } from "../data/wayfindingDemo";
import { RootStackParamList } from "../navigation/AppNavigator";

type Props = NativeStackScreenProps<RootStackParamList, "DestinationSearch">;
type Filter = "all" | "lecture" | "facility";

const FILTERS: { key: Filter; label: string }[] = [
    { key: "all", label: "All places" },
    { key: "lecture", label: "Lecture rooms" },
    { key: "facility", label: "Facilities" },
];

export default function DestinationSearchScreen({ navigation }: Props) {
    const [query, setQuery] = useState("");
    const [filter, setFilter] = useState<Filter>("all");

    const results = useMemo(() => {
        const term = query.trim().toLowerCase();
        return DEMO_DESTINATIONS.filter((destination) => {
            const matchesFilter =
                filter === "all"
                || (filter === "lecture" && destination.category === "lecture")
                || (filter === "facility" && destination.category === "facility");
            const matchesSearch = !term || [
                destination.name,
                destination.shortName,
                destination.code,
                destination.floor,
            ].some((value) => value.toLowerCase().includes(term));
            return matchesFilter && matchesSearch;
        });
    }, [filter, query]);

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
                            <Text style={styles.demoBadgeText}>DEMO</Text>
                        </View>
                    </View>
                )}
                ListEmptyComponent={(
                    <View style={styles.emptyState}>
                        <Text style={styles.emptyTitle}>No places found</Text>
                        <Text style={styles.emptyText}>
                            Try a room number such as 303-101 or clear the filter.
                        </Text>
                    </View>
                )}
                renderItem={({ item }) => (
                    <WayfindingDestinationCard
                        destination={item}
                        onPress={() => navigation.navigate("RoutePreview", {
                            destinationCode: item.code,
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
});
