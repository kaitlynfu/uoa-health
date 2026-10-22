import { SafeAreaView } from 'react-native-safe-area-context';
import {
    ScrollView,
    StyleSheet,
    Text,
    View,
} from "react-native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";

import PageHeader from "../../components/PageHeader";
import { COLORS } from "../../constants/theme";
import { RootStackParamList } from "../../navigation/AppNavigator";
import SettingsOption from "../../components/SettingsOptions";

type Props = NativeStackScreenProps<RootStackParamList, "Settings">;

export default function SettingsScreen({ navigation }: Props) {

    function editProfile() {
        navigation.navigate("EditProfile");
    }

    function changePassword() {
        navigation.navigate("ChangePassword");
    }

    function notificationSettings() {
        navigation.navigate("NotificationSettings");
    }

    function privacy() {
        navigation.navigate("Privacy");
    }

    function aboutApp() {
        navigation.navigate("AboutApp");
    }

    function helpSupport() {
        navigation.navigate("HelpSupport");
    }

    return (
        <SafeAreaView style={styles.container}>
            <ScrollView
                contentContainerStyle={styles.content}
                showsVerticalScrollIndicator={false}
            >
                <View style={{marginHorizontal:-20,marginTop:-14}}>
                    <PageHeader title="Settings" navigation={navigation} leftIcon="back" />
                </View>

                {/* Account */}
                <View style={styles.sectionCard}>
                    <SettingsOption icon="person-outline" title="Edit Profile" onPress={editProfile}/>
                    <SettingsOption icon="lock-closed-outline" title="Change Password" onPress={changePassword}/>
                    <SettingsOption icon="mail-outline" title="Verify email" onPress={()=>navigation.navigate('AccountRecovery')}/>
                    <SettingsOption icon="download-outline" title="Export or delete account" onPress={()=>navigation.navigate('AccountData')}/>
                    <SettingsOption icon="shield-outline" title="Safety & support" onPress={()=>navigation.navigate('Safety')}/>
                </View>

                {/* Notifications */}
                <View style={styles.sectionCard}>
                    <Text style={styles.sectionTitle}>Notifications</Text><Text style={{marginTop:8,color:"#555"}}>See unread messages and friend requests in your activity inbox. Choose which activity appears in Notification Settings.</Text>
                    <View style={styles.divider} />

                    <SettingsOption icon="mail-unread-outline" title="Open activity inbox" onPress={()=>navigation.navigate('Notifications')}/>
                    <Text style={{marginTop:8,color:'#555'}}>Notifications appear while using the app. Lock-screen alerts are not available.</Text>
                </View>

                {/* Preferences */}
                <View style={styles.sectionCard}>
                    <SettingsOption icon="options-outline" title="Notification Settings" onPress={notificationSettings}/>
                    <SettingsOption icon="shield-checkmark-outline" title="Privacy" onPress={privacy}/>
                </View>

                {/* About */}
                <View style={styles.sectionCard}>
                    <Text style={styles.sectionTitle}>About</Text>
                    <View style={styles.divider} />

                    <SettingsOption icon="information-circle-outline" title="About the App" onPress={aboutApp}/>
                    <SettingsOption icon="help-circle-outline" title="Help & Support" onPress={helpSupport}/>
                </View>
            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: COLORS.white,
    },
    content: {
        width: "100%",
        maxWidth: 680,
        alignSelf: "center",
        marginTop: 14,
        paddingHorizontal: 20,
        paddingBottom: 30,
        gap: 12,
    },
    sectionCard: {
        backgroundColor: "#FFFFFF",
        borderRadius: 14,
        padding: 16,
        marginBottom: 8,
        borderWidth: 1,
        borderColor: "#e8e8e8",
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: "700",
        color: COLORS.text,
    },
    divider: {
        height: 1,
        backgroundColor: "#e8e8e8",
        marginTop: 12,
        marginBottom: 4,
    },
    option: {
        minHeight: 58,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
    },
    optionLeft: {
        flexDirection: "row",
        alignItems: "center",
        flex: 1,
        gap: 12,
    },
    iconContainer: {
        width: 38,
        height: 38,
        borderRadius: 19,
        backgroundColor: COLORS.primary,
        alignItems: "center",
        justifyContent: "center",
        marginRight: 12,
    },
    optionText: {
        fontSize: 15,
        fontWeight: "500",
        color: COLORS.text,
    },
});
