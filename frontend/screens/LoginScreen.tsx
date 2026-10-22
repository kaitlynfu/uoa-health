import {
    KeyboardAvoidingView,
    Platform,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from "react-native";
import { useRef, useState } from "react";
import { SafeAreaView } from 'react-native-safe-area-context';
import { useHeaderHeight } from '@react-navigation/elements';
import { useSession } from '../context/SessionContext';
import { NativeStackScreenProps } from "@react-navigation/native-stack";

import { COLORS } from "../constants/theme";
import { RootStackParamList } from "../navigation/AppNavigator";
import BrandLogo, {BrandWordmark} from '../components/BrandLogo';

type Props = NativeStackScreenProps<RootStackParamList, "Login">;

export default function LoginScreen({ navigation }: Props) {
    const session = useSession();
    const headerHeight = useHeaderHeight();
    const passwordInput = useRef<TextInput>(null);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    const [register, setRegister] = useState(false);
    const [name, setName] = useState('');
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");

    async function login() {
        if (busy) return;
        setBusy(true);
        setError('');
        try {
            await session.login(email, password, register ? name : undefined);
            navigation.replace(register ? 'Onboarding' : 'Home');
        } catch (error) { setError(error instanceof Error ? error.message : 'Sign in failed. Please retry.'); }
        finally { setBusy(false); }
    }

    return (
        <SafeAreaView edges={['top','left','right','bottom']} style={styles.container}>
            <KeyboardAvoidingView style={{flex: 1}} behavior={Platform.OS === 'ios' ? 'padding' : 'height'} keyboardVerticalOffset={headerHeight}>
            <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" keyboardDismissMode="interactive">
                <View style={styles.logo}>
                    <BrandLogo size={100}/>
                </View>

                <BrandWordmark size={34} style={{textAlign:'center'}}/>

                <Text style={styles.subtitle}>Your degree, career and campus — all in one place.</Text>

                <View style={styles.form}>
                    {error ? <Text accessibilityRole="alert">{error}</Text> : null}
                    {!!session.sessionNotice && <Text accessibilityRole="alert">{session.sessionNotice}</Text>}
                    {register && (<><Text style={styles.label}>Display name</Text><TextInput style={styles.input} accessibilityLabel="Display name" placeholder="Enter display name" placeholderTextColor="grey" value={name} onChangeText={setName} /></>)}
                    <Text style={styles.label}>Email</Text>

                    <TextInput
                        accessibilityLabel="Email"
                        style={styles.input}
                        value={email}
                        onChangeText={setEmail}
                        placeholder="Enter your email"
                        placeholderTextColor="grey"
                        keyboardType="email-address"
                        autoCapitalize="none"
                        returnKeyType="next"
                        onSubmitEditing={() => passwordInput.current?.focus()}
                    />

                    <Text style={styles.label}>Password</Text>

                    <TextInput
                        accessibilityLabel="Password"
                        ref={passwordInput}
                        autoCapitalize="none"
                        autoCorrect={false}
                        textContentType={register ? 'newPassword' : 'password'}
                        returnKeyType="done"
                        onSubmitEditing={login}
                        style={styles.input}
                        value={password}
                        onChangeText={setPassword}
                        placeholder="Enter your password"
                        placeholderTextColor="grey"
                        secureTextEntry
                    />
                    {!register&&<TouchableOpacity accessibilityRole="button" disabled={busy} onPress={()=>navigation.navigate('AccountRecovery')} style={{paddingBottom:8 }}><Text style={{color: '#287d7b', fontSize: 14, fontWeight: '500'}}>Forgot password?</Text></TouchableOpacity>}
                    {register && (<Text style={styles.passwordReq}>Password must be at least 10 characters</Text>)}

                    <TouchableOpacity accessibilityRole="button" disabled={busy} style={styles.loginButton} onPress={login}>
                        <Text style={styles.loginText}>{busy ? 'Please wait…' : register ? 'Create account' : 'Log in'}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity disabled={busy} onPress={() => setRegister(!register)}><Text style={{fontWeight: '400', color: COLORS.text}}>{register ? (<> Already registered?{' '} <Text style={styles.link}>Log in</Text></>) : (<> New here?{' '} <Text style={styles.link}>Create an account</Text></>)}</Text></TouchableOpacity>
                    <Text style={styles.securityNote}>Account data is saved on the server. On phones, your sign-in is stored securely until it expires or you sign out.</Text>
                </View>
                <TouchableOpacity accessibilityRole="button" disabled={busy} onPress={() => navigation.replace('Onboarding')} style={{padding: 18, alignItems: 'center'}}><Text style={{color: '#287d7b', fontWeight: '700'}}>Continue as guest →</Text></TouchableOpacity>
            </ScrollView>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#F6FBFA',
    },
    content: {
        flexGrow: 1,
        justifyContent: "center",
        paddingHorizontal: 28,
        paddingVertical: 36,
        maxWidth: 520,
        width: '100%',
        alignSelf: 'center',
    },
    logo: {
        width: 100,
        height: 100,
        alignItems: "center",
        justifyContent: "center",
        alignSelf: "center",
        marginBottom: 24,
    },
    title: {
        fontSize: 28,
        fontWeight: "700",
        color: COLORS.text,
        textAlign: "center",
    },
    subtitle: {
        fontSize: 15,
        color: "grey",
        textAlign: "center",
        marginTop: 8,
        marginBottom: 32,
        lineHeight: 22,
    },
    form: {
        backgroundColor: '#ffffff',
        borderWidth: 1,
        borderColor: '#E4EFED',
        borderRadius: 18,
        padding: 20,
    },
    label: {
        fontSize: 14,
        fontWeight: "600",
        color: COLORS.text,
        marginBottom: 7,
    },
    input: {
        height: 48,
        borderWidth: 1,
        borderColor: "#E0E0E0",
        borderRadius: 12,
        paddingHorizontal: 14,
        fontSize: 14,
        marginBottom: 18,
        backgroundColor: COLORS.white,
        color: COLORS.text,
    },
    loginButton: {
        height: 48,
        borderRadius: 12,
        backgroundColor: '#52B3B1',
        alignItems: "center",
        justifyContent: "center",
        marginVertical: 8,
    },
    loginText: {
        fontSize: 15,
        fontWeight: "600",
        color: "#173b39",
    },
    passwordReq: {
        fontSize: 13,
        color: '#666666',
        marginBottom: 8,
    },
        link: {
        color: '#287d7b',
    },
    securityNote: {
        fontSize: 13,
        color: '#666666',
        lineHeight: 14,
        marginTop: 12,
    },
});
