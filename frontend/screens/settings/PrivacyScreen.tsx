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

type Props = NativeStackScreenProps<RootStackParamList, "Privacy">;

export default function PrivacyScreen({ navigation }: Props) {
    return (
        <SafeAreaView style={styles.container}>
            <PageHeader
                title="Privacy"
                navigation={navigation}
                leftIcon="back"
                background={false}
            />

            <ScrollView
                style={styles.scroll}
                contentContainerStyle={styles.content}
            >
                <Text style={styles.heading}>Your Privacy</Text>
                <Text style={styles.text}>
                    UoA Health is a Team 43 university project. Account data is stored by the hosted API in PostgreSQL on AWS. This screen explains the implemented behaviour; the team must confirm its retention policy and privacy contact before a public launch.
                </Text>

                <Text style={styles.heading}>Information We Collect</Text>
                <Text style={styles.text}>
                    We store your email, display name, a salted password hash, sign-in sessions, declared interests, saves, self-reported progression, group memberships, messages and submitted reports. Your password itself is not stored. Phone sign-in tokens use secure device storage; guest preferences remain in memory.
                </Text>

                <Text style={styles.heading}>How We Use Your Information</Text>
                <Text style={styles.text}>
                    Interests provide keyword recommendations, not admissions advice. Signed-in students can search display names and public group descriptions. Group members can see messages; direct messages are scoped to the two participants. Email is not included in social search. Peer suggestions require both students to opt in. Authorized moderators can review reports and a reported message.
                </Text>

                <Text style={styles.heading}>Your Choices</Text>
                <Text style={styles.text}>
                    Settings lets you change your password, verify your email when delivery is configured, block people, control in-app notifications, export data or delete your account. Deletion removes personal records and authored messages, retaining only an anonymous actor ID for shared history. Historical backups remain until the team's retention policy expires them. Device push delivery is not enabled. Campus recordings and published routes are shared data, so account deletion does not remove the campus route itself.
                </Text>
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
    heading: {
        fontSize: 16,
        fontWeight: "700",
        color: COLORS.text,
        marginBottom: 8,
        marginTop: 8,
    },
    text: {
        fontSize: 14,
        lineHeight: 21,
        color: "grey",
        marginBottom: 24,
    },
});
