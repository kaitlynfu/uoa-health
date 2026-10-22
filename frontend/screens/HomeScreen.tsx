import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { View, Text, StyleSheet, Pressable, Animated, Easing, useWindowDimensions, ScrollView, PanResponder, Platform, AccessibilityInfo, BackHandler } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { useFocusEffect } from "@react-navigation/native";
import { Ionicons, Feather } from "@expo/vector-icons";
import { useSession } from "../context/SessionContext";
import { useSaved } from "../context/SavedContext";
import { homeNextStep, compassDirectionIndex, compassHomeLayout } from "../services/homeNavigation";
import NavBar from "../components/NavBar";
import SideBar from "../components/SideBar";
import BrandLogo, {BrandWordmark} from "../components/BrandLogo";

type FeatureId = "career" | "groups" | "milestones" | "wayfinder";
type Feature = { id: FeatureId; title: string; description: string; color: string; background: string; rotation: number };

const MAIN = "#52B3B1";
const LIGHT = "#CFEFED";
const PALE = "#EAF7F5";
const TEXT = "#171717";
const SECONDARY = "#666666";
const NATIVE_DRIVER = Platform.OS !== "web";
const FONT = Platform.OS === "web" ? "system-ui" : "System";

const FEATURES: Feature[] = [
    { id: "career", title: "Career Alignment", description: "Explore career pathways and opportunities.", color: "#E87931", background: "#FFE4D4", rotation: 0 },
    { id: "groups", title: "Study Groups", description: "Connect and collaborate with other students.", color: "#2D9F74", background: "#DDF3E9", rotation: 90 },
    { id: "milestones", title: "Milestones", description: "Track your university journey and progress.", color: "#4C7EDB", background: "#DFE9FF", rotation: 180 },
    { id: "wayfinder", title: "Wayfinder", description: "Navigate campus with ease.", color: "#5F4DD8", background: "#E8E3FF", rotation: 270 },
];

