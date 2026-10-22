import {
    ScrollView,
    StyleSheet,
    Text,
    View,
    TouchableOpacity,
    Alert,
    Image,
} from "react-native";
import { useCallback, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { useSession } from '../context/SessionContext';
import { studentRequest, type Profile } from '../services/studentApi';
import { Ionicons } from "@expo/vector-icons";
import { NativeStackScreenProps } from "@react-navigation/native-stack";

import NavBar from "../components/NavBar";
import PageHeader from "../components/PageHeader";
import ProfileInterests from "../components/ProfileInterests";
import ProfileSavedItem from "../components/ProfileSavedItem";
import AppUpdateDetails from "../components/AppUpdateDetails";
import { RootStackParamList } from "../navigation/AppNavigator";
import { SafeAreaView } from "react-native-safe-area-context";

type Props = NativeStackScreenProps<RootStackParamList, "Profile">;

export default function ProfileScreen({ navigation }: Props) {
    const { auth, logout } = useSession();
    const [profile, setProfile] = useState<Profile | null>(null);
    const [error, setError] = useState('');
    const [photo,setPhoto]=useState<string|null>(null);
    useFocusEffect(useCallback(() => {
        let active = true;
        setProfile(null); setError('');
        setPhoto(null);
        if (auth) studentRequest<Profile>('/profile/me', auth.access_token)
            .then(p => { if (active) setProfile(p); })
            .catch(e => { if (active) setError(e.message); });
        if(auth)void studentRequest<{base64:string|null}>('/profile/me/photo',auth.access_token).then(result=>{if(active)setPhoto(result.base64);}).catch(()=>{});
        return () => { active = false; };
    }, [auth]));
    const interests = profile?.interests ?? [];
    const careerInterests = profile?.career_interests ?? [];
    function editInterests() { navigation.navigate('EditInterests'); }
    function editCareerInterests() { navigation.navigate('EditCareerInterests'); }
    function openSavedProgrammes() { navigation.navigate('Saves', {tab:'Programmes'}); }
    function openSavedCareers() { navigation.navigate('Saves', {tab:'Careers'}); }
    function openSettings() { navigation.navigate('Settings'); }
    async function logOut() {
        try { await logout(); }
        catch { Alert.alert('Signed out locally', 'Server logout could not be confirmed. The session will expire on the server.'); }
        navigation.navigate('Home');
    }

    if (!auth) {
        return (
            <SafeAreaView edges={['top','left','right']} style={styles.screen}>
                <ScrollView contentContainerStyle={styles.guestContent} showsVerticalScrollIndicator={false}>
                    <PageHeader title="Profile" navigation={navigation} background={true} description="Manage your profile and personalise your experience." leftIcon="menu" />

                    <View style={styles.guestCard}>
                        <View style={styles.iconCircle}>
                            <Ionicons name="person-circle-outline" size={44} color="#52B3B1" />
                        </View>
                        <Text style={styles.guestTitle}>Sign in to see your profile</Text>
                        <Text style={styles.guestText}>
                            Track your saved programmes, careers and journey. Sign in to see your personalised recommendations and progress.
                        </Text>
                        <TouchableOpacity accessibilityRole="button" style={styles.guestButton} onPress={() => navigation.navigate('Login')}>
                            <Text style={styles.guestButtonText}>Sign in / create account</Text>
                        </TouchableOpacity>
                    </View>
                </ScrollView>

                <NavBar navigation={navigation} activeScreen="Profile" />
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView edges={['top','left','right']} style={styles.screen}>
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
                <PageHeader title="Profile" navigation={navigation} background={true} leftIcon="menu" />

                <View style={styles.profileSection}>
                    <View style={styles.avatar}>
                        {photo?<Image accessibilityLabel="Your profile photo" source={{uri:`data:image/jpeg;base64,${photo}`}} style={{width:80,height:80,borderRadius:40}}/>:<Ionicons name="person" size={40} color="#52B3B1" />}
                    </View>
                    <Text style={styles.name}>{profile?.user.display_name ?? auth.user.display_name}</Text>
                    {error ? <Text accessibilityRole="alert" style={styles.errorText}>{error}</Text> : null}
                    <Text style={styles.subtitle}>Your study and career interests</Text>
                </View>

                <View style={styles.content}>
                    <ProfileInterests title="Interests" interests={interests} onEdit={editInterests} />
                    <ProfileInterests title="Career interests" interests={careerInterests} onEdit={editCareerInterests} />

                    {/* Saved */}
                    <View style={styles.savedItems}>
                        <ProfileSavedItem icon="briefcase-outline" title={"Save\nCareers"} onPress={openSavedCareers} />
                        <ProfileSavedItem icon="school-outline" title={"Saved\nProgrammes"} onPress={openSavedProgrammes} />
                    </View>

                    {/* Settings */}
                    <TouchableOpacity style={styles.settingsCard} onPress={openSettings}>
                        <View style={styles.settingsLeft}>
                            <View style={styles.settingsIcon}>
                                <Ionicons name="settings" size={20} color="#52B3B1" />
                            </View>
                            <Text style={styles.settingsText}>Settings</Text>
                        </View>

                        <Ionicons name="chevron-forward" size={20} color="#666" />
                    </TouchableOpacity>

                    <AppUpdateDetails />

                    {/* Log out */}
                    <TouchableOpacity style={styles.logoutButton} onPress={logOut}>
                        <Ionicons name="log-out-outline" size={20} color="white" />
                        <Text style={styles.logoutText}>Log out</Text>
                    </TouchableOpacity>
                </View>
            </ScrollView>

            <NavBar navigation={navigation} activeScreen="Profile" />
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    screen: {
        flex: 1,
        width: "100%", maxWidth: 640, alignSelf: "center",
        backgroundColor: "white",
    },
    scrollContent: {
        paddingBottom: 110,
    },
    guestContent: {
        flexGrow: 1,
        paddingBottom: 40,
    },
    profileSection: {
        alignItems: "center",
        paddingHorizontal: "7%",
        marginTop: 4,
    },
    avatar: {
        width: 82,
        height: 82,
        borderRadius: 41,
        backgroundColor: "#E8F6F6",
        borderWidth: 0,
        borderColor: "#52B3B1",
        alignItems: "center",
        justifyContent: "center",
        margin: 8,
    },
    name: {
        fontSize: 22,
        fontWeight: "700",
        color: "#111",
    },
    errorText: {
        marginTop: 6,
        fontSize: 12,
        color: "#B3261E",
        textAlign: "center",
    },
    subtitle: {
        fontSize: 13,
        color: "#466b68",
        marginTop: 4,
    },
    content: {
        paddingHorizontal: "7%",
        marginTop: 22,
    },
    savedTitle: {
        fontSize: 16,
        fontWeight: "700",
        color: "#111",
    },
    savedDivider: {
        height: 1,
        backgroundColor: "#EEEEEE",
        marginTop: 14,
        marginBottom: 14,
    },
    savedItems: {
        flexDirection: "row",
        gap: 12,
        marginTop: 4,
        marginBottom: 20,
    },
    settingsCard: {
        backgroundColor: "white",
        borderWidth: 1,
        borderColor: "#EAEAEA",
        borderRadius: 18,
        padding: 16,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        marginBottom: 20,
    },
    settingsLeft: {
        flexDirection: "row",
        alignItems: "center",
    },
    settingsIcon: {
        width: 42,
        height: 42,
        borderRadius: 21,
        backgroundColor: "#E8F6F6",
        alignItems: "center",
        justifyContent: "center",
        marginRight: 12,
    },
    settingsText: {
        fontSize: 14,
        fontWeight: "600",
        color: "#111",
    },
    logoutButton: {
        height: 50,
        borderRadius: 14,
        backgroundColor: "#52B3B1",
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: 8,
        marginBottom: 20,
    },
    logoutText: {
        fontSize: 15,
        fontWeight: "700",
        color: "white",
    },
    guestCard: {
        marginHorizontal: "7%",
        marginTop: 40,
        padding: 24,
        borderRadius: 20,
        borderWidth: 1,
        borderColor: "#EEEEEE",
        alignItems: "center",
    },
    iconCircle: {
        width: 76,
        height: 76,
        borderRadius: 38,
        backgroundColor: "#E8F6F6",
        alignItems: "center",
        justifyContent: "center",
        marginBottom: 16,
    },
    guestTitle: {
        fontSize: 18,
        fontWeight: "700",
        color: "#111",
        textAlign: "center",
    },
    guestText: {
        fontSize: 13,
        color: "#666",
        textAlign: "center",
        lineHeight: 19,
        marginTop: 8,
        marginBottom: 20,
    },
    guestButton: {
        height: 48,
        paddingHorizontal: 24,
        borderRadius: 14,
        backgroundColor: "#52B3B1",
        alignItems: "center",
        justifyContent: "center",
    },
    guestButtonText: {
        fontSize: 14,
        fontWeight: "700",
        color: "white",
    },
});
