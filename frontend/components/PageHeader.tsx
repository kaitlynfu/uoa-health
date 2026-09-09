import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
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
        <View style={[styles.header, background && styles.headerBackground]}>
            <View style={styles.topRow}>
                <TouchableOpacity onPress={() => { if (leftIcon === "back") { navigation.goBack();}}}>
                    <Ionicons name={leftIcon === "back" ? "chevron-back" : "menu-sharp"} size={24} color="#666"/>
                </TouchableOpacity>
                {title && ( <Text style={styles.title} pointerEvents="none">{title}</Text>)}
                <TouchableOpacity onPress={rightIconPress ? rightIconPress : () => rightIcon === "bookmark" ? navigation.navigate("Saves") : navigation.navigate("Notifications")}>
                    <Ionicons name={rightIcon === "bookmark" ? rightIconActive ? "bookmark" : "bookmark-outline" : "notifications-outline"} size={23} color={rightIconActive ? "#52B3B1" : "#666"}/>
                </TouchableOpacity>
            </View>
            {description && (<Text style={styles.description}>{description}</Text>)}
        </View>
    );
} 

const styles = StyleSheet.create({
    header: {
        paddingHorizontal: "7%",
        paddingTop: 22,
        paddingBottom: 22
    },
    headerBackground: {
        backgroundColor: "#CFEFED"
    },
    topRow: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        marginBottom: 20
    },
    title: {
        left: 0,
        right: 0,
        position: "absolute",
        textAlign: "center",
        fontSize: 18,
        fontWeight: "700",
        color: "#111"
    },
    description: {
        fontSize: 14,
        color: "#333",
        lineHeight: 20,
        marginTop: 8
    }
});