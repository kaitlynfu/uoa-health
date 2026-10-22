import { Ionicons } from "@expo/vector-icons";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";

import { COLORS } from "../constants/theme";
import IconCircle from "./IconCircle";

type Props = {
    icon: keyof typeof Ionicons.glyphMap;
    title: string;
    onPress: () => void;
};

export default function SettingsOption({ icon, title, onPress }: Props) {
    return (
        <TouchableOpacity accessibilityRole="button" accessibilityLabel={title} style={styles.option} onPress={onPress}>
            <View style={styles.optionLeft}>
                <IconCircle icon={icon}/>
                <Text style={styles.optionText}>{title}</Text>
            </View>

            <Ionicons name="chevron-forward" size={20} color="grey" />
        </TouchableOpacity>
    );
}

const styles = StyleSheet.create({
    option: {
        minHeight: 58,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
    },
    optionLeft: {
        flexDirection: "row",
        alignItems: "center",
        flex: 1,
        gap: 12,
    },
    optionText: {
        fontSize: 15,
        fontWeight: "500",
        color: COLORS.text,
    },
});
