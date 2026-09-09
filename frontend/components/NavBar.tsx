import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";

export default function NavBar({ navigation, activeScreen }: any) {
    const activeColour = "#52B3B1";
    const inactiveColour = "grey";

    return (
        <View style={styles.nav}>
            <TouchableOpacity style={styles.item} onPress={() => navigation.navigate("Home")}>
                <Ionicons name={activeScreen === "Home" ? "home" : "home-outline"} size={22} color={activeScreen === "Home" ? activeColour : inactiveColour}/>
                <Text style={activeScreen === "Home" ? styles.activeText : styles.inactiveText}>Home</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.item} onPress={() => navigation.navigate("Wayfinder")}>
                <Ionicons name={activeScreen === "Wayfinder" ? "location" : "location-outline"} size={22} color={activeScreen === "Wayfinder" ? activeColour : inactiveColour}/>
                <Text style={activeScreen === "Wayfinder" ? styles.activeText : styles.inactiveText}>Wayfinder</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.item} onPress={() => navigation.navigate("StudyGroups")}>
                <MaterialCommunityIcons name={activeScreen === "Groups" ? "account-group" : "account-group-outline"} size={26} color={activeScreen === "Groups" ? activeColour : inactiveColour}/>
                <Text style={activeScreen === "Groups" ? styles.activeText : styles.inactiveText}>Groups</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.item} onPress={() => navigation.navigate("CareerAlignment")}>
                <Ionicons name={activeScreen === "Career" ? "briefcase" : "briefcase-outline"} size={22} color={activeScreen === "Career" ? activeColour : inactiveColour}/>
                <Text style={activeScreen === "Career" ? styles.activeText : styles.inactiveText}>Career</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.item} onPress={() => navigation.navigate("Profile")}>
                <Ionicons name={activeScreen === "Profile" ? "person-circle" : "person-circle-outline"} size={24} color={activeScreen === "Profile" ? activeColour : inactiveColour}/>
                <Text style={activeScreen === "Profile" ? styles.activeText : styles.inactiveText}>Profile</Text>
            </TouchableOpacity>
        </View>
    );
}

const styles = StyleSheet.create({
    nav: {
        position: "absolute",
        bottom: 0,
        left: 0,
        right: 0,
        flexDirection: "row",
        backgroundColor: "white",
        paddingTop: 18,
        paddingVertical: 18,
        borderTopWidth: 1,
        borderTopColor: "#E5E5E5",
    },
    item: {
        flex: 1,
        alignItems: "center",
        justifyContent: "center",
        gap: 4,
    },
    activeText: {
        color: "#52B3B1",
        fontSize: 11,
        fontWeight: "600",
    },
    inactiveText: {
        color: "grey",
        fontSize: 11,
        fontWeight: "500"
    }
});