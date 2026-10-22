import EntryRequirements from '../components/EntryRequirements';
import ProgrammeCourses from '../components/ProgrammeCourses';
import { SafeAreaView } from 'react-native-safe-area-context';
// Based on Kaitlyn's frontend/career-alignment screens at 154bfcd; layout preserved.
import { useEffect, useState } from "react";
import { Linking, StyleSheet, ScrollView, Text, TouchableOpacity, View } from "react-native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { Ionicons } from "@expo/vector-icons";
import { RootStackParamList } from "../navigation/AppNavigator";

import PageHeader from "../components/PageHeader";
import NavBar from "../components/NavBar";
import SignInPopup from "../components/SignInPopup";
import UniversityEntryRequirements from '../components/ClinicalEntryRequirements';
import ClinicalOtherPathways from "../components/ClinicalOtherPathways";
import ClinicalFirstYearCourses from '../components/ClinicalFirstYearCourses';
import { useSession } from "../context/SessionContext";
import { Programme } from "../types/programme";
import { getProgramme } from "../services/api";
import { adaptCareer } from "../services/careerAdapter";
import type { CareerRecord } from "../services/studentApi";
import { useSaved } from "../context/SavedContext";

type Props = NativeStackScreenProps<RootStackParamList, "ProgrammeDetails">;
type Tab = "Overview" | "Requirements" | "Courses" | "Careers";

