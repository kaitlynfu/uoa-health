import { StyleSheet, ScrollView, Text, TouchableOpacity, View } from "react-native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { Ionicons, MaterialCommunityIcons, Feather } from "@expo/vector-icons";
import { RootStackParamList } from "../../navigation/AppNavigator";

import PageHeader from "../../components/PageHeader";
import NavBar from "../../components/NavBar";

type Props = NativeStackScreenProps<RootStackParamList, "Home">;

export default function HomeScreen({ navigation }: Props) {
    return (
        <View style={styles.container}>
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
                <View style={styles.header}>
                    <PageHeader navigation={navigation} background={false} leftIcon="menu" rightIcon="notification"/>
                    <View style={styles.message}>
                        <Text style={styles.title}>Welcome, [Name]</Text>
                        <Text style={styles.subtitle}>Your university journey{"\n"}starts here.</Text>
                    </View>
                </View>

                <View style={styles.grid}>
                    <TouchableOpacity style={[styles.card, styles.wayfinderCard]} onPress={() => navigation.navigate("Wayfinder")}>
                        <View style={[styles.iconCircle, styles.wayfinderIcon]}>
                            <Ionicons name='location-outline' size={38} color="#5F4DD8"/>
                        </View>

                        <Text style={styles.cardTitle}>Wayfinder</Text>
                        <Text style={styles.cardText}>Navigate campuses</Text>
                    </TouchableOpacity>

                    <TouchableOpacity style={[styles.card, styles.groupsCard]} onPress={() => navigation.navigate("StudyGroups")}>
                        <View style={[styles.iconCircle, styles.groupsIcon]}>
                            <MaterialCommunityIcons name="account-group-outline" size={40} color="#2D9F74"/>
                        </View>

                        <Text style={styles.cardTitle}>Study Groups</Text>
                        <Text style={styles.cardText}>Connect & collaborate</Text>
                    </TouchableOpacity>

                    <TouchableOpacity style={[styles.card, styles.careerCard]} onPress={() => navigation.navigate("CareerAlignment")}>
                        <View style={[styles.iconCircle, styles.careerIcon]}>
                            <Ionicons name="briefcase-outline" size={38} color="#E87931"/>
                        </View>

                        <Text style={styles.cardTitle}>Career Alignment</Text>
                        <Text style={styles.cardText}>Find your pathway</Text>
                    </TouchableOpacity>

                    <TouchableOpacity style={[styles.card, styles.progressCard]} onPress={() => navigation.navigate("Progression")}>
                        <View style={[styles.iconCircle, styles.progressIcon]}>
                            <Feather name="check-square" size={38} color="#4C7EDB"/>
                        </View>

                        <Text style={styles.cardTitle}>Milestones</Text>
                        <Text style={styles.cardText}>Track your journey</Text>
                    </TouchableOpacity> 
                </View>

                <TouchableOpacity style={styles.exploreCard} onPress={() => navigation.navigate("CareerExplorer")}>
                    <View>
                        <Text style={styles.exploreTitle}>Explore Your Pathway</Text>
                        <Text style={styles.exploreText}>Discover study and career options.</Text>
                    </View>

                    <View style={styles.exploreIcon}>
                        <Ionicons name="compass-outline" size={32} color="#52B3B1"/>
                    </View>
                </TouchableOpacity>
            </ScrollView>

            <NavBar navigation={navigation} activeScreen="Home"/>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: "white",
        paddingBottom: 90,
    },
    header: {
        backgroundColor: "#CFEFED",
        paddingBottom: 45,
    },
    message: {
        paddingHorizontal: "7%"
    },
    title: {
        fontSize: 25,
        fontWeight: "700",
        color: "#111",
    },
    subtitle: {
        fontSize: 14,
        color: "#666",
        lineHeight: 24,
        marginTop: 10,
        maxWidth: "60%",
    },
    grid: {
        flexDirection: "row",
        flexWrap: "wrap",
        justifyContent: "space-between",
        paddingHorizontal: "7%",
        marginTop: -35,
        rowGap: 16,
    },
    card: {
        width: "47%",
        aspectRatio: 0.88,
        borderRadius: 50,
        alignItems: "center",
        justifyContent: "center",
        paddingHorizontal: 10,
    },
    wayfinderCard: {
        backgroundColor: "#F1EEFF",
        borderWidth: 6,
        borderColor: "white",
    },
    groupsCard: {
        backgroundColor: "#EAF8F2",
        borderWidth: 6,
        borderColor: "white",
    },
    careerCard: {
        backgroundColor: "#FFF1E8",
        borderWidth: 6,
        borderColor: "white",
    },
    progressCard: {
        backgroundColor: "#EDF4FF",
        borderWidth: 6,
        borderColor: "white",
    },
    exploreCard: {
        marginHorizontal: "7%",
        marginTop: 24,
        borderWidth: 1,
        borderColor: "#E8E8E8",
        borderRadius: 18,
        paddingVertical: 18,
        paddingHorizontal: 16,
        minHeight: 15,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
    },
    iconCircle: {
        width: "42%",
        aspectRatio: 1,
        borderRadius: 100,
        alignItems: "center",
        justifyContent: "center",
        marginBottom: 10,
    },
    wayfinderIcon: {
        backgroundColor: "#E1DCFF",
    },
    groupsIcon: {
        backgroundColor: "#D7F0E5",
    },
    careerIcon: {
        backgroundColor: "#FFE1CF",
    },
    progressIcon: {
        backgroundColor: "#DCE8FF",
    },
    exploreIcon: {
        width: 65,
        height: 65,
        borderRadius: 33,
        backgroundColor: "#EAF8F3",
        alignItems: "center",
        justifyContent: "center",
    },
    cardTitle: {
        fontSize: 14,
        fontWeight: "700",
        color: "#111",
        textAlign: "center",
        marginBottom: 5,
    },
    exploreTitle: {
        fontSize: 15,
        fontWeight: "700",
        marginBottom: 8,
    },
    exploreDescription: {
        fontSize: 12,
        color: "#666",
    },
    cardText: {
        fontSize: 12,
        color: "#666",
        textAlign: "center",
        lineHeight: 18,
    },
    exploreText: {
        flex: 1,
        color: "#666",
        paddingRight: 10
    },
    scrollContent: {
        paddingBottom: 30
    }
});