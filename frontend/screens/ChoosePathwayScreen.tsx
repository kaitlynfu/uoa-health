import {
    SafeAreaView,
    StyleSheet,
    Text,
    View,
    TouchableOpacity,
    ScrollView,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useState, useEffect } from "react";
import { Alert, TextInput } from 'react-native';
import { useSession } from '../context/SessionContext';
import { studentRequest, type Plan } from '../services/studentApi';
import { getProgrammes } from '../services/api';
import { validCatalogueYear } from '../services/catalogueYear';
type Choice = { id: number; name: string; pathways: { id: string; name: string }[] };

import NavBar from "../components/NavBar";
import PageHeader from "../components/PageHeader";
import { COLORS } from "../constants/theme";
import { RootStackParamList } from "../navigation/AppNavigator";

type Props = NativeStackScreenProps<RootStackParamList, "ChoosePathway">;

export default function ChoosePathwayScreen({ navigation, route }: Props) {
    const { auth } = useSession();
    const [programmes, setProgrammes] = useState<Choice[]>([]);
    const [selectedProgramme, setSelectedProgramme] = useState<Choice>({id: 0, name: 'Select programme', pathways: []});
    const [selectedPathway, setSelectedPathway] = useState({id: '', name: 'Select pathway'});
    const [year, setYear] = useState('2027');
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    const [programmeDropdownOpen, setProgrammeDropdownOpen] = useState(false);
    const [pathwayDropdownOpen, setPathwayDropdownOpen] = useState(false);
    useEffect(() => {
        let active = true;
        getProgrammes().then(rows => { if (active) {
            const choices = rows.map(p => ({...p, pathways: []})); setProgrammes(choices);
            const requested = choices.find(p => p.id === route.params?.programmeId);
            if (requested) setSelectedProgramme(requested);
        } })
            .catch(e => { if (active) setError(e.message); });
        return () => { active = false; };
    }, [route.params?.programmeId]);
    useEffect(() => {
        let active = true;
        setSelectedPathway({id: '', name: 'Select pathway'});
        setSelectedProgramme(p => ({...p, pathways: []}));
        if (selectedProgramme.id && validCatalogueYear(year)) {
            studentRequest<Plan[]>('/journey/programmes/' + selectedProgramme.id + '/plans?catalogue_year=' + year)
                .then(rows => { if (active) {
                    setError(rows.length ? '' : 'No published pathway for this programme/year.');
                    setSelectedProgramme(p => ({...p, pathways: rows.map(r => ({id:r.code, name:r.name}))}));
                }}).catch(e => { if (active) setError(e.message); });
        } else if (selectedProgramme.id) setError('Enter a four-digit catalogue year between 2024 and 2100.');
        return () => { active = false; };
    }, [selectedProgramme.id, year]);
    function selectProgramme(programme: typeof programmes[number]) {
        setSelectedProgramme(programme);
        setSelectedPathway({id: '', name: 'Select pathway'});
        setProgrammeDropdownOpen(false);
    }

    function selectPathway(pathway: typeof programmes[number]["pathways"][number]) {
        setSelectedPathway(pathway);
        setPathwayDropdownOpen(false);
    }

    async function saveChanges() {
        if (!auth) { navigation.navigate('Login'); return; }
        if (!selectedProgramme.id || !selectedPathway.id || busy) return;
        setBusy(true);
        try {
            await studentRequest('/journey/me/programme', auth.access_token, 'PUT', {
                programme_id: selectedProgramme.id, plan_code: selectedPathway.id,
                catalogue_year: Number(year), current_stage: 1,
            });
            navigation.navigate('Progression');
        } catch (e) { setError(e instanceof Error ? e.message : 'Could not save. Retry.'); }
        finally { setBusy(false); }
    }

    return (
        <SafeAreaView style={styles.container}>
            <ScrollView
                showsVerticalScrollIndicator={false}
                contentContainerStyle={styles.content}
            >
                <View style={styles.headerContainer}>
                    <PageHeader
                        title="Choose your journey"
                        navigation={navigation}
                        leftIcon="back"
                        description="Choose the programme and pathway you want to follow. Your progression will update to match your selection."
                    />
                </View>

                <View style={styles.formCard}>

                    <View style={styles.field}>
                        <Text style={styles.label}>Catalogue Year</Text>
                        {error ? <Text accessibilityRole="alert" style={{ marginBottom: 8 }}>{error}</Text> : null}
                        <TextInput accessibilityLabel="Catalogue year" keyboardType="number-pad" value={year} onChangeText={setYear} placeholder="e.g. 2027" style={styles.yearInput} />
                        <Text style={styles.helperText}>Available data currently includes 2027.</Text>
                    </View>

                    <View style={styles.field}>
                        <Text style={styles.label}>Programme</Text>

                        <TouchableOpacity
                            style={styles.dropdown}
                            onPress={() => {
                                setProgrammeDropdownOpen(!programmeDropdownOpen);
                                setPathwayDropdownOpen(false);
                            }}
                            activeOpacity={0.8}
                        >
                            <Text style={styles.dropdownText}>{selectedProgramme.name}</Text>
                            <Ionicons name={programmeDropdownOpen ? "chevron-up" : "chevron-down"} size={20} color={COLORS.text} />
                        </TouchableOpacity>

                        {programmeDropdownOpen && (
                            <View style={styles.dropdownOptions}>
                                {programmes.map((programme) => (
                                    <TouchableOpacity
                                        key={programme.id}
                                        style={[styles.option, selectedProgramme.id === programme.id && styles.selectedOption]}
                                        onPress={() => selectProgramme(programme)}
                                        activeOpacity={0.7}
                                    >
                                        <Text style={styles.optionText}>{programme.name}</Text>
                                        {selectedProgramme.id === programme.id && <Ionicons name="checkmark" size={20} color={COLORS.secondary} />}
                                    </TouchableOpacity>
                                ))}
                            </View>
                        )}
                    </View>

                    <View style={styles.field}>
                        <Text style={styles.label}>Pathway</Text>

                        <TouchableOpacity
                            style={styles.dropdown}
                            onPress={() => {
                                setPathwayDropdownOpen(!pathwayDropdownOpen);
                                setProgrammeDropdownOpen(false);
                            }}
                            activeOpacity={0.8}
                        >
                            <Text style={styles.dropdownText}>{selectedPathway.name}</Text>
                            <Ionicons name={pathwayDropdownOpen ? "chevron-up" : "chevron-down"} size={20} color={COLORS.text} />
                        </TouchableOpacity>

                        {pathwayDropdownOpen && (
                            <View style={styles.dropdownOptions}>
                                {selectedProgramme.pathways.map((pathway) => (
                                    <TouchableOpacity
                                        key={pathway.id}
                                        style={[styles.option, selectedPathway.id === pathway.id && styles.selectedOption]}
                                        onPress={() => selectPathway(pathway)}
                                        activeOpacity={0.7}
                                    >
                                        <Text style={styles.optionText}>{pathway.name}</Text>
                                        {selectedPathway.id === pathway.id && <Ionicons name="checkmark" size={20} color={COLORS.secondary} />}
                                    </TouchableOpacity>
                                ))}
                            </View>
                        )}
                    </View>

                    <TouchableOpacity disabled={busy || !selectedPathway.id} style={styles.saveButton} onPress={saveChanges} activeOpacity={0.8}>
                        <Text style={styles.saveButtonText}>Save changes</Text>
                    </TouchableOpacity>

                    <TouchableOpacity style={styles.cancelButton} onPress={() => navigation.goBack()} activeOpacity={0.7}>
                        <Text style={styles.cancelButtonText}>Cancel</Text>
                    </TouchableOpacity>
                </View>
            </ScrollView>

            <NavBar navigation={navigation} activeScreen="Progression" />
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
        paddingBottom: 120,
        gap: 12,
    },
    intro: {
        marginTop: 28,
        marginBottom: 24,
    },
    title: {
        fontSize: 25,
        fontWeight: "700",
        color: COLORS.text,
        marginBottom: 10,
    },
    description: {
        fontSize: 14,
        lineHeight: 21,
        color: "grey",
    },
    formCard: {
        backgroundColor: COLORS.white,
        borderRadius: 18,
        padding: 20,
        borderWidth: 1,
        borderColor: "#EAEAEA",
        marginHorizontal: -11
    },
    field: {
        marginBottom: 22,
    },
    label: {
        fontSize: 14,
        fontWeight: "600",
        color: COLORS.text,
        marginBottom: 9,
    },
    dropdown: {
        minHeight: 54,
        backgroundColor: '#FFFFFF',
        borderRadius: 12,
        paddingHorizontal: 15,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        borderWidth: 1,
        borderColor: '#D0D0D0',
    },
    dropdownText: {
        flex: 1,
        fontSize: 14,
        fontWeight: "600",
        color: COLORS.text,
        marginRight: 10,
    },
    dropdownOptions: {
        marginTop: 6,
        backgroundColor: '#FFFFFF',
        borderRadius: 12,
        padding: 5,
        borderWidth: 1,
        borderColor: '#D0D0D0',
    },
    option: {
        minHeight: 48,
        borderRadius: 9,
        paddingHorizontal: 10,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
    },
    selectedOption: {
        backgroundColor: COLORS.primary,
    },
    optionText: {
        flex: 1,
        fontSize: 14,
        fontWeight: "600",
        color: COLORS.text,
    },
    saveButton: {
        minHeight: 52,
        backgroundColor: COLORS.secondary,
        borderRadius: 13,
        alignItems: "center",
        justifyContent: "center",
        marginTop: 2,
    },
    saveButtonText: {
        fontSize: 15,
        fontWeight: "700",
        color: COLORS.white,
    },
    cancelButton: {
        minHeight: 44,
        alignItems: "center",
        justifyContent: "center",
        marginTop: 16,
        backgroundColor: "#EAF6F5",
        borderRadius: 10,
    },
    cancelButtonText: {
        fontSize: 15,
        fontWeight: "600",
        color: COLORS.secondary,
    },
    headerContainer: {
        marginHorizontal: -31,
    },
    yearInput: {
        minHeight: 54,
        backgroundColor: '#FFFFFF',
        borderRadius: 12,
        paddingHorizontal: 15,
        fontSize: 14,
        color: COLORS.text,
        borderWidth: 1,
        borderColor: '#D0D0D0',
    },
    helperText: {
        fontSize: 12,
        color: "#777777",
        marginTop: 7,
    },
});
