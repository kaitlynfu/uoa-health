import { StyleSheet, Text, TouchableOpacity, View, Modal } from "react-native";
import { Ionicons } from "@expo/vector-icons";

type Props = {
    visible: boolean;
    onClose: () => void;
    navigation: any;
};

export default function SignInPopup({ visible, onClose, navigation }: Props) {
    const signIn = () => {
        onClose();
        navigation.navigate("Login");
    };

    return (
        <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
            <View style={styles.overlay}>
                <View style={styles.card} accessibilityViewIsModal>
                    <View style={styles.icon}>
                        <Ionicons name="bookmark-outline" size={26} color="#52B3B1"/>
                    </View>

                    <Text accessibilityRole="header" style={styles.title}>Sign in to save</Text>
                    <Text style={styles.description}>Sign in to save items and access them later.</Text>

                    <TouchableOpacity accessibilityRole="button" style={styles.signInButton} onPress={signIn}>
                        <Text style={styles.signInText}>Sign in</Text>
                    </TouchableOpacity>

                    <TouchableOpacity accessibilityRole="button" style={styles.cancelButton} onPress={onClose}>
                        <Text style={styles.cancelText}>Not now</Text>
                    </TouchableOpacity>
                </View>
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: "rgba(0,0,0,0.35)",
        alignItems: "center",
        justifyContent: "center",
        paddingHorizontal: "8%"
    },
    card: {
        width: "100%",
        maxWidth: 340,
        backgroundColor: "#FFFFFF",
        borderRadius: 22,
        padding: 24,
        alignItems: "center"
    },
    icon: {
        width: 58,
        height: 58,
        borderRadius: 29,
        backgroundColor: "#E8F6F6",
        alignItems: "center",
        justifyContent: "center",
        marginBottom: 16
    },
    title: {
        fontSize: 19,
        fontWeight: "700",
        color: "#111111",
        textAlign: "center"
    },
    description: {
        marginTop: 8,
        marginBottom: 20,
        fontSize: 14,
        lineHeight: 20,
        color: "#666666",
        textAlign: "center"
    },
    signInButton: {
        width: "100%",
        backgroundColor: "#52B3B1",
        minHeight: 44,
        borderRadius: 14,
        paddingVertical: 13,
        alignItems: "center"
    },
    signInText: {
        fontSize: 14,
        fontWeight: "700",
        color: "#FFFFFF"
    },
    cancelButton: {
        minHeight: 44,
        paddingTop: 14,
        paddingHorizontal: 20
    },
    cancelText: {
        fontSize: 13,
        fontWeight: "600",
        color: "#666666"
    }
});