export default function CompassHome({ navigation }: any) {
    const { width, height, fontScale } = useWindowDimensions();
    const { auth } = useSession();
    const { savedProgrammeIds, savedCareerIds } = useSaved();
    const insets = useSafeAreaInsets();
    const firstName = auth?.user?.display_name?.trim().split(/\s+/)[0] || "Guest";
    const [expanded, setExpanded] = useState(false);
    const expandedRef = useRef(expanded);
    expandedRef.current = expanded;
    const [isSpinning, setIsSpinning] = useState(false);
    const [isClosing, setIsClosing] = useState(false);
    const [selectedFeature, setSelectedFeature] = useState<Feature | null>(null);
    const [menuOpen, setMenuOpen] = useState(false);
    const [reduceMotion, setReduceMotion] = useState(false);
    const rotation = useRef(new Animated.Value(0)).current;
    const featuresOpacity = useRef(new Animated.Value(0)).current;
    const featuresScale = useRef(new Animated.Value(0.8)).current;
    const currentAngle = useRef(0);
    const lastDragAt = useRef(0);
    const busy = useRef(false);
    const webDrag = useRef<{x: number; y: number; centreX: number; centreY: number; moved: boolean} | null>(null);

    const { horizontalPadding, compassSize, featureAreaWidth, featureCircleSize, openedCompassSize, openedHeight } = compassHomeLayout(width, height - insets.top - insets.bottom, fontScale);
    const activeCompassSize = expanded ? openedCompassSize : compassSize;
    const featureAreaHeight = expanded ? openedHeight : compassSize + 64;
    const haloSize = Math.min(activeCompassSize + 64, featureAreaWidth);
    const nextStep = homeNextStep(Boolean(auth), savedProgrammeIds.length, savedCareerIds.length);

    useEffect(() => {
        let active = true;
        AccessibilityInfo.isReduceMotionEnabled().then(value => { if (active) setReduceMotion(value); });
        const listener = AccessibilityInfo.addEventListener("reduceMotionChanged", setReduceMotion);
        return () => { active = false; listener.remove(); };
    }, []);

    useFocusEffect(useCallback(() => {
        busy.current = false;
        setIsSpinning(false);
        setIsClosing(false);
        if (expandedRef.current) {
            featuresOpacity.setValue(1);
            featuresScale.setValue(1);
        }
        return () => {
            rotation.stopAnimation();
            featuresOpacity.stopAnimation();
            featuresScale.stopAnimation();
            busy.current = false;
            webDrag.current = null;
            setMenuOpen(false);
        };
    }, [rotation, featuresOpacity, featuresScale]));

    useEffect(() => {
        if (!expanded || menuOpen) return;
        const listener = BackHandler.addEventListener("hardwareBackPress", () => {
            if (!busy.current) closeCompass();
            return true;
        });
        return () => listener.remove();
    }, [expanded, menuOpen, rotation, reduceMotion]);

    function closeCompass() {
        if (busy.current) return;
        busy.current = true;
        setIsClosing(true);
        setIsSpinning(true);
        // Keep the expanded layout until all icons have faded out, so closing
        // doesn't jump or bring labels across the dial.
        Animated.parallel([
            Animated.timing(featuresOpacity, {toValue: 0, duration: reduceMotion ? 0 : 200, useNativeDriver: NATIVE_DRIVER}),
            Animated.timing(featuresScale, {toValue: 0.8, duration: reduceMotion ? 0 : 220, easing: Easing.in(Easing.cubic), useNativeDriver: NATIVE_DRIVER}),
            Animated.timing(rotation, {toValue: currentAngle.current - 180, duration: reduceMotion ? 0 : 320, easing: Easing.inOut(Easing.cubic), useNativeDriver: NATIVE_DRIVER}),
        ]).start(({finished}) => {
            if (!finished) return;
            currentAngle.current = 0;
            rotation.setValue(0);
            setExpanded(false);
            setSelectedFeature(null);
            setIsClosing(false);
            setIsSpinning(false);
            busy.current = false;
        });
    }

    function showFeatures() {
        if (reduceMotion) {
            featuresOpacity.setValue(1);
            featuresScale.setValue(1);
            return;
        }
        Animated.parallel([
            Animated.timing(featuresOpacity, {toValue: 1, duration: 220, useNativeDriver: NATIVE_DRIVER}),
            Animated.spring(featuresScale, {toValue: 1, friction: 7, tension: 70, useNativeDriver: NATIVE_DRIVER}),
        ]).start();
    }

    function openFeature(feature: Feature) {
        if (feature.id === "career") navigation.navigate("CareerAlignment");
        if (feature.id === "groups") navigation.navigate("StudyGroups");
        if (feature.id === "milestones") navigation.navigate("Progression");
        if (feature.id === "wayfinder") navigation.navigate("Wayfinder");
    }

    function chooseFeature(feature: Feature) {
        if (busy.current) return;
        busy.current = true;
        setIsSpinning(true);
        setSelectedFeature(feature);
        currentAngle.current = feature.rotation;
        Animated.timing(rotation, {toValue: feature.rotation, duration: reduceMotion ? 0 : 160, easing: Easing.out(Easing.cubic), useNativeDriver: NATIVE_DRIVER})
            .start(({finished}) => {
                if (!finished) return;
                busy.current = false;
                setIsSpinning(false);
                openFeature(feature);
            });
    }

    function toggleCompass() {
        if (busy.current || Date.now() - lastDragAt.current < 250) return;
        if (expanded) {
            closeCompass();
            return;
        }
        busy.current = true;
        setIsSpinning(true);
        setSelectedFeature(null);
        featuresOpacity.setValue(0);
        featuresScale.setValue(0.8);
        rotation.setValue(0);
        // The spin reveals the menu; it never picks a random destination.
        Animated.timing(rotation, {toValue: 360, duration: reduceMotion ? 0 : 650, easing: Easing.out(Easing.cubic), useNativeDriver: NATIVE_DRIVER})
            .start(({finished}) => {
                if (!finished) return;
                currentAngle.current = 0;
                rotation.setValue(0);
                setExpanded(true);
                setIsSpinning(false);
                busy.current = false;
                showFeatures();
            });
    }

    function finishDrag() {
        if (busy.current) return;
        lastDragAt.current = Date.now();
        const index = compassDirectionIndex(currentAngle.current);
        if (index === null) return;
        const feature = FEATURES[index];
        currentAngle.current = feature.rotation;
        Animated.timing(rotation, {toValue: feature.rotation, duration: reduceMotion ? 0 : 160, useNativeDriver: NATIVE_DRIVER}).start();
        setSelectedFeature(feature);
        setExpanded(true);
        showFeatures();
    }

    const panResponder = useMemo(() => PanResponder.create({
        onStartShouldSetPanResponder: () => false,
        onMoveShouldSetPanResponder: (_, gesture) => !busy.current && (Math.abs(gesture.dx) > 4 || Math.abs(gesture.dy) > 4),
        onPanResponderMove: (event) => {
            if (busy.current) return;
            const {locationX, locationY} = event.nativeEvent;
            currentAngle.current = Math.atan2(locationY - activeCompassSize / 2, locationX - activeCompassSize / 2) * (180 / Math.PI) + 90;
            rotation.setValue(currentAngle.current);
        },
        onPanResponderRelease: finishDrag,
        onPanResponderTerminate: finishDrag,
    }), [activeCompassSize, reduceMotion]);

    const webPointerHandlers = {
        onPointerDown: (event: any) => {
            if (busy.current) return;
            const bounds = event.currentTarget.getBoundingClientRect();
            const pointer = event.nativeEvent;
            webDrag.current = {x: pointer.clientX, y: pointer.clientY, centreX: bounds.left + bounds.width / 2, centreY: bounds.top + bounds.height / 2, moved: false};
            event.currentTarget.setPointerCapture(pointer.pointerId);
        },
        onPointerMove: (event: any) => {
            const drag = webDrag.current;
            if (!drag || busy.current) return;
            const pointer = event.nativeEvent;
            if (Math.hypot(pointer.clientX - drag.x, pointer.clientY - drag.y) > 4) drag.moved = true;
            if (!drag.moved) return;
            currentAngle.current = Math.atan2(pointer.clientY - drag.centreY, pointer.clientX - drag.centreX) * (180 / Math.PI) + 90;
            rotation.setValue(currentAngle.current);
        },
        onPointerUp: () => {
            if (webDrag.current?.moved) finishDrag();
            webDrag.current = null;
        },
        onPointerCancel: () => {
            webDrag.current = null;
        },
    };
    const needleRotation = rotation.interpolate({inputRange: [-1440, 1440], outputRange: ["-1440deg", "1440deg"]});

    return <SafeAreaView edges={["top", "left", "right"]} style={styles.safeArea}>
        <View style={styles.container}>
            <ScrollView contentContainerStyle={[styles.scrollContent, {paddingHorizontal: horizontalPadding, paddingBottom: 96 + insets.bottom}]} showsVerticalScrollIndicator={false}>
                <View style={styles.brandRow}>
                    <View style={styles.brand}>
                        <View style={styles.brandIcon}><BrandLogo size={50}/></View>
                        <BrandWordmark/>
                    </View>
                    <Pressable accessibilityRole="button" accessibilityLabel="Open menu" accessibilityState={{expanded: menuOpen}} aria-expanded={menuOpen} accessibilityHint="Saved items, For you, profile, settings and all app features" style={styles.menuPill} onPress={() => setMenuOpen(true)}>
                        <Ionicons name="menu-outline" size={20} color="#52B3B1"/><Text style={styles.menuText}>Menu</Text>
                    </Pressable>
                </View>
                <Text style={styles.greeting}>Welcome, {firstName}</Text>
                <View style={styles.centerHeading}>
                    <Text accessibilityRole="header" style={styles.pageTitle}>Find your direction</Text>
                    <Text style={styles.pageSubtitle}>Choose where you’d like to go.</Text>
                </View>
                <View style={[styles.compassSection, {width: featureAreaWidth, height: featureAreaHeight}]}>
                    <View pointerEvents="none" style={[styles.compassHalo, {width: haloSize, height: haloSize, borderRadius: haloSize / 2}]}>
                        <View style={styles.panelCircleOne}/><View style={styles.panelCircleTwo}/><View style={styles.panelCircleThree}/>
                    </View>
                    {expanded && <Animated.View pointerEvents={isSpinning ? "none" : "box-none"} accessibilityElementsHidden={isSpinning} aria-hidden={isSpinning} importantForAccessibility={isSpinning ? "no-hide-descendants" : "auto"} style={[StyleSheet.absoluteFill, styles.featureLayer, {opacity: featuresOpacity}]}>
                        <FeatureButton feature={FEATURES[0]} position="top" circleSize={featureCircleSize} scale={featuresScale} selected={selectedFeature?.id === "career"} onPress={() => chooseFeature(FEATURES[0])}/>
                        <FeatureButton feature={FEATURES[3]} position="left" circleSize={featureCircleSize} scale={featuresScale} selected={selectedFeature?.id === "wayfinder"} onPress={() => chooseFeature(FEATURES[3])}/>
                        <FeatureButton feature={FEATURES[1]} position="right" circleSize={featureCircleSize} scale={featuresScale} selected={selectedFeature?.id === "groups"} onPress={() => chooseFeature(FEATURES[1])}/>
                        <FeatureButton feature={FEATURES[2]} position="bottom" circleSize={featureCircleSize} scale={featuresScale} selected={selectedFeature?.id === "milestones"} onPress={() => chooseFeature(FEATURES[2])}/>
                    </Animated.View>}
                    <Compass size={activeCompassSize} rotation={needleRotation} spinning={isSpinning} closing={isClosing} expanded={expanded} selectedFeature={selectedFeature} onPress={toggleCompass} panHandlers={Platform.OS === "web" ? webPointerHandlers : panResponder.panHandlers}/>
                </View>
                <View style={styles.tapSection}><Pressable accessibilityRole="button" accessibilityLabel={expanded ? 'Close compass menu' : 'Open compass menu'} accessibilityState={{disabled:isSpinning,expanded}} disabled={isSpinning} onPress={toggleCompass} style={styles.tapPill}><Text style={styles.tapText}>
                    {isClosing ? "Closing your compass…" : isSpinning ? "Opening your compass…" : expanded ? "Choose an option · tap the compass to close" : "Tap to open compass"}
                </Text></Pressable></View>
                {nextStep.route !== "Programmes" && <Pressable accessibilityRole="button" accessibilityLabel="Explore Programmes" style={styles.nextStepCard} onPress={() => navigation.navigate('Programmes')}>
                    <View style={[styles.nextStepIcon, {backgroundColor:'#F1ECFF'}]}><Ionicons name="school-outline" size={24} color="#6554D9"/></View>
                    <View style={{flex:1,marginHorizontal:14}}><Text style={styles.resultTitle}>Explore programmes</Text><Text style={styles.resultDescription}>Find a degree and see where it can take you.</Text></View>
                    <Ionicons name="chevron-forward" size={22} color="#777"/>
                </Pressable>}
                <Pressable accessibilityRole="button" accessibilityLabel={nextStep.title} style={styles.nextStepCard} onPress={() => nextStep.route === "Saves" ? navigation.navigate("Saves", {tab: nextStep.tab}) : navigation.navigate(nextStep.route)}>
                    <View style={styles.nextStepIcon}><Ionicons name={nextStep.route === "Saves" ? "bookmark-outline" : "sparkles-outline"} size={24} color="#52B3B1"/></View>
                    <View style={styles.resultContent}>
                        <Text style={styles.nextStepLabel}>YOUR NEXT STEP</Text>
                        <Text style={styles.resultTitle}>{nextStep.title}</Text>
                        <Text style={styles.resultDescription}>{nextStep.description}</Text>
                    </View>
                    <Ionicons name="chevron-forward" size={21} color="#777"/>
                </Pressable>
            </ScrollView>
            <NavBar navigation={navigation} activeScreen="Home"/>
            <SideBar visible={menuOpen} navigation={navigation} activeScreen="Home" onClose={() => setMenuOpen(false)}/>
        </View>
    </SafeAreaView>;
}

