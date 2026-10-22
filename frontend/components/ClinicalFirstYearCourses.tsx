
import React, { useMemo, useState } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

type Props = { text?: string | null; programmeName: string; duration?: string | null };
type Course = { code: string; name: string };
type CourseGroup = { title: string; courses: Course[] };

const COURSE_REGEX = /^([A-Z]{2,}\s*\d{3}[A-Z]?)\s*:\s*(.+)$/;
const STOP_REGEX = /^(?:Option B:|Interview Eligibility|Interview Ranking|Final Selection Ranking|Graduate Entry)/i;

function parseCourses(lines: string[]): Course[] {
    const courses: Course[] = [];
    for (const line of lines) {
        const match = line.trim().match(COURSE_REGEX);
        if (!match) continue;
        const code = match[1].replace(/\s+/g, " ").replace(/([A-Z])(\d)/, "$1 $2");
        const name = match[2].trim();
        if (!courses.some(course => course.code === code)) courses.push({ code, name });
    }
    return courses;
}

function getAucklandLines(text: string): string[] {
    const lines = text.split(/\r?\n/).map(line => line.trim()).filter(Boolean);
    const start = lines.findIndex(line => /^Option A:/i.test(line));
    const relevant = start >= 0 ? lines.slice(start + 1) : lines;
    const end = relevant.findIndex(line => STOP_REGEX.test(line));
    return end >= 0 ? relevant.slice(0, end) : relevant;
}

function getCourseGroups(text: string, programmeName: string): CourseGroup[] {
    const lines = getAucklandLines(text);
    const isPharmacy = /BPharm|Pharmacy/i.test(programmeName);
    const isMedicine = /MBChB|Medicine/i.test(programmeName);

    if (isPharmacy) {
        const courses = parseCourses(lines).filter(course => !/^WTR/.test(course.code));
        return courses.length ? [{ title: "Core Courses", courses }] : [];
    }

    if (isMedicine) {
        const headingIndex = lines.findIndex(line => /^First Year BSc \(Biomedical Science\) courses:/i.test(line));
        if (headingIndex >= 0) {
            const first = parseCourses(lines.slice(0, headingIndex));
            const second = parseCourses(lines.slice(headingIndex + 1));
            return [
                ...(first.length ? [{ title: "Health Sciences Pathway", courses: first }] : []),
                ...(second.length ? [{ title: "Biomedical Science Pathway", courses: second }] : []),
            ];
        }
    }

    const courses = parseCourses(lines);
    return courses.length ? [{ title: "First-Year Courses", courses }] : [];
}

