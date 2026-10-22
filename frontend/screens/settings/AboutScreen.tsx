import { SafeAreaView } from 'react-native-safe-area-context';
import {
    StyleSheet,
    ScrollView,
    Text,
    View,
} from "react-native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";

import appConfig from "../../app.json";
import PageHeader from "../../components/PageHeader";
import NavBar from "../../components/NavBar";
import { COLORS } from "../../constants/theme";
import { RootStackParamList } from "../../navigation/AppNavigator";
import BrandLogo, {BrandWordmark} from '../../components/BrandLogo';

type Props = NativeStackScreenProps<RootStackParamList, "AboutApp">;

export default function AboutAppScreen({ navigation }: Props) {
    return (
        <SafeAreaView style={styles.container}>
            <PageHeader
                title="About App"
                navigation={navigation}
                leftIcon="back"
            />

            <ScrollView contentContainerStyle={styles.content}>
                <View style={styles.iconContainer}>
                    <BrandLogo size={96}/>
                </View>

                <BrandWordmark size={30} style={{textAlign:'center',marginBottom:12}}/>

                <Text style={styles.description}>
                    A study companion designed to help undergraduate health
                    students navigate their studies, explore pathways,
                    connect with opportunities and track their progression.
                </Text>

                <View style={styles.info}>
                    <Text style={styles.label}>VERSION</Text>
                    <Text style={styles.value}>{appConfig.expo.version}</Text>
                </View>

                <View style={styles.info}>
                    <Text style={styles.label}>ABOUT</Text>
                    <Text style={styles.value}>
                        Bridging campuses, cohorts and careers.
                    </Text>
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
    content: {
        flexGrow: 1,
        alignItems: "center",
        paddingHorizontal: "7%",
        paddingTop: 35,
        paddingBottom: 110,
    },
    iconContainer: {
        width: 96,
        height: 96,
        alignItems: "center",
        justifyContent: "center",
        marginBottom: 20,
    },
    title: {
        fontSize: 20,
        fontWeight: "700",
        color: COLORS.text,
        textAlign: "center",
        marginBottom: 12,
    },
    description: {
        fontSize: 14,
        lineHeight: 21,
        color: "grey",
        textAlign: "center",
        marginBottom: 35,
    },
    info: {
        width: "100%",
        paddingVertical: 14,
        borderBottomWidth: 1,
        borderBottomColor: "#E8E8E8",
    },
    label: {
        fontSize: 10,
        fontWeight: "700",
        letterSpacing: 0.8,
        color: "grey",
        marginBottom: 5,
    },
    value: {
        fontSize: 14,
        color: COLORS.text,
    },
});
