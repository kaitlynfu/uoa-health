import { useEffect, useState } from 'react';
import { APP_NAME } from '../constants/brand';
import { Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { compass as s } from '../components/CompassStyles';
import { useSession } from '../context/SessionContext';
import { studentRequest, type Profile, type CareerRecord } from '../services/studentApi';
import PageHeader from '../components/PageHeader';
import { SafeAreaView } from 'react-native-safe-area-context';

import { preferenceTerms, togglePreference } from '../services/preferenceHelpers';

export default function OnboardingScreen({ navigation }: any) {
  const { auth, preferences, setPreferences } = useSession();
  const [interests, setInterests] = useState(preferences.interests.join(', '));
  const [careers, setCareers] = useState(preferences.career_interests.join(', '));
  const [catalogue, setCatalogue] = useState<CareerRecord[]>([]);
  const [careerSearch, setCareerSearch] = useState('');
  const [careerError, setCareerError] = useState('');
  const [careerLoading, setCareerLoading] = useState(true);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let active = true;
    setCareerLoading(true); setCareerError('');
    studentRequest<CareerRecord[]>('/careers?limit=200').then(rows => { if (active) setCatalogue(rows); })
      .catch(() => { if (active) setCareerError('Could not load career choices. You can still type your own.'); })
      .finally(() => { if (active) setCareerLoading(false); });
    return () => { active = false; };
  }, [attempt]);
  function chips(choices:string[], value:string, update:(value:string)=>void) {
    return <View style={{flexDirection:'row',flexWrap:'wrap',gap:8}}>{choices.map(choice => {
      const selected = preferenceTerms(value).some(x => x.toLowerCase() === choice.toLowerCase());
      return <Pressable key={choice} accessibilityRole="checkbox" accessibilityLabel={choice} accessibilityState={{checked:selected, disabled:loading || busy}} disabled={loading || busy} onPress={() => update(togglePreference(value,choice))} style={{borderWidth:1,borderColor:selected?'#287d7b':'#dbe8e5',backgroundColor:selected?'#CFEFED':'#fff',borderRadius:18,padding:12}}><Text style={{color:'#245b57'}}>{selected ? '✓ ' : '+ '}{choice}</Text></Pressable>;
    })}</View>;
  }
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(!!auth);
  const [error, setError] = useState('');
  const [loadFailed, setLoadFailed] = useState(false);
  const [profileAttempt, setProfileAttempt] = useState(0);
  useEffect(() => {
    let active = true;
    setLoadFailed(false); setError(''); setLoading(!!auth);
    if (!auth) { setLoading(false); return; }
    studentRequest<Profile>('/profile/me', auth.access_token).then(p => {
      if (active) { setInterests(p.interests.join(', ')); setCareers(p.career_interests.join(', ')); }
    }).catch(() => { if (active) { setLoadFailed(true); setError('Could not load your saved preferences. Retry before editing so we do not overwrite them.'); } })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [auth?.access_token, profileAttempt]);
  async function save() {
    if (busy || loading || loadFailed) return;
    const terms = preferenceTerms;
    const value = { interests: terms(interests), career_interests: terms(careers) };
    setBusy(true); setError('');
    try {
      if (auth) await studentRequest('/profile/me', auth.access_token, 'PATCH', value);
      setPreferences(value);
      navigation.replace('Home');
    } catch { setError('Could not save your preferences. Please try again.'); }
    finally { setBusy(false); }
  }
  return <SafeAreaView edges={['top','left','right']} style={s.page}><PageHeader title="" navigation={navigation} leftIcon="back" /><ScrollView style={s.page} contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">    <View style={s.hero}><Text style={s.brand}>{APP_NAME.toUpperCase()} · MAKE IT YOURS</Text><Text style={s.heroTitle}>What interests you?</Text><Text style={s.heroCopy}>Tell us what you enjoy and where you might like to go. Still deciding? You can skip this and explore.</Text></View>
    <View style={s.card}><Text style={s.title}>Subjects and interests</Text><Text style={s.copy}>Tap subjects you enjoy, or add your own below.</Text>
      {chips(['Biology','Public health','Chemistry','Technology','Nutrition','Psychology'], interests, setInterests)}
      <Text style={s.title}>Hobbies and activities</Text>
      {chips(['Football','Hiking','Cooking','Gaming','Volunteering','Photography','Music','Swimming'], interests, setInterests)}
      <Text style={s.copy}>Other interests (comma-separated). Hobbies may not match catalogue keywords.</Text><TextInput accessibilityLabel="Interests" style={s.input} value={interests} onChangeText={setInterests} editable={!loading && !busy} placeholder="What would you like to study?" />
      <Text style={s.title}>Preferred careers</Text><Text style={s.copy}>Search real catalogue careers and tap to select. You can also enter your own.</Text>
      <TextInput style={s.input} accessibilityLabel="Search career choices" placeholder="Search careers, e.g. nurse" value={careerSearch} onChangeText={setCareerSearch} />
      {careerLoading ? <Text style={s.copy}>Loading career choices…</Text> : careerError ? <Pressable accessibilityRole="button" onPress={() => setAttempt(a=>a+1)}><Text style={s.error}>{careerError} Tap to retry.</Text></Pressable> : <>
        {chips(catalogue.filter(c=>c.name.toLowerCase().includes(careerSearch.trim().toLowerCase())).map(c=>c.name), careers, setCareers)}
        {!catalogue.some(c=>c.name.toLowerCase().includes(careerSearch.trim().toLowerCase())) && <Text style={s.copy}>No matching careers. Add your own below.</Text>}
      </>}
      <Text style={s.copy}>Selected careers and any other goals (comma-separated)</Text><TextInput accessibilityLabel="Preferred careers" style={s.input} value={careers} onChangeText={setCareers} editable={!loading && !busy} placeholder="Careers you are curious about" />
      <Text style={s.copy}>{auth ? 'Saved to your profile. You can change these later.' : 'Guest preferences stay only in this session and clear when the app closes.'}</Text>
      {error ? <Text style={s.error} accessibilityRole="alert">{error}</Text> : null}
      {loadFailed && <Pressable accessibilityRole="button" onPress={() => setProfileAttempt(a=>a+1)}><Text style={s.link}>Retry loading preferences</Text></Pressable>}
      <Pressable accessibilityRole="button" disabled={busy || loading || loadFailed} style={[s.button, (busy || loading || loadFailed) && {opacity:0.5}]} onPress={() => void save()}><Text style={s.buttonText}>{loading ? 'Loading…' : busy ? 'Saving…' : 'Find my direction →'}</Text></Pressable>
      <Pressable accessibilityRole="button" disabled={busy} onPress={() => navigation.replace('Home')}><Text style={s.link}>Skip for now</Text></Pressable>
    </View>
    </ScrollView>
  </SafeAreaView>;
}
