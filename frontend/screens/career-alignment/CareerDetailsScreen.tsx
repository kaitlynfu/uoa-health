import { SafeAreaView } from 'react-native-safe-area-context';
import { useEffect, useState } from "react";
import { Linking, StyleSheet, ScrollView, Text, TouchableOpacity, View } from "react-native";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";

import PageHeader from "../../components/PageHeader";
import NavBar from "../../components/NavBar";
import SignInPopup from "../../components/SignInPopup";
import { useSession } from "../../context/SessionContext";
import { useSaved } from "../../context/SavedContext";
import { Career } from "../../types/programme";
import { getCareers } from "../../services/api";
import { getCareerDetails } from '../../services/careerAdapter';

export default function CareerDetailsScreen({ navigation, route }: any) {
    const [career, setCareer] = useState<Career>(route.params.career);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(true), [attempt, setAttempt] = useState(0);
    const [showSignIn, setShowSignIn] = useState(false);
    const { auth } = useSession();
    const token = auth?.access_token;
    const { toggleCareer, isCareerSaved, notice } = useSaved();
    const [relatedCareers, setRelatedCareers] = useState<Career[]>([]);

    useEffect(() => {
        let active = true;
        setCareer(route.params.career);
        setError('');
        setLoading(true);
        getCareerDetails(route.params.career.id).then(c => { if (active) setCareer(c); })
            .catch(() => { if (active) setError('Could not load the linked programmes. Please try again.'); })
            .finally(() => { if (active) setLoading(false); });
        getCareers().then(data => { if (active) setRelatedCareers(data.filter(c =>
            c.id !== route.params.career.id && c.category === route.params.career.category).slice(0,3)); })
            .catch(() => { /* Related suggestions are optional. */ });
        return () => { active = false; };
    }, [route.params.career.id, attempt]);

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
        <SafeAreaView edges={['top','left','right']} style={styles.screen}>
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
                <View style={styles.header}>
                    <PageHeader navigation={navigation} background={false} leftIcon="back" rightIcon="bookmark" rightIconActive={isCareerSaved(career.id)} rightIconPress={() => { if (!token) { setShowSignIn(true); return; } toggleCareer(career.id)}}/>
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
                    {error ? <View style={{gap:8,marginBottom:16}}><Text accessibilityRole="alert">{error}</Text><TouchableOpacity accessibilityRole="button" onPress={()=>setAttempt(n=>n+1)} style={{minHeight:44,justifyContent:'center'}}><Text style={styles.cardLabel}>Try again</Text></TouchableOpacity></View> : null}
                    {token && notice ? <Text accessibilityRole="alert">{notice}</Text> : null}
                    <View style={styles.studyIntro}>
                        <Text style={styles.sectionTitle}>What could I study?</Text>
                        <Text style={styles.careerDescription}>Explore university programmes that can help you work towards this career. View their entry requirements, courses and study pathways below.</Text>
                    </View>
                    {loading&&<Text style={styles.careerDescription}>Finding related programmes…</Text>}
                    {!loading&&!error&&career.programmes.length===0&&<TouchableOpacity accessibilityRole="button" style={styles.programmeCard} onPress={()=>navigation.navigate('Programmes')}><View style={{flex:1}}><Text style={styles.programmeName}>Explore all programmes</Text><Text style={styles.programmeMeta}>No programme links have been added for this career yet.</Text></View><Ionicons name="chevron-forward" size={22} color="#257D80"/></TouchableOpacity>}
                    {career.programmes.map(programme => (
                        <TouchableOpacity accessibilityRole="button" accessibilityLabel={'View programme '+programme.name} key={programme.id} style={styles.programmeCard} onPress={() => navigation.navigate("ProgrammeDetails", { programmeId: programme.id })}>
                            <View style={styles.programmeIcon}>
                                <Ionicons name="school-outline" size={24} color="#52B3B1"/>
                            </View>
                            <View style={styles.programmeInfo}>
                                <Text style={styles.cardLabel}>PROGRAMME PATHWAY</Text>
                                <Text style={styles.programmeName}>{programme.name}</Text>
                                <Text style={styles.programmeMeta}>View entry requirements & courses</Text>
                            </View>
                            <View style={styles.programmeArrow}>
                                <Ionicons name="chevron-forward" size={19} color="#52B3B1"/>
                            </View>
                        </TouchableOpacity>
                    ))}
                    <View style={styles.careerGuidance}>
                        {!!career.description&&<Text style={styles.careerDescription}>{career.description}</Text>}
                        <View style={styles.guidanceNote}>
                            <Ionicons name="information-circle-outline" size={20} color="#52B3B1"/>
                            <Text style={styles.guidanceText}>Some careers may require additional qualifications, professional registration or practical experience beyond an undergraduate degree.</Text>
                        </View>
                    </View>
                    {!!career.official_url&&<TouchableOpacity accessibilityRole="link" style={styles.programmeCard} onPress={()=>{
                        try { const url=new URL(career.official_url!);if(url.protocol!=='https:')throw new Error();void Linking.openURL(url.href).catch(()=>setError('Could not open the career guidance page.')); }
                        catch {setError('The career guidance link is not available.');}
                    }}><Text style={styles.cardLabel}>Open official career and qualification guidance →</Text></TouchableOpacity>}
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
                    <TouchableOpacity accessibilityRole="button" style={styles.exploreButton} onPress={() => navigation.navigate("CareerExplorer")}>
                        <View style={styles.exploreIcon}>
                            <Ionicons name="compass-outline" size={21} color="#52B3B1"/>
                        </View>
                        <View style={styles.exploreInfo}>
                            <Text style={styles.exploreLabel}>EXPLORE FURTHER</Text>
                            <Text style={styles.exploreText}>See more career options</Text>
                        </View>
                        <Ionicons name="chevron-forward" size={20} color="#173b39"/>
                    </TouchableOpacity>
                </View>
            </ScrollView>
            <SignInPopup visible={showSignIn} onClose={() => setShowSignIn(false)} navigation={navigation}/>
            <NavBar navigation={navigation} activeScreen="Career"/>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    careerDescription: {
        fontSize: 15, 
        lineHeight: 24, 
        color: '#52615E'
    },
    screen: {
        flex: 1,
        backgroundColor: "white",
        width:'100%',
        maxWidth:680,
        alignSelf:'center'
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
        fontSize: 21,
        fontWeight: "700",
        color: "#111",
        lineHeight: 28,
        marginBottom: 6
    },
    category: {
        fontSize: 14,
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
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: "#F7FBFB",
        borderWidth: 1,
        borderColor: "#DDEDEC",
        borderRadius: 18,
        padding: 14,
        marginBottom: 18
    },
    cardLabel: {
        fontSize: 11,
        fontWeight: "700",
        color: "#257D80",
        letterSpacing: 0.7,
        marginBottom: 5
    },
    programmeRow: {
        flexDirection: "row",
        alignItems: "center"
    },
    programmeIcon: {
        width: 52,
        height: 52,
        borderRadius: 26,
        backgroundColor: "#E3F4F3",
        alignItems: "center",
        justifyContent: "center",
        marginRight: 13
    },
    programmeInfo: {
        flex: 1
    },
    programmeName: {
        fontSize: 16,
        fontWeight: "700",
        lineHeight: 23,
        color: "#111"
    },
    programmeMeta: {
        fontSize: 13,lineHeight:19,
        color: "#777",
        marginTop: 5
    },
    programmeArrow: {
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: "#FFFFFF",
        alignItems: "center",
        justifyContent: "center",
        marginLeft: 10
    },
    sectionHeader: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        marginBottom: 12
    },
    sectionTitle: {
        fontSize: 19,
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
        flexWrap: "wrap",
        gap: 10,
        marginBottom: 20
    },
    infoCard: {
        flex: 1,
        minWidth: 200,
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
        fontSize: 12,
        color: "#777",
        marginBottom: 3
    },
    infoText: {
        fontSize: 14,
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
    studyIntro:{
        marginBottom:20,
        gap:10
    },
    relatedRow: {
        flexDirection: "column",
        gap: 10,
        marginBottom: 28
    },
    careerGuidance: {
        marginTop: 4,
        marginBottom: 20,
        gap: 14
    },
    guidanceNote: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: 10,
        paddingVertical: 12,
        paddingHorizontal: 14,
        backgroundColor: '#F7FAFA',
        borderLeftWidth: 3, 
        borderLeftColor: '#52B3B1',
        borderRadius: 8
    },
    guidanceText: {
        flex: 1,
        fontSize: 14,
        lineHeight: 22,
        color: '#66758A'
    },
    relatedCard: {
        flexDirection:'row',
        minHeight: 78,
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
        marginRight: 14
    },
    relatedBottom: {
        flex:1,
        alignItems: "flex-start",
        justifyContent: "center"
    },
    relatedText: {
        fontSize: 14,
        fontWeight: "600",
        color: "#222",
        lineHeight: 20,
        textAlign: "left"
    },
    exploreButton: {
        minHeight: 76,
        paddingVertical: 16,
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
        minWidth: 0,
        justifyContent: "center",
    },
    exploreLabel: {
        fontSize: 10,
        lineHeight: 15,
        fontWeight: "700",
        color: "#173b39",
        marginBottom: 3
    },
    exploreText: {
        fontSize: 14,
        lineHeight: 20,
        fontWeight: "700",
        color: "#173b39"
    }
});
