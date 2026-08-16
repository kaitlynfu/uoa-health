import { StyleSheet, Text, View } from "react-native";

import { Programme } from "../types/programme";

interface ProgrammeCardProps {
    programme: Programme;
}

export default function ProgrammeCard({
    programme,
}: ProgrammeCardProps) {
    return (
        <View style={styles.card}>
            <Text style={styles.name}>{programme.name}</Text>
            <Text>{programme.faculty ?? "Faculty not available"}</Text>
            <Text>{programme.duration ?? "Duration not available"}</Text>
        </View>
    );
}

const styles = StyleSheet.create({
    card: {
        paddingVertical: 16,
        borderBottomWidth: 1,
    },
    name: {
        fontSize: 18,
        fontWeight: "600",
        marginBottom: 4,
    },
});