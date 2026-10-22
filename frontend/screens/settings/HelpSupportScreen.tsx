import { SafeAreaView } from 'react-native-safe-area-context';
import {
    ScrollView,
    StyleSheet,
    Text,
    View,
} from "react-native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";

import PageHeader from "../../components/PageHeader";
import NavBar from "../../components/NavBar";
import { COLORS } from "../../constants/theme";
import { RootStackParamList } from "../../navigation/AppNavigator";
import {Action} from '../../components/ConnectedScreen';

type Props = NativeStackScreenProps<RootStackParamList, "HelpSupport">;

export default function HelpSupportScreen({ navigation }: Props) {
    return (
        <SafeAreaView style={styles.container}>
            <PageHeader
                title="Help & Support"
                navigation={navigation}
                leftIcon="back"
            />

            <ScrollView
                style={styles.scroll}
                contentContainerStyle={styles.content}
            >
                <Text style={styles.description}>Find answers to common questions or get help with the app.</Text>

                <View style={styles.card}>
                    <Text style={styles.question}>How do I update my profile?</Text>
                    <Text style={styles.answer}>
                        Open your Profile and select Edit Profile to update your details.</Text>
                </View>

                <View style={styles.card}>
                    <Text style={styles.question}>How do I change my interests?</Text>
                    <Text style={styles.answer}>Open Edit Interests or Edit Career Interests from your Profile.</Text>
                </View>

                <View style={styles.card}>
                    <Text style={styles.question}>How do I view my study progression?</Text>
                    <Text style={styles.answer}>Use the Progression section to view your milestones, requirements and pathway.</Text>
                </View>

                <View style={styles.card}>
                    <Text style={styles.question}>Need more help?</Text>
                    <Text style={styles.answer}>Submit a report with the screen name, steps and error. Do not include passwords or recovery codes. This is not an emergency service.</Text>
                    <View style={{ marginTop: 8 }}>
                        <Action title="Submit a support or safety report" onPress={()=>navigation.navigate('Safety')} />
                    </View>
                </View>
            </ScrollView>

            <NavBar navigation={navigation} activeScreen="Profile" />
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: COLORS.white,
    },
    scroll: {
        flex: 1,
    },
    content: {
        paddingHorizontal: "7%",
        paddingTop: 24,
        paddingBottom: 100,
    },
    description: {
        fontSize: 14,
        lineHeight: 20,
        color: "grey",
        marginBottom: 22,
    },
    card: {
        padding: 16,
        borderRadius: 14,
        backgroundColor: COLORS.tile,
        borderWidth: 1,
        borderColor: "#EAEAEA",
        marginBottom: 12,
    },
    question: {
        fontSize: 14,
        fontWeight: "700",
        color: COLORS.text,
        marginBottom: 7,
    },
    answer: {
        fontSize: 13,
        lineHeight: 19,
        color: "grey",
    },
});
