import {Platform, Pressable, ScrollView, StyleSheet, Text, View} from 'react-native';
import {SafeAreaView, useSafeAreaInsets} from 'react-native-safe-area-context';
import {Ionicons} from '@expo/vector-icons';
import type {NativeStackScreenProps} from '@react-navigation/native-stack';
import type {RootStackParamList} from '../navigation/AppNavigator';
import MenuButton from '../components/MenuButton';
import NavBar from '../components/NavBar';
import PageHeader from '../components/PageHeader';

export default function WayfinderScreen({navigation}:NativeStackScreenProps<RootStackParamList,'Wayfinder'>){
    const insets = useSafeAreaInsets();
    return <SafeAreaView edges={['top','left','right']} style={styles.root}>
        <ScrollView contentContainerStyle={[styles.content, {paddingBottom: 110 + insets.bottom}]} showsVerticalScrollIndicator={false}>
            <View style={{marginHorizontal: -22}}>
                <PageHeader
                    title="Wayfinder"
                    description="Find a room inside a building, or get directions across campus."
                    navigation={navigation}
                    leftIcon="back"
                    background={true}
                />
            </View>
<Pressable accessibilityRole="button" accessibilityLabel="Choose indoor navigation" style={[styles.card, {marginTop: 8}]} onPress={() => navigation.navigate('IndoorWayfinder')}>                <View style={styles.cardHeader}><View style={[styles.icon, styles.indoorIcon]}><Ionicons name="business-outline" size={29} color="#5F4DD8"/></View><View style={styles.cardHeading}><Text style={styles.cardTitle}>Indoor</Text><Text style={styles.cardSubtitle}>Find rooms in Building 303</Text></View><Ionicons name="chevron-forward" size={22} color="#5F4DD8"/></View>
                <Text style={styles.description}>Look around to recognise your location, then follow in-app AR arrows on a published route.</Text>
                <View style={[styles.badge, styles.indoorIcon]}><Text style={styles.badgeText}>iPhone AR pilot</Text></View>
                <Text style={styles.notice}>{Platform.OS === 'ios' ? 'Requires a compatible iPhone and sign-in. Recognition is not guaranteed.' : 'AR requires a compatible iPhone. You can still open the indoor route screen here.'}</Text>
            </Pressable>
            <Pressable accessibilityRole="button" accessibilityLabel="Choose outdoor navigation" style={styles.card} onPress={() => navigation.navigate('FindRoute')}>
                <View style={styles.cardHeader}><View style={[styles.icon, styles.outdoorIcon]}><Ionicons name="navigate-outline" size={29} color="#257D80"/></View><View style={styles.cardHeading}><Text style={styles.cardTitle}>Outdoor</Text><Text style={styles.cardSubtitle}>Get between campus buildings</Text></View><Ionicons name="chevron-forward" size={22} color="#257D80"/></View>
                <Text style={styles.description}>Choose your destination and travel mode, then open Maps for live turn-by-turn directions.</Text>
                <View style={[styles.badge, styles.outdoorIcon]}><Text style={styles.badgeText}>Campus directions · Maps</Text></View>
                <Text style={styles.notice}>Uses Apple Maps on iPhone or Google Maps on Android and web. No AR camera needed.</Text>
            </Pressable>
            <View style={styles.tip}><Ionicons name="information-circle-outline" size={22} color="#257D80"/><Text style={styles.tipText}>Going from outside to a room? Finish your outdoor trip, then return here and choose Indoor. The two routes do not switch automatically.</Text></View>
        </ScrollView>
        <NavBar navigation={navigation} activeScreen="Wayfinder"/>
    </SafeAreaView>;
}

const styles = StyleSheet.create({
    root: {flex: 1, width: '100%', maxWidth: 640, alignSelf: 'center', backgroundColor: '#FFFFFF'},
    content: {paddingHorizontal: 22},
    header: {flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 22},
    back: {width: 44, height: 44, borderRadius: 22, backgroundColor: '#EAF7F5', alignItems: 'center', justifyContent: 'center'},
    title: {flex: 1, fontSize: 25, fontWeight: '700', color: '#171717'},
    intro: {backgroundColor: '#F2FAF9', borderRadius: 22, padding: 20, marginBottom: 20},
    introTitle: {fontSize: 21, fontWeight: '700', color: '#171717', marginBottom: 8},
    description: {fontSize: 14, lineHeight: 21, color: '#555555'},
    card: {padding: 20, borderWidth: 1, borderColor: '#DDEFED', borderRadius: 22, marginBottom: 16, backgroundColor: '#FFFFFF'},
    cardHeader: {flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 14},
    icon: {width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center'},
    indoorIcon: {backgroundColor: '#E8E3FF'}, outdoorIcon: {backgroundColor: '#EAF7F5'},
    cardHeading: {flex: 1, minWidth: 0}, cardTitle: {fontSize: 20, fontWeight: '700', color: '#171717'},
    cardSubtitle: {fontSize: 13, lineHeight: 19, color: '#666666', marginTop: 3},
    badge: {alignSelf: 'flex-start', borderRadius: 14, paddingVertical: 5, paddingHorizontal: 10, marginTop: 14},
    badgeText: {fontSize: 12, fontWeight: '600', color: '#334C51'}, notice: {fontSize: 12, lineHeight: 18, color: '#666666', marginTop: 9},
    tip: {flexDirection: 'row', gap: 10, paddingVertical: 8}, tipText: {flex: 1, fontSize: 13, lineHeight: 20, color: '#555555'},
});
