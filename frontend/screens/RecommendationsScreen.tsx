import { useCallback, useState } from 'react';
import { APP_NAME } from '../constants/brand';
import { useFocusEffect } from '@react-navigation/native';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';
import { useSession } from '../context/SessionContext';
import { studentRequest, type Profile } from '../services/studentApi';
import { getPersonalisedRecommendations } from '../services/api';
import type { PersonalisedRecommendation } from '../types/programme';
import { compass as s } from '../components/CompassStyles';
import PageHeader from '../components/PageHeader';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function RecommendationsScreen({ navigation }: any) {
  const { auth, preferences } = useSession();
  const [items, setItems] = useState<PersonalisedRecommendation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [hasPreferences, setHasPreferences] = useState(false);
  const [preferenceCount, setPreferenceCount] = useState(0);
  const [attempt, setAttempt] = useState(0);
  useFocusEffect(useCallback(() => {
    let active = true;
    setLoading(true); setError(''); setItems([]);
    async function load() {
      try {
        const p = auth ? await studentRequest<Profile>('/profile/me', auth.access_token) : preferences;
        const has = p.interests.length + p.career_interests.length > 0;
        if (active) { setHasPreferences(has); setPreferenceCount(p.interests.length + p.career_interests.length); }
        const results = has ? await getPersonalisedRecommendations({interests:p.interests, career_goals:p.career_interests, limit:9}) : [];
        if (active) setItems(results);
      } catch { if (active) setError('Could not load your suggestions. Please try again.'); }
      finally { if (active) setLoading(false); }
    }
    void load();
    return () => { active = false; };
  }, [auth?.access_token, preferences, attempt]));
    return <SafeAreaView edges={['top','left','right']} style={s.page}><PageHeader title="" navigation={navigation} leftIcon="back" background={false} /><ScrollView style={s.page} contentContainerStyle={s.content}>    <View style={s.hero}><Text style={s.brand}>{APP_NAME.toUpperCase()} · FOR YOU</Text><Text style={s.heroTitle}>Explore your possibilities</Text><Text style={s.heroCopy}>The percentage shows how many of your selected interests and career goals have a keyword match in the catalogue. Partial keyword matches count; this is not suitability or admission probability.</Text></View>
    <Pressable accessibilityRole="button" onPress={() => navigation.navigate('Onboarding')}><Text style={s.link}>Change interests and career goals →</Text></Pressable>
    {loading ? <ActivityIndicator accessibilityLabel="Loading suggestions" /> : error ? <View style={s.card}><Text accessibilityRole="alert" style={s.error}>{error}</Text><Pressable accessibilityRole="button" onPress={() => setAttempt(a => a + 1)}><Text style={s.link}>Try again</Text></Pressable></View> : !hasPreferences ? <View style={s.card}><Text style={s.title}>Make it yours</Text><Text style={s.copy}>Add some interests or career goals to get personalised suggestions. You can always browse without them.</Text></View> : !items.length ? <View style={s.card}><Text style={s.title}>No matches yet</Text><Text style={s.copy}>Try broader subjects or different career interests.</Text></View> : items.map(p => <Pressable key={p.id} style={s.card} accessibilityRole="button" onPress={() => navigation.navigate('ProgrammeDetails', {programmeId:p.id})}><Text style={s.pill}>{Math.round(100 * Math.min(preferenceCount, p.matched_interests.length + p.matched_career_goals.length) / Math.max(1, preferenceCount))}% of preferences matched</Text><Text style={s.title}>{p.name}</Text><Text style={s.copy}>Interests matched: {p.matched_interests.join(", ") || "None"}</Text><Text style={s.copy}>Career goals matched: {p.matched_career_goals.join(", ") || "None"}</Text><Text style={s.copy}>Ranked using weighted catalogue keyword relevance.</Text><Text style={s.link}>Explore programme →</Text></Pressable>)}
    <Pressable accessibilityRole="button" onPress={() => navigation.navigate('Programmes')}><Text style={s.link}>Browse all programmes →</Text></Pressable>
    </ScrollView></SafeAreaView>;
}
