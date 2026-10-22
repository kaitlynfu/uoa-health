import { SafeAreaView } from 'react-native-safe-area-context';
import { StyleSheet, Text, View, TouchableOpacity, ScrollView } from "react-native";
import { Ionicons, Feather } from "@expo/vector-icons";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useState, useCallback } from "react";
import { useFocusEffect } from '@react-navigation/native';
import { nextMilestone } from '../services/preferenceHelpers';
import { useSession } from '../context/SessionContext';
import { studentRequest, type Journey, type Milestone } from '../services/studentApi';

import MilestoneCourseEditor from "../components/MilestoneCourseEditor";
import NavBar from "../components/NavBar";
import PageHeader from "../components/PageHeader";
import { RootStackParamList } from "../navigation/AppNavigator";

type Props = NativeStackScreenProps<RootStackParamList, "Progression">;

export default function ProgressionScreen({ navigation }: Props) {
    const { auth } = useSession();
    const [journey, setJourney] = useState<Journey | null>(null);
    const [error, setError] = useState('');
    const [busy, setBusy] = useState(false);
    const [expandedStages, setExpandedStages] = useState<string[]>([]);
    const [hideCompleted, setHideCompleted] = useState(false);
    const [editing, setEditing] = useState<Milestone | null>(null);
    useFocusEffect(useCallback(() => {
        let active = true;
        setJourney(null); setError(''); setEditing(null);
        if (auth) studentRequest<Journey>('/journey/me', auth.access_token)
            .then(j => { if (active) {
                setJourney(j);
                const next = nextMilestone(j.milestones);
                setExpandedStages(next ? [next.stage == null ? 'Programme requirements' : 'Stage ' + next.stage] : []);
            } })
            .catch(e => { if (active) setError(e.message); });
        return () => { active = false; };
    }, [auth]));
    const selectedProgramme = journey?.programme.name ?? 'Choose your journey';
    const selectedPathway = journey ? journey.plan_name + ' · Catalogue ' + journey.catalogue_year : '';
    const grouped = new Map<string, Milestone[]>();
    for (const milestone of journey?.milestones ?? []) {
        const stage = milestone.stage == null ? 'Programme requirements' : 'Stage ' + milestone.stage;
        grouped.set(stage, [...(grouped.get(stage) ?? []), milestone]);
    }
    const milestones = [...grouped].map(([stage, milestones]) => ({ stage, milestones }));
    const next = nextMilestone(journey?.milestones ?? []);
    const currentStageLabel = next ? (next.stage == null ? "Programme requirements" : "Stage " + next.stage) : null;
    const totalMilestones = journey?.total_count ?? 0;
    const completedMilestones = journey?.completed_count ?? 0;
    const progress = journey?.progress_percent ?? 0;
    const totalPoints = journey?.milestones.reduce((sum, m) => sum + m.points, 0) ?? 0;
    const earnedPoints = journey?.milestones.reduce((sum, m) => sum + (m.completed ? m.points : 0), 0) ?? 0;
    const allExpanded = milestones.length > 0 && expandedStages.length === milestones.length;

    function toggleStage(stage: string) {
        setExpandedStages((current) =>current.includes(stage)? current.filter((item) => item !== stage): [...current, stage]);
    }

    function toggleAllStages() {
        setExpandedStages(allExpanded ? [] : milestones.map((m) => m.stage));
    }

    async function toggleMilestone(stageName: string, milestoneCode: string) {
        if (!auth || busy) return;
        const milestone = journey?.milestones.find(m => m.code === milestoneCode);
        if (!milestone) return;
        setBusy(true);
        try {
            setJourney(await studentRequest<Journey>('/journey/me/milestones/' + milestone.id,
                auth.access_token, 'PATCH', { completed: !milestone.completed }));
        } catch (e) { setError(e instanceof Error ? e.message : 'Could not save progress. Retry.'); }
        finally { setBusy(false); }
    }
    function openMilestone(milestoneCode: string) {
        const milestone = journey?.milestones.find(m => m.code === milestoneCode);
        if (milestone) navigation.navigate('MapCourse', { milestone });
    }

    if (!auth) {
        return (
            <SafeAreaView edges={['top','left','right']} style={styles.container}>
                <ScrollView contentContainerStyle={styles.guestContent} showsVerticalScrollIndicator={false}>
                    <PageHeader title="Milestones" navigation={navigation} description="Track your progress and explore your health journey." background={true} leftIcon="menu" />
                    <View style={styles.guestCard}>
                        <View style={styles.guestIcon}>
                            <Feather name="check-square" size={40} color="#52B3B1" />
                        </View>
                        <Text style={styles.guestTitle}>Sign in to track your journey</Text>
                        <Text style={styles.guestText}>
                            See your milestones, track progress, and pick up where you left off.
                        </Text>
                        <TouchableOpacity accessibilityRole="button" style={styles.guestButton} onPress={() => navigation.navigate('Login')}>
                            <Text style={styles.guestButtonText}>Sign in</Text>
                        </TouchableOpacity>
                    </View>
                </ScrollView>

                <NavBar navigation={navigation} activeScreen="Progression" />
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView edges={['top','left','right']} style={styles.container}>
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
                <PageHeader
                    title="Milestones"
                    navigation={navigation}
                    description="Track your progress and explore your health journey."
                    background={true}
                    leftIcon="menu"
                />
            <View style={styles.content}>
                {error ? <Text accessibilityRole="alert" style={styles.errorText}>{error}</Text> : null}
                {!journey && !error ? <Text style={styles.progressDetails}>Loading your journey…</Text> : null}
                {busy && <Text style={styles.progressDetails}>Saving…</Text>}

                <View style={styles.programmeSection}>
                    <Text style={styles.programmeName}>{selectedProgramme}</Text>
                    <Text style={styles.pathwayLabel}>{selectedPathway}</Text>
                </View>

                <View style={styles.progressCard}>
                    <View style={styles.progressHeader}>
                        <Text style={styles.progressTitle}>Overall Progress</Text>
                        <Text style={styles.progressPercentage}>{progress}%</Text>
                    </View>

                    <View style={styles.progressBar}>
                        <View
                            style={[
                                styles.progressFill,
                                { width: `${progress}%` },
                            ]}
                        />
                    </View>

                    <Text style={styles.progressDetails}>
                        {completedMilestones} of {totalMilestones} milestones completed{"  •  "}{earnedPoints} of {totalPoints} points earned
                    </Text>
                </View>

                <View style={styles.controlsRow}>
                    <Text style={styles.programmeName}>My Journey</Text>
                    <View style={styles.controlsRight}>
                        <TouchableOpacity accessibilityRole="button" onPress={() => setHideCompleted((h) => !h)}>
                            <Text style={styles.controlLink}>{hideCompleted ? "Show all" : "Hide completed"}</Text>
                        </TouchableOpacity>
                        <TouchableOpacity accessibilityRole="button" onPress={toggleAllStages}>
                            <Text style={styles.controlLink}>{allExpanded ? "Collapse all" : "Expand all"}</Text>
                        </TouchableOpacity>
                    </View>
                </View>
                <Text style={[styles.progressDetails, {marginBottom:16, marginTop: -4}]}>Expand a stage to see its courses. Tap a title for details, tick the box to track completion, or choose Edit course to name an elective or personalise a course label.</Text>

                <View style={styles.timeline}>
                    {milestones.map((stage, index) => {
                        const isExpanded = expandedStages.includes(stage.stage);
                        const isLast = index === milestones.length - 1;
                        const completedInStage = stage.milestones.filter((m) => m.completed).length;
                        const totalInStage = stage.milestones.length;
                        const stageComplete = totalInStage > 0 && completedInStage === totalInStage;
                        const visibleMilestones = hideCompleted ? stage.milestones.filter((m) => !m.completed) : stage.milestones;

                        return (
                            <View key={stage.stage} style={styles.stageWrapper}>
                                <View style={styles.timelineColumn}>
                                    <View
                                        style={[
                                            styles.stageDot,
                                            isExpanded && styles.stageDotActive,
                                        ]}
                                    />
                                    {!isLast && <View style={styles.timelineLine} />}
                                </View>

                                <View style={styles.stageContent}>
                                    <TouchableOpacity
                                        style={styles.stageHeader}
                                        onPress={() => toggleStage(stage.stage)}
                                        activeOpacity={0.8}
                                    >
                                        <Text style={styles.stageTitle} numberOfLines={1}>{stage.stage}{stage.stage === currentStageLabel ? " · Current focus" : ""}</Text>
                                        <View style={styles.stageHeaderRight}>
                                            <View style={[styles.stageBadge, stageComplete && styles.stageBadgeComplete]}>
                                                <Text style={[styles.stageBadgeText, stageComplete && styles.stageBadgeTextComplete]}>{completedInStage}/{totalInStage}</Text>
                                            </View>
                                            <Ionicons
                                                name={isExpanded ? "chevron-up" : "chevron-down"}
                                                size={20}
                                                color="#666"
                                            />
                                        </View>
                                    </TouchableOpacity>

                                    {isExpanded && (
                                        <View style={styles.milestones}>
                                            {visibleMilestones.length === 0 ? (
                                                <Text style={styles.allDoneText}>All milestones in this stage are complete 🎉</Text>
                                            ) : visibleMilestones.map((milestone) => (
                                                <View key={milestone.code} style={styles.milestoneCard}>
                                                    <TouchableOpacity
                                                        accessibilityRole="checkbox"
                                                        accessibilityLabel={'Complete ' + milestone.title}
                                                        accessibilityState={{checked: milestone.completed, disabled: busy}}
                                                        disabled={busy}
                                                        style={[styles.checkbox, milestone.completed && styles.checkboxCompleted]}
                                                        onPress={() => toggleMilestone(stage.stage, milestone.code)}
                                                        activeOpacity={0.7}
                                                    >
                                                        {milestone.completed && <Ionicons name="checkmark" size={16} color="white" />}
                                                    </TouchableOpacity>

                                                    <TouchableOpacity
                                                        style={styles.milestoneInfo}
                                                        onPress={() => openMilestone(milestone.code)}
                                                        activeOpacity={0.7}
                                                    >
                                                        <Text style={styles.milestoneCode}>{milestone.custom_course_code || milestone.code.split(":").pop()?.replaceAll("_", " ")}</Text>
                                                        <Text style={styles.milestoneTitle}>{milestone.title}</Text>
                                                    </TouchableOpacity>

                                                    <View style={styles.milestoneActions}>
                                                        <Text style={styles.points}>{milestone.points}pt</Text>
                                                        <TouchableOpacity accessibilityRole="button" accessibilityLabel={'Edit course ' + milestone.title} disabled={busy} style={styles.editCourse} onPress={() => setEditing(milestone)}>
                                                            <Feather name="edit-2" size={14} color="#287d7b" />
                                                            <Text style={styles.editCourseText}>Edit course</Text>
                                                        </TouchableOpacity>
                                                    </View>
                                                </View>
                                            ))}
                                        </View>
                                    )}
                                </View>
                            </View>
                        );
                    })}
                </View>

                <TouchableOpacity
                    style={styles.changePathwayButton}
                    onPress={() => navigation.navigate("ChoosePathway")}
                    activeOpacity={0.8}
                >
                    <Text style={styles.changePathwayText}>{journey ? "Change programme / pathway" : "Choose programme / pathway"}</Text>
                </TouchableOpacity>
            </View>
            </ScrollView>

            <NavBar navigation={navigation} activeScreen="Progression" />
            {editing && <MilestoneCourseEditor key={editing.id} milestone={editing} token={auth.access_token} onClose={() => setEditing(null)} onSaved={updated => { setJourney(updated); setEditing(null); }} />}
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        width: "100%", maxWidth: 640, alignSelf: "center",
        backgroundColor: "white",
    },
    scrollContent: {
        paddingBottom: 110,
    },
    content: {
        paddingHorizontal: "7%",
    },
    errorText: {
        marginTop: 12,
        fontSize: 13,
        color: "#B3261E",
    },
    programmeSection: {
        marginTop: 16,
        marginBottom: 24,
    },
    programmeName:{
        fontSize:18,
        fontWeight:'700',
        color:'#111111',
    },
    pathwayLabel:{
        marginTop:5,
        fontSize:13,
        fontWeight:'600',
        color:'#52B3B1',
    },
    progressCard: {
        backgroundColor: "#F2FAF9",
        borderRadius: 14,
        padding: 20,
        marginBottom: 24,
    },
    progressHeader: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        marginBottom: 16,
    },
    progressTitle: {
        fontSize: 16,
        fontWeight: "700",
        color: "#111111",
    },
    progressPercentage: {
        fontSize: 20,
        fontWeight: "700",
        color: "#52B3B1",
    },
    progressBar: {
        height: 9,
        borderRadius: 8,
        backgroundColor: "#CFEFED",
        overflow: "hidden",
    },
    progressFill:{
        height:'100%',
        borderRadius:8,
        backgroundColor:'#52B3B1',
    },
    progressDetails: {
        marginTop: 12,
        fontSize: 12,
        color: "#666666",
        lineHeight: 20,
    },
    controlsRow: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        marginBottom: 6,
    },
    controlsRight: {
        flexDirection: "row",
        gap: 14,
    },
    controlLink: {
        fontSize: 12,
        fontWeight: "700",
        color: "#287d7b",
    },
    timeline: {
        paddingBottom: 20,
    },
    stageWrapper: {
        flexDirection: "row",
        minHeight: 80,
    },
    timelineColumn: {
        width: 28,
        alignItems: "center",
    },
    stageDot: {
        width: 14,
        height: 14,
        borderRadius: 7,
        backgroundColor: "white",
        borderWidth: 3,
        borderColor: "#52B3B1",
        zIndex: 2,
    },
    stageDotActive: {
        backgroundColor: "#52B3B1",
    },
    timelineLine: {
        position: "absolute",
        top: 14,
        bottom: 0,
        width: 2,
        backgroundColor: "#CFEFED",
    },
    stageContent: {
        flex: 1,
        marginLeft: 8,
        paddingBottom: 18,
    },
    stageHeader: {
        minHeight: 44,
        paddingHorizontal: 14,
        borderRadius: 14,
        backgroundColor: "white",
        borderWidth: 1,
        borderColor: "#DDEFED",
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
    },
    stageHeaderRight: {
        flexDirection: "row",
        alignItems: "center",
        gap: 8,
    },
    stageBadge: {
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 10,
        backgroundColor: "#F2F2F2",
    },
    stageBadgeComplete: {
        backgroundColor: "#E8F6F6",
    },
    stageBadgeText: {
        fontSize: 11,
        fontWeight: "700",
        color: "#666",
    },
    stageBadgeTextComplete: {
        color: "#287d7b",
    },
    stageTitle: {
        flex: 1,
        marginRight: 8,
        fontSize: 15,
        fontWeight: "700",
        color: "#111",
    },
    milestones: {
        marginTop: 8,
        gap: 8,
    },
    allDoneText: {
        fontSize: 12,
        color: "#666",
        paddingVertical: 12,
        textAlign: "center",
    },
    milestoneActions: {alignItems: 'flex-end', marginLeft: 8},
    editCourse: {minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 5},
    editCourseText: {fontSize: 11, fontWeight: '700', color: '#287d7b'},
    milestoneCard: {
        minHeight: 65,
        padding: 12,
        borderRadius: 14,
        backgroundColor: "white",
        borderWidth: 1,
        borderColor: "#EEEEEE",
        flexDirection: "row",
        alignItems: "center",
    },
    checkbox: {
        width: 25,
        height: 25,
        marginRight: 11,
        borderRadius: 7,
        borderWidth: 2,
        borderColor: "#CCCCCC",
        alignItems: "center",
        justifyContent: "center",
    },
    checkboxCompleted: {
        backgroundColor: "#52B3B1",
        borderColor: "#52B3B1",
    },
    milestoneInfo: {
        flex: 1,
        minWidth: 0,
    },
    milestoneCode: {
        marginBottom: 2,
        fontSize: 12,
        fontWeight: "700",
        color: "#111",
    },
    milestoneTitle: {
        fontSize: 12,
        color: "#666",
        lineHeight: 17,
    },
    points: {
        marginLeft: 8,
        fontSize: 12,
        fontWeight: "700",
        color: "#52B3B1",
    },
    changePathwayButton: {
        minHeight: 50,
        marginBottom: 20,
        borderRadius: 14,
        backgroundColor: "#52B3B1",
        alignItems: "center",
        justifyContent: "center",
    },
    changePathwayText: {
        fontSize: 15,
        fontWeight: "700",
        color: "white",
    },
    guestContent: {
        flexGrow: 1,
        paddingBottom: 40,
    },
    guestCard: {
        marginHorizontal: "7%",
        marginTop: 40,
        padding: 24,
        borderRadius: 20,
        borderWidth: 1,
        borderColor: "#EEEEEE",
        alignItems: "center",
    },
    guestIcon: {
        width: 76,
        height: 76,
        borderRadius: 38,
        backgroundColor: "#E8F6F6",
        alignItems: "center",
        justifyContent: "center",
        marginBottom: 16,
    },
    guestTitle: {
        fontSize: 18,
        fontWeight: "700",
        color: "#111",
        textAlign: "center",
    },
    guestText: {
        fontSize: 13,
        color: "#666",
        textAlign: "center",
        lineHeight: 19,
        marginTop: 8,
        marginBottom: 20,
    },
    guestButton: {
        height: 48,
        paddingHorizontal: 24,
        borderRadius: 14,
        backgroundColor: "#52B3B1",
        alignItems: "center",
        justifyContent: "center",
    },
    guestButtonText: {
        fontSize: 14,
        fontWeight: "700",
        color: "white",
    }
});
