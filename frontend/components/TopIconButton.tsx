import { ComponentProps } from "react";
import { StyleSheet, TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { COLORS } from "../theme/tokens";

export type IoniconName = ComponentProps<typeof Ionicons>["name"];

interface TopIconButtonProps {
    icon: IoniconName;
    onPress?: () => void;
    variant?: "solid" | "ghost";
    floating?: boolean;
}

export default function TopIconButton({
    icon,
    onPress,
    variant = "solid",
    floating = false,
}: TopIconButtonProps) {
    return (
        <TouchableOpacity
            onPress={onPress}
            activeOpacity={0.7}
            style={[
                styles.base,
                variant === "ghost" && styles.ghost,
                floating && styles.floating,
            ]}
        >
            <Ionicons name={icon} size={20} color={COLORS.textPrimary} />
        </TouchableOpacity>
    );
}

const styles = StyleSheet.create({
    base: {
        width: 40,
        height: 40,
        borderRadius: 20,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: COLORS.surfaceMuted,
    },
    ghost: {
        backgroundColor: "transparent",
    },
    floating: {
        backgroundColor: COLORS.background,
        shadowColor: "#000",
        shadowOpacity: 0.1,
        shadowRadius: 8,
        shadowOffset: { width: 0, height: 2 },
        elevation: 3,
    },
});
