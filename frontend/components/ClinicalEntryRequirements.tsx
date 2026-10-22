import { useState } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import RequirementSource from "./RequirementSource";

type Props = { text?: string | null; programmeName: string };
type Pathway = { title: string; description: string; details: string[]; icon: keyof typeof Ionicons.glyphMap };
type Weight = { label: string; value: string };

export default function UniversityEntryRequirements({ text, programmeName }: Props) {
    const [expanded, setExpanded] = useState(false);
    const [openPathway, setOpenPathway] = useState<number | null>(null);
    const content = text?.trim() ?? "";
    const lines = content.split(/\r?\n/).map(line => line.trim()).filter(Boolean);
    const isMedicine = /MBChB|Medicine and Bachelor of Surgery/i.test(programmeName);
    const isOptometry = /BOptom|Optometry/i.test(programmeName);
    const isPharmacy = /BPharm|Pharmacy/i.test(programmeName);
    const entryType = "Undergraduate Entry";
    const entryYear = content.match(/20\d{2}\s+entry/i)?.[0] ?? "";
    const gpa = content.match(/minimum Grade Point Average \(GPA\) of\s+([\d.]+)/i)?.[1];
    const hasNoFails = /with no fails/i.test(content);
    const pathways: Pathway[] = [];

    if (isMedicine) {
        const eligible = lines.filter(line => /^Bachelor of (Biomedical Science|Health Sciences|Science)\s*\(/i.test(line));
        const biomedical = eligible.filter(line => /^Bachelor of Biomedical Science/i.test(line));
        const health = eligible.filter(line => /^Bachelor of Health Sciences/i.test(line));
        const science = eligible.filter(line => /^Bachelor of Science/i.test(line));

        if (biomedical.length > 0) {
            pathways.push({ title: "Bachelor of Biomedical Science", description: "Approved first-year programme", details: ["Complete the approved first-year study requirements."], icon: "book-outline" });
        }
        if (health.length > 0) {
            pathways.push({ title: "Bachelor of Health Sciences", description: `${health.length} approved majors`, details: health.map(line => line.replace(/^Bachelor of Health Sciences \(BHSc\)\s*[–-]\s*/i, "")), icon: "heart-outline" });
        }
        if (science.length > 0) {
            pathways.push({ title: "Bachelor of Science", description: `${science.length} approved majors`, details: science.map(line => line.replace(/^Bachelor of Science \(BSc\)\s*[–-]\s*/i, "")), icon: "flask-outline" });
        }
    } else {
        const optionA = lines.find(line => /^Option A:/i.test(line));
        const optionB = lines.find(line => /^Option B:/i.test(line));

        if (optionA) {
            pathways.push({ title: "University of Auckland", description: "Approved first-year study", details: [optionA.replace(/^Option A:\s*/i, "")], icon: "ribbon-outline" });
        }
        if (optionB) {
            pathways.push({ title: "University of Otago", description: "Health Sciences First Year", details: [optionB.replace(/^Option B:\s*/i, "")], icon: "rocket-outline" });
        }
    }

    const selectionWeights: Weight[] = [];

    if (isMedicine) {
        const gpaWeight = content.match(/GPA for four courses[^:]*:\s*(\d+%)/i)?.[1];
        const ucatWeight = content.match(/UCAT ANZ Final Score\s*:\s*(\d+%)/i)?.[1];
        const interviewWeight = content.match(/Multi Mini Interview\s*:\s*(\d+%)/i)?.[1];

        if (gpaWeight) selectionWeights.push({ label: "GPA", value: gpaWeight });
        if (ucatWeight) selectionWeights.push({ label: "UCAT ANZ", value: ucatWeight });
        if (interviewWeight) selectionWeights.push({ label: "Interview", value: interviewWeight });
    }

    const additionalCourse = lines.filter(line => /WTR(?:MHS|SCI)\s*100/i.test(line)).join(" ");
    const interviewRanking = lines.find(line => /^Interview Ranking/i.test(line));
    const finalSelection = lines.find(line => /^Final Selection Ranking/i.test(line));
    const interviewDescription = interviewRanking?.replace(/^Interview Ranking\s*/i, "") ?? "";
    const selectionDescription = finalSelection?.replace(/^Final Selection Ranking\s*/i, "") ?? "";
    const hasInterview = /interview/i.test(content);

    return (
        <View style={styles.card}>
            <TouchableOpacity style={styles.header} activeOpacity={0.7} onPress={() => setExpanded(!expanded)} accessibilityRole="button" accessibilityState={{ expanded }}>
                <View style={styles.purpleIcon}>
                    <Ionicons name="school-outline" size={20} color="#6C55D9"/>
                </View>
                <View style={styles.headerText}>
                    <Text style={styles.title}>{entryType}</Text>
                    <Text style={styles.subtitle}>University study pathways</Text>
                </View>
                <Ionicons name={expanded ? "chevron-up" : "chevron-down"} size={18} color="#777777"/>
            </TouchableOpacity>

            {expanded && (
                <View style={styles.expanded}>
                    <View style={styles.divider}/>
                    <View style={styles.introRow}>
                        <Ionicons name="information-circle-outline" size={18} color="#888888"/>
                        <Text style={styles.introText}>Review the university study and selection requirements below. The full source conditions are also available below.</Text>
                    </View>

                    {pathways.length > 0 && (
                        <View style={styles.section}>
                            <View style={styles.sectionHeading}>
                                <Text style={styles.sectionHeadingTitle}>Eligible Entry Pathways</Text>
                                {!!entryYear && <Text style={styles.yearLabel}>{entryYear}</Text>}
                            </View>
                            <Text style={styles.sectionDescription}>Complete the required first-year study through one of the following pathways.</Text>
                            <View style={styles.pathwayContainer}>
                                {pathways.map((pathway, index) => {
                                    const isOpen = openPathway === index;
                                    return (
                                        <View key={index}>
                                            <TouchableOpacity style={styles.pathwayRow} activeOpacity={0.7} onPress={() => setOpenPathway(isOpen ? null : index)} accessibilityRole="button" accessibilityState={{ expanded: isOpen }}>
                                                <View style={styles.pathwayIcon}>
                                                    <Ionicons name={pathway.icon} size={18} color="#888888"/>
                                                </View>
                                                <View style={styles.pathwayContent}>
                                                    <Text style={styles.pathwayTitle}>{pathway.title}</Text>
                                                    <Text style={styles.pathwaySubtitle}>{pathway.description}</Text>
                                                </View>
                                                <Ionicons name={isOpen ? "chevron-up" : "chevron-down"} size={15} color="#999999"/>
                                            </TouchableOpacity>
                                            {isOpen && (
                                                <View style={styles.pathwayDetails}>
                                                    {pathway.details.map((detail, detailIndex) => (
                                                        <View key={detailIndex} style={styles.detailRow}>
                                                            <View style={styles.detailDot}/>
                                                            <Text style={styles.detailText}>{detail}</Text>
                                                        </View>
                                                    ))}
                                                </View>
                                            )}
                                            {index < pathways.length - 1 && <View style={styles.pathwayDivider}/>}
                                        </View>
                                    );
                                })}
                            </View>
                            {(isOptometry || isPharmacy) && (
                                <View style={styles.infoRow}>
                                    <Ionicons name="information-circle-outline" size={16} color="#888888"/>
                                    <Text style={styles.body}>Applicants must complete the relevant first-year study on a full-time basis.</Text>
                                </View>
                            )}
                        </View>
                    )}

                    {!!gpa && (
                        <View style={styles.section}>
                            <Text style={styles.sectionTitle}>Interview Eligibility</Text>
                            <View style={styles.gpaRow}>
                                <View style={styles.gpaCard}>
                                    <Text style={styles.gpaValue}>{gpa}</Text>
                                    <Text style={styles.gpaLabel}>Minimum GPA</Text>
                                </View>
                                <View style={styles.gpaDescription}>
                                    <Text style={styles.body}>Across the specified first-year courses {hasNoFails ? ", with no failed courses" : ""}.</Text>
                                </View>
                            </View>
                            <View style={styles.infoRow}>
                                <Ionicons name="information-circle-outline" size={16} color="#888888" />
                                <Text style={styles.body}>{additionalCourse}</Text>
                            </View>
                            <Text style={styles.eligibilityNote}>Meeting the minimum GPA makes you eligible for consideration but does not guarantee an interview or an offer of admission.</Text>
                        </View>
                    )}

                    {selectionWeights.length > 0 && (
                        <View style={styles.section}>
                            <Text style={styles.sectionTitle}>Selection Weighting</Text>
                            <View style={styles.scoreRow}>
                                {selectionWeights.map(item => (
                                    <View key={item.label} style={styles.scoreCard}>
                                        <Text style={styles.scoreValue}>{item.value}</Text>
                                        <Text style={styles.scoreLabel}>{item.label}</Text>
                                    </View>
                                ))}
                            </View>
                        </View>
                    )}

                    {hasInterview && (
                        <View style={styles.section}>
                            <Text style={styles.sectionTitle}>Interview and Selection</Text>
                            {isMedicine && /UCAT/i.test(content) && (
                                <View style={styles.infoCard}>
                                    <View style={styles.infoCardHeader}>
                                        <Ionicons name="document-text-outline" size={17} color="#888888" />
                                        <Text style={styles.infoCardTitle}>UCAT ANZ</Text>
                                    </View>
                                    <Text style={styles.infoCardText}>Applicants must complete the UCAT ANZ as part of the Medicine selection process.</Text>
                                </View>
                            )}
                            <View style={styles.infoCard}>
                                <View style={styles.infoCardHeader}>
                                    <Ionicons name="people-outline" size={17} color="#888888" />
                                    <Text style={styles.infoCardTitle}>Multi Mini Interview (MMI)</Text>
                                </View>
                                <Text style={styles.infoCardText}>{isMedicine ? "Eligible applicants may be considered for a Multi Mini Interview as part of the Medicine selection process." : "Shortlisted applicants may be invited to a Multi Mini Interview as part of the admission process."}</Text>
                            </View>
                            {!!interviewDescription && (
                                <View style={styles.infoCard}>
                                    <View style={styles.infoCardHeader}>
                                        <Ionicons name="list-outline" size={17} color="#888888" />
                                        <Text style={styles.infoCardTitle}>Interview Ranking</Text>
                                    </View>
                                    <Text style={styles.infoCardText}>{interviewDescription}</Text>
                                </View>
                            )}
                            {!!selectionDescription && (
                                <View style={styles.infoCard}>
                                    <View style={styles.infoCardHeader}>
                                        <Ionicons name="document-text-outline" size={17} color="#888888" />
                                        <Text style={styles.infoCardTitle}>Final Selection</Text>
                                    </View>
                                    <Text style={styles.infoCardText}>{selectionDescription}</Text>
                                </View>
                            )}
                        </View>
                    )}
                </View>
            )}
            <RequirementSource text={text}/>
        </View>
    );
}

const styles = StyleSheet.create({
    card: { backgroundColor: "#FFFFFF" },
    header: { flexDirection: "row", alignItems: "center", minHeight: 65, paddingVertical: 8 },
    purpleIcon: { width: 35, height: 35, borderRadius: 10, backgroundColor: "#E8E3FF", alignItems: "center", justifyContent: "center" },
    headerText: { flex: 1, marginLeft: 10 },
    title: { fontSize: 11, fontWeight: "700", color: "#222222", marginBottom: 2 },
    subtitle: { fontSize: 10, color: "#666666", lineHeight: 14 },
    expanded: { marginTop: 14 },
    divider: { height: 1, backgroundColor: "#EEEEEE", marginBottom: 15 },
    introRow: { flexDirection: "row", alignItems: "flex-start", gap: 9, marginBottom: 20 },
    introText: { flex: 1, fontSize: 10, lineHeight: 15, color: "#666666" },
    section: { marginBottom: 20 },
    sectionHeading: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8, marginBottom: 10 },
    sectionHeadingTitle: { flex: 1, fontSize: 11, fontWeight: "700", color: "#222222" },
    sectionTitle: { fontSize: 11, fontWeight: "700", color: "#222222", marginBottom: 12 },
    sectionDescription: { fontSize: 10, lineHeight: 15, color: "#666666", marginBottom: 12 },
    yearLabel: { fontSize: 9, fontWeight: "600", color: "#52B3B1" },
    pathwayContainer: { backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: "#EEEEEE", borderRadius: 12, overflow: "hidden", marginBottom: 12 },
    pathwayRow: { flexDirection: "row", alignItems: "center", padding: 12, gap: 10 },
    pathwayIcon: { width: 36, height: 36, borderRadius: 10, backgroundColor: "#F7F7F7", alignItems: "center", justifyContent: "center" },
    pathwayContent: { flex: 1 },
    pathwayTitle: { fontSize: 11, fontWeight: "700", color: "#333333", marginBottom: 3 },
    pathwaySubtitle: { fontSize: 10, lineHeight: 14, color: "#888888" },
    pathwayDivider: { height: 1, backgroundColor: "#EEEEEE", marginHorizontal: 12 },
    pathwayDetails: { paddingHorizontal: 14, paddingBottom: 13, paddingLeft: 58, gap: 8 },
    detailRow: { flexDirection: "row", alignItems: "flex-start", gap: 8 },
    detailDot: { width: 5, height: 5, borderRadius: 3, backgroundColor: "#888888", marginTop: 5 },
    detailText: { flex: 1, fontSize: 10, lineHeight: 15, color: "#666666" },
    gpaRow: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 12 },
    gpaCard: { width: 108, backgroundColor: "#E8F6F6", borderRadius: 12, paddingVertical: 17, paddingHorizontal: 8, alignItems: "center" },
    gpaValue: { fontSize: 24, fontWeight: "700", color: "#52B3B1" },
    gpaLabel: { fontSize: 10, fontWeight: "600", color: "#52B3B1", marginTop: 4 },
    gpaDescription: { flex: 1 },
    body: { flex: 1, fontSize: 10, lineHeight: 15, color: "#666666" },
    infoRow: { flexDirection: "row", alignItems: "flex-start", gap: 8, marginBottom: 10 },
    eligibilityNote: { fontSize: 10, lineHeight: 15, color: "#777777", marginTop: 4 },
    scoreRow: { flexDirection: "row", gap: 8 },
    scoreCard: { flex: 1, backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: "#EEEEEE", borderRadius: 12, paddingVertical: 15, paddingHorizontal: 5, alignItems: "center" },
    scoreValue: { fontSize: 20, fontWeight: "700", color: "#52B3B1" },
    scoreLabel: { fontSize: 10, color: "#777777", marginTop: 5, textAlign: "center" },
    infoCard: { backgroundColor: "#F7F7F7", borderRadius: 12, padding: 12, marginBottom: 10 },
    infoCardHeader: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 8 },
    infoCardTitle: { fontSize: 11, fontWeight: "700", color: "#555555" },
    infoCardText: { fontSize: 10, lineHeight: 16, color: "#666666" },
    footerNote: { flexDirection: "row", alignItems: "flex-start", gap: 9, paddingTop: 12, borderTopWidth: 1, borderTopColor: "#EEEEEE" },
    footerText: { flex: 1, fontSize: 10, lineHeight: 15, color: "#888888" },
});
