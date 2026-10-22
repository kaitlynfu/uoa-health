import { Ionicons } from "@expo/vector-icons";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";

import { COLORS } from "../constants/theme";

type Props = {
    icon: keyof typeof Ionicons.glyphMap;
    title: string;
    onPress: () => void;
};

export default function ProfileSavedItem({ icon, title, onPress }: Props) {
    return (
        <TouchableOpacity style={styles.savedItem} onPress={onPress}>
            <View style={styles.savedIcon}>
                <Ionicons name={icon} size={26} color={COLORS.secondary} />
            </View>

            <Text style={styles.savedItemTitle}>{title}</Text>
        </TouchableOpacity>
    );
}

const styles = StyleSheet.create({
    savedItem: {
        flex: 1,
        minHeight: 80,
        borderRadius: 14,
        padding: 12,
        flexDirection: "row",
        alignItems: "center",
        gap: 10,
        borderWidth: 1,
        borderColor: "#EAEAEA",
    },
    savedIcon: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: "#E8F6F6",
        alignItems: "center",
        justifyContent: "center",
    },
    savedItemTitle: {
        flex: 1,
        minWidth:0,
        fontSize: 13,
        fontWeight: "500",
        color: COLORS.text,
        lineHeight: 19,
    },
});
