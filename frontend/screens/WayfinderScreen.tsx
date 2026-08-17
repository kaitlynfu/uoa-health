import { StyleSheet, Text, View } from "react-native";

export default function WayfinderScreen() {
    return (
        <View style={styles.container}>
            <Text style={styles.title}>Campus Wayfinder</Text>
            <Text>Screen ready for UI development.</Text>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        padding: 24,
    },
    title: {
        fontSize: 28,
        fontWeight: "bold",
        marginBottom: 12,
    },
});