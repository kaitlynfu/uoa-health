import { Ionicons } from "@expo/vector-icons";
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";

import { COLORS } from "../constants/theme";

type Props = {
    title: string;
    interests: string[];
    onEdit: () => void;
};

export default function ProfileInterests({ title, interests, onEdit }: Props) {
    return (
        <View style={styles.sectionCard}>
            <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>{title}</Text>

                <TouchableOpacity style={styles.editButton} onPress={onEdit}>
                    <Text style={styles.editText}>Edit interests</Text>
                    <Ionicons name="chevron-forward" size={18} color={COLORS.secondary} />
                </TouchableOpacity>
            </View>

            <View style={styles.divider} />

            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.bubbles}>
                {interests.map((interest) => (
                    <View key={interest} style={styles.interestBubble}>
                        <Text style={styles.interestText}>{interest}</Text>
                    </View>
                ))}
            </ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    sectionCard: {
        backgroundColor: "#FFFFFF",
        borderRadius: 14,
        padding: 16,
        marginTop: 4,
        marginBottom: 16,
        borderWidth: 1,
        borderColor: "#e8e8e8",
    },
    sectionHeader: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
    },
    sectionTitle: {
        fontSize: 15,
        fontWeight: "600",
        color: COLORS.text,
    },
    editButton: {
        flexDirection: "row",
        alignItems: "center",
        gap: 2,
    },
    editText: {
        fontSize: 13,
        fontWeight: "600",
        color: "#287d7b",
    },
    divider: {
        height: 1,
        backgroundColor: "#e8e8e8",
        marginTop: 12,
        marginBottom: 12,
    },
    bubbles: {
        flexDirection: "row",
        flexWrap: "wrap",
        gap: 8,
    },
    interestBubble: {
        backgroundColor: "#EAF6F5",
        borderRadius: 20,
        paddingHorizontal: 12,
        paddingVertical: 7,
    },
    interestText: {
        fontSize: 13,
        color: "#287d7b",
        fontWeight: "500",
    },
});