export default function ClinicalFirstYearCourses({ text, programmeName, duration }: Props) {
    const isPharmacy = /BPharm|Pharmacy/i.test(programmeName);
    const [requirementsExpanded, setRequirementsExpanded] = useState(false);
    const [selectedGroup, setSelectedGroup] = useState(0);
    const [degree, setDegree] = useState<"BHSc" | "BSc">("BHSc");
    const groups = useMemo(() => getCourseGroups(text ?? "", programmeName), [text, programmeName]);
    const entryYear = text?.match(/20\d{2}\s+entry/i)?.[0]?.replace(/\s+entry/i, "") ?? "";
    const hasElectives = isPharmacy && /Three 15 point elective courses/i.test(text ?? "");
    const hasWtr = isPharmacy && /WTRMHS 100.*WTRSCI 100/i.test(text ?? "");
    const wtrCode = degree === "BHSc" ? "WTRMHS 100" : "WTRSCI 100";
    const wtrName = parseCourses((text ?? "").split(/\r?\n/)).find(course => course.code === wtrCode)?.name ?? "Check the official course catalogue for the current title.";

    return (
        <View>
            <View>
                <TouchableOpacity style={styles.requirementsHeader} activeOpacity={0.7} onPress={() => setRequirementsExpanded(!requirementsExpanded)} accessibilityRole="button" accessibilityState={{ expanded: requirementsExpanded }}>
                    <View style={styles.orangeIcon}><Ionicons name="compass-outline" size={20} color="#E87931"/></View>
                    <View style={styles.headerText}>
                        <Text style={styles.rowTitle}>First-Year Course Requirements</Text>
                        <Text style={styles.rowDescription}>University of Auckland · View required courses</Text>
                    </View>
                    <Ionicons name={requirementsExpanded ? "chevron-up" : "chevron-down"} size={18} color="#888888" style={{ marginLeft: 10, alignSelf: "center" }}/>
                </TouchableOpacity>

                {requirementsExpanded && (
                    <View style={styles.requirementsContent}>
                        {groups.length > 0 ? (
                            <>
                                {groups.length > 1 && (
                                    <>
                                        <Text style={styles.selectorLabel}>Select a pathway</Text>
                                        <View style={styles.pathwaySelector}>
                                            {groups.map((group, index) => (
                                                <TouchableOpacity key={index} style={[styles.pathwayOption, selectedGroup === index && styles.pathwayActive]} onPress={() => setSelectedGroup(index)}>
                                                    <Text style={[styles.pathwayText, selectedGroup === index && styles.pathwayActiveText]}>{group.title.replace(" Pathway", "")}</Text>
                                                </TouchableOpacity>
                                            ))}
                                        </View>
                                    </>
                                )}

                                {groups[selectedGroup] && (
                                    <>
                                        <View style={styles.courseHeading}>
                                            <Text style={styles.groupTitle}>{groups[selectedGroup].title}</Text>
                                            <Text style={styles.groupSubtitle}>{groups[selectedGroup].courses.length} listed courses</Text>
                                        </View>
                                        <View style={styles.courseGrid}>
                                            {groups[selectedGroup].courses.map(course => (
                                                <View key={course.code} style={styles.courseTile}>
                                                    <Text style={styles.courseCode}>{course.code}</Text>
                                                    <Text style={styles.courseName}>{course.name}</Text>
                                                </View>
                                            ))}
                                        </View>
                                    </>
                                )}
                            </>
                        ) : (
                            <Text style={styles.emptyText}>First-year course information is not available in the current programme data.</Text>
                        )}
                        {hasElectives && (
                            <View style={styles.additionalContainer}>
                                <View style={styles.additionalHeading}>
                                    <Text style={styles.groupTitle}>Additional Courses</Text>
                                    <Text style={styles.groupSubtitle}>As listed in requirements</Text>
                                </View>

                                <View style={styles.electiveCard}>
                                    <View style={styles.electiveHeader}>
                                        <Ionicons name="layers-outline" size={17} color="#6C55D9" />
                                        <Text style={styles.additionalTitle}>Elective Courses</Text>
                                    </View>
                                    <Text style={styles.additionalText}>Three 15-point elective courses from your degree schedule.</Text>
                                    <Text style={styles.pointsText}>45 points</Text>
                                </View>

                                {hasWtr && (
                                    <View style={styles.wtrSection}>
                                        <Text style={styles.additionalTitle}>Required Waipapa Taumata Rau Course</Text>
                                        <View style={styles.degreeSelector}>
                                            <TouchableOpacity style={[styles.degreeOption, degree === "BHSc" && styles.degreeActive]} onPress={() => setDegree("BHSc")}><Text style={[styles.degreeText, degree === "BHSc" && styles.degreeActiveText]}>Health Sciences</Text></TouchableOpacity>
                                            <TouchableOpacity style={[styles.degreeOption, degree === "BSc" && styles.degreeActive]} onPress={() => setDegree("BSc")}><Text style={[styles.degreeText, degree === "BSc" && styles.degreeActiveText]}>Science</Text></TouchableOpacity>
                                        </View>
                                        <View style={styles.wtrCard}>
                                            <Text style={styles.wtrCode}>{wtrCode}</Text>
                                            <Text style={styles.wtrName}>{wtrName}</Text>
                                            <Text style={styles.wtrDescription}>Required for {degree} applicants</Text>
                                        </View>
                                    </View>
                                )}
                            </View>
                        )}
                    </View>
                )}
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    requirementsHeader: { flexDirection: "row", alignItems: "center", minHeight: 65, paddingVertical: 8 },
    requirementsContent: { borderTopWidth: 1, borderTopColor: "#EEEEEE", marginTop: 14, paddingTop: 14 },
    selectorLabel: { fontSize: 11, fontWeight: "700", color: "#333333", marginBottom: 10 },
    pathwaySelector: { flexDirection: "row", backgroundColor: "#F7F7F7", borderRadius: 10, padding: 4, gap: 4, marginBottom: 16 },
    pathwayOption: { flex: 1, alignItems: "center", justifyContent: "center", paddingVertical: 10, paddingHorizontal: 5, borderRadius: 8 },
    pathwayActive: { backgroundColor: "#E8F6F6" },
    pathwayText: { fontSize: 10, fontWeight: "600", color: "#777777", textAlign: "center" },
    pathwayActiveText: { color: "#389E9C", fontWeight: "700" },
    courseHeading: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 12, gap: 8 },
    sectionHeader: { flexDirection: "row", alignItems: "center", marginBottom: 12 },
    orangeIcon: { width: 35, height: 35, borderRadius: 10, backgroundColor: "#FFE4D4", alignItems: "center", justifyContent: "center", marginRight: 10 },
    greenIcon: { width: 35, height: 35, borderRadius: 10, backgroundColor: "#DDF3E9", alignItems: "center", justifyContent: "center", marginRight: 10 },
    purpleIcon: { width: 35, height: 35, borderRadius: 10, backgroundColor: "#E8E3FF", alignItems: "center", justifyContent: "center", marginRight: 10 },
    headerText: { flex: 1 },
    rowTitle: { fontSize: 11, fontWeight: "700", color: "#222222", marginBottom: 3 },
    rowDescription: { fontSize: 10, lineHeight: 15, color: "#777777" },
    group: { borderTopWidth: 1, borderTopColor: "#EEEEEE" },
    groupHeader: { flexDirection: "row", alignItems: "center", paddingVertical: 12 },
    groupTitle: { fontSize: 11, fontWeight: "700", color: "#333333", marginBottom: 3 },
    groupSubtitle: { fontSize: 10, color: "#888888" },
    courseGrid: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", rowGap: 8, paddingBottom: 12 },
    courseTile: { width: "48.5%", backgroundColor: "#F7F9F9", borderRadius: 11, padding: 12, minHeight: 80 },
    courseCode: { fontSize: 10, fontWeight: "700", color: "#389E9C", marginBottom: 6 },
    courseName: { fontSize: 10, lineHeight: 15, color: "#444444" },
    separator: { height: 1, backgroundColor: "#EEEEEE", marginVertical: 12 },
    additionalSection: { gap: 8 },
    additionalContainer: { borderTopWidth: 1, borderTopColor: "#EEEEEE", marginTop: 16, paddingTop: 16, gap: 12 },
    additionalHeading: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
    electiveCard: { backgroundColor: "#F7F9F9", borderRadius: 11, padding: 12, gap: 7 },
    electiveHeader: { flexDirection: "row", alignItems: "center", gap: 8 },
    pointsText: { fontSize: 9, color: "#888888" },
    wtrSection: { gap: 10 },
    additionalTitle: { fontSize: 11, fontWeight: "700", color: "#333333" },
    additionalText: { fontSize: 10, lineHeight: 16, color: "#666666" },
    degreeSelector: { flexDirection: "row", backgroundColor: "#F7F7F7", borderRadius: 9, padding: 3, gap: 3 },
    degreeDescription: { fontSize: 10, color: "#888888", marginTop: 3 },
    degreeOption: { flex: 1, alignItems: "center", justifyContent: "center", borderRadius: 7, paddingVertical: 8 },
    degreeActive: { backgroundColor: "#E8F6F6" },
    degreeText: { fontSize: 10, fontWeight: "600", color: "#777777" },
    degreeActiveText: { color: "#389E9C", fontWeight: "700" },
    wtrCard: { backgroundColor: "#F7F9F9", borderRadius: 10, padding: 12, gap: 5 },
    wtrCode: { fontSize: 11, fontWeight: "700", color: "#389E9C" },
    wtrName: { fontSize: 10, lineHeight: 16, color: "#444444" },
    wtrDescription: { fontSize: 9, color: "#888888" },
    emptyRow: { flexDirection: "row", alignItems: "flex-start", gap: 8, paddingVertical: 12 },
    emptyText: { flex: 1, fontSize: 10, lineHeight: 16, color: "#777777" },
    durationCard: { borderWidth: 1, borderColor: "#EEEEEE", borderRadius: 15, padding: 14, flexDirection: "row", alignItems: "center", marginBottom: 14, backgroundColor: "#FFFFFF" },
    footerText: { fontSize: 9, lineHeight: 15, color: "#888888", marginTop: 2, marginBottom: 10, textAlign: "center" },
});
