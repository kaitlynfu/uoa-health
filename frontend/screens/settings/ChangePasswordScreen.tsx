import { SafeAreaView } from 'react-native-safe-area-context';
import {
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    ScrollView,
    KeyboardAvoidingView,
    Platform,
} from "react-native";
import { useState } from "react";
import { useSession } from '../../context/SessionContext';
import { NativeStackScreenProps } from "@react-navigation/native-stack";

import PageHeader from "../../components/PageHeader";
import NavBar from "../../components/NavBar";
import { COLORS } from "../../constants/theme";
import { RootStackParamList } from "../../navigation/AppNavigator";

type Props = NativeStackScreenProps<
    RootStackParamList,
    "ChangePassword"
>;

export default function ChangePasswordScreen({ navigation }: Props) {
    const [currentPassword, setCurrentPassword] = useState("");
    const [newPassword, setNewPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const {auth,changePassword}=useSession();
    const [busy,setBusy]=useState(false),[notice,setNotice]=useState('');
    async function save(){
        if(busy||!auth)return;
        if(newPassword.length<10){setNotice('Use at least 10 characters.');return;}
        if(newPassword!==confirmPassword){setNotice('New passwords do not match.');return;}
        setBusy(true);setNotice('');
        try{await changePassword(currentPassword,newPassword);setCurrentPassword('');setNewPassword('');setConfirmPassword('');setNotice('Password changed. Other sessions have been signed out.');}
        catch(e){setNotice((e as Error).message);}finally{setBusy(false);}
    }

    return (
        <SafeAreaView style={styles.container}>
            <PageHeader
                title="Change Password"
                navigation={navigation}
                leftIcon="back"
                background={false}
            />

            <KeyboardAvoidingView style={{flex:1}} behavior={Platform.OS==='ios'?'padding':'height'}><ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
                <Text style={styles.description}>{auth?'Choose at least 10 characters. Changing your password signs out your other sessions.':'Sign in to change your password.'}</Text>
                {!!notice&&<Text accessibilityRole="alert">{notice}</Text>}

                <Text style={styles.label}>CURRENT PASSWORD</Text>
                <TextInput editable={!!auth&&!busy} accessibilityLabel="Current password" autoCapitalize="none" autoCorrect={false} maxLength={128}
                    style={styles.input}
                    value={currentPassword}
                    onChangeText={setCurrentPassword}
                    placeholder="Enter current password"
                    secureTextEntry
                />

                <Text style={styles.label}>NEW PASSWORD</Text>
                <TextInput editable={!!auth&&!busy} accessibilityLabel="New password" autoCapitalize="none" autoCorrect={false} maxLength={128}
                    style={styles.input}
                    value={newPassword}
                    onChangeText={setNewPassword}
                    placeholder="Enter new password"
                    secureTextEntry
                />

                <Text style={styles.label}>CONFIRM NEW PASSWORD</Text>
                <TextInput editable={!!auth&&!busy} accessibilityLabel="Confirm new password" autoCapitalize="none" autoCorrect={false} maxLength={128}
                    style={styles.input}
                    value={confirmPassword}
                    onChangeText={setConfirmPassword}
                    placeholder="Confirm new password"
                    secureTextEntry
                />

                <TouchableOpacity accessibilityRole="button" disabled={busy||!auth||!currentPassword||!newPassword||!confirmPassword} onPress={()=>void save()} style={[styles.button,{opacity:busy||!auth?0.5:1}]}>
                    <Text style={styles.buttonText}>{busy?'Saving…':'Change password'}</Text>
                </TouchableOpacity>
            </ScrollView></KeyboardAvoidingView>

            <NavBar navigation={navigation} activeScreen="Profile" />
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: COLORS.white,
    },
    content: {
        flexGrow: 1,
        paddingHorizontal: "7%",
        paddingTop: 24,
        paddingBottom: 110,
    },
    description: {
        fontSize: 14,
        lineHeight: 20,
        color: "grey",
        marginBottom: 28,
    },
    label: {
        fontSize: 11,
        fontWeight: "700",
        color: COLORS.text,
        letterSpacing: 0.8,
        marginBottom: 8,
    },
    input: {
        height: 48,
        paddingHorizontal: 14,
        borderRadius: 10,
        borderWidth: 1,
        borderColor: "#DCDCDC",
        marginBottom: 20,
        fontSize: 14,
        backgroundColor: COLORS.tile,
    },
    button: {
        height: 48,
        borderRadius: 10,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: COLORS.secondary,
        marginTop: 8,
    },
    buttonText: {
        fontSize: 14,
        fontWeight: "700",
        color: COLORS.white,
    },
});
