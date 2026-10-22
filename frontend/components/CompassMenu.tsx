import { useCallback, useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, BackHandler, Easing, Platform, StyleSheet, Text, TouchableOpacity, View, useWindowDimensions } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/AppNavigator';

const nativeDriver = Platform.OS !== 'web';
const directions = [
    { label: 'Discover', detail: 'Programmes & careers', route: 'CareerAlignment', icon: 'book' as const, x: 0, y: -1, tint: '#257D80', ink: '#FFFFFF' },
    { label: 'My Journey', detail: 'Your milestones', route: 'Progression', icon: 'flag' as const, x: 1, y: 0, tint: '#FFE3CF', ink: '#975323' },
    { label: 'Navigate', detail: 'Campus wayfinding', route: 'Wayfinder', icon: 'location' as const, x: 0, y: 1, tint: '#DEECF6', ink: '#365D75' },
    { label: 'Connect', detail: 'Groups & messages', route: 'StudyGroups', icon: 'people' as const, x: -1, y: 0, tint: '#D8F0E8', ink: '#257D70' },
] as const;

export default function CompassMenu({ navigation }: { navigation: NativeStackNavigationProp<RootStackParamList, 'Home'> }) {
    const { width, fontScale } = useWindowDimensions();
    const size = Math.min(Math.max(width - 24, 240), 400);
    // Reserve horizontal space outside the ring for the east/west labels.
    const compact = size < 340;
    const radius = size * 0.25;
    const iconSize = compact ? 48 : 56;
    const sideLabelWidth = compact ? 48 : 58;
    const hubSize = compact ? 84 : 94;
    const [expanded, setExpanded] = useState(false);
    const [reduceMotion, setReduceMotion] = useState(false);
    const progress = useRef(new Animated.Value(0)).current;
    const nodes = useRef(directions.map(() => new Animated.Value(0))).current;
    const isOpen = useRef(false);

    useEffect(() => {
        let active = true;
        AccessibilityInfo.isReduceMotionEnabled().then(value => { if (active) setReduceMotion(value); });
        const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduceMotion);
        return () => { active = false; subscription.remove(); };
    }, []);

    const close = useCallback(() => { isOpen.current = false; setExpanded(false); }, []);
    useFocusEffect(useCallback(() => {
        const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
            if (!isOpen.current) return false;
            close(); return true;
        });
        return () => { subscription.remove(); close(); };
    }, [close]));

    useEffect(() => {
        progress.stopAnimation();
        nodes.forEach(node => node.stopAnimation());
        if (reduceMotion) {
            progress.setValue(expanded ? 1 : 0);
            nodes.forEach(node => node.setValue(expanded ? 1 : 0));
            return;
        }
        const animation = Animated.parallel([
            Animated.timing(progress, { toValue: expanded ? 1 : 0, duration: expanded ? 520 : 220, easing: Easing.out(Easing.cubic), useNativeDriver: nativeDriver }),
            expanded ? Animated.stagger(55, nodes.map(node => Animated.spring(node, { toValue: 1, speed: 16, bounciness: 6, useNativeDriver: nativeDriver })))
                : Animated.parallel(nodes.map(node => Animated.timing(node, { toValue: 0, duration: 180, useNativeDriver: nativeDriver }))),
        ]);
        animation.start();
        return () => animation.stop();
    }, [expanded, reduceMotion, progress, nodes]);

    function toggle() { isOpen.current = !isOpen.current; setExpanded(isOpen.current); }
    function choose(route: typeof directions[number]['route']) { close(); navigation.navigate(route); }

    return <View style={styles.wrapper} onAccessibilityEscape={close}>
        <View style={[styles.stage, { width: size, height: size }]}>
            <View pointerEvents="none" style={[styles.halo, { width: size * 0.62, height: size * 0.62, borderRadius: size, left: size * 0.19, top: size * 0.19 }]}/>
            <Animated.View pointerEvents="none" style={[styles.innerHalo, { left: size / 2 - 63, top: size / 2 - 63, transform: [{ scale: progress.interpolate({ inputRange: [0, 1], outputRange: [1, 0.9] }) }] }]}/>
            <Animated.View pointerEvents="none" aria-hidden accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={[styles.ring, { width: radius * 2, height: radius * 2, borderRadius: radius, left: size / 2 - radius, top: size / 2 - radius, opacity: progress.interpolate({ inputRange: [0, 1], outputRange: [0.3, 1] }), transform: [{ scale: progress.interpolate({ inputRange: [0, 1], outputRange: [0.86, 1] }) }, { rotate: progress.interpolate({ inputRange: [0, 1], outputRange: ['-24deg', '0deg'] }) }] }]}>
                {Array.from({ length: 24 }, (_, i) => <View key={i} style={[styles.tick, { left: radius - 1, top: radius - 1, transform: [{ rotate: `${i * 15}deg` }, { translateY: -radius + 9 }], height: i % 6 === 0 ? 10 : 5 }]}/>)}
            </Animated.View>
            <Animated.View pointerEvents="none" aria-hidden style={[styles.cardinals, { opacity: progress, width: radius * 2 - iconSize - 8, height: radius * 2 - iconSize - 8, left: size / 2 - radius + iconSize / 2 + 4, top: size / 2 - radius + iconSize / 2 + 4 }]} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
                <Text style={[styles.cardinal, styles.north]}>N</Text><Text style={[styles.cardinal, styles.east]}>E</Text><Text style={[styles.cardinal, styles.south]}>S</Text><Text style={[styles.cardinal, styles.west]}>W</Text>
            </Animated.View>
            {directions.map((direction, i) => <Animated.View key={direction.label} pointerEvents={expanded ? 'auto' : 'none'} aria-hidden={!expanded} accessibilityElementsHidden={!expanded} importantForAccessibility={expanded ? 'auto' : 'no-hide-descendants'} style={[styles.option, {
                width: direction.x ? iconSize + sideLabelWidth + 6 : 92,
                left: direction.x ? size / 2 - iconSize / 2 - (direction.x < 0 ? sideLabelWidth + 6 : 0) : size / 2 - 46,
                top: size / 2 - iconSize / 2 - (direction.y < 0 ? 31 : 0),
                opacity: nodes[i], transform: [{ translateX: nodes[i].interpolate({ inputRange: [0, 1], outputRange: [0, direction.x * radius] }) }, { translateY: nodes[i].interpolate({ inputRange: [0, 1], outputRange: [0, direction.y * radius] }) }, { scale: nodes[i].interpolate({ inputRange: [0, 1], outputRange: [0.45, 1] }) }],
            }]}>
                <TouchableOpacity disabled={!expanded} focusable={expanded} activeOpacity={0.75} accessibilityRole="button" accessibilityLabel={`${direction.label}. ${direction.detail}`} accessibilityHint={`Open ${direction.detail.toLowerCase()}`} onPress={() => choose(direction.route)} style={[styles.optionButton, direction.x ? { flexDirection: direction.x < 0 ? 'row-reverse' : 'row', gap: 6 } : { flexDirection: direction.y < 0 ? 'column-reverse' : 'column', gap: 7 }]}>
                    <View style={[styles.optionIcon, { backgroundColor: direction.tint, width: iconSize, height: iconSize, borderRadius: iconSize / 2 }]}><Ionicons name={direction.icon} size={compact ? 22 : 25} color={direction.ink}/></View>
                    <Text maxFontSizeMultiplier={1.2} style={[styles.optionLabel, { fontSize: compact ? 11 : 12 }, direction.x ? { width: sideLabelWidth, textAlign: direction.x < 0 ? 'right' : 'left' } : { height: 24 }]}>{direction.label}</Text>
                </TouchableOpacity>
            </Animated.View>)}
            <TouchableOpacity activeOpacity={0.9} accessibilityRole="button" accessibilityLabel={expanded ? 'Close compass' : 'Open compass'} accessibilityHint={expanded ? 'Collapse the four directions' : 'Show Discover, Connect, My Journey and Navigate'} accessibilityState={{ expanded }} onPress={toggle} style={[styles.hub, { width: hubSize, height: hubSize, borderRadius: hubSize / 2, left: size / 2 - hubSize / 2, top: size / 2 - hubSize / 2 }]}>
                <Animated.View pointerEvents="none" style={[styles.needle, { opacity: progress.interpolate({ inputRange: [0, 0.7, 1], outputRange: [1, 0, 0] }), transform: [{ rotate: progress.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '135deg'] }) }] }]}><Ionicons name="compass" size={56} color="#FFFFFF"/></Animated.View>
                <Animated.View pointerEvents="none" style={[styles.closeContent, { opacity: progress }]}><Ionicons name="close-outline" size={30} color="#FFFFFF"/><Text style={styles.closeLabel}>Close</Text></Animated.View>
            </TouchableOpacity>
        </View>
        <View accessibilityLiveRegion="polite" style={styles.caption}>
            <Text style={styles.captionTitle}>{expanded ? 'Where will you go next?' : 'Explore your compass'}</Text>
            <Text style={styles.captionDetail}>{expanded ? 'Choose a direction to get started.' : 'Tap the compass to choose a direction.'}</Text>
        </View>
        {fontScale > 1.2 && expanded ? <View style={styles.accessibleChoices}>{directions.map(direction => <TouchableOpacity key={direction.label} accessibilityRole="button" style={styles.textChoice} onPress={() => choose(direction.route)}><Text style={styles.textChoiceTitle}>{direction.label}</Text><Text style={styles.captionDetail}>{direction.detail}</Text></TouchableOpacity>)}</View> : null}
    </View>;
}

