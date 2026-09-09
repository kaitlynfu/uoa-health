import { useEffect, useState } from "react";
import { StyleSheet, ScrollView, Text, TouchableOpacity, View } from "react-native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { Ionicons } from "@expo/vector-icons";
import { RootStackParamList } from "../../navigation/AppNavigator";

import PageHeader from "../../components/PageHeader";
import NavBar from "../../components/NavBar";
import { Programme } from "../../types/programme";
import { getProgramme } from "../../services/api";
import { useSaved } from "../../context/SavedContext";

type Props = NativeStackScreenProps<RootStackParamList, "ProgrammeDetails">;
type Tab = "Overview" | "Requirements" | "Courses" | "Careers";

export default function ProgrammeDetailsScreen({ navigation, route }: Props) {
    const [programme, setProgramme] = useState<Programme | null>(null);
    const [activeTab, setActiveTab] = useState<Tab>("Overview");
    const { toggleProgramme, isProgrammeSaved } = useSaved();
    const { programmeId } = route.params;

    useEffect(() => {
        loadProgramme();
    }, []);

    async function loadProgramme() {
        try {
            const data = await getProgramme(programmeId);
            setProgramme(data);
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

        return "school-outline";
    }

    if (!programme) {
        return (
            <View style={styles.loading}>
                <Text>Loading programme...</Text>
            </View>
        );
    }

    const careerList = programme.career_pathways ? programme.career_pathways.split(",").map((career) => career.trim()).filter(Boolean) : [];

    return (
        <View style={styles.screen}>
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
                <View style={styles.header}>
                    <PageHeader navigation={navigation} background={false} leftIcon="back" rightIcon="bookmark" rightIconActive={isProgrammeSaved(programmeId)} rightIconPress={() => toggleProgramme(programmeId)}/>

                    <View style={styles.programmeHeader}>
                        <View style={styles.iconCircle}>
                            <Ionicons name={getProgrammeIcon(programme.name)} size={37} color="#52B3B1"/>
                        </View>

                        <View style={styles.headerInfo}>
                            <Text style={styles.programmeName}>{formatProgramme(programme.name)}</Text>
                            <Text style={styles.faculty}>{formatFaculty(programme.faculty)}</Text>
                            <View style={styles.duration}>
                                <Ionicons name="time-outline" size={13} color="#666"/>
                                <Text style={styles.durationText}>Full-time</Text>
                                <Text style={styles.dot}>•</Text>
                                <Text style={styles.durationText}>{formatDuration(programme.duration)}</Text>
                            </View>
                        </View>
                    </View>
                </View>

                <View style={styles.tabs}>
                    {(["Overview", "Requirements", "Courses", "Careers"] as Tab[]).map((tab) => (
                        <TouchableOpacity key={tab} style={[styles.tab, activeTab === tab && styles.activeTab]} onPress={() => setActiveTab(tab)}>
                            <Text style={[styles.tabText, activeTab === tab && styles.activeTabText]}>{tab}</Text>
                        </TouchableOpacity>
                    ))}
                </View>

                <View style={styles.content}>
                    {activeTab === "Overview" && (<>
                        <View style={styles.card}>
                            <Text style={styles.cardTitle}>About this programme</Text>
                            <Text style={styles.cardText}>{programme.description || "Programme information is currently unavailable."}</Text>
                        </View>

                        <View style={styles.infoBox}>
                            <View style={styles.row}>
                                <View style={styles.greenIcon}>
                                    <Ionicons name="time-outline" size={20} color="#21A995"/>
                                </View>
                                <View style={styles.rowText}>
                                    <Text style={styles.rowTitle}>Duration</Text>
                                    <Text style={styles.rowDescription}>{programme.duration}</Text>
                                </View>
                            </View>

                            <View style={styles.line}/>
                            <View style={styles.row}>
                                <View style={styles.purpleIcon}>
                                    <Ionicons name="school-outline" size={20} color="#6C55D9"/>
                                </View>
                                <View style={styles.rowText}>
                                    <Text style={styles.rowTitle}>Faculty</Text>
                                    <Text style={styles.rowDescription}>{programme.faculty}</Text>
                                </View>
                            </View>

                            <View style={styles.line}/>
                            <View style={styles.row}>
                                <View style={styles.orangeIcon}>
                                    <Ionicons name="business-outline" size={20} color="#E87931"/>
                                </View>

                                <View style={styles.rowText}>
                                    <Text style={styles.rowTitle}>Campus</Text>
                                    <Text style={styles.rowDescription}>On Campus</Text>
                                </View>
                            </View>
                        </View>
                    </>)}

                    {activeTab === "Requirements" && (<>
                        <View style={styles.card}>
                            <Text style={styles.cardTitle}>Entry Requirements</Text>
                            <Text style={styles.cardText}>Check the requirements for this programme.</Text>
                        </View>

                        <View style={styles.infoBox}>
                            <View style={styles.row}>
                                <View style={styles.greenIcon}>
                                    <Ionicons name="school-outline" size={20} color="#21A995"/>
                                </View>

                                <View style={styles.rowText}>
                                    <Text style={styles.rowTitle}>Academic Requirements</Text>
                                    <Text style={styles.rowDescription}>{programme.entry_requirements || "Requirements are unavailable"}</Text>
                                </View>
                            </View>
                            
                            <View style={styles.line}/>
                            <View style={styles.row}>
                                <View style={styles.purpleIcon}>
                                    <Ionicons name="book-outline" size={20} color="#6C55D9"/>
                                </View>

                                <View style={styles.rowText}>
                                    <Text style={styles.rowTitle}>Subject Requirements</Text>
                                    <Text style={styles.rowDescription}>View required subjects</Text>
                                </View>
                            </View>
                        </View>
                    </>)}

                    {activeTab === "Courses" && (<>
                        <View style={styles.card}>
                            <Text style={styles.cardTitle}>Courses</Text>
                            <Text style={styles.cardText}>Explore the courses and subjects you'll study throughout this programme.</Text>
                        </View>

                        <View style={styles.infoBox}>
                            <View style={styles.row}>
                                <View style={styles.greenIcon}>
                                    <Ionicons name="book-outline" size={20} color="#21A995"/>
                                </View>
                                <View style={styles.rowText}>
                                    <Text style={styles.rowTitle}>Course Information</Text>
                                    <Text style={styles.rowDescription}>View programme courses</Text>
                                </View>
                            </View>
                            <View style={styles.line}/>
                            <View style={styles.row}>
                                <View style={styles.purpleIcon}>
                                    <Ionicons name="calculator-outline" size={20} color="#6C55D9"/>
                                </View>
                                <View style={styles.rowText}>
                                    <Text style={styles.rowTitle}>Programme Duration</Text>
                                    <Text style={styles.rowDescription}>{programme.duration}</Text>
                                </View>
                            </View>
                        </View>
                    </>)}

                    {activeTab === "Careers" && (<>
                        <View style={styles.card}>
                            <Text style={styles.cardTitle}>Career Opportunities</Text>
                            <Text style={styles.cardText}>Explore potential careers after completing this programme.</Text>
                        </View>

                        <View style={styles.infoBox}>
                            <View style={styles.row}>
                                <View style={styles.greenIcon}>
                                    <Ionicons name="briefcase-outline" size={20} color="#21A995"/>
                                </View>

                                <View style={styles.rowText}>
                                    <Text style={styles.rowTitle}>Career Pathways</Text>
                                    <Text style={styles.rowDescription}>{programme.career_pathways || "Career information unavailable"}</Text>
                                </View>
                            </View>
                        </View>
                    </>)}
                    
                    <TouchableOpacity style={styles.button}>
                        <Text style={styles.buttonText}>View Full Details</Text>
                        <Ionicons name="chevron-forward" size={17} color="white"/>
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
    loading: {
        flex: 1,
        alignItems: "center",
        justifyContent: "center"
    },
    header: {
        paddingBottom: 22
    },
    programmeHeader: {
        flexDirection: "row",
        alignItems: "center",
        paddingHorizontal: "7%"
    },
    iconCircle: {
        width: 72,
        height: 72,
        borderRadius: 36,
        backgroundColor: "#E8F6F6",
        alignItems: "center",
        justifyContent: "center",
        marginRight: 14
    },
    headerInfo: {
        flex: 1
    },
    programmeName: {
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
    duration: {
        flexDirection: "row",
        alignItems: "center"
    },
    durationText: {
        fontSize: 10,
        color: "#666",
        marginLeft: 4
    },
    dot: {
        marginHorizontal: 7,
        color: "#777"
    },
    tabs: {
        flexDirection: "row",
        borderBottomWidth: 1,
        borderBottomColor: "#EEEEEE",
        paddingHorizontal: "4%"
    },
    tab: {
        flex: 1,
        alignItems: "center",
        paddingVertical: 14
    },
    activeTab: {
        borderBottomWidth: 3,
        borderBottomColor: "#52B3B1"
    },
    tabText: {
        fontSize: 10,
        color: "#666"
    },
    activeTabText: {
        color: "#52B3B1",
        fontWeight: "700"
    },
    content: {
        paddingHorizontal: "7%",
        paddingTop: 18
    },
    card: {
        borderWidth: 1,
        borderColor: "#EEEEEE",
        borderRadius: 15,
        padding: 15,
        marginBottom: 14
    },
    cardTitle: {
        fontSize: 13,
        fontWeight: "700",
        marginBottom: 7,
        color: "#111"
    },
    cardText: {
        fontSize: 11,
        lineHeight: 17,
        color: "#555"
    },
    infoBox: {
        borderWidth: 1,
        borderColor: "#EEEEEE",
        borderRadius: 15,
        paddingHorizontal: 12,
        marginBottom: 18
    },
    row: {
        minHeight: 65,
        flexDirection: "row",
        alignItems: "center"
    },
    rowText: {
        flex: 1,
        marginLeft: 10
    },
    rowTitle: {
        fontSize: 11,
        fontWeight: "700",
        color: "#222",
        marginBottom: 2
    },
    rowDescription: {
        fontSize: 10,
        color: "#666",
        lineHeight: 14
    },
    greenIcon: {
        width: 35,
        height: 35,
        borderRadius: 10,
        backgroundColor: "#DDF3E9",
        alignItems: "center",
        justifyContent: "center"
    },
    purpleIcon: {
        width: 35,
        height: 35,
        borderRadius: 10,
        backgroundColor: "#E8E3FF",
        alignItems: "center",
        justifyContent: "center"
    },
    orangeIcon: {
        width: 35,
        height: 35,
        borderRadius: 10,
        backgroundColor: "#FFE4D4",
        alignItems: "center",
        justifyContent: "center"
    },
    blueIcon: {
        width: 35,
        height: 35,
        borderRadius: 10,
        backgroundColor: "#DFE9FF",
        alignItems: "center",
        justifyContent: "center"
    },
    line: {
        height: 1,
        backgroundColor: "#EEEEEE"
    },
    button: {
        height: 45,
        borderRadius: 8,
        backgroundColor: "#52B3B1",
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center"
    },
    buttonText: {
        fontSize: 11,
        fontWeight: "700",
        color: "white",
        marginRight: 5
    }
});