import { StyleSheet, Text, View } from "react-native";

export default function NotificationScreen({ navigation }: any) {
    return (
        <View style={styles.container}>
            <Text style={styles.title}>Notifications</Text>
            <Text style={styles.text}>You have no notifications yet.</Text>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: "white",
        padding: 24,
    },
    title: {
        fontSize: 24,
        fontWeight: "700",
        marginBottom: 10,
    },
    text: {
        fontSize: 14,
        color: "#666",
    },
});