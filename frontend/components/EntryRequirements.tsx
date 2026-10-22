
import { useState } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import RequirementSource from "./RequirementSource";

type Props = { text?: string | null };
type Score = { type: string; score: string };
type Subject = { type: string; details: string };

export default function EntryRequirements({ text }: Props) {
    const [secondaryOpen, setSecondaryOpen] = useState(false);
    const [otherOpen, setOtherOpen] = useState(false);
    const content = text?.trim() ?? "";
    const lines = content.split(/\r?\n/).map(line => line.trim()).filter(Boolean);
    const paragraphs = lines;

    const scores: Score[] = [];
    const subjects: Subject[] = [];
    const seen = new Set<string>();

    const addSubject = (type: string, details: string) => {
        const value = details.trim();
        const key = value.replace(/\s+/g, " ").toLowerCase();
        if (!value || seen.has(key)) return;
        seen.add(key);
        subjects.push({ type, details: value });
    };

    ["NCEA", "CIE", "IB"].forEach(type => {
        const line = lines.find(line => new RegExp(`^Qualification\\s+${type}\\b`, "i").test(line));
        const match = line?.match(/Score required\s+(\d+)(.*)$/i);
        if (!match) return;
        scores.push({ type, score: match[1] });
        addSubject(type, match[2]);
    });

    lines.forEach((line, index) => {
        if (/^Qualification\s+|^Read more|^To find out/i.test(line)) return;
        if (!/minimum\s+\d+\s+credits|at full A Level|required subjects?:|must have studied/i.test(line)) return;

        const previous = lines.slice(0, index).reverse().find(item => /^Qualification\s+(NCEA|CIE|IB)\b/i.test(item));
        const type = previous?.match(/^Qualification\s+(NCEA|CIE|IB)\b/i)?.[1]?.toUpperCase() ?? "General";
        addSubject(type, line);
    });

    const hasUE = /University Entrance\s*\(UE\)/i.test(content);
    const hasRankScore = /rank score/i.test(content);

    const notes = [...new Set(lines.filter(line => {
        if (/^Qualification\s+|^Read more|^To find out/i.test(line)) return false;
        if (/targeted admission schemes|rank score is slightly lower/i.test(line)) return false;
        if (subjects.some(item => item.details.toLowerCase() === line.toLowerCase())) return false;
        return /limited entry|selection criteria|interview is required|portfolio is required|references are required|additional requirements include/i.test(line);
    }))];

    const lowerScore = /rank score is slightly lower/i.test(content);
    const targetedAdmission = /Undergraduate Targeted Admission Schemes/i.test(content);
    const hasOtherPathways = lowerScore || targetedAdmission;
    const hasSecondaryDetails = hasUE || hasRankScore || scores.length > 0 || subjects.length > 0 || notes.length > 0;

    return (
        <View style={styles.container}>

            {/* Secondary Education */}
            <View>
                <TouchableOpacity style={styles.header} activeOpacity={0.7} onPress={() => setSecondaryOpen(!secondaryOpen)} accessibilityRole="button" accessibilityState={{ expanded: secondaryOpen }}>
                    <View style={styles.purpleIcon}><Ionicons name="school-outline" size={20} color="#6C55D9" /></View>
                    <View style={styles.headerText}>
                        <Text style={styles.title}>Secondary Education</Text>
                        <Text style={styles.subtitle}>Entry from secondary school</Text>
                    </View>
                    <Ionicons name={secondaryOpen ? "chevron-up" : "chevron-down"} size={18} color="#777777" />
                </TouchableOpacity>

                {secondaryOpen && (
                    <View style={styles.expanded}>
                        <View style={styles.divider} />

                        {!content ? (
                            <Text style={styles.copy}>Entry requirements are unavailable. Please check the official programme page.</Text>
                        ) : (
                            <>
                                {(hasUE || hasRankScore) && (
                                    <View style={styles.section}>
                                        <Text style={styles.sectionTitle}>Key Requirements</Text>
                                        {hasUE && (
                                            <View style={styles.requirementRow}>
                                                <View style={styles.checkCircle}><Ionicons name="checkmark" size={11} color="#FFFFFF" /></View>
                                                <Text style={styles.copy}>Meet the University Entrance (UE) standard.</Text>
                                            </View>
                                        )}
                                        {hasRankScore && (
                                            <View style={styles.requirementRow}>
                                                <View style={styles.checkCircle}><Ionicons name="checkmark" size={11} color="#FFFFFF" /></View>
                                                <Text style={styles.copy}>Meet the required rank score for this programme.</Text>
                                            </View>
                                        )}
                                    </View>
                                )}

                                {scores.length > 0 && (
                                    <View style={styles.section}>
                                        <View style={styles.divider} />
                                        <Text style={styles.sectionTitle}>Listed Entry Scores</Text>
                                        <View style={styles.scoreRow}>
                                            {scores.map(item => (
                                                <View key={item.type} style={styles.scoreCard}>
                                                    <Text style={styles.scoreLabel}>{item.type}</Text>
                                                    <Text style={styles.scoreValue}>{item.score}</Text>
                                                </View>
                                            ))}
                                        </View>
                                    </View>
                                )}

                                {subjects.length > 0 && (
                                    <View style={styles.section}>
                                        <View style={styles.divider} />
                                        <Text style={styles.sectionTitle}>Subject Requirements</Text>
                                        {subjects.map((item, index) => (
                                            <View key={`${item.type}-${index}`} style={styles.subjectCard}>
                                                <View style={styles.subjectHeader}>
                                                    <View style={styles.subjectIcon}><Ionicons name="book-outline" size={16} color="#888888" /></View>
                                                    <Text style={styles.subjectTitle}>{item.type}</Text>
                                                </View>
                                                <Text style={styles.subjectText}>{item.details}</Text>
                                            </View>
                                        ))}
                                    </View>
                                )}

                                {notes.length > 0 && (
                                    <View style={styles.section}>
                                        <View style={styles.divider} />
                                        <Text style={styles.sectionTitle}>Additional Information</Text>
                                        {notes.map((note, index) => (
                                            <View key={index} style={styles.noteCard}>
                                                <Ionicons name="information-circle-outline" size={18} color="#888888" />
                                                <Text style={styles.noteText}>{note}</Text>
                                            </View>
                                        ))}
                                    </View>
                                )}

                                {!hasSecondaryDetails && (
                                    <View style={styles.paragraphContainer}>
                                        {paragraphs.map((paragraph, index) => (
                                            <Text key={index} style={styles.paragraphText}>{paragraph}</Text>
                                        ))}
                                    </View>
                                )}
                            </>
                        )}
                    </View>
                )}
            </View>

            <View style={styles.rowDivider} />

            {/* Other Entry Pathways */}
            <View>
                <TouchableOpacity style={styles.header} activeOpacity={0.7} onPress={() => setOtherOpen(!otherOpen)} accessibilityRole="button" accessibilityState={{ expanded: otherOpen }}>
                    <View style={styles.orangeIcon}><Ionicons name="git-branch-outline" size={20} color="#E87931" /></View>
                    <View style={styles.headerText}>
                        <Text style={styles.title}>Other Entry Pathways</Text>
                        <Text style={styles.subtitle}>Alternative ways to enter this programme</Text>
                    </View>
                    <Ionicons name={otherOpen ? "chevron-up" : "chevron-down"} size={18} color="#777777" />
                </TouchableOpacity>

                {otherOpen && (
                    <View style={styles.expanded}>
                        <View style={styles.divider} />
                        {!hasOtherPathways ? (
                            <Text style={styles.copy}>No alternative entry information is currently available. Please check the official programme page for other admission options.</Text>
                        ) : (
                            <>
                                {lowerScore && (
                                    <View style={styles.pathwayCard}>
                                        <View style={styles.pathwayHeader}>
                                            <View style={styles.pathwayIcon}><Ionicons name="trending-up-outline" size={16} color="#888888" /></View>
                                            <Text style={styles.pathwayTitle}>Lower Rank Score</Text>
                                        </View>
                                        <Text style={styles.subjectText}>Applicants with a slightly lower rank score may still be considered if places are available.</Text>
                                    </View>
                                )}

                                {targetedAdmission && (
                                    <View style={styles.pathwayCard}>
                                        <View style={styles.pathwayHeader}>
                                            <View style={styles.pathwayIcon}><Ionicons name="people-outline" size={16} color="#888888" /></View>
                                            <Text style={styles.pathwayTitle}>Targeted Admission Schemes</Text>
                                        </View>
                                        <Text style={styles.subjectText}>If you don't meet the standard entry requirements, you may be able to apply through the University's Undergraduate Targeted Admission Schemes.</Text>
                                    </View>
                                )}
                            </>
                        )}
                    </View>
                )}
            </View>
            <RequirementSource text={text}/>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { backgroundColor: "#FFFFFF" },
    header: { flexDirection: "row", alignItems: "center", minHeight: 65, paddingVertical: 8 },
    headerText: { flex: 1, marginLeft: 10 },
    purpleIcon: { width: 35, height: 35, borderRadius: 10, backgroundColor: "#E8E3FF", alignItems: "center", justifyContent: "center" },
    orangeIcon: { width: 35, height: 35, borderRadius: 10, backgroundColor: "#FFE4D4", alignItems: "center", justifyContent: "center" },
    title: { fontSize: 11, fontWeight: "700", color: "#222222", marginBottom: 2 },
    subtitle: { fontSize: 10, color: "#666666", lineHeight: 14 },
    rowDivider: { height: 1, backgroundColor: "#EEEEEE" },
    expanded: { marginTop: 14, paddingBottom: 14 },
    divider: { height: 1, backgroundColor: "#EEEEEE", marginBottom: 14 },
    section: { marginBottom: 8 },
    sectionTitle: { fontSize: 11, fontWeight: "700", color: "#222222", marginBottom: 13 },
    requirementRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 13 },
    checkCircle: { width: 16, height: 16, borderRadius: 8, backgroundColor: "#2D9F74", alignItems: "center", justifyContent: "center" },
    copy: { flex: 1, fontSize: 10, lineHeight: 14, color: "#666666" },
    scoreRow: { flexDirection: "row", gap: 8, marginBottom: 14 },
    scoreCard: { flex: 1, backgroundColor: "#E8F6F6", borderRadius: 12, paddingVertical: 15, paddingHorizontal: 5, alignItems: "center" },
    scoreLabel: { fontSize: 10, fontWeight: "600", color: "#52B3B1", marginBottom: 5 },
    scoreValue: { fontSize: 21, fontWeight: "700", color: "#52B3B1" },
    subjectCard: { backgroundColor: "#F7F7F7", borderRadius: 12, padding: 12, marginBottom: 10 },
    subjectHeader: { flexDirection: "row", alignItems: "center", marginBottom: 8 },
    subjectIcon: { width: 28, height: 28, borderRadius: 8, backgroundColor: "#F7F7F7", alignItems: "center", justifyContent: "center", marginRight: 8 },
    subjectTitle: { fontSize: 11, fontWeight: "700", color: "#555555" },
    subjectText: { fontSize: 10, lineHeight: 14, color: "#666666" },
    noteCard: { flexDirection: "row", alignItems: "flex-start", backgroundColor: "#F7F7F7", borderRadius: 12, padding: 12, marginBottom: 10, gap: 9 },
    noteText: { flex: 1, fontSize: 10, lineHeight: 14, color: "#666666" },
    pathwayCard: { backgroundColor: "#F7F7F7", borderRadius: 12, padding: 12, marginBottom: 10 },
    pathwayHeader: { flexDirection: "row", alignItems: "center", marginBottom: 8 },
    pathwayIcon: { width: 28, height: 28, borderRadius: 8, backgroundColor: "#F7F7F7", alignItems: "center", justifyContent: "center", marginRight: 8 },
    pathwayTitle: { fontSize: 11, fontWeight: "700", color: "#555555" },
    paragraphContainer: { gap: 12 },
    paragraphText: { fontSize: 10, lineHeight: 16, color: "#666666" },
});
