import { SafeAreaView } from 'react-native-safe-area-context';
import { useCallback, useState } from "react";
import { useFocusEffect } from '@react-navigation/native';
import { StyleSheet, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { RootStackParamList } from '../../navigation/AppNavigator';

import PageHeader from "../../components/PageHeader";
import NavBar from "../../components/NavBar";
import { Career } from "../../types/programme";
import { getCareers } from "../../services/api";

type Props = NativeStackScreenProps<RootStackParamList, "CareerAlignment">;

export default function CareerAlignmentScreen({ navigation }: Props) {
    const [error, setError] = useState('');
    const [careers, setCareers] = useState<Career[]>([]);

    const [attempt, setAttempt] = useState(0);
    useFocusEffect(useCallback(() => {
        let active = true; setError('');
        getCareers().then(data => { if (active) setCareers(data.slice(0, 3)); })
            .catch(() => { if (active) setError('Could not load careers. Check your connection and retry.'); });
        return () => { active = false; };
    }, [attempt]));

    function formatTitle(title: string) {
        const lowercaseWords = ["or", "and", "of", "the", "in", "for", "to"];
        return title.split(" ").map((word, index) => {
            if (index !== 0 && lowercaseWords.includes(word.toLowerCase())) {
                return word.toLowerCase();
            }
            return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
        }).join(" ");
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
        <SafeAreaView edges={['top','left','right']} style={styles.container}>
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
                <View style={styles.header}>
                    <PageHeader title="Career Alignment" description="Explore careers and find a pathway that matches your interests." navigation={navigation}/>
                </View>

                <View style={styles.section}>{error ? <TouchableOpacity accessibilityRole="button" onPress={() => setAttempt(a => a + 1)}><Text accessibilityRole="alert">{error} Tap to retry.</Text></TouchableOpacity> : null}
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
                        <Text style={styles.sectionTitle}>Explore Career Pathways</Text>
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

                <TouchableOpacity style={styles.quizCard} onPress={() => navigation.navigate("Quiz")}>
                    <View style={styles.quizContent}>
                        <Text style={styles.quizTitle}>Not sure where to start?</Text>
                        <Text style={styles.quizText}>Answer six questions, explore your interest areas and choose whether to add the results to For you.</Text>
                    </View>
                    <View style={styles.quizButton}>
                        <Text style={styles.quizButtonText}>Take Quiz</Text>
                        <Ionicons name="chevron-forward" size={16} color="#FFFFFF"/>
                    </View>
                </TouchableOpacity>
            </ScrollView>

            <NavBar navigation={navigation} activeScreen="Career"/>
        </SafeAreaView>
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
        backgroundColor: "#F2FAF9",
    },
    section: {
        paddingHorizontal: "7%",
        marginTop: 18
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
        minHeight: 116,
        backgroundColor: "#F6F6F6",
        borderRadius: 18,
        borderWidth: 1,
        borderColor: "#F0F0F0",
        alignItems: "center",
        justifyContent: "center",
        paddingVertical: 16,
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
        backgroundColor: "#FAFAFA",
        borderRadius: 13,
        paddingVertical: 9,
        paddingHorizontal: 11,
        marginBottom: 8,
        borderWidth: 1,
        borderColor: "#EAEAEA",
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
    quizCard: {
        marginHorizontal: "7%",
        marginTop: 20,
        backgroundColor: "#E8F6F6",
        borderRadius: 18,
        padding: 18,
        flexDirection: "row",
        alignItems: "center",
        gap: 14
    },
    quizContent: {
        flex: 1,
        minWidth: 0
    },
    quizTitle: {
        fontSize: 14,
        fontWeight: "700",
        marginBottom: 5,
        color: "#111111"
    },
    quizText: {
        fontSize: 12,
        color: "#666666",
        lineHeight: 17
    },
    quizButton: {
        flexDirection: "row",
        alignItems: "center",
        gap: 3,
        backgroundColor: "#52B3B1",
        paddingHorizontal: 14,
        minHeight: 42,
        borderRadius: 21
    },
    quizButtonText: {
        fontSize: 12,
        fontWeight: "700",
        color: "#FFFFFF"
    }
});
