import { useEffect, useState } from "react";
import { StyleSheet, ScrollView, Text, TouchableOpacity, View } from "react-native";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";

import PageHeader from "../../components/PageHeader";
import NavBar from "../../components/NavBar";
import { useSaved } from "../../context/SavedContext";
import { Career } from "../../types/programme";
import { getCareers } from "../../services/api";

export default function CareerDetailsScreen({ navigation, route }: any) {
    const { career } = route.params;
    const { toggleCareer, isCareerSaved } = useSaved();
    const [relatedCareers, setRelatedCareers] = useState<Career[]>([]);

    useEffect(() => {
        getCareers().then(data => {
            const related = data.filter(item => item.id !== career.id && item.category === career.category).slice(0, 3);
            setRelatedCareers(related);
        });
    }, [career.id]);
    
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

    return (
        <View style={styles.screen}>
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
                <View style={styles.header}>
                    <PageHeader navigation={navigation} background={false} leftIcon="back" rightIcon="bookmark" rightIconActive={isCareerSaved(career.id)} rightIconPress={() => toggleCareer(career.id)}/>
                    <View style={styles.careerHeader}>
                        <View style={[styles.iconCircle, {backgroundColor: getCategoryBackground(career.category)}]}>
                            <CareerIcon item={career} size={37}/>
                        </View>
                        <View style={styles.headerInfo}>
                            <Text style={styles.careerName}>{formatTitle(career.title)}</Text>
                            <Text style={[styles.category, {color: getCategoryColour(career.category)}]}>{career.category === "Tech" ? "Technology" : career.category}</Text>
                        </View>
                    </View>
                </View>
                <View style={styles.content}>
                    <TouchableOpacity style={styles.programmeCard} onPress={() => navigation.navigate("ProgrammeDetails", {programmeId: career.programme_id})}>
                        <Text style={styles.cardLabel}>Recommended Programme</Text>
                        <View style={styles.programmeRow}>
                            <View style={styles.programmeIcon}>
                                <Ionicons name="school-outline" size={28} color="#52B3B1"/>
                            </View>
                            <View style={styles.programmeInfo}>
                                <Text style={styles.programmeName}>{formatProgramme(career.programme_name)}</Text>
                                <Text style={styles.programmeMeta}>Undergraduate programme</Text>
                            </View>
                            <Ionicons name="chevron-forward" size={22} color="#333"/>
                        </View>
                    </TouchableOpacity>
                    <View style={styles.divider} />
                    <View style={styles.sectionHeader}>
                        <Text style={styles.sectionTitle}>Career Overview</Text>
                        <View style={styles.categoryCap}>
                            <Text style={styles.categoryCapText}>{career.category === "Tech" ? "Technology" : `${career.category}`}</Text>
                        </View>
                    </View>
                    <View style={styles.infoRow}>
                        <View style={[styles.infoCard, {backgroundColor: "#F7F7F7"}]}>
                            <View style={styles.orangeCircle}>
                                <Ionicons name="briefcase-outline" size={23} color="#E87931"/>
                            </View>
                            <View style={styles.infoContent}>
                                <Text style={styles.infoLabel}>Career Area</Text>
                                <Text style={styles.infoText}>{career.category === "Tech" ? "Technology" : career.category || "Other"}</Text>
                            </View>
                        </View>
                        <View style={[styles.infoCard, {backgroundColor: "#F7F7F7"}]}>
                            <View style={styles.blueCircle}>
                                <Ionicons name="book-outline" size={23} color="#4C7ED8"/>
                            </View>
                            <View style={styles.infoContent}>
                                <Text style={styles.infoLabel}>Study Area</Text>
                                <Text style={styles.infoText} numberOfLines={2}>{career.category === "Research" ? "Biomedical Science" : career.category === "Clinical" ? "Medical and Health Sciences" : career.category === "Mental Health" ? "Mental Health" : career.category === "Public Health" ? "Public Health" : career.category === "Tech" ? "Health Technology" : "Health Sciences"}</Text>
                            </View>
                        </View>
                    </View>
                    {relatedCareers.length > 0 && (
                        <>
                            <View style={styles.sectionHeader}>
                                <Text style={styles.sectionTitle}>Related Careers</Text>
                                <TouchableOpacity style={styles.viewAllButton} onPress={() => navigation.navigate("CareerExplorer", {category: career.category})}>
                                    <Text style={styles.viewAll}>View All</Text>
                                    <Ionicons name="chevron-forward" size={15} color="#52B3B1"/>
                                </TouchableOpacity>
                            </View>
                            <View style={styles.relatedRow}>
                                {relatedCareers.map(item => (
                                    <TouchableOpacity key={item.id} style={styles.relatedCard} onPress={() => navigation.push("CareerDetails", {career: item})}>
                                        <View style={[styles.relatedIcon, {backgroundColor: getCategoryBackground(item.category)}]}>
                                            <CareerIcon item={item}/>
                                        </View>
                                        <View style={styles.relatedBottom}>
                                            <Text style={styles.relatedText} numberOfLines={2}>{formatTitle(item.title)}</Text>
                                        </View>
                                    </TouchableOpacity>
                                ))}
                            </View>
                        </>
                    )}
                    <TouchableOpacity style={styles.exploreButton} onPress={() => navigation.navigate("CareerExplorer")}>
                        <View style={styles.exploreIcon}>
                            <Ionicons name="compass-outline" size={21} color="#52B3B1"/>
                        </View>
                        <View style={styles.exploreInfo}>
                            <Text style={styles.exploreLabel}>EXPLORE FURTHER</Text>
                            <Text style={styles.exploreText}>See more career options</Text>
                        </View>
                        <Ionicons name="chevron-forward" size={20} color="white"/>
                    </TouchableOpacity>
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
    scrollContent: {
        paddingBottom: 100
    },
    header: {
        paddingBottom: 16
    },
    careerHeader: {
        flexDirection: "row",
        alignItems: "center",
        paddingHorizontal: "7%",
        marginBottom: 16
    },
    iconCircle: {
        width: 72,
        height: 72,
        borderRadius: 36,
        alignItems: "center",
        justifyContent: "center",
        marginRight: 14
    },
    headerInfo: {
        flex: 1
    },
    careerName: {
        fontSize: 14,
        fontWeight: "700",
        color: "#111",
        lineHeight: 19,
        marginBottom: 6
    },
    category: {
        fontSize: 11,
        fontWeight: "600",
        marginBottom: 8
    },
    content: {
        paddingHorizontal: "7%"
    },
    divider: {
        height: 1,
        backgroundColor: "#EEEEEE",
        marginBottom: 22
    },
    programmeCard: {
        borderWidth: 1,
        borderColor: "#EEEEEE",
        borderRadius: 16,
        padding: 14,
        marginBottom: 18
    },
    cardLabel: {
        fontSize: 12,
        fontWeight: "700",
        color: "#111",
        marginBottom: 12
    },
    programmeRow: {
        flexDirection: "row",
        alignItems: "center"
    },
    programmeIcon: {
        width: 58,
        height: 58,
        borderRadius: 14,
        backgroundColor: "#E8F6F6",
        alignItems: "center",
        justifyContent: "center",
        marginRight: 13
    },
    programmeInfo: {
        flex: 1
    },
    programmeName: {
        fontSize: 13,
        fontWeight: "600",
        lineHeight: 18,
        color: "#111"
    },
    programmeMeta: {
        fontSize: 10,
        color: "#777",
        marginTop: 6
    },
    sectionHeader: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        marginBottom: 12
    },
    sectionTitle: {
        fontSize: 15,
        fontWeight: "700",
        color: "#111",
    },
    categoryCap: {
        backgroundColor: "#EAF8F6",
        paddingHorizontal: 13,
        paddingVertical: 7,
        borderRadius: 20
    },
    categoryCapText: {
        fontSize: 10,
        color: "#52B3B1",
        fontWeight: "600"
    },
    infoRow: {
        flexDirection: "row",
        gap: 10,
        marginBottom: 20
    },
    infoCard: {
        flex: 1,
        minHeight: 90,
        flexDirection: "row",
        alignItems: "center",
        borderRadius: 15,
        padding: 11
    },
    orangeCircle: {
        width: 42,
        height: 42,
        borderRadius: 21,
        backgroundColor: "#FFE4D4",
        alignItems: "center",
        justifyContent: "center",
        marginRight: 9
    },
    blueCircle: {
        width: 42,
        height: 42,
        borderRadius: 21,
        backgroundColor: "#DFE9FF",
        alignItems: "center",
        justifyContent: "center",
        marginRight: 9
    },
    infoContent: {
        flex: 1
    },
    infoLabel: {
        fontSize: 10,
        color: "#777",
        marginBottom: 3
    },
    infoText: {
        fontSize: 11,
        fontWeight: "700",
        color: "#222"
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
    relatedRow: {
        flexDirection: "row",
        gap: 10,
        marginBottom: 28
    },
    relatedCard: {
        flex: 1,
        minHeight: 118,
        backgroundColor: "#F7F7F7",
        borderRadius: 18,
        padding: 12,
        alignItems: "center",
        justifyContent: "center"
    },
    relatedIcon: {
        width: 46,
        height: 46,
        borderRadius: 23,
        alignItems: "center",
        justifyContent: "center",
        marginBottom: 10
    },
    relatedBottom: {
        width: "100%",
        alignItems: "center",
        justifyContent: "center"
    },
    relatedText: {
        fontSize: 10,
        fontWeight: "600",
        color: "#222",
        lineHeight: 13,
        textAlign: "center"
    },
    exploreButton: {
        height: 62,
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: "#52B3B1",
        borderRadius: 8,
        paddingHorizontal: 16,
        marginTop: 4
    },
    exploreIcon: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: "white",
        alignItems: "center",
        justifyContent: "center",
        marginRight: 12
    },
    exploreInfo: {
        flex: 1,
        marginLeft: 12
    },
    exploreLabel: {
        fontSize: 9,
        fontWeight: "700",
        color: "white",
        marginBottom: 3
    },
    exploreText: {
        flex: 1,
        fontSize: 12,
        fontWeight: "700",
        color: "white"
    }
});