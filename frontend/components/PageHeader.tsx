import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import MenuButton from "./MenuButton";
import { Ionicons } from "@expo/vector-icons";

type Props = {
    title?: string;
    description?: string;
    navigation: any;
    background?: boolean;
    leftIcon?: "menu" | "back";
    rightIcon?: "notification" | "bookmark";
    rightIconPress?: () => void;
    rightIconActive?: boolean;
}

export default function PageHeader({ title, description, navigation, background = true, leftIcon = "menu", rightIcon = "notification", rightIconPress, rightIconActive = false }: Props) {
    return (
        // Screens own their safe area (or use the navigator's native header).
        <View style={styles.header}>
            <View style={styles.topRow}>
                {leftIcon === "back" ? (
                    <TouchableOpacity style={styles.iconButton} accessibilityRole="button" accessibilityLabel="Go back" onPress={() => navigation.canGoBack() ? navigation.goBack() : navigation.navigate("Home")}>
                        <Ionicons name="chevron-back" size={22} color="#111111" />
                    </TouchableOpacity>
                ) : (
                    <View style={styles.iconButton}>
                        <MenuButton navigation={navigation} />
                    </View>
                )}

                <TouchableOpacity style={styles.iconButton} accessibilityRole="button" accessibilityLabel={rightIcon === "bookmark" ? rightIconPress ? rightIconActive ? "Unsave item" : "Save item" : "Saved items" : "Notifications"} onPress={rightIconPress ? rightIconPress : () => rightIcon === "bookmark" ? navigation.navigate("Saves") : navigation.navigate("Notifications")}>
                    <Ionicons name={rightIcon === "bookmark" ? rightIconActive ? "bookmark" : "bookmark-outline" : "notifications-outline"} size={21} color={rightIconActive ? "#52B3B1" : "#111111"} />
                </TouchableOpacity>
            </View>

            {!background && title && <Text accessibilityRole="header" style={styles.compactTitle}>{title}</Text>}
            {(background ? title || description : description) && (
                <View style={[styles.titleCard, !background && styles.noBackground]}>
                    {background && (
                        <View pointerEvents="none" style={styles.decorations}>
                            <View style={styles.circlePurple} />
                            <View style={styles.circleOrange} />
                            <View style={styles.circleBlue} />
                        </View>
                    )}

                    <View style={styles.headerContent}>
                        {background && title && <Text style={styles.title}>{title}</Text>}
                        {description && <Text style={styles.description}>{description}</Text>}
                    </View>
                </View>
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    header: { backgroundColor: "#FFFFFF", paddingHorizontal: 20, paddingBottom: 8 },
    topRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12, marginTop: 8, marginBottom: 12 },
    compactTitle: {fontSize: 24, lineHeight: 30, fontWeight: '700', color: '#173B39', marginBottom: 10},
    iconButton: { minWidth: 44, minHeight: 44, borderRadius: 22, backgroundColor: "#F3F3F3", alignItems: "center", justifyContent: "center" },
    titleCard: { position: "relative", overflow: "hidden", backgroundColor: "#F2FAF9", borderRadius: 22, paddingHorizontal: 22, paddingVertical: 27, borderWidth: 1, borderColor: "#DDEFED", shadowColor: "#000000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.03, shadowRadius: 5, elevation: 1 },
    noBackground: { backgroundColor: "transparent", borderWidth: 0, borderRadius: 0, overflow: 'visible', shadowOpacity: 0, elevation: 0, paddingHorizontal: 0, paddingVertical: 0 },
    decorations: { position: "absolute", top: 0, right: 0, bottom: 0, left: 0 },
    circlePurple: { position: "absolute", width: 100, height: 100, borderRadius: 50, backgroundColor: "#E8EFFF", opacity: 0.5, left: -48, bottom: -52 },
    circleOrange: { position: "absolute", width: 105, height: 105, borderRadius: 53, backgroundColor: "#F7F3EA", opacity: 0.9, right: -30, top: -42 },
    circleBlue: { position: "absolute", width: 72, height: 72, borderRadius: 36, backgroundColor: "#E7F3FA", opacity: 0.65, right: 70, bottom: -48 },
    headerContent: { zIndex: 1 },
    title: { fontSize: 24, lineHeight: 30, fontWeight: "700", color: "#111111" },
    description: { maxWidth: 340, marginTop: 8, fontSize: 14, lineHeight: 21, color: "#555555" }
});
