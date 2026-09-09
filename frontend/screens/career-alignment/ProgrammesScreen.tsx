import { useEffect, useState } from "react";
import { StyleSheet, ScrollView, Text, TextInput, TouchableOpacity, View, Pressable } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import PageHeader from "../../components/PageHeader";
import NavBar from "../../components/NavBar";
import { Programme } from "../../types/programme";
import { getProgrammes, searchProgrammes } from "../../services/api";
import { useSaved } from "../../context/SavedContext";

export default function ProgrammesScreen({ navigation }: any) {
    const [programmes, setProgrammes] = useState<Programme[]>([]);
    const [search, setSearch] = useState("");
    const [showFilters, setShowFilters] = useState(false);
    const [selectedFaculty, setSelectedFaculty] = useState("All");
    const [sortBy, setSortBy] = useState("Default");
    const { toggleProgramme, isProgrammeSaved } = useSaved();

    useEffect(() => {
        loadProgrammes();
    }, []);

    async function loadProgrammes() {
        try {
            const data = await getProgrammes();
            setProgrammes(data);
        } catch (error) {
            console.log(error);
        }
    }

    async function handleSearch(text: string) {
        setSearch(text);

        try {
            const data = text.trim() === "" ? await getProgrammes() : await searchProgrammes(text);
            setProgrammes(data);
        } catch (error) {
            console.log(error);
        }
    }

    function formatProgramme(name: string) {
        const programmeName = name.trim().split(" ");
        const programmeCode = programmeName.pop();
        return `${programmeName.join(" ")} (${programmeCode})`;
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
        ...Array.from(new Set(programmes.map((programme) => programme.faculty).filter((faculty): faculty is string => Boolean(faculty))))
    ];

    let filteredProgrammes = [...programmes];

    if (selectedFaculty !== "All") {
        filteredProgrammes = filteredProgrammes.filter((programme) => programme.faculty === selectedFaculty);
    }

    if (sortBy === "A-Z") {
        filteredProgrammes.sort((a, b) => a.name.localeCompare(b.name));
    }

    if (sortBy === "Z-A") {
        filteredProgrammes.sort((a, b) => b.name.localeCompare(a.name));
    }

    return (
        <View style={styles.screen}>
            <ScrollView style={styles.container} showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
                <PageHeader title="Programmes" navigation={navigation} background={false} leftIcon="back" rightIcon="bookmark"/>

                <View style={styles.content}>
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
                            <Text style={styles.filterTitle}>Faculty</Text>
                            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                                {faculties.map((faculty) => (
                                    <TouchableOpacity key={faculty} style={[styles.filterChip, selectedFaculty === faculty && styles.activeFilterChip]} onPress={() => setSelectedFaculty(faculty)}>
                                        <Text style={[styles.filterText, selectedFaculty === faculty && styles.activeFilterText]}>{faculty === "All" ? "All Faculties" : faculty}</Text>
                                    </TouchableOpacity>
                                ))}
                            </ScrollView>
                            <Text style={styles.filterTitle}>Sort By:</Text>
                            <View style={styles.sortRow}>
                                {["Default", "A-Z", "Z-A"].map((option) => (
                                    <TouchableOpacity key={option} style={[styles.filterChip, sortBy === option && styles.activeFilterChip]} onPress={() => setSortBy(option)}>
                                        <Text style={[styles.filterText, sortBy === option && styles.activeFilterText]}>{option}</Text>
                                    </TouchableOpacity>
                                ))}
                            </View>
                        </View>
                    )}

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
                                <TouchableOpacity onPress={() => toggleProgramme(programme.id)}>
                                    <Ionicons name={isProgrammeSaved(programme.id) ? "bookmark" : "bookmark-outline"} size={20} color={isProgrammeSaved(programme.id) ? "#52B3B1" : "#666"}/>
                                </TouchableOpacity>
                                <Ionicons name="chevron-forward" size={20} color="#666"/>
                            </View>
                        </TouchableOpacity>
                    ))}
                </View>
            </ScrollView>

            <NavBar navigation={navigation} activeScreen="Career"/>
        </View>
    );
}

const styles = StyleSheet.create({
    screen: {
        flex: 1,
        backgroundColor: "white"
    },
    container: {
        flex: 1,
        backgroundColor: "white",
    },
    content: {
        paddingHorizontal: "7%"
    },
    scrollContent: {
        paddingBottom: 100
    },
    searchRow: {
        flexDirection: "row",
        alignItems: "center",
        marginBottom: 22
    },
    searchBar: {
        flex: 1,
        height: 50,
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: "#F7F7F7",
        borderRadius: 14,
        paddingHorizontal: 14
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
        borderRadius: 14,
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
        backgroundColor: "#F8F8F8",
        borderRadius: 16,
        padding: 15,
        marginBottom: 20
    },
    filterTitle: {
        fontSize: 12,
        fontWeight: "700",
        color: "#333",
        marginBottom: 10
    },
    filterChip: {
        paddingVertical: 8,
        paddingHorizontal: 13,
        borderRadius: 18,
        backgroundColor: "white",
        borderWidth: 1,
        borderColor: "#E5E5E5",
        marginRight: 8,
        marginBottom: 14
    },
    activeFilterChip: {
        backgroundColor: "#52B3B1",
        borderColor: "#52B3B1"
    },
    filterText: {
        fontSize: 11,
        color: "#555"
    },
    activeFilterText: {
        color: "white",
        fontWeight: "600"
    },
    sortRow: {
        flexDirection: "row"
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