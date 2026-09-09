import { StyleSheet, Text, View } from "react-native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { RootStackParamList } from "../../navigation/AppNavigator";

import NavBar from "../../components/NavBar";

type Props = NativeStackScreenProps<RootStackParamList, "StudyGroups">;

export default function StudyGroupsScreen({ navigation }: Props) {
    return (
        <View style={styles.container}>
            <Text style={styles.title}>Study Groups</Text>
            <Text>Screen ready for UI development.</Text>

            <NavBar navigation={navigation} activeScreen="Groups"/>
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