import { SafeAreaView } from 'react-native-safe-area-context';
import {
    ScrollView,
    KeyboardAvoidingView,
    Platform,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from "react-native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { usePreferenceEditor } from "../../hooks/usePreferenceEditor";

import NavBar from "../../components/NavBar";
import PageHeader from "../../components/PageHeader";
import { COLORS } from "../../constants/theme";
import { RootStackParamList } from "../../navigation/AppNavigator";

type Props = NativeStackScreenProps<RootStackParamList, "EditInterests">;

export default function EditInterestsScreen({ navigation }: Props) {
    const {value:interests,setValue:setInterests,loaded,busy,error,retry,save:saveInterests,guest}=usePreferenceEditor('interests',navigation);

    return (
        <SafeAreaView style={styles.container}>
            <PageHeader
                title="Edit Interests"
                navigation={navigation}
                leftIcon="back"
            />

            <KeyboardAvoidingView style={{flex:1}} behavior={Platform.OS==="ios"?"padding":undefined}><ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
                <Text style={styles.title}>What are you interested in?</Text>

                <Text style={styles.subtitle}>List subjects and hobbies, separated by commas. For example: biology, hiking, music.</Text>

                {guest && <Text style={styles.subtitle}>Guest choices apply to this app session only. Sign in to save them to an account.</Text>}
                {!loaded && !error && <Text>Loading your saved choices…</Text>}
                {!!error && <Text accessibilityRole="alert">{error}</Text>}
                {!loaded && !!error && <TouchableOpacity accessibilityRole="button" onPress={retry}><Text>Retry loading choices</Text></TouchableOpacity>}
                <TextInput editable={loaded && !busy} accessibilityLabel="Subjects and hobbies"
                    style={styles.input}
                    value={interests}
                    onChangeText={setInterests}
                    placeholder="e.g. Public Health, Medicine, Nutrition"
                    placeholderTextColor="grey"
                    multiline
                />

                <TouchableOpacity accessibilityRole="button" disabled={!loaded||busy} style={[styles.saveButton,(!loaded||busy)&&{opacity:0.5}]} onPress={saveInterests}>
                    <Text style={styles.saveText}>{busy?'Saving…':'Save'}</Text>
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
        paddingHorizontal: "7%",
        paddingTop: 20,
        paddingBottom: 110,
    },
    title: {
        marginBottom: 8,
        fontSize: 20,
        fontWeight: "700",
        color: COLORS.text,
    },
    subtitle: {
        marginBottom: 20,
        fontSize: 14,
        color: "grey",
        lineHeight: 20,
    },
    input: {
        minHeight: 120,
        padding: 14,
        borderRadius: 16,
        backgroundColor: COLORS.tile,
        borderWidth: 1,
        borderColor: "#E0E0E0",
        fontSize: 14,
        color: COLORS.text,
        textAlignVertical: "top",
    },
    saveButton: {
        height: 48,
        marginTop: 20,
        borderRadius: 14,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: COLORS.secondary,
    },
    saveText: {
        fontSize: 15,
        fontWeight: "600",
        color: COLORS.white,
    },
});
