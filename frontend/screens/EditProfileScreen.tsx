import { useEffect, useState } from 'react';
import { ActivityIndicator, Image, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { compass as s } from '../components/CompassStyles';
import { preferenceTerms, togglePreference } from '../services/preferenceHelpers';
import { useSession } from '../context/SessionContext';
import { studentRequest, type Profile } from '../services/studentApi';
import PageHeader from '../components/PageHeader';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ui } from '../components/ConnectedScreen';

export default function EditProfileScreen({ navigation }: any) {
    const { auth, updateUser } = useSession();
    const [name, setName] = useState('');
    const [interests, setInterests] = useState('');
    const [careers, setCareers] = useState('');
    const [matching,setMatching]=useState(false);
    const [photo,setPhoto]=useState<string|null>(null),[photoNotice,setPhotoNotice]=useState('');
    const [loaded, setLoaded] = useState(false);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    const [attempt, setAttempt] = useState(0);
    useEffect(() => {
        let active = true;
        setLoaded(false);
        setError(''); setName(''); setInterests(''); setCareers('');
        if (auth) studentRequest<Profile>('/profile/me', auth.access_token).then(p => {
            if (!active) return;
            setName(p.user.display_name); setInterests(p.interests.join(', '));
            setCareers(p.career_interests.join(', ')); setLoaded(true);
            setMatching(p.matching_enabled);
        }).catch(e => { if (active) setError(e.message); });
        if(auth)void studentRequest<{base64:string|null}>('/profile/me/photo',auth.access_token).then(result=>{if(active)setPhoto(result.base64);}).catch(()=>{if(active)setPhotoNotice('Could not load your photo. Profile fields remain available.');});
        return () => { active = false; };
    }, [auth, attempt]);
    async function save() {
        if (!auth || busy || !loaded || !name.trim()) return;
        setBusy(true);
        setError('');
        const terms = preferenceTerms;
        try {
            const saved = await studentRequest<Profile>('/profile/me', auth.access_token, 'PATCH', {
                display_name: name.trim(), interests: terms(interests), career_interests: terms(careers),
                matching_enabled:matching,
            });
            await updateUser(saved.user, auth.access_token);
            navigation.goBack();
        } catch (e) { setError(e instanceof Error ? e.message : 'Could not save. Retry.'); }
        finally { setBusy(false); }
    }
    async function choosePhoto(){
        if(!auth||busy)return;
        setBusy(true);setPhotoNotice('');
        try{
            const result=await ImagePicker.launchImageLibraryAsync({mediaTypes:['images'],allowsEditing:true,aspect:[1,1],quality:0.6,base64:true});
            if(result.canceled)return;
            const image=result.assets[0].base64;
            if(!image)throw new Error('Could not read this photo. Choose a JPEG or PNG.');
            await studentRequest('/profile/me/photo',auth.access_token,'PUT',{base64:image});
            const saved=await studentRequest<{base64:string|null}>('/profile/me/photo',auth.access_token);
            setPhoto(saved.base64);setPhotoNotice('Photo saved. It is private to your profile; GPS and original metadata are not retained.');
        }catch(e){setPhotoNotice(e instanceof Error?e.message:'Could not save the photo.');}
        finally{setBusy(false);}
    }
    const editable = loaded && !busy;
    function chips(choices: string[], value: string, update: (value: string) => void) {
        return <View style={styles.chips}>{choices.map(choice => {
            const selected = preferenceTerms(value).some(term => term.toLowerCase() === choice.toLowerCase());
            return <Pressable key={choice} accessibilityRole="checkbox" accessibilityLabel={choice}
                accessibilityState={{ checked: selected, disabled: !editable }} disabled={!editable}
                onPress={() => update(togglePreference(value, choice))}
                style={[styles.chip, selected && styles.selected]}>
                <Text style={styles.chipText}>{selected ? '✓ ' : '+ '}{choice}</Text>
            </Pressable>;
        })}</View>;
    }
    return <SafeAreaView edges={['top','left','right']} style={s.page}><KeyboardAvoidingView style={s.page} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">
        <View style={{ marginHorizontal: -20}}><PageHeader title="Edit Profile" navigation={navigation} background={false} leftIcon="back" /></View>
            <Text style={ui.copy}>Update your name and what interests you. Your choices help personalise programme suggestions.</Text>        {!auth ? <View style={s.card}><Text style={s.copy}>Sign in to edit and save your profile.</Text>
            <Pressable accessibilityRole="button" style={s.button} onPress={() => navigation.navigate('Login')}><Text style={s.buttonText}>Sign in</Text></Pressable>
        </View> : !loaded ? <View style={s.card}>
            {error ? <><Text accessibilityRole="alert" style={s.error}>{error}</Text><Pressable accessibilityRole="button" style={s.button} onPress={() => setAttempt(a => a + 1)}><Text style={s.buttonText}>Retry loading profile</Text></Pressable></> : <><ActivityIndicator color="#287d7b" /><Text style={s.copy}>Loading your saved profile…</Text></>}
        </View> : <>
            <View style={s.card}><Text style={s.title}>Your profile photo</Text><Text style={s.copy}>Optional and private to your account. Choose a JPEG/PNG under 1 MB and 4 megapixels. Photo changes save immediately.</Text>{photo&&<Image accessibilityLabel="Your profile photo" source={{uri:`data:image/jpeg;base64,${photo}`}} style={{width:96,height:96,borderRadius:48}}/>}<Pressable accessibilityRole="button" disabled={busy} style={s.button} onPress={()=>void choosePhoto()}><Text style={s.buttonText}>Choose photo</Text></Pressable>{photo&&<Pressable accessibilityRole="button" disabled={busy} style={s.button} onPress={()=>{if(auth){setBusy(true);void studentRequest('/profile/me/photo',auth.access_token,'DELETE').then(()=>{setPhoto(null);setPhotoNotice('Photo removed.');}).catch(e=>setPhotoNotice(e.message)).finally(()=>setBusy(false));}}}><Text style={s.buttonText}>Remove photo</Text></Pressable>}{!!photoNotice&&<Text accessibilityRole="alert">{photoNotice}</Text>}</View>
            <View style={s.card}>
                <Text style={s.title}>About you</Text>
                <Text style={styles.label}>Display name</Text>
                <TextInput style={s.input} accessibilityLabel="Display name" value={name} onChangeText={setName} editable={editable} autoCapitalize="words" placeholder="Your name" placeholderTextColor="#788783" />
                {!name.trim() && <Text style={s.error}>Enter a display name to save your profile.</Text>}
            </View>
            <View style={s.card}>
                <Text style={s.title}>Subjects & interests</Text>
                <Text style={s.copy}>Tap to select or remove. You can also type your own below.</Text>
                {chips(['Biology', 'Public health', 'Chemistry', 'Technology', 'Nutrition', 'Psychology'], interests, setInterests)}
                <Text style={styles.label}>Hobbies & activities</Text>
                {chips(['Football', 'Hiking', 'Cooking', 'Gaming', 'Volunteering', 'Photography', 'Music', 'Swimming'], interests, setInterests)}
                <Text style={styles.label}>Your interests</Text>
                <TextInput style={[s.input, styles.multiline]} accessibilityLabel="Interests" value={interests} onChangeText={setInterests} editable={editable} multiline placeholder="For example: biology, hiking, music" placeholderTextColor="#788783" />
                <Text style={styles.hint}>Separate each interest with a comma. Hobbies may not match catalogue keywords.</Text>
            </View>
            <View style={s.card}>
                <Text style={s.title}>Career goals</Text>
                <Text style={s.copy}>What would you like to explore? It’s fine to leave this empty if you’re still deciding.</Text>
                {chips(preferenceTerms(careers), careers, setCareers)}
                <Text style={styles.label}>Your career interests</Text>
                <TextInput style={[s.input, styles.multiline]} accessibilityLabel="Career interests" value={careers} onChangeText={setCareers} editable={editable} multiline placeholder="For example: nurse, researcher" placeholderTextColor="#788783" />
                <Text style={styles.hint}>Separate careers with commas. Tap a selected chip to remove it.</Text>
            </View>
            <View style={s.card}><Text style={s.title}>Opt-in peer suggestions</Text><Text style={s.copy}>Allow signed-in students who also opted in to discover your name when you share declared interests. Your email stays private. You can turn this off at any time.</Text><Switch accessibilityLabel="Enable shared-interest peer suggestions" value={matching} onValueChange={setMatching} disabled={!editable} trackColor={{ true: "#CFEFED" }} thumbColor="#52B3B1" /></View>
            {error ? <Text accessibilityRole="alert" style={s.error}>{error}</Text> : null}
            <Pressable accessibilityRole="button" accessibilityState={{ disabled: !editable || !name.trim(), busy }} disabled={!editable || !name.trim()} style={[s.button, (!editable || !name.trim()) && styles.disabled]} onPress={save}>
                <Text style={s.buttonText}>{busy ? 'Saving changes…' : 'Save changes'}</Text>
            </Pressable>
            <Pressable accessibilityRole="button" disabled={busy} onPress={() => navigation.goBack()} style={styles.cancel}><Text style={s.link}>Cancel — keep my profile</Text></Pressable>
            <Text style={styles.hint}>Changes are only saved when you tap Save changes. Password changes are available in Settings.</Text>
        </>}
      </ScrollView>
    </KeyboardAvoidingView></SafeAreaView>;
}

const styles = StyleSheet.create({
    icon: { width: 48, height: 48, borderRadius: 24, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' },
    label: { color: '#173b39', fontSize: 15, fontWeight: '600' },
    hint: { color: '#626f6d', fontSize: 13, lineHeight: 20 },
    chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    chip: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 14, paddingVertical: 10, borderRadius: 22, borderWidth: 1, borderColor: '#dbe8e5' },
    selected: { borderColor: '#52B3B1', backgroundColor: '#CFEFED' },
    chipText: { color: '#173b39', fontSize: 14 },
    multiline: { minHeight: 90, textAlignVertical: 'top' },
    disabled: { opacity: 0.5 },
    cancel: { alignItems: 'center', minHeight: 44 },
});
