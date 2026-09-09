import { StyleSheet, Text, View } from "react-native";

export default function RecommendationsScreen() {
    return (
        <View style={styles.container}>
            <Text style={styles.title}>Recommendations</Text>
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