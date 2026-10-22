import { useCallback, useEffect, useState } from "react";
import { useFocusEffect } from '@react-navigation/native';
import { StyleSheet, ScrollView, Text, TextInput, TouchableOpacity, View } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";

import PageHeader from "../../components/PageHeader";
import NavBar from "../../components/NavBar";
import SignInPopup from "../../components/SignInPopup";
import { useSession } from "../../context/SessionContext";
import { Career } from "../../types/programme";
import { getCareers, searchCareers } from "../../services/api";
import { useSaved } from "../../context/SavedContext";

export default function CareerExplorerScreen({ navigation, route }: any) {
    const insets = useSafeAreaInsets();
    const [careers, setCareers] = useState<Career[]>([]);
    const [search, setSearch] = useState(route.params?.search ?? "");
    const [selectedCategory, setSelectedCategory] = useState(route.params?.category || "All");
    const [showFilters, setShowFilters] = useState(false);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(true);
    const [showSignIn, setShowSignIn] = useState(false);
    const { auth } = useSession();
    const token = auth?.access_token;
    const { toggleCareer, isCareerSaved, notice } = useSaved();

    useEffect(() => {
        setSearch(route.params?.search ?? '');
        setSelectedCategory(route.params?.category ?? 'All');
    }, [route.params?.search, route.params?.category]);

    const [attempt, setAttempt] = useState(0);
    useFocusEffect(useCallback(() => {
        let active = true; setLoading(true); setError('');
        getCareers().then(data => { if (active) setCareers(data); })
            .catch(() => { if (active) setError('Could not load careers. Check your connection and retry.'); })
            .finally(() => { if (active) setLoading(false); });
        return () => { active = false; };
    }, [attempt]));

    function handleSearch(text: string) { setSearch(text); }

    function formatTitle(title: string) {
        const lowercaseWords = ["or", "and", "of", "the", "in", "for", "to"];
        return title.split(" ").map((word, index) => {
            if (index !== 0 && lowercaseWords.includes(word.toLowerCase())) {
                return word.toLowerCase();
            }
            return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
        }).join(" ");
    }

    function formatProgramme(name: string | null) {
        if (!name) return "";

        const programmeName = name.trim().split(" ");
        const programmeCode = programmeName.pop();
        return `${programmeName.join(" ")} (${programmeCode})`;
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

    function CareerIcon({ item, size = 27 }: any) {
        if (item.category === "Research") {
            return (
                <MaterialCommunityIcons name="microscope" size={size} color={getCategoryColour(item.category)}/>
            );
        }
        if (item.category === "Mental Health") {
            return (
                <MaterialCommunityIcons name="brain" size={size} color={getCategoryColour(item.category)}/>
            );
        }
        return (
            <Ionicons name={item.category === "Clinical" ? "medical-outline" : item.category === "Tech" ? "laptop-outline" : "earth-outline"} size={size} color={getCategoryColour(item.category)}/>
        );
    }

    const filteredCareers = careers.filter(career =>
        (selectedCategory === "All" || career.category === selectedCategory) &&
        career.title.toLowerCase().includes(search.toLowerCase()));

    return (
        <SafeAreaView edges={['top','left','right']} style={styles.screen}>
            <ScrollView style={styles.container} contentContainerStyle={[styles.scrollContent, {paddingBottom: 100 + insets.bottom}]} showsVerticalScrollIndicator={false}>
                <PageHeader title="Explore Careers" description="Discover health careers and find pathways that match your interests." navigation={navigation} background={true} leftIcon="back" rightIcon="bookmark"/>
                <View style={styles.content}>
                    <View style={styles.divider}/>
                    {error ? <TouchableOpacity accessibilityRole="button" onPress={() => setAttempt(a => a + 1)}><Text accessibilityRole="alert">{error} Tap to retry.</Text></TouchableOpacity> : null}
                    {token && notice ? <Text accessibilityRole="alert">{notice}</Text> : null}
                    {loading ? <Text>Loading careers…</Text> : null}
                    {!loading && !error && !filteredCareers.length ? <Text>No careers match your search.</Text> : null}
                    <View style={styles.searchRow}>
                        <View style={styles.searchBar}>
                            <Ionicons name="search-outline" size={20} color="#888"/>
                            <TextInput style={styles.search} placeholder="Search careers, or keywords..." placeholderTextColor="#999" value={search} onChangeText={handleSearch}/>
                        </View>

                    </View>

                    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filters}>
                        <TouchableOpacity style={[styles.filter, selectedCategory === "All" && styles.activeFilter]} onPress={() => setSelectedCategory("All")}>
                            <Ionicons name="grid-outline" size={16} color={selectedCategory === "All" ? "white" : "#333"}/>
                            <Text style={[styles.filterText, selectedCategory === "All" && styles.activeFilterText]}>All</Text>
                        </TouchableOpacity>

                        <TouchableOpacity style={[styles.filter, selectedCategory === "Clinical" && styles.activeFilter]} onPress={() => setSelectedCategory("Clinical")}>
                            <Ionicons name="medical-outline" size={16} color={selectedCategory === "Clinical" ? "white" : getCategoryColour("Clinical")}/>
                            <Text style={[styles.filterText, selectedCategory === "Clinical" && styles.activeFilterText]}>Clinical</Text>
                        </TouchableOpacity>

                        <TouchableOpacity style={[styles.filter, selectedCategory === "Research" && styles.activeFilter]} onPress={() => setSelectedCategory("Research")}>
                            <MaterialCommunityIcons name="microscope" size={16} color={selectedCategory === "Research" ? "white" : getCategoryColour("Research")}/>
                            <Text style={[styles.filterText, selectedCategory === "Research" && styles.activeFilterText]}>Research</Text>
                        </TouchableOpacity>

                        <TouchableOpacity style={[styles.filter, selectedCategory === "Public Health" && styles.activeFilter]} onPress={() => setSelectedCategory("Public Health")}>
                            <Ionicons name="earth-outline" size={16} color={selectedCategory === "Public Health" ? "white" : getCategoryColour("Public Health")}/>
                            <Text style={[styles.filterText, selectedCategory === "Public Health" && styles.activeFilterText]}>Public Health</Text>
                        </TouchableOpacity>

                        <TouchableOpacity style={[styles.filter, selectedCategory === "Tech" && styles.activeFilter]} onPress={() => setSelectedCategory("Tech")}>
                            <Ionicons name="laptop-outline" size={16} color={selectedCategory === "Tech" ? "white" : getCategoryColour("Tech")}/>
                            <Text style={[styles.filterText, selectedCategory === "Tech" && styles.activeFilterText]}>Technology</Text>
                        </TouchableOpacity>

                        <TouchableOpacity style={[styles.filter, selectedCategory === "Mental Health" && styles.activeFilter]} onPress={() => setSelectedCategory("Mental Health")}>
                            <MaterialCommunityIcons name="brain" size={16} color={selectedCategory === "Mental Health" ? "white" : getCategoryColour("Mental Health")}/>
                            <Text style={[styles.filterText, selectedCategory === "Mental Health" && styles.activeFilterText]}>Mental Health</Text>
                        </TouchableOpacity>

                        <TouchableOpacity style={[styles.filter, selectedCategory === "Other" && styles.activeFilter]} onPress={() => setSelectedCategory("Other")}>
                            <Ionicons name="flask-outline" size={16} color={selectedCategory === "Other" ? "white" : getCategoryColour("Other")}/>
                            <Text style={[styles.filterText, selectedCategory === "Other" && styles.activeFilterText]}>Other</Text>
                        </TouchableOpacity>
                    </ScrollView>

                    {filteredCareers.map((career) => (
                        <TouchableOpacity key={career.id} style={styles.card} onPress={() => navigation.navigate("CareerDetails", { career })}>
                            <View style={[styles.iconCircle, {backgroundColor: getCategoryBackground(career.category)}]}>
                                <CareerIcon item={career} size={30}/>
                            </View>

                            <View style={styles.info}>
                                <Text style={styles.name} numberOfLines={2}>{formatTitle(career.title)}</Text>
                                <Text style={styles.program} numberOfLines={1}>{formatProgramme(career.programme_name)}</Text>
                                <Text style={[styles.categoryText, {color: getCategoryColour(career.category)}]}>{career.category === "Tech" ? "Technology" : career.category || "Other"}</Text>
                            </View>

                            <View style={styles.cardRight}>
                                <TouchableOpacity accessibilityRole="button" accessibilityLabel={(isCareerSaved(career.id) ? 'Unsave ' : 'Save ') + career.title} style={styles.bookmarkButton} onPress={(e) => {
                                    e.stopPropagation();
                                    if (!token) { setShowSignIn(true); return; }
                                    toggleCareer(career.id);
                                    }}>
                                        <Ionicons name={isCareerSaved(career.id) ? "bookmark" : "bookmark-outline"} size={20} color={isCareerSaved(career.id) ? "#52B3B1" : "#555"}/>
                                </TouchableOpacity>
                                <Ionicons name="chevron-forward" size={20} color="#666"/>
                            </View>
                        </TouchableOpacity>
                    ))}
                </View>
                <View style={{ height: 30 }}/>
            </ScrollView>
            <SignInPopup visible={showSignIn} onClose={() => setShowSignIn(false)} navigation={navigation}/>
            <NavBar navigation={navigation} activeScreen="Career"/>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    bookmarkButton: {minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center'},
    container: {
        flex: 1,
        backgroundColor: "white"
    },
    screen: {
        flex: 1,
        backgroundColor: "white"
    },
    scrollContent: {
        paddingBottom: 90
    },
    content: {
        paddingHorizontal: "7%"
    },
    divider: {
        height: 1,
        backgroundColor: "#EEEEEE",
        marginTop: 6,
        marginBottom: 20
    },
    search: {
        flex: 1,
        marginLeft: 10,
        fontSize: 13,
        color: "#111"
    },
    searchRow: {
        flexDirection: "row",
        alignItems: "center",
        marginBottom: 22
    },
    searchBar: {
        flex: 1,
        height: 52,
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: "#FAFAFA",
        borderRadius: 16,
        paddingHorizontal: 10,
        borderWidth: 1,
        borderColor: "#EAEAEA"
    },
    searchIcon: {
        width: 34,
        height: 34,
        borderRadius: 17,
        backgroundColor: "#E8F6F6",
        alignItems: "center",
        justifyContent: "center"
    },
    clearButton: {
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: "#F0F0F0",
        alignItems: "center",
        justifyContent: "center"
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
    filters: {
        marginBottom: 20
    },
    filter: {
        flexDirection: "row",
        alignItems: "center",
        gap: 6,
        backgroundColor: "white",
        paddingVertical: 10,
        paddingHorizontal: 16,
        borderRadius: 22,
        marginRight: 10,
        borderWidth: 1,
        borderColor: "#E5E5E5"
    },
    activeFilter: {
        backgroundColor: "#52B3B1",
        borderColor: "#52B3B1"
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
    iconCircle: {
        width: 68,
        height: 68,
        borderRadius: 34,
        alignItems: "center",
        justifyContent: "center",
        marginRight: 16
    },
    imageBox: {
        width: 72,
        height: 72,
        borderRadius: 16,
        alignItems: "center",
        justifyContent: "center",
        marginRight: 16
    },
    info: {
        flex: 1,
        paddingRight: 10
    },
    name: {
        fontSize: 14,
        fontWeight: "700",
        color: "#111",
        lineHeight: 19,
        marginBottom: 2
    },
    program: {
        fontSize: 11,
        color: "#555",
        marginBottom: 6
    },
    programRow: {
        flexDirection: "row",
        alignItems: "center",
        gap: 6,
        marginBottom: 7
    },
    tag: {
        alignSelf: "flex-start",
        backgroundColor: "EAF8F6",
        paddingHorizontal: 11,
        paddingVertical: 5,
        borderRadius: 12
    },
    tagText: {
        fontSize: 11,
        fontWeight: "600",
        color: "#52B3B1"
    },
    categoryText: {
        fontSize: 11,
        fontWeight: "600"
    },
    cardRight: {
        height: 62,
        justifyContent: "space-between",
        alignItems: "center",
        marginLeft: 8
    },
    saves: {
        position: "absolute",
        right: 16,
        top: 16,
        width: 32,
        height: 32,
        borderRadius: 16,
        alignItems: "center",
        justifyContent: "center"
    }
});
