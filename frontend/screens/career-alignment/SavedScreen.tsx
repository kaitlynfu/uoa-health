import { useEffect, useState } from "react";
import { StyleSheet, ScrollView, Text, TextInput, TouchableOpacity, View } from "react-native";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";

import PageHeader from "../../components/PageHeader";
import NavBar from "../../components/NavBar";
import { Career, Programme } from "../../types/programme";
import { getCareers, getProgrammes } from "../../services/api";
import { useSaved } from "../../context/SavedContext";

export default function SavedScreen({ navigation }: any) {
    const [tab, setTab] = useState("Careers");
    const [search, setSearch] = useState("");
    const [careers, setCareers] = useState<Career[]>([]);
    const [programmes, setProgrammes] = useState<Programme[]>([]);
    const { savedCareerIds, savedProgrammeIds, toggleCareer, toggleProgramme } = useSaved();

    useEffect(() => {
        getCareers().then(setCareers);
        getProgrammes().then(setProgrammes);
    }, []);

    const savedCareers = careers.filter(c => savedCareerIds.includes(c.id) && c.title.toLowerCase().includes(search.toLowerCase()));
    const savedProgrammes = programmes.filter(p => savedProgrammeIds.includes(p.id) && p.name.toLowerCase().includes(search.toLowerCase()));

    function formatTitle(title: string) {
        const lowercaseWords = ["or", "and", "of", "the", "in", "for", "to"];
        return title.split(" ").map((word, index) => {
            if (index !== 0 && lowercaseWords.includes(word.toLowerCase())) {
                return word.toLowerCase();
            }
            return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
        }).join(" ");
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

    function getCategoryColour(category: string | null) {
        if (category === "Clinical") return "#5F4DD8";
        if (category === "Research") return "#2D9F74";
        if (category === "Public Health") return "#247F91";
        if (category === "Tech") return "#4C7ED8";
        if (category === "Mental Health") return "#E87931";
        return "#2D9F8C";
    }

    function getCategoryBackground(category: string | null) {
        if (category === "Clinical") return "#E8E3FF";
        if (category === "Research") return "#DDF3E9";
        if (category === "Public Health") return "#DFF3F5";
        if (category === "Tech") return "#DFE9FF";
        if (category === "Mental Health") return "#FFE4D4";
        return "#EAF8F6";
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

    return (
        <View style={styles.screen}>
            <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
                <PageHeader title="Saves" navigation={navigation} background={false} leftIcon="back" rightIcon="bookmark"/>
                <View style={styles.content}>
                    <View style={styles.tabs}>
                        <TouchableOpacity style={[styles.tab, tab === "Careers" && styles.activeTab]} onPress={() => setTab("Careers")}>
                            <Text style={[styles.tabText, tab === "Careers" && styles.activeTabText]}>Careers</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={[styles.tab, tab === "Programmes" && styles.activeTab]} onPress={() => setTab("Programmes")}>
                            <Text style={[styles.tabText, tab === "Programmes" && styles.activeTabText]}>Programmes</Text>
                        </TouchableOpacity>
                    </View>
                    <View style={styles.searchRow}>
                        <View style={styles.searchBox}>
                            <Ionicons name="search-outline" size={19} color="#999"/>
                            <TextInput style={styles.search} placeholder="Search saved items..." placeholderTextColor="#999" value={search} onChangeText={setSearch}/>
                        </View>
                        <TouchableOpacity style={styles.filterButton}>
                            <Ionicons name="filter-outline" size={20} color="#666"/>
                        </TouchableOpacity>
                    </View>
                    <View style={styles.listHeader}>
                        <Text style={styles.count}>
                            {tab === "Careers"
                                ? `${savedCareers.length} Saved Careers`
                                : `${savedProgrammes.length} Saved Programmes`}
                        </Text>
                        <Text style={styles.recent}>Recently Added</Text>
                    </View>
                    {tab === "Careers" &&
                        savedCareers.map(career => (
                            <TouchableOpacity key={career.id} style={styles.card} onPress={() => navigation.navigate("CareerDetails", {career})}>
                                <View style={[styles.iconCircle, {backgroundColor: getCategoryBackground(career.category)}]}>
                                    {career.category === "Research" ? (
                                        <MaterialCommunityIcons name="microscope" size={27} color={getCategoryColour(career.category)}/>
                                    ) : career.category === "Mental Health" ? (
                                        <MaterialCommunityIcons name="brain" size={27} color={getCategoryColour(career.category)}/>
                                    ) : (
                                        <Ionicons name={career.category === "Clinical" ? "medical-outline" : career.category === "Tech" ? "laptop-outline" : "earth-outline"} size={27} color={getCategoryColour(career.category)}/>
                                    )}
                                </View>
                                <View style={styles.info}>
                                    <Text style={styles.cardTitle} numberOfLines={2}>{formatTitle(career.title)}</Text>
                                    <Text style={styles.cardText} numberOfLines={1}>{career.programme_name}</Text>
                                    <Text style={[styles.category, {color: getCategoryColour(career.category)}]}>{career.category === "Tech" ? "Technology" : career.category || "Other"}</Text>
                                </View>
                                <View style={styles.cardRight}>
                                    <TouchableOpacity onPress={e => {e.stopPropagation(); toggleCareer(career.id);}}>
                                        <Ionicons name="bookmark" size={21} color="#52B3B1"/>
                                    </TouchableOpacity>
                                    <Ionicons name="chevron-forward" size={20} color="#777"/>
                                </View>
                            </TouchableOpacity>
                        ))}
                    {tab === "Programmes" &&
                        savedProgrammes.map(programme => (
                            <TouchableOpacity key={programme.id} style={styles.card} onPress={() => navigation.navigate("ProgrammeDetails", {programmeId: programme.id})}>
                                <View style={styles.programmeIcon}>
                                    <Ionicons name={getProgrammeIcon(programme.name)} size={27} color="#52B3B1"/>
                                </View>
                                <View style={styles.info}>
                                    <Text style={styles.cardTitle} numberOfLines={2}>{formatProgramme(programme.name)}</Text>
                                    <Text style={styles.faculty} numberOfLines={1}>{formatFaculty(programme.faculty)}</Text>
                                    <Text style={styles.metaRow}>
                                        <Ionicons name="time-outline" size={13} color="#777"/>
                                        <Text style={styles.metaText}>Full-time</Text>
                                        <Text style={styles.dot}>•</Text>
                                        <Text style={styles.metaText}>{formatDuration(programme.duration)}</Text>
                                    </Text>
                                </View>
                                <View style={styles.cardRight}>
                                    <TouchableOpacity onPress={e => {e.stopPropagation(); toggleProgramme(programme.id);}}>
                                        <Ionicons name="bookmark" size={20} color="#52B3B1"/>
                                    </TouchableOpacity>
                                    <Ionicons name="chevron-forward" size={20} color="#666"/>
                                </View>
                            </TouchableOpacity>
                        ))}
                </View>
                <View style={{ height: 30 }}/>
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
    },
    content: {
        paddingHorizontal: "7%"
    },
    tabs: {
        flexDirection: "row",
        borderBottomWidth: 1,
        borderBottomColor: "#EEEEEE",
        marginBottom: 16
    },
    tab: {
        flex: 1,
        alignItems: "center",
        paddingBottom: 10
    },
    activeTab: {
        borderBottomWidth: 3,
        borderBottomColor: "#52B3B1"
    },
    tabText: {
        fontSize: 12,
        color: "#666"
    },
    activeTabText: {
        color: "#52B3B1",
        fontWeight: "700"
    },
    searchRow: {
        flexDirection: "row",
        marginBottom: 18
    },
    searchBox: {
        flex: 1,
        height: 46,
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: "#F7F7F7",
        borderRadius: 13,
        paddingHorizontal: 13
    },
    search: {
        flex: 1,
        marginLeft: 8,
        fontSize: 12
    },
    filterButton: {
        width: 46,
        height: 46,
        marginLeft: 10,
        borderWidth: 1,
        borderColor: "#EEEEEE",
        borderRadius: 13,
        alignItems: "center",
        justifyContent: "center"
    },
    listHeader: {
        flexDirection: "row",
        justifyContent: "space-between",
        marginBottom: 12
    },
    count: {
        fontSize: 12,
        fontWeight: "600",
        color: "#444",
    },
    recent: {
        fontSize: 11,
        fontWeight: "600",
        color: "#52B3B1"
    },
    card: {
        minHeight: 105,
        flexDirection: "row",
        alignItems: "center",
        padding: 13,
        borderWidth: 1,
        borderColor: "#EEEEEE",
        borderRadius: 18,
        marginBottom: 12,
        backgroundColor: "white"
    },
    iconCircle: {
        width: 58,
        height: 58,
        borderRadius: 29,
        alignItems: "center",
        justifyContent: "center",
        marginRight: 13
    },
    programmeIcon: {
        width: 58,
        height: 58,
        borderRadius: 29,
        backgroundColor: "#E8F6F6",
        alignItems: "center",
        justifyContent: "center",
        marginRight: 13
    },
    info: {
        flex: 1,
        paddingRight: 8
    },
    cardTitle: {
        fontSize: 13,
        fontWeight: "700",
        color: "#111",
        marginBottom: 4
    },
    cardText: {
        fontSize: 11,
        color: "#777",
        marginBottom: 4
    },
    category: {
        fontSize: 11,
        fontWeight: "600"
    },
    cardRight: {
        height: 62,
        justifyContent: "space-between",
        alignItems: "center"
    },
    faculty: {
        fontSize: 11,
        fontWeight: "600",
        color: "#52B3B1",
        marginBottom: 7
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
    }
});