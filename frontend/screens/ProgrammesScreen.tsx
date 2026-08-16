import { useEffect, useState } from "react";
import {
    ActivityIndicator,
    FlatList,
    SafeAreaView,
    StyleSheet,
    Text,
    View,
} from "react-native";

import ProgrammeCard from "../components/ProgrammeCard";
import { getProgrammes } from "../services/api";
import { Programme } from "../types/programme";

export default function ProgrammesScreen() {
    const [programmes, setProgrammes] = useState<Programme[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        async function loadProgrammes() {
            try {
                const data = await getProgrammes();
                setProgrammes(data);
            } catch (err) {
                console.error(err);
                setError("Could not load programmes.");
            } finally {
                setLoading(false);
            }
        }

        loadProgrammes();
    }, []);

    if (loading) {
        return (
            <View style={styles.center}>
                <ActivityIndicator size="large" />
                <Text>Loading programmes...</Text>
            </View>
        );
    }

    if (error) {
        return (
            <View style={styles.center}>
                <Text>{error}</Text>
            </View>
        );
    }

    return (
        <SafeAreaView style={styles.container}>
            <Text style={styles.heading}>Programmes</Text>

            <FlatList
                data={programmes}
                keyExtractor={(programme) => programme.id.toString()}
                renderItem={({ item }) => (
                    <ProgrammeCard programme={item} />
                )}
                ListEmptyComponent={<Text>No programmes found.</Text>}
            />
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        padding: 24,
    },
    center: {
        flex: 1,
        alignItems: "center",
        justifyContent: "center",
    },
    heading: {
        fontSize: 28,
        fontWeight: "bold",
        marginBottom: 20,
    },
});