const styles = StyleSheet.create({
    wrapper: { alignItems: 'center' }, stage: { position: 'relative' },
    halo: { position: 'absolute', backgroundColor: '#F0F7F1' },
    innerHalo: { position: 'absolute', width: 126, height: 126, borderRadius: 63, backgroundColor: '#DEEEEA', borderWidth: 8, borderColor: '#EDF6F0' },
    ring: { position: 'absolute', borderWidth: 1.5, borderColor: '#ACD3D2' },
    tick: { position: 'absolute', width: 1.5, backgroundColor: '#ACD3D2' },
    cardinals: { position: 'absolute' }, cardinal: { position: 'absolute', color: '#5F9D9D', fontSize: 10, fontWeight: '600' },
    north: { top: 4, alignSelf: 'center' }, east: { right: 4, top: '47%' }, south: { bottom: 4, alignSelf: 'center' }, west: { left: 4, top: '47%' },
    option: { position: 'absolute' }, optionButton: { alignItems: 'center', justifyContent: 'center', minHeight: 44 },
    optionIcon: { width: 60, height: 60, borderRadius: 30, alignItems: 'center', justifyContent: 'center', borderWidth: 3, borderColor: '#FAFCF9', shadowColor: '#315B5A', shadowOpacity: 0.09, shadowRadius: 8, shadowOffset: { width: 0, height: 3 }, elevation: 2 },
    optionLabel: { color: '#28545A', fontSize: 12, lineHeight: 16, fontWeight: '700', textAlign: 'center' },
    hub: { position: 'absolute', width: 94, height: 94, borderRadius: 47, backgroundColor: '#257D80', borderWidth: 4, borderColor: '#D6EAE4', alignItems: 'center', justifyContent: 'center', shadowColor: '#257D80', shadowOpacity: 0.22, shadowRadius: 14, shadowOffset: { width: 0, height: 5 }, elevation: 5 },
    needle: { position: 'absolute' }, closeContent: { alignItems: 'center' }, closeLabel: { fontSize: 11, fontWeight: '600', color: '#FFFFFF' },
    caption: { paddingHorizontal: 18, alignItems: 'center', minHeight: 52 },
    captionTitle: { color: '#28545A', fontSize: 16, fontWeight: '700', textAlign: 'center' },
    captionDetail: { color: '#597D82', fontSize: 12, lineHeight: 18, marginTop: 5, textAlign: 'center' },
    accessibleChoices: { width: '100%', paddingHorizontal: 20, gap: 8 },
    textChoice: { minHeight: 52, padding: 12, borderRadius: 14, backgroundColor: '#EAF3F0' },
    textChoiceTitle: { color: '#28545A', fontSize: 16, fontWeight: '700', textAlign: 'center' },
});