function Compass({ size, rotation, spinning, closing, expanded, selectedFeature, onPress, panHandlers }: { size: number; rotation: any; spinning: boolean; closing: boolean; expanded: boolean; selectedFeature: Feature | null; onPress: () => void; panHandlers: any }) {
    const needleHeight = size * 0.58;

    return (
        <Pressable {...panHandlers} accessibilityRole="button" accessibilityLabel={closing ? "Compass closing" : spinning ? "Compass opening" : expanded ? "Close compass" : "Open compass"} accessibilityState={{disabled: spinning, expanded}} aria-expanded={expanded} aria-disabled={spinning} accessibilityHint="Reveals four directions. Tap a feature to open it; dragging only highlights a direction." onPress={onPress} disabled={spinning} style={[styles.compass, { width: size, height: size, borderRadius: size / 2, ...(Platform.OS === "web" ? {touchAction: "none"} : {}) }]}>
        <View pointerEvents="none" style={[styles.compassOuterGlow, { width: size + 14, height: size + 14, borderRadius: (size + 14) / 2 }]}/>
        <View pointerEvents="none" style={[styles.outerRing, { width: size, height: size, borderRadius: size / 2 }]}/>
        <View pointerEvents="none" style={[styles.middleRing, { width: size * 0.67, height: size * 0.67, borderRadius: size * 0.335 }]}/>
        <View pointerEvents="none" style={[styles.innerRing, { width: size * 0.43, height: size * 0.43, borderRadius: size * 0.215 }]}/>
        <CompassTicks size={size} />
        <View pointerEvents="none" style={[styles.verticalGuide, { height: size * 0.62 }]}/>
        <View pointerEvents="none" style={[styles.horizontalGuide, { width: size * 0.62 }]}/>
        <Text pointerEvents="none" style={[styles.direction, { top: size * 0.10, color: selectedFeature?.rotation === 0 ? selectedFeature.color : MAIN }]}>N</Text>
        <Text pointerEvents="none" style={[styles.direction, { right: size * 0.10, color: selectedFeature?.rotation === 90 ? selectedFeature.color : MAIN }]}>E</Text>
        <Text pointerEvents="none" style={[styles.direction, { bottom: size * 0.10, color: selectedFeature?.rotation === 180 ? selectedFeature.color : MAIN }]}>S</Text>
        <Text pointerEvents="none" style={[styles.direction, { left: size * 0.10, color: selectedFeature?.rotation === 270 ? selectedFeature.color : MAIN }]}>W</Text>
        <Animated.View pointerEvents="none" style={[styles.needleContainer, { height: needleHeight, transform: [{ rotate: rotation }] }]}>
            <View style={[styles.needleNorth, { borderLeftWidth: size * 0.038, borderRightWidth: size * 0.038, borderBottomWidth: needleHeight * 0.48, borderBottomColor: selectedFeature?.color ?? "#F56262" }]} />
            <View style={[styles.needleSouth, { borderLeftWidth: size * 0.03, borderRightWidth: size * 0.03, borderTopWidth: needleHeight * 0.42 }]}/>
            <View style={[styles.needleWest, { borderTopWidth: size * 0.025, borderBottomWidth: size * 0.025, borderRightWidth: size * 0.19 }]}/>
            <View style={[styles.needleEast, { borderTopWidth: size * 0.025, borderBottomWidth: size * 0.025, borderLeftWidth: size * 0.19 }]}/>
        </Animated.View>
        <View pointerEvents="none" style={[styles.centreButton, { width: size * 0.17, height: size * 0.17, borderRadius: size * 0.085 }]}>
            <View style={[styles.centreDot, { width: size * 0.048, height: size * 0.048, borderRadius: size * 0.024 }]}/>
        </View>
        </Pressable>
    );
}