export default function ProgrammeDetailsScreen({ navigation, route }: Props) {
    const [programme, setProgramme] = useState<(Programme & { careers?: CareerRecord[] }) | null>(null);
    const [error, setError] = useState("");
    const [attempt, setAttempt] = useState(0);
    const [activeTab, setActiveTab] = useState<Tab>("Overview");
    const [careersExpanded, setCareersExpanded] = useState(false);
    const [coursesExpanded, setCoursesExpanded] = useState(false);
    const [showSignIn, setShowSignIn] = useState(false);
    const { auth } = useSession();
    const token = auth?.access_token;
    const { toggleProgramme, isProgrammeSaved, notice } = useSaved();
    const { programmeId } = route.params;

    useEffect(() => {
        let active = true;
        setError(""); setProgramme(null); setActiveTab("Overview");
        getProgramme(programmeId).then(data => { if (active) setProgramme(data); })
            .catch(() => { if (active) setError("Could not load programme. Check your connection and retry."); });
        return () => { active = false; };
    }, [programmeId, attempt]);

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

        return "school-outline";
    }

    if (!programme || programme.id !== programmeId) {
        return (
            <View style={styles.loading}>
                {error ? <><Text accessibilityRole="alert">{error}</Text><TouchableOpacity accessibilityRole="button" onPress={() => setAttempt(a => a + 1)}><Text style={{padding:16,color:'#287d7b'}}>Retry</Text></TouchableOpacity></> : <Text>Loading programme...</Text>}
                <TouchableOpacity accessibilityRole="button" onPress={() => navigation.goBack()}><Text style={{padding:16,color:'#287d7b'}}>Back to explore</Text></TouchableOpacity>
            </View>
        );
    }


    return (
        <SafeAreaView edges={['top','left','right']} style={styles.screen}>
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
                <View style={styles.header}>
                    <PageHeader navigation={navigation} background={false} leftIcon="back" rightIcon="bookmark" rightIconActive={isProgrammeSaved(programmeId)} rightIconPress={() => { if (!token) { setShowSignIn(true); return; } toggleProgramme(programmeId)}}/>

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
                        <TouchableOpacity key={tab} style={[styles.tab, activeTab === tab && styles.activeTab]} accessibilityRole="tab" accessibilityState={{selected: activeTab === tab}} onPress={() => setActiveTab(tab)}>
                            <Text style={[styles.tabText, activeTab === tab && styles.activeTabText]}>{tab}</Text>
                        </TouchableOpacity>
                    ))}
                </View>

                <View style={styles.content}>
                    {token && notice ? <Text accessibilityRole="alert">{notice}</Text> : null}
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
                                    <Text style={styles.rowDescription}>See official programme information</Text>
                                </View>
                            </View>
                        </View>
                    </>)}

                    {activeTab === "Requirements" && (<>
                        <View style={styles.card}>
                            <Text style={styles.cardTitle}>Entry Requirements</Text>
                            <Text style={styles.cardText}>Check the requirements for this programme.</Text>
                        </View>

                        {/MBChB|BOptom|BPharm/i.test(programme.name) ? (
                            <View style={styles.clinicalRequirementsCard}>
                                <UniversityEntryRequirements text={programme.entry_requirements} programmeName={programme.name}/>
                                <View style={styles.clinicalRequirementsDivider}/>
                                <ClinicalOtherPathways programmeName={programme.name} text={programme.entry_requirements}/>
                            </View>
                        ) : (
                            <View style={styles.clinicalRequirementsCard}>
                                <EntryRequirements text={programme.entry_requirements}/>
                            </View>
                        )}
                    </>)}

                    {activeTab === "Courses" && (
                        <>
                            <View style={styles.card}>
                                <Text style={styles.cardTitle}>Courses</Text>
                                <Text style={styles.cardText}>Explore the courses and subjects you'll study throughout this programme.</Text>
                            </View>
                            {/MBChB|BOptom|BPharm/i.test(programme.name) ? (
                                <>
                                    <View style={styles.clinicalInfoCard}>
                                        <ClinicalFirstYearCourses text={programme.entry_requirements} programmeName={programme.name} duration={programme.duration} />

                                        <View style={styles.clinicalDivider} />

                                        <TouchableOpacity style={styles.clinicalInfoRow} activeOpacity={0.7} accessibilityRole="button" accessibilityState={{expanded: coursesExpanded}} onPress={() => setCoursesExpanded(value => !value)}>
                                            <View style={styles.greenIcon}><Ionicons name="book-outline" size={20} color="#21A995"/></View>
                                            <View style={styles.clinicalRowText}>
                                                <Text style={styles.rowTitle}>Course Information</Text>
                                                <Text style={styles.rowDescription}>Explore study plans and milestones</Text>
                                            </View>
                                            <Ionicons name={coursesExpanded ? "chevron-up" : "chevron-down"} size={18} color="#888888" style={styles.clinicalChevron}/>
                                        </TouchableOpacity>
                                        {coursesExpanded && <View style={styles.coursePreview}><ProgrammeCourses programmeId={programmeId} navigation={navigation}/></View>}
                                        <View style={styles.clinicalDivider}/>
                                        <View style={styles.clinicalInfoRow}>
                                            <View style={styles.purpleIcon}><Ionicons name="calculator-outline" size={20} color="#6C55D9" /></View>
                                            <View style={styles.clinicalRowText}>
                                                <Text style={styles.rowTitle}>Programme Duration</Text>
                                                <Text style={styles.rowDescription}>{programme.duration || "Duration unavailable"}</Text>
                                            </View>
                                        </View>
                                    </View>
                                </>
                            ) : (
                                <View style={styles.infoBox}>
                                    <TouchableOpacity style={styles.row} activeOpacity={0.7} accessibilityRole="button" accessibilityState={{expanded: coursesExpanded}} onPress={() => setCoursesExpanded(value => !value)}>
                                        <View style={styles.greenIcon}><Ionicons name="book-outline" size={20} color="#21A995" /></View>
                                        <View style={styles.rowText}>
                                            <Text style={styles.rowTitle}>Course Information</Text>
                                            <Text style={styles.rowDescription}>Explore study plans and milestones</Text>
                                        </View>
                                        <Ionicons name={coursesExpanded ? "chevron-up" : "chevron-down"} size={18} color="#888888" />
                                    </TouchableOpacity>
                                    {coursesExpanded && <View style={styles.coursePreview}><ProgrammeCourses programmeId={programmeId} navigation={navigation}/></View>}
                                    <View style={styles.line}/>
                                    <View style={styles.row}>
                                        <View style={styles.purpleIcon}><Ionicons name="calculator-outline" size={20} color="#6C55D9"/></View>
                                        <View style={styles.rowText}>
                                            <Text style={styles.rowTitle}>Programme Duration</Text>
                                            <Text style={styles.rowDescription}>{programme.duration}</Text>
                                        </View>
                                    </View>
                                </View>
                            )}
                        </>
                    )}

                    {activeTab === "Careers" && (
                        <>
                            <View style={styles.card}>
                                <Text style={styles.cardTitle}>Career Opportunities</Text>
                                <Text style={styles.cardText}>Explore potential careers after completing this programme.</Text>
                            </View>

                            <View style={styles.careerCard}>
                                <TouchableOpacity style={styles.careerHeader} activeOpacity={0.7} accessibilityRole="button" accessibilityState={{ expanded: careersExpanded }} onPress={() => setCareersExpanded(!careersExpanded)}>
                                    <View style={styles.careerHeaderIcon}><Ionicons name="briefcase-outline" size={20} color="#52B3B1" /></View>
                                    <View style={styles.careerHeaderText}>
                                        <Text style={styles.rowTitle}>Career Pathways</Text>
                                        <Text style={styles.rowDescription}>Careers related to this programme</Text>
                                    </View>
                                    <Ionicons name={careersExpanded ? "chevron-up" : "chevron-down"} size={18} color="#888888" />
                                </TouchableOpacity>

                                {careersExpanded && (
                                    <>
                                        <View style={styles.careerDivider} />

                                        {programme.careers && programme.careers.length > 0 ? (
                                            <View style={styles.careerGrid}>
                                                {programme.careers.map((career) => (
                                                    <TouchableOpacity key={career.id} style={styles.careerOption} activeOpacity={0.7} onPress={() => navigation.navigate("CareerDetails", { career: adaptCareer(career, [programme]) })}>
                                                        <View style={styles.careerOptionHeader}>
                                                            <Ionicons name="briefcase-outline" size={18} color="#52B3B1" />
                                                            <Ionicons name="arrow-up-outline" size={18} color="#52B3B1" style={{ transform: [{ rotate: "45deg" }] }} />
                                                        </View>
                                                        <Text style={styles.careerName}>{formatTitle(career.name)}</Text>
                                                    </TouchableOpacity>
                                                ))}
                                            </View>
                                        ) : (
                                            <View style={styles.careerEmpty}>
                                                <Ionicons name="briefcase-outline" size={26} color="#AAAAAA" />
                                                <Text style={styles.careerEmptyTitle}>{programme.career_pathways ? "Further study and career guidance" : "No career suggestions available"}</Text>
                                                <Text selectable style={styles.careerEmptyText}>{programme.career_pathways || "Career pathways have not been listed for this programme yet. Check the official programme page for more information."}</Text>
                                            </View>
                                        )}
                                    </>
                                )}
                            </View>
                        </>
                    )}

                    {error ? <Text accessibilityRole="alert">{error}</Text> : null}
                    <TouchableOpacity style={styles.button} accessibilityRole="link" onPress={() => {
                        try { const url = new URL(programme.programme_url || "");
                            if (!["https:", "http:"].includes(url.protocol) || url.hostname.endsWith(".test")) throw new Error();
                            void Linking.openURL(url.href).catch(() => setError("Could not open the official page."));
                        } catch { setError("No official programme link is available."); }
                    }}>
                        <Text style={styles.buttonText}>View Full Details</Text>
                        <Ionicons name="chevron-forward" size={17} color="white"/>
                    </TouchableOpacity>
                </View>
            </ScrollView>
            <SignInPopup visible={showSignIn} onClose={() => setShowSignIn(false)} navigation={navigation}/>
            <NavBar navigation={navigation} activeScreen="Career"/>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    coursePreview: {paddingVertical: 16, gap: 12},
    screen: {
        flex: 1,
        width: "100%", maxWidth: 640, alignSelf: "center",
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
        padding: 14,
        marginBottom: 18
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
    },
    careerSection: {
        marginBottom: 18
    },
    careerCard: {
        backgroundColor: "#FFFFFF",
        borderWidth: 1,
        borderColor: "#EEEEEE",
        borderRadius: 15,
        paddingHorizontal: 12,
        marginBottom: 18
    },
    careerHeader: {
        flexDirection: "row",
        alignItems: "center",
        minHeight: 65,
        paddingVertical: 8
    },
    careerHeaderIcon: {
        width: 35,
        height: 35,
        borderRadius: 10,
        backgroundColor: "#DDF3E9",
        alignItems: "center",
        justifyContent: "center"
    },
    careerHeaderText: {
        flex: 1,
        marginLeft: 10
    },
    careerDivider: {
        height: 1,
        backgroundColor: "#EEEEEE"
    },
    careerGrid: {
        flexDirection: "row",
        flexWrap: "wrap",
        columnGap: 10,
        rowGap: 10,
        paddingVertical: 12
    },
    careerOption: {
        width: "47%",
        flexGrow: 1,
        minHeight: 95,
        backgroundColor: "#F6F7F7",
        borderRadius: 12,
        padding: 12,
        justifyContent: "space-between"
    },
    careerOptionHeader: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        marginBottom: 12
    },
    careerName: {
        fontSize: 11,
        fontWeight: "600",
        color: "#444444",
        lineHeight: 16
    },
    careerEmpty: {
        backgroundColor: "#F6F7F7",
        borderRadius: 12,
        padding: 20,
        alignItems: "center",
        gap: 8,
        marginVertical: 12
    },
    careerEmptyTitle: {
        fontSize: 11,
        fontWeight: "700",
        color: "#444444",
        textAlign: "center"
    },
    careerEmptyText: {
        fontSize: 10,
        color: "#777777",
        lineHeight: 16,
        textAlign: "center"
    },
    clinicalInfoCard: {
        backgroundColor: "#FFFFFF",
        borderWidth: 1,
        borderColor: "#EAEAEA",
        borderRadius: 15,
        paddingHorizontal: 12,
        marginBottom: 18
    },
    clinicalInfoRow: {
        flexDirection: "row",
        alignItems: "center",
        minHeight: 65,
        paddingVertical: 8
    },
    clinicalRowText: {
        flex: 1,
        marginLeft: 10
    },
    clinicalDivider: {
        height: 1,
        backgroundColor: "#EEEEEE",
        marginVertical: 0
    },
    clinicalChevron: {
        marginLeft: 10,
        alignSelf: "center"
    },
    clinicalRequirementsCard: {
        backgroundColor: "#FFFFFF",
        borderWidth: 1,
        borderColor: "#EEEEEE",
        borderRadius: 15,
        paddingHorizontal: 12,
        marginBottom: 18
    },
    clinicalRequirementsDivider: {
        height: 1,
        backgroundColor: "#EEEEEE"
    }
});
