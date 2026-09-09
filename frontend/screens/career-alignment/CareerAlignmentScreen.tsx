import { useEffect, useState } from "react";
import { StyleSheet, ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { RootStackParamList } from '../../navigation/AppNavigator';

import PageHeader from "../../components/PageHeader";
import NavBar from "../../components/NavBar";
import { Career, Programme } from "../../types/programme";
import { getCareers, getProgrammes } from "../../services/api";

type Props = NativeStackScreenProps<RootStackParamList, "CareerAlignment">;

export default function CareerAlignmentScreen({ navigation }: Props) {
    const [careers, setCareers] = useState<Career[]>([]);
    const [programmes, setProgrammes] = useState<Programme[]>([]);

    useEffect(() => {
        loadCareers();
        loadProgrammes();
    }, []);

    async function loadCareers() {
        try {
            const data = await getCareers();
            setCareers(data.slice(0, 3));
        } catch (error) {
            console.log(error);
        }
    }

    async function loadProgrammes() {
        try {
            const data = await getProgrammes();
            setProgrammes(data.slice(0, 4));
        } catch (error) {
            console.log(error);
        }
    }

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

    return (
        <View style={styles.container}>
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
                <View style={styles.header}>
                    <PageHeader title="Career Alignment" description={"Explore careers and find a pathway\nthat matches your interests."} navigation={navigation}/>
                    <View style={styles.searchContainer}>
                        <View style={styles.searchBar}>
                            <Ionicons name="search-outline" size={18} color="#777"/>
                            <TextInput placeholder="Search keywords..." placeholderTextColor="#888" style={styles.searchInput}/>
                        </View>
                    </View>
                </View>

                <View style={styles.section}>
                    <View style={styles.sectionHeader}>
                        <Text style={styles.sectionTitle}>Explore by Interest</Text>
                        <TouchableOpacity style={styles.viewAllButton} onPress={() => navigation.navigate("CareerExplorer")}>
                            <Text style={styles.viewAll}>View All</Text>
                            <Ionicons name="chevron-forward" size={15} color="#52B3B1"/>
                        </TouchableOpacity>
                    </View>

                    <View style={styles.interestGrid}>
                        <TouchableOpacity style={styles.interestCard} onPress={() => navigation.navigate("CareerExplorer", {category: "Clinical"})}>
                            <View style={[styles.interestIcon, {backgroundColor: getCategoryBackground("Clinical")}]}>
                                <CareerIcon item={{category: "Clinical"}} size={28}/>
                            </View>
                            <Text style={styles.interestTitle}>Clinical Care</Text>
                        </TouchableOpacity>

                        <TouchableOpacity style={styles.interestCard} onPress={() => navigation.navigate("CareerExplorer", {category: "Research"})}>
                            <View style={[styles.interestIcon, {backgroundColor: getCategoryBackground("Research")}]}>
                                <CareerIcon item={{category: "Research"}} size={28}/>
                            </View>
                            <Text style={styles.interestTitle}>Research</Text>
                        </TouchableOpacity>

                        <TouchableOpacity style={styles.interestCard} onPress={() => navigation.navigate("CareerExplorer", {category: "Mental Health"})}>
                            <View style={[styles.interestIcon, {backgroundColor: getCategoryBackground("Mental Health")}]}>
                                <CareerIcon item={{category: "Mental Health"}} size={28}/>
                            </View>
                            <Text style={styles.interestTitle}>Mental Health</Text>
                        </TouchableOpacity>

                        <TouchableOpacity style={styles.interestCard} onPress={() => navigation.navigate("CareerExplorer", {category: "Public Health"})}>
                            <View style={[styles.interestIcon, {backgroundColor: getCategoryBackground("Public Health")}]}>
                                <CareerIcon item={{category: "Public Health"}} size={28}/>
                            </View>
                            <Text style={styles.interestTitle}>Public Health</Text>
                        </TouchableOpacity>
                    </View>
                </View>

                <View style={styles.section}>
                    <View style={styles.sectionHeader}>
                        <Text style={styles.sectionTitle}>Popular Career Pathways</Text>
                        <TouchableOpacity style={styles.viewAllButton} onPress={() => navigation.navigate("CareerExplorer")}>
                            <Text style={styles.viewAll}>View All</Text>
                            <Ionicons name="chevron-forward" size={15} color="#52B3B1"/>
                        </TouchableOpacity>
                    </View>

                    {careers.map((career) => (
                        <TouchableOpacity key={career.id} style={styles.careerCard} onPress={() => navigation.navigate("CareerDetails", {career})}>
                            <View style={[styles.careerIcon, {backgroundColor: getCategoryBackground(career.category)}]}>
                                <CareerIcon item={career} size={19}/>
                            </View>
                            <Text style={styles.careerTitle}>{formatTitle(career.title)}</Text>
                            <Ionicons name="chevron-forward" size={18} color="#555"/>
                        </TouchableOpacity>
                    ))}
                </View>

                <View style={styles.section}>
                    <View style={styles.sectionHeader}>
                        <Text style={styles.sectionTitle}>Browse Programmes</Text>
                        <TouchableOpacity style={styles.viewAllButton} onPress={() => navigation.navigate("Programmes")}>
                            <Text style={styles.viewAll}>View All</Text>
                            <Ionicons name="chevron-forward" size={15} color="#52B3B1"/>
                        </TouchableOpacity>
                    </View>

                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.programmeRow}>
                        {programmes.map((programme) => (
                            <TouchableOpacity key={programme.id} style={styles.programmeCard} onPress={() => navigation.navigate("ProgrammeDetails", {programmeId: programme.id})}>
                                <View style={styles.programmeIcon}>
                                    <Ionicons name={getProgrammeIcon(programme.name)} size={28} color="#52B3B1"/>
                                </View>
                                <Text style={styles.programmeTitle} numberOfLines={2}>{formatProgramme(programme.name)}</Text>
                                <Text style={styles.programmeType}>Undergraduate</Text>
                            </TouchableOpacity>
                        ))}
                    </ScrollView>
                </View>

                <TouchableOpacity style={styles.quizCard} onPress={() => navigation.navigate("Quiz")}>
                    <View>
                        <Text style={styles.quizTitle}>Not sure where to start?</Text>
                        <Text style={styles.quizText}>Take a short quiz to discover{"\n"}careers that may suit you.</Text>
                    </View>

                    <View style={styles.quizButton}>
                        <Text style={styles.quizButtonText}>Take a Quiz</Text>
                    </View>
                </TouchableOpacity>
            </ScrollView>

            <NavBar navigation={navigation} activeScreen="Career"/>
        </View>
    )
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: "white",
        paddingBottom: 90,
    },
    scrollContent: {
        paddingBottom: 30
    },
    header: {
        backgroundColor: "#CFEFED",
        paddingBottom: 26
    },
    searchContainer: {
        paddingHorizontal: "7%"
    },
    searchBar: {
        backgroundColor: "white",
        borderRadius: 12,
        flexDirection: "row",
        alignItems: "center",
        paddingHorizontal: 14,
        height: 48
    },
    searchInput: {
        flex: 1,
        marginLeft: 8,
        fontSize: 11,
        color: "#111"
    },
    section: {
        paddingHorizontal: "7%",
        marginTop: 24
    },
    sectionHeader: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        marginBottom: 14
    },
    sectionTitle: {
        fontSize: 15,
        fontWeight: "700",
        color: "#111"
    },
    viewAll: {
        fontSize: 11,
        fontWeight: "600",
        color: "#52B3B1"
    },
    viewAllButton: {
        flexDirection: "row",
        alignItems: "center",
        gap: 3
    },
    interestGrid: {
        flexDirection: "row",
        flexWrap: "wrap",
        justifyContent: "space-between",
        rowGap: 14
    },
    interestCard: {
        width: "48%",
        backgroundColor: "#F5F5F5",
        borderRadius: 20,
        paddingVertical: 18,
        alignItems: "center",
        justifyContent: "center"
    },
    interestIcon: {
        width: 48,
        height: 48,
        borderRadius: 24,
        alignItems: "center",
        justifyContent: "center",
        marginBottom: 10
    },
    interestTitle: {
        fontSize: 13,
        fontWeight: "600",
        color: "#111"
    },
    careerCard: {
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: "white",
        borderRadius: 12,
        paddingVertical: 7,
        paddingHorizontal: 10,
        marginBottom: 8,
        borderWidth: 1,
        borderColor: "#EAEAEA"
    },
    careerIcon: {
        width: 36,
        height: 36,
        borderRadius: 18,
        alignItems: "center",
        justifyContent: "center",
        marginRight: 10
    }, 
    careerTitle: {
        flex: 1,
        fontSize: 12,
        fontWeight: "600",
        color: "#111"
    },
    programmeRow: {
        gap: 12
    },
    programmeCard: {
        width: 145,
        minHeight: 170,
        backgroundColor: "#F5F5F5",
        borderRadius: 18,
        paddingVertical: 18,
        paddingHorizontal: 12,
        alignItems: "center"
    },
    programmeIcon: {
        width: 58,
        height: 58,
        borderRadius: 29,
        backgroundColor: "#E8F6F6",
        alignItems: "center",
        justifyContent: "center",
        marginBottom: 14
    },
    programmeTitle: {
        fontSize: 12,
        fontWeight: "700",
        color: "#111",
        textAlign: "center",
        lineHeight: 16,
        marginBottom: 8
    },
    programmeType: {
        fontSize: 11,
        color: "#777"
    },
    quizCard: {
        marginHorizontal: "7%",
        marginTop: 20,
        backgroundColor: "#E8F6F6",
        borderRadius: 18,
        padding: 18,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between"
    },
    quizTitle: {
        fontSize: 14,
        fontWeight: "700",
        marginBottom: 6,
        color: "#111"
    },
    quizText: {
        fontSize: 12,
        color: "#666",
        lineHeight: 17
    },
    quizButton: {
        backgroundColor: "white",
        paddingHorizontal: 14,
        paddingVertical: 10,
        borderRadius: 10,
        marginLeft: 10,
    },
    quizButtonText: {
        fontSize: 12,
        fontWeight: "600",
        color: "#111"
    }
});