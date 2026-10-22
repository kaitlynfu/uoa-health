import { StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { COLORS } from "../constants/theme";

interface IconCircleProps {
    icon: keyof typeof Ionicons.glyphMap;
    size?: number;
    iconSize?: number;
    backgroundColor?: string;
    iconColor?: string;
}

export default function IconCircle({ icon, size = 42, iconSize = 21, backgroundColor = COLORS.primary , iconColor = COLORS.secondary}: IconCircleProps) {
    return (
        <View
            style={[styles.circle, {
                width: size,height: size, borderRadius: size / 2,backgroundColor}]}>
            <Ionicons name={icon} size={iconSize} color={iconColor} />
        </View>
    );
}

const styles = StyleSheet.create({
    circle: {
        justifyContent: "center",
        alignItems: "center",
    },
});
