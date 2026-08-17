import { Button, StyleSheet, Text, View } from "react-native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";

import { RootStackParamList } from "../navigation/AppNavigator";

type Props = NativeStackScreenProps<
    RootStackParamList,
    "CareerExplorer"
>;

export default function CareerExplorerScreen({ navigation }: Props) {
    return (
        <View style={styles.container}>
            <Text style={styles.title}>Career Explorer</Text>
            <Text style={styles.text}>
                Screen ready for UI development.
            </Text>

            <Button
                title="View Recommendations"
                onPress={() => navigation.navigate("Recommendations")}
            />
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
    text: {
        marginBottom: 16,
    },
});