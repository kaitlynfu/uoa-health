import { useState } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

type Props = { programmeName: string; text?: string | null };

export default function ClinicalOtherPathways({ programmeName, text }: Props) {
    const [expanded, setExpanded] = useState(false);
    const isMedicine = /MBChB|Medicine/i.test(programmeName);
    const isOptometry = /BOptom|Optometry/i.test(programmeName);
    const isPharmacy = /BPharm|Pharmacy/i.test(programmeName);

    const pathways=(text??'').split(/\r?\n/).map(line=>line.trim()).filter(line=>/graduate|first.?year|undergraduate|^Option [AB]:|entry categor/i.test(line));
    if (!isMedicine && !isOptometry && !isPharmacy) return null;

    return (
        <View style={styles.card}>
            <TouchableOpacity style={styles.header} activeOpacity={0.7} onPress={() => setExpanded(!expanded)} accessibilityRole="button" accessibilityState={{ expanded }}>
                <View style={styles.orangeIcon}><Ionicons name="git-branch-outline" size={20} color="#E87931"/></View>
                <View style={styles.headerText}>
                    <Text style={styles.title}>Other Entry Pathways</Text>
                    <Text style={styles.subtitle}>Explore alternative routes into this programme</Text>
                </View>
                <Ionicons name={expanded ? "chevron-up" : "chevron-down"} size={18} color="#888888"/>
            </TouchableOpacity>

            {expanded && (
                <View style={styles.content}>
                    {pathways.length?pathways.map((description,index)=>(
                        <View style={styles.pathwayCard} key={index}>
                            <View style={styles.pathwayHeader}>
                                <Ionicons name="document-text-outline" size={18} color="#888888"/>
                                <Text style={styles.pathwayTitle}>Programme entry information</Text>
                            </View>
                            <Text selectable style={styles.description}>{description}</Text>
                        </View>
                    )):<Text style={styles.description}>Alternative entry information is not available in the current programme data. Check the official programme page.</Text>}
                    <Text style={styles.description}>Read the full entry requirements for all conditions and application dates.</Text>
                </View>
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    card: {
        backgroundColor: "#FFFFFF",
    },
    header: {
        flexDirection: "row",
        alignItems: "center",
        minHeight: 65,
        paddingVertical: 8
    },
    orangeIcon: {
        width: 35,
        height: 35,
        borderRadius: 10,
        backgroundColor: "#FFE4D4",
        alignItems: "center",
        justifyContent: "center",
        marginRight: 10
    },
    headerText: {
        flex: 1
    },
    title: {
        fontSize: 11,
        fontWeight: "700",
        color: "#222222",
        marginBottom: 3
    },
    subtitle: {
        fontSize: 10,
        color: "#777777",
        lineHeight: 15
    },
    content: {
        borderTopWidth: 1,
        borderTopColor: "#EEEEEE",
        marginTop: 14,
        paddingTop: 14,
        gap: 10
    },
    pathwayCard: {
        backgroundColor: "#F7F7F7",
        borderRadius: 11,
        padding: 12,
        gap: 7
    },
    pathwayHeader: {
        flexDirection: "row",
        alignItems: "center",
        gap: 10
    },
    pathwayTitle: {
        fontSize: 11,
        fontWeight: "700",
        color: "#444444"
    },
    description: {
        fontSize: 10,
        color: "#666666",
        lineHeight: 16
    },
    note: {
        fontSize: 9,
        color: "#888888",
        lineHeight: 15,
        marginTop: 5
    },
});
