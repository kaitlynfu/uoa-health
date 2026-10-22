import { useState } from "react";
import { StyleSheet, TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import SideBar from "./SideBar";

type Props = {
    navigation: any;
    color?: string;
};

// The ☰ button plus the drawer it opens. PageHeader uses it, and screens with
// the navigator's built-in header can pass it to headerLeft/headerRight.
export default function MenuButton({ navigation, color = "#666" }: Props) {
    const [open, setOpen] = useState(false);

    return (
        <>
            <TouchableOpacity style={styles.button} accessibilityRole="button" accessibilityLabel="Open menu" onPress={() => setOpen(true)}>
                <Ionicons name="menu-sharp" size={24} color={color}/>
            </TouchableOpacity>
            <SideBar visible={open} navigation={navigation} onClose={() => setOpen(false)}/>
        </>
    );
}

const styles = StyleSheet.create({
    button: { minWidth: 44, minHeight: 44, alignItems: "center", justifyContent: "center" },
});
