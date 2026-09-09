import { StyleSheet, Text, View } from "react-native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";

import { RootStackParamList } from "../../navigation/AppNavigator";
import NavBar from "../../components/NavBar";

type Props = NativeStackScreenProps<RootStackParamList, "Profile">;

export default function QuizScreen({ navigation }: Props) {
    return (
        <View style={styles.container}>
            <Text style={styles.title}>Quiz</Text>
            <Text>Quiz screen ready for development.</Text>

            <NavBar navigation={navigation} activeScreen="Profile" />
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
        fontSize: 28,
        fontWeight: "bold",
        marginBottom: 12,
    },
});