function CompassTicks({ size }: { size: number }) {
    const ticks = Array.from({ length: 24 });
    return (
        <View pointerEvents="none" style={[styles.tickContainer, { width: size, height: size, borderRadius: size / 2 }]}>
        {ticks.map((_, index) => {
            const angle = index * (360 / ticks.length);
            const major = index % 6 === 0;
            return (
            <View key={index} style={[styles.tickWrapper, { transform: [{ rotate: `${angle}deg` }] }]}>
                <View style={[styles.tick, { height: major ? size * 0.065 : size * 0.04, width: major ? 2 : 1.2, top: size * 0.045 }]}/>
            </View>
            );
        })}
        </View>
    );
}

function FeatureButton({ feature, position, selected, circleSize, scale, onPress }: { feature: Feature; position: "top" | "left" | "right" | "bottom"; selected: boolean; circleSize: number; scale: Animated.Value; onPress: () => void }) {
    const label = <Text numberOfLines={2} maxFontSizeMultiplier={2} style={[styles.featureText, position === "top" && styles.featureTextAbove, selected && { color: feature.color }]}>{feature.title}</Text>;
    return (
        <Pressable accessibilityRole="button" accessibilityLabel={`Open ${feature.title}`} accessibilityState={{selected}} accessibilityHint={feature.description} onPress={onPress} style={[styles.feature, position === "top" && styles.featureTop, position === "bottom" && styles.featureBottom, position === "left" && styles.featureLeft, position === "right" && styles.featureRight]}>
        {position === "top" && label}
        <Animated.View style={[styles.featureCircle, { width: circleSize, height: circleSize, borderRadius: circleSize / 2, backgroundColor: feature.background, borderColor: selected ? feature.color : "#FFFFFF", transform: [{scale}] }, selected && styles.selectedFeature]}>
            <FeatureIcon feature={feature} size={circleSize * 0.42}/>
        </Animated.View>
        {position !== "top" && label}
        </Pressable>
    );
}

function FeatureIcon({ feature, size }: { feature: Feature; size: number }) {
    if (feature.id === "milestones") return <Feather name="check-square" size={size} color={feature.color}/>;
    const icons = { career: "briefcase-outline", groups: "people-outline", wayfinder: "location-outline" } as const;
    return <Ionicons name={icons[feature.id]} size={size} color={feature.color}/>;
}

const styles = StyleSheet.create({
    safeArea: { flex: 1, width: "100%", maxWidth: 640, alignSelf: "center", backgroundColor: "#FFFFFF" },
    container: { flex: 1, backgroundColor: "#FFFFFF" },
    scrollContent: { flexGrow: 1, paddingBottom: 110, backgroundColor: "#FFFFFF", alignItems: "center" },
    brandRow: { width: "100%", minHeight: 60, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
    brand: { flexDirection: "row", alignItems: "center", flexShrink: 1 },
    brandIcon: { width: 50, height: 50, alignItems: "center", justifyContent: "center", marginRight: 6 },
    menuPill: { flexDirection: "row", alignItems: "center", gap: 5, minHeight: 44, backgroundColor: PALE, paddingHorizontal: 12, borderRadius: 22 },
    menuText: { fontFamily: FONT, fontSize: 13, fontWeight: "700", color: "#52B3B1" },
    greeting: { fontFamily: FONT, alignSelf: "flex-start", fontSize: 14, fontWeight: 700, color: SECONDARY, marginTop: 8 },
    centerHeading: { width: "100%", alignItems: "center", marginTop: 14, paddingHorizontal: 8 },
    pageTitle: { fontFamily: FONT, fontSize: 26, fontWeight: "700", color: TEXT, textAlign: "center" },
    pageSubtitle: { fontFamily: FONT, marginTop: 6, fontSize: 15, lineHeight: 21, color: SECONDARY, textAlign: "center" },
    compassSection: { marginTop: 12, alignSelf: "center", position: "relative", alignItems: "center", justifyContent: "center" },
    compassHalo: { position: "absolute", backgroundColor: "#F2FAF9", borderWidth: 1, borderColor: "#E6F4F2", overflow: "hidden" },
    panelCircleOne: { position: "absolute", width: 150, height: 150, borderRadius: 75, backgroundColor: "#E8E3FF", opacity: 0.3, left: -70, top: 85 },
    panelCircleTwo: { position: "absolute", width: 135, height: 135, borderRadius: 68, backgroundColor: "#FFE4D4", opacity: 0.28, right: -60, top: -45 },
    panelCircleThree: { position: "absolute", width: 120, height: 120, borderRadius: 60, backgroundColor: "#DFE9FF", opacity: 0.25, right: -40, bottom: -40 },
    compass: { position: "absolute", alignItems: "center", justifyContent: "center", backgroundColor: "#FFFFFF", shadowColor: "#52B3B1", shadowOffset: { width: 0, height: 5 }, shadowOpacity: 0.12, shadowRadius: 12, elevation: 4 },
    compassOuterGlow: { position: "absolute", borderWidth: 6, borderColor: "#DDF3F1", opacity: 0.9 },
    outerRing: { position: "absolute", borderWidth: 2, borderColor: MAIN },
    middleRing: { position: "absolute", borderWidth: 1, borderColor: "#9EDBD8" },
    innerRing: { position: "absolute", borderWidth: 1, borderStyle: "dashed", borderColor: LIGHT },
    direction: { fontFamily: FONT, position: "absolute", fontSize: 14, fontWeight: "700", color: MAIN, zIndex: 4 },
    tickContainer: { position: "absolute" },
    tickWrapper: { position: "absolute", width: "100%", height: "100%", alignItems: "center" },
    tick: { position: "absolute", backgroundColor: MAIN, borderRadius: 2 },
    verticalGuide: { position: "absolute", width: 1, backgroundColor: PALE },
    horizontalGuide: { position: "absolute", height: 1, backgroundColor: PALE },
    needleContainer: { position: "absolute", alignItems: "center", justifyContent: "center", zIndex: 5 },
    needleNorth: { position: "absolute", width: 0, height: 0, top: 0, borderLeftColor: "transparent", borderRightColor: "transparent" },
    needleSouth: { position: "absolute", width: 0, height: 0, bottom: 0, borderLeftColor: "transparent", borderRightColor: "transparent", borderTopColor: "#52B3B1" },
    needleWest: { position: "absolute", width: 0, height: 0, right: "50%", borderTopColor: "transparent", borderBottomColor: "transparent", borderRightColor: "#52B3B1" },
    needleEast: { position: "absolute", width: 0, height: 0, left: "50%", borderTopColor: "transparent", borderBottomColor: "transparent", borderLeftColor: "#52B3B1" },
    centreButton: { position: "absolute", backgroundColor: "#FFFFFF", borderWidth: 3, borderColor: MAIN, alignItems: "center", justifyContent: "center", shadowColor: "#000000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 4, elevation: 3, zIndex: 10 },
    centreDot: { backgroundColor: "#52B3B1" },
    featureLayer: { zIndex: 20 },
    feature: { position: "absolute", width: 90, minHeight: 44, alignItems: "center" },
    featureTop: { width: 180, top: 8, left: "50%", transform: [{ translateX: -90 }] },
    featureBottom: { width: 160, bottom: 8, left: "50%", transform: [{ translateX: -80 }] },
    featureLeft: { left: 4, top: "50%", transform: [{ translateY: -43 }] },
    featureRight: { right: 4, top: "50%", transform: [{ translateY: -43 }] },
    featureCircle: { borderWidth: 2, alignItems: "center", justifyContent: "center", shadowColor: "#000000", shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.08, shadowRadius: 6, elevation: 3 },
    selectedFeature: { borderWidth: 3 },
    featureText: { fontFamily: FONT, marginTop: 7, fontSize: 13, lineHeight: 17, fontWeight: "700", color: TEXT, textAlign: "center" },
    featureTextAbove: { marginTop: 0, marginBottom: 7 },
    tapSection: { alignItems: "center", marginTop: 8, maxWidth: "100%" },
    tapPill: { backgroundColor: PALE, paddingHorizontal: 17, paddingVertical: 9, borderRadius: 20 },
    tapText: { fontFamily: FONT, fontSize: 14, fontWeight: "600", color: "#52B3B1", textAlign: "center" },
    nextStepCard: { width: "100%", maxWidth: 390, marginTop: 18, flexDirection: "row", alignItems: "center", padding: 16, backgroundColor: "#FFFFFF", borderRadius: 20, borderWidth: 1, borderColor: "#DDEFED", shadowColor: "#000000", shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.04, shadowRadius: 8, elevation: 2 },
    nextStepIcon: { width: 46, height: 46, borderRadius: 23, alignItems: "center", justifyContent: "center", backgroundColor: PALE },
    nextStepLabel: { fontFamily: FONT, fontSize: 10, letterSpacing: 1, fontWeight: "700", color: "#52B3B1", marginBottom: 5 },
    resultContent: { flex: 1, marginLeft: 13, marginRight: 7 },
    resultTitle: { fontFamily: FONT, fontSize: 16, fontWeight: "700", color: TEXT },
    resultDescription: { fontFamily: FONT, marginTop: 3, fontSize: 13, lineHeight: 19, color: SECONDARY },
});
