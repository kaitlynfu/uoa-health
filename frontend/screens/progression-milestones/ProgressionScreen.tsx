import { StyleSheet, Text, View } from "react-native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";

import { RootStackParamList } from "../../navigation/AppNavigator";
import NavBar from "../../components/NavBar";

type Props = NativeStackScreenProps<
    RootStackParamList,
    "Progression"
>;

export default function ProgressionScreen({ navigation }: Props) {
    return (
        <View style={styles.container}>
            <Text style={styles.title}>Progression & Milestones</Text>
            <Text>Screen ready for UI development.</Text>

            <NavBar
                navigation={navigation}
                activeScreen="Progression"
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
});