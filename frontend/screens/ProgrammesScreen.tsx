import { SafeAreaView } from 'react-native-safe-area-context';
// Based on Kaitlyn's frontend/career-alignment screens at 154bfcd; layout preserved.
import { useEffect, useState } from "react";
import { StyleSheet, ScrollView, Text, TextInput, TouchableOpacity, View, Pressable } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import PageHeader from "../components/PageHeader";
import NavBar from "../components/NavBar";
import SignInPopup from "../components/SignInPopup";
import { useSession } from "../context/SessionContext";
import { Programme } from "../types/programme";
import { getProgrammes, searchProgrammes } from "../services/api";
import { useSaved } from "../context/SavedContext";

export default function ProgrammesScreen({ navigation }: any) {
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [programmes, setProgrammes] = useState<Programme[]>([]);
    const [search, setSearch] = useState("");
    const [showFilters, setShowFilters] = useState(false);
    const [selectedFaculties, setSelectedFaculties] = useState<string[]>([]);
    const [sortBy, setSortBy] = useState("Default");
    const [showSignIn, setShowSignIn] = useState(false);
    const { auth } = useSession();
    const token = auth?.access_token;
    const { toggleProgramme, isProgrammeSaved, notice } = useSaved();

    useEffect(() => {
        loadProgrammes();
    }, []);

    async function loadProgrammes() {
        setLoading(true); setError("");
        try {
            const data = await getProgrammes();
            setProgrammes(data);
        } catch (error) {
            setError("Could not load programmes. Please try again.");
        } finally { setLoading(false); }
    }

    function handleSearch(text: string) { setSearch(text); }

    function toggleFaculty(faculty: string) {
        if (faculty === "All") {
            setSelectedFaculties([]);
            return;
        }

        setSelectedFaculties(current => current.includes(faculty) ? current.filter(item => item !== faculty) : [...current, faculty]);
    }

    function formatProgramme(name: string) {
        return name.replace(/ (BBiomedSc|BHSc|MBChB|BNurs|BOptom|BPharm|BSc|BSportHPE|CertHSc)$/, " ($1)");
    }

    function formatFaculty(faculty: string | null) {
        if (!faculty) return "";
        return faculty.replace(/^Faculty of\s+/i, "");
    }

    function formatDuration(duration: string | null) {
        if (!duration) return "Duration unavailable";
        return duration.replace(/^Full[- ]?time:\s*/i, "");
    }

    function getProgrammeIcon(name: string) {
        const lower = name.toLowerCase();
        if (lower.includes("medicine")) return "medical-outline";
        if (lower.includes("optometry")) return "eye-outline";
        if (lower.includes("pharmacy")) return "medkit-outline";
        if (lower.includes("biomedical")) return "heart-outline";
        if (lower.includes("nurse")) return "star-outline";
        if (lower.includes("nutrition")) return "flask-outline";
        return "school-outline";
    }

    const faculties = [
        "All",
        ...Array.from(new Set(programmes.map(programme => programme.faculty?.trim()).filter((faculty): faculty is string => Boolean(faculty)))).sort((a, b) => a.localeCompare(b))
    ];

    const searchTerm = search.trim().toLowerCase();

    const filteredProgrammes = programmes
        .filter(programme => {
            const matchesSearch = [programme.name, programme.description, programme.faculty, programme.duration].some(value => (value ?? "").toLowerCase().includes(searchTerm));
            const matchesFaculty = selectedFaculties.length === 0 || selectedFaculties.includes(programme.faculty?.trim() ?? "");
            return matchesSearch && matchesFaculty;
        })
        .sort((a, b) => {
            if (sortBy === "A-Z") return a.name.localeCompare(b.name);
            if (sortBy === "Z-A") return b.name.localeCompare(a.name);
            return 0;
        });

    const hasActiveFilters = selectedFaculties.length > 0 || sortBy !== "Default";

    function clearFilters() {
        setSelectedFaculties([]);
        setSortBy("Default");
    }

    return (
        <SafeAreaView edges={['top','left','right']} style={styles.screen}>
            <ScrollView style={styles.container} showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
                <PageHeader title="Programmes" description="Explore programmes and find the right study pathway for you." navigation={navigation} background={true} leftIcon="menu" rightIcon="bookmark"/>

                <View style={styles.content}>
                    <View style={styles.divider}/>
                    {token && notice ? <Text accessibilityRole='alert'>{notice}</Text> : null}
                    <View style={styles.searchRow}>
                        <View style={styles.searchBar}>
                            <Ionicons name="search-outline" size={20} color="#888"/>
                            <TextInput style={styles.search} placeholder="Search programmes, or keywords..." placeholderTextColor="#999" value={search} onChangeText={handleSearch}/>
                        </View>
                        <TouchableOpacity style={[styles.filterButton, showFilters && styles.activeFilterButton]} onPress={() => setShowFilters(!showFilters)}>
                            <Ionicons name="filter-outline" size={21} color={showFilters ? "white" : "#666"}/>
                        </TouchableOpacity>
                    </View>

                    {showFilters && (
                        <View style={styles.filterBox}>
                            <View style={styles.filterHeader}>
                                <View style={styles.filterHeading}>
                                    <Ionicons name="options-outline" size={18} color="#52B3B1" />
                                    <Text style={styles.filterHeadingText}>Filter Programmes</Text>
                                </View>
                                <TouchableOpacity onPress={clearFilters} disabled={!hasActiveFilters}>
                                    <Text style={[styles.clearFilters, !hasActiveFilters && styles.clearDisabled]}>Clear All</Text>
                                </TouchableOpacity>
                            </View>

                            <View style={styles.filterDivider}/>

                            <Text style={styles.filterTitle}>Faculty</Text>
                            <View style={styles.facultyRow}>
                                {faculties.map(faculty => {
                                    const isSelected = faculty === "All" ? selectedFaculties.length === 0 : selectedFaculties.includes(faculty);

                                    return (
                                        <TouchableOpacity key={faculty} style={[styles.filterChip, isSelected && styles.activeFilterChip]} activeOpacity={0.7} onPress={() => toggleFaculty(faculty)}>
                                            {isSelected && <Ionicons name="checkmark" size={13} color="#FFFFFF" />}
                                            <Text style={[styles.filterText, isSelected && styles.activeFilterText]}>{faculty === "All" ? "All Faculties" : formatFaculty(faculty)}</Text>
                                        </TouchableOpacity>
                                    );
                                })}
                            </View>

                            <Text style={styles.filterTitle}>Sort By</Text>
                            <View style={styles.sortRow}>
                                {["Default", "A-Z", "Z-A"].map(option => {
                                    const isSelected = sortBy === option;

                                    return (
                                        <TouchableOpacity key={option} style={[styles.filterChip, styles.sortChip, isSelected && styles.activeFilterChip]} activeOpacity={0.7} onPress={() => setSortBy(option)}>
                                            <Text style={[styles.filterText, isSelected && styles.activeFilterText]}>{option}</Text>
                                        </TouchableOpacity>
                                    );
                                })}
                            </View>

                            <View style={styles.filterFooter}>
                                <Text style={styles.filterCount}>{filteredProgrammes.length} {filteredProgrammes.length === 1 ? "programme" : "programmes"} found</Text>
                                <TouchableOpacity style={styles.applyButton} onPress={() => setShowFilters(false)}>
                                    <Text style={styles.applyButtonText}>Show Results</Text>
                                    <Ionicons name="arrow-forward" size={15} color="#FFFFFF" />
                                </TouchableOpacity>
                            </View>
                        </View>
                    )}

                    {!loading && !error && (search.trim() || hasActiveFilters) ? (
                        <View style={styles.resultsRow}>
                            <Text style={styles.resultsText}>{filteredProgrammes.length} {filteredProgrammes.length === 1 ? "programme" : "programmes"} found</Text>
                            {hasActiveFilters && !showFilters && (
                                <TouchableOpacity onPress={clearFilters}>
                                    <Text style={styles.resetText}>Clear filters</Text>
                                </TouchableOpacity>
                            )}
                        </View>
                    ) : null}

                    {loading ? <Text>Loading programmes…</Text> : error ? <TouchableOpacity accessibilityRole="button" onPress={loadProgrammes}><Text accessibilityRole="alert">{error} Tap to retry.</Text></TouchableOpacity> : !filteredProgrammes.length ? <Text>No programmes match your search or filters.</Text> : null}
                    {filteredProgrammes.map((programme) => (
                        <TouchableOpacity key={programme.id} style={styles.card} onPress={() => navigation.navigate("ProgrammeDetails", {programmeId: programme.id})}>
                            <View style={styles.iconBox}>
                                <Ionicons name={getProgrammeIcon(programme.name)} size={28} color="#52B3B1"/>
                            </View>
                            <View style={styles.info}>
                                <Text style={styles.name} numberOfLines={2}>{formatProgramme(programme.name)}</Text>
                                <Text style={styles.faculty} numberOfLines={1}>{formatFaculty(programme.faculty)}</Text>
                                <View style={styles.metaRow}>
                                    <Ionicons name="time-outline" size={13} color="#777"/>
                                    <Text style={styles.metaText}>Full-time</Text>
                                    <Text style={styles.dot}>•</Text>
                                    <Text style={styles.metaText}>{formatDuration(programme.duration)}</Text>
                                </View>
                            </View>
                            <View style={styles.cardRight}>
                                <TouchableOpacity style={styles.bookmarkButton} accessibilityRole="button" accessibilityLabel={(isProgrammeSaved(programme.id) ? "Unsave " : "Save ") + programme.name} onPress={(event) => { event.stopPropagation(); if (!token) { setShowSignIn(true); return; } void toggleProgramme(programme.id); }}>
                                    <Ionicons name={isProgrammeSaved(programme.id) ? "bookmark" : "bookmark-outline"} size={20} color={isProgrammeSaved(programme.id) ? "#52B3B1" : "#666"}/>
                                </TouchableOpacity>
                                <Ionicons name="chevron-forward" size={20} color="#666"/>
                            </View>
                        </TouchableOpacity>
                    ))}
                </View>
            </ScrollView>
            <SignInPopup visible={showSignIn} onClose={() => setShowSignIn(false)} navigation={navigation}/>
            <NavBar navigation={navigation} activeScreen="Career"/>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    bookmarkButton: {minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center'},
    screen: {
        flex: 1,
        width: "100%", maxWidth: 640, alignSelf: "center",
        backgroundColor: "white"
    },
    container: {
        flex: 1,
        backgroundColor: "white",
    },
    content: {
        paddingHorizontal: "7%",
        paddingTop: 16
    },
    scrollContent: {
        paddingBottom: 100
    },
    divider: {
        height: 1,
        backgroundColor: "#EEEEEE",
        marginBottom: 20
    },
    searchRow: {
        flexDirection: "row",
        alignItems: "center",
        marginBottom: 18
    },
    searchBar: {
        flex: 1,
        height: 50,
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: "#F5F5F5",
        borderRadius: 16,
        paddingHorizontal: 16
    },
    search: {
        flex: 1,
        marginLeft: 8,
        fontSize: 13,
        color: "#111"
    },
    filterButton: {
        width: 50,
        height: 50,
        marginLeft: 10,
        backgroundColor: "white",
        borderRadius: 16,
        alignItems: "center",
        justifyContent: "center",
        borderWidth: 1,
        borderColor: "#EEEEEE"
    },
    activeFilterButton: {
        backgroundColor: "#52B3B1",
        borderColor: "#52B3B1"
    },
    filterBox: {
        backgroundColor: "#FFFFFF",
        borderWidth: 1,
        borderColor: "#EEEEEE",
        borderRadius: 16,
        padding: 15,
        marginBottom: 18
    },
    filterHeader: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between"
    },
    filterHeading: {
        flexDirection: "row",
        alignItems: "center",
        gap: 8
    },
    filterHeadingText: {
        fontSize: 12,
        fontWeight: "700",
        color: "#222222"
    },
    clearFilters: {
        fontSize: 11,
        fontWeight: "600",
        color: "#52B3B1"
    },
    clearDisabled: {
        color: "#BBBBBB"
    },
    filterDivider: {
        height: 1,
        backgroundColor: "#EEEEEE",
        marginVertical: 15
    },
    filterTitle: {
        fontSize: 11,
        fontWeight: "700",
        color: "#444444",
        marginBottom: 10
    },
    facultyRow: {
        flexDirection: "row",
        flexWrap: "wrap",
        gap: 8,
        marginBottom: 20
    },
    filterChip: { 
        flexDirection: "row", 
        alignItems: "center", 
        justifyContent: "center", 
        gap: 5, 
        paddingVertical: 10, 
        paddingHorizontal: 13, 
        borderRadius: 10, 
        backgroundColor: "#F7F7F7", 
        borderWidth: 1, 
        borderColor: "#EEEEEE" 
    },
    activeFilterChip: {
        backgroundColor: "#52B3B1",
        borderColor: "#52B3B1"
    },
    filterText: {
        fontSize: 11,
        fontWeight: "500",
        color: "#666666"
    },
    activeFilterText: {
        color: "#FFFFFF",
        fontWeight: "700"
    },
    sortChip: {
        flex: 1
    },
    sortRow: {
        flexDirection: "row",
        gap: 8,
        marginBottom: 18
    },
    filterFooter: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        borderTopWidth: 1,
        borderTopColor: "#EEEEEE",
        paddingTop: 14
    },
    filterCount: {
        fontSize: 10,
        color: "#777777"
    },
    applyButton: {
        backgroundColor: "#52B3B1",
        borderRadius: 10,
        paddingHorizontal: 14,
        paddingVertical: 10,
        flexDirection: "row",
        alignItems: "center",
        gap: 6
    },
    applyButtonText: { 
        fontSize: 11, 
        fontWeight: "700", 
        color: "#FFFFFF" 
    },
    resultsRow: { 
        flexDirection: "row", 
        alignItems: "center", 
        justifyContent: "space-between", 
        marginBottom: 14
    },
    resultsText: { 
        fontSize: 11, 
        fontWeight: "500",
        color: "#888888" 
    },
    resetText: { 
        fontSize: 11, 
        fontWeight: "600", 
        color: "#52B3B1" 
    },
    card: {
        minHeight: 125,
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: "white",
        borderRadius: 18,
        padding: 14,
        marginBottom: 14,
        borderWidth: 1,
        borderColor: "#EEEEEE"
    },
    iconBox: {
        width: 68,
        height: 68,
        borderRadius: 34,
        backgroundColor: "#E8F6F6",
        alignItems: "center",
        justifyContent: "center",
        marginRight: 16
    },
    info: {
        flex: 1,
        paddingRight: 8
    },
    name: {
        fontSize: 14,
        fontWeight: "700",
        color: "#111",
        lineHeight: 19,
        marginBottom: 6
    },
    faculty: {
        fontSize: 11,
        fontWeight: "600",
        color: "#52B3B1",
        marginBottom: 8
    },
    metaRow: {
        flexDirection: "row",
        alignItems: "center"
    },
    metaText: {
        fontSize: 10,
        color: "#777",
        marginLeft: 4
    },
    dot: {
        fontSize: 10,
        color: "#777",
        marginHorizontal: 6
    },
    cardRight: {
        height: 76,
        justifyContent: "space-between",
        alignItems: "center"
    }
});
