import { Button, StyleSheet, Text, View } from "react-native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";

import { RootStackParamList } from "../navigation/AppNavigator";

type Props = NativeStackScreenProps<RootStackParamList, "Home">;

export default function HomeScreen({ navigation }: Props) {
    return (
        <View style={styles.container}>
            <Text style={styles.title}>UoA Student App</Text>
            <Text style={styles.subtitle}>
                Frontend navigation skeleton
            </Text>

            <Button
                title="Explore Programmes"
                onPress={() => navigation.navigate("Programmes")}
            />

            <Button
                title="Career Explorer"
                onPress={() => navigation.navigate("CareerExplorer")}
            />

            <Button
                title="Wayfinder"
                onPress={() => navigation.navigate("Wayfinder")}
            />
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        justifyContent: "center",
        padding: 24,
        gap: 16,
    },
    title: {
        fontSize: 28,
        fontWeight: "bold",
    },
    subtitle: {
        fontSize: 16,
        marginBottom: 12,
    },
});