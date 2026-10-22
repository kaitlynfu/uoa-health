import { useEffect, useRef, useState, type ComponentProps } from "react";
import {
    Alert,
    Animated,
    Easing,
    Modal,
    PanResponder,
    Platform,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
    useWindowDimensions,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useSession } from "../context/SessionContext";
import BrandLogo, {BrandWordmark} from './BrandLogo';
import type { RootStackParamList } from "../navigation/AppNavigator";

type IoniconName = ComponentProps<typeof Ionicons>["name"];
type Route = keyof RootStackParamList;

type Props = {
    visible: boolean;
    onClose: () => void;
    navigation: any;
    // Defaults to the focused route, so PageHeader doesn't need to pass it.
    activeScreen?: string;
};

type MenuLink = { icon: IoniconName; activeIcon: IoniconName; label: string; route: Route };

const MAIN_LINKS: MenuLink[] = [
    { icon: "home-outline", activeIcon: "home", label: "Home", route: "Home" },
    { icon: "bookmark-outline", activeIcon: "bookmark", label: "Saved Programmes & Careers", route: "Saves" },
    { icon: "sparkles-outline", activeIcon: "sparkles", label: "For You", route: "Recommendations" },
];

const EXPLORE_LINKS: MenuLink[] = [
    { icon: "school-outline", activeIcon: "school", label: "Programmes", route: "Programmes" },
    { icon: "briefcase-outline", activeIcon: "briefcase", label: "Career Alignment", route: "CareerAlignment" },
    { icon: "flag-outline", activeIcon: "flag", label: "Milestones", route: "Progression" },
    { icon: "location-outline", activeIcon: "location", label: "Wayfinder", route: "Wayfinder" },
    { icon: "people-outline", activeIcon: "people", label: "Study Groups", route: "StudyGroups" },
];

const CONNECT_LINKS: MenuLink[] = [
    { icon: "chatbubbles-outline", activeIcon: "chatbubbles", label: "Messages", route: "Messages" },
    { icon: "person-add-outline", activeIcon: "person-add", label: "Friends", route: "Friends" },
    { icon: "people-circle-outline", activeIcon: "people-circle", label: "My Groups", route: "UserGroup" },
    { icon: "notifications-outline", activeIcon: "notifications", label: "Notifications", route: "Notifications" },
];

const ACCOUNT_LINKS: MenuLink[] = [
    { icon: "person-outline", activeIcon: "person", label: "Profile", route: "Profile" },
    { icon: "create-outline", activeIcon: "create", label: "Edit Profile", route: "EditProfile" },
    { icon: "settings-outline", activeIcon: "settings", label: "Settings", route: "Settings" },
    { icon: "help-circle-outline", activeIcon: "help-circle", label: "Help & Support", route: "HelpSupport" },
];

const MAX_WIDTH = 320;
const USE_NATIVE_DRIVER = Platform.OS !== "web";

export default function SideBar({ visible, onClose, navigation, activeScreen }: Props) {
    const { auth, logout } = useSession();
    const insets = useSafeAreaInsets();
    const { width: screenWidth } = useWindowDimensions();
    const drawerWidth = Math.min(screenWidth * 0.82, MAX_WIDTH);

    // Keep the Modal mounted until the close animation has finished.
    const [mounted, setMounted] = useState(visible);
    const translateX = useRef(new Animated.Value(-drawerWidth)).current;

    // The pan responder is created once, so it reads these through refs.
    const widthRef = useRef(drawerWidth);
    const onCloseRef = useRef(onClose);
    widthRef.current = drawerWidth;
    onCloseRef.current = onClose;

    useEffect(() => {
        if (visible) {
            setMounted(true);
            translateX.setValue(-widthRef.current);
            Animated.timing(translateX, {
                toValue: 0,
                duration: 240,
                easing: Easing.out(Easing.cubic),
                useNativeDriver: USE_NATIVE_DRIVER,
            }).start();
        } else {
            Animated.timing(translateX, {
                toValue: -widthRef.current,
                duration: 200,
                easing: Easing.in(Easing.cubic),
                useNativeDriver: USE_NATIVE_DRIVER,
            // An interrupted close (e.g. reopened mid-animation) must not unmount the drawer.
            }).start(({ finished }) => { if (finished) setMounted(false); });
        }
    }, [visible, translateX]);

    const panResponder = useRef(PanResponder.create({
        // Only claim clear leftward swipes, so taps and vertical scrolling still work.
        onMoveShouldSetPanResponderCapture: (_, g) => g.dx < -10 && Math.abs(g.dx) > Math.abs(g.dy) * 1.5,
        onPanResponderMove: (_, g) => translateX.setValue(Math.min(0, g.dx)),
        onPanResponderRelease: (_, g) => {
            if (g.dx < -widthRef.current * 0.3 || g.vx < -0.5) onCloseRef.current();
            else Animated.spring(translateX, { toValue: 0, bounciness: 0, useNativeDriver: USE_NATIVE_DRIVER }).start();
        },
        onPanResponderTerminate: () => {
            Animated.spring(translateX, { toValue: 0, bounciness: 0, useNativeDriver: USE_NATIVE_DRIVER }).start();
        },
    })).current;

    const overlayOpacity = translateX.interpolate({
        inputRange: [-drawerWidth, 0],
        outputRange: [0, 1],
        extrapolate: "clamp",
    });

    const navState = navigation.getState?.();
    const current = activeScreen ?? navState?.routes?.[navState.index]?.name;

    function goTo(link: MenuLink) {
        onClose();
        if (link.route === 'Friends') navigation.navigate('Friends',{tab:'Friends'});
        else if (link.route !== current) navigation.navigate(link.route);
    }

    async function logOut() {
        onClose();
        try { await logout(); }
        catch { Alert.alert('Signed out locally', 'Server logout could not be confirmed. The session will expire on the server.'); }
        navigation.navigate('Home');
    }

    function signIn() {
        onClose();
        navigation.navigate('Login');
    }

    function renderLinks(links: MenuLink[]) {
        return links.map((link) => (
            <MenuItem key={link.route} link={link} active={link.route === current || (link.route === 'Wayfinder' && ['IndoorWayfinder', 'FindRoute'].includes(current))} onPress={() => goTo(link)}/>
        ));
    }

    if (!mounted) return null;

    return (
        <Modal transparent visible animationType="none" statusBarTranslucent onRequestClose={onClose}>
            <View style={styles.root} {...panResponder.panHandlers}>
                <Animated.View style={[styles.overlay, { opacity: overlayOpacity }]}>
                    <Pressable style={StyleSheet.absoluteFill} accessibilityRole="button" accessibilityLabel="Close menu" onPress={onClose}/>
                </Animated.View>

                <Animated.View
                    accessibilityViewIsModal
                    style={[styles.drawer, { width: drawerWidth, transform: [{ translateX }] }]}
                >
                    <View style={[styles.header, { paddingTop: insets.top + 14 }]}>
                        <View style={styles.brandRow}>
                            <View style={styles.brand}>
                                <BrandLogo size={36}/>
                                <BrandWordmark size={20}/>
                            </View>
                            <TouchableOpacity style={styles.closeButton} accessibilityRole="button" accessibilityLabel="Close menu" onPress={onClose}>
                                <Ionicons name="close" size={22} color="#52B3B1"/>
                            </TouchableOpacity>
                        </View>

                        <View style={styles.profile}>
                            <View style={styles.avatar}>
                                <Ionicons name="person" size={26} color="#52B3B1"/>
                            </View>
                            <View style={styles.profileText}>
                                <Text style={styles.name} numberOfLines={1}>{auth?.user.display_name ?? 'Guest'}</Text>
                                <Text style={styles.subtitle} numberOfLines={1}>{auth ? 'University of Auckland' : 'Explore your options'}</Text>
                            </View>
                        </View>
                    </View>

                    <ScrollView style={styles.menu} contentContainerStyle={styles.menuContent} showsVerticalScrollIndicator={false}>
                        {renderLinks(MAIN_LINKS)}

                        <Text style={styles.sectionLabel}>Explore</Text>
                        {renderLinks(EXPLORE_LINKS)}

                        <Text style={styles.sectionLabel}>Connect</Text>
                        {renderLinks(CONNECT_LINKS)}

                        <Text style={styles.sectionLabel}>Account</Text>
                        {renderLinks(auth ? ACCOUNT_LINKS : ACCOUNT_LINKS.filter((link) => link.route !== 'EditProfile'))}
                    </ScrollView>

                    <View style={[styles.footer, { paddingBottom: insets.bottom + 16 }]}>
                        {auth ? (
                            <TouchableOpacity style={styles.logoutButton} accessibilityRole="button" onPress={logOut}>
                                <Ionicons name="log-out-outline" size={20} color="#287d7b"/>
                                <Text style={styles.logoutText}>Log out</Text>
                            </TouchableOpacity>
                        ) : (
                            <TouchableOpacity style={styles.signInButton} accessibilityRole="button" onPress={signIn}>
                                <Ionicons name="log-in-outline" size={20} color="#173b39"/>
                                <Text style={styles.signInText}>Sign in / create account</Text>
                            </TouchableOpacity>
                        )}
                    </View>
                </Animated.View>
            </View>
        </Modal>
    );
}

function MenuItem({ link, active, onPress }: { link: MenuLink; active: boolean; onPress: () => void }) {
    return (
        <TouchableOpacity
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            style={[styles.menuItem, active && styles.activeItem]}
            onPress={onPress}
        >
            <View style={[styles.menuIcon, active && styles.activeMenuIcon]}>
                <Ionicons name={active ? link.activeIcon : link.icon} size={20} color={active ? "#52B3B1" : "#52B3B1"}/>
            </View>
            <Text style={[styles.menuText, active && styles.activeMenuText]} numberOfLines={1}>{link.label}</Text>
        </TouchableOpacity>
    );
}

const styles = StyleSheet.create({
    root: {
        flex: 1,
    },
    overlay: {
        position: "absolute",
        top: 0,
        bottom: 0,
        left: 0,
        right: 0,
        backgroundColor: "rgba(13, 64, 90, 0.45)",
    },
    drawer: {
        position: "absolute",
        top: 0,
        bottom: 0,
        left: 0,
        backgroundColor: "white",
        borderTopRightRadius: 18,
        borderBottomRightRadius: 18,
        overflow: "hidden",
        shadowColor: "#000",
        shadowOpacity: 0.15,
        shadowRadius: 16,
        shadowOffset: { width: 4, height: 0 },
        elevation: 16,
    },
    header: {
        backgroundColor: "#CFEFED",
        paddingHorizontal: 20,
        paddingBottom: 20,
    },
    brandRow: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        marginBottom: 16,
    },
    brand: {
        flexDirection: "row",
        alignItems: "center",
        gap: 6,
    },
    brandText: {
        fontSize: 14,
        fontWeight: "700",
        color: "#52B3B1",
    },
    closeButton: {
        minWidth: 44,
        minHeight: 44,
        marginRight: -8,
        alignItems: "center",
        justifyContent: "center",
    },
    profile: {
        flexDirection: "row",
        alignItems: "center",
    },
    avatar: {
        width: 56,
        height: 56,
        borderRadius: 28,
        backgroundColor: "#E8F6F6",
        borderWidth: 3,
        borderColor: "white",
        alignItems: "center",
        justifyContent: "center",
    },
    profileText: {
        flex: 1,
        marginLeft: 14,
    },
    name: {
        fontSize: 18,
        fontWeight: "700",
        color: "#111",
    },
    subtitle: {
        fontSize: 13,
        color: "#555",
        marginTop: 3,
    },
    menu: {
        flex: 1,
    },
    menuContent: {
        paddingHorizontal: 14,
        paddingTop: 14,
        paddingBottom: 20,
    },
    sectionLabel: {
        fontSize: 12,
        fontWeight: "700",
        color: "#888",
        textTransform: "uppercase",
        letterSpacing: 0.6,
        marginTop: 18,
        marginBottom: 6,
        marginLeft: 8,
    },
    menuItem: {
        minHeight: 50,
        flexDirection: "row",
        alignItems: "center",
        paddingHorizontal: 8,
        borderRadius: 14,
        marginBottom: 2,
    },
    activeItem: {
        backgroundColor: "#E8F6F6",
    },
    menuIcon: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: "#E8F6F6",
        alignItems: "center",
        justifyContent: "center",
    },
    activeMenuIcon: {
        backgroundColor: "white",
    },
    menuText: {
        flex: 1,
        fontSize: 15,
        fontWeight: "500",
        color: "#111",
        marginLeft: 14,
    },
    activeMenuText: {
        fontWeight: "700",
        color: "#52B3B1",
    },
    footer: {
        paddingHorizontal: 20,
        paddingTop: 14,
        borderTopWidth: 1,
        borderTopColor: "#EEEEEE",
    },
    logoutButton: {
        height: 50,
        borderRadius: 14,
        borderWidth: 1,
        borderColor: "#EEEEEE",
        backgroundColor: "white",
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: 8,
    },
    logoutText: {
        fontSize: 15,
        fontWeight: "700",
        color: "#52B3B1",
    },
    signInButton: {
        height: 50,
        borderRadius: 14,
        backgroundColor: "#52B3B1",
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: 8,
    },
    signInText: {
        fontSize: 15,
        fontWeight: "700",
        color: "#173b39",
    },
});
