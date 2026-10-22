import {useCallback,useState} from 'react';
import {useFocusEffect} from '@react-navigation/native';
import {Switch,Text,View} from 'react-native';
import {ConnectedScreen,Action,ui,useOperation,type AppNavigation} from '../../components/ConnectedScreen';
import {useSession} from '../../context/SessionContext';
import {studentRequest} from '../../services/studentApi';
type Preferences={messages:boolean;friend_requests:boolean};
export default function NotificationSettingsScreen({navigation}:{navigation:AppNavigation}){
    const {auth}=useSession(),{busy,notice,run}=useOperation();
    const [preferences,setPreferences]=useState<Preferences|null>(null),[error,setError]=useState(''),[retry,setRetry]=useState(0);
    useFocusEffect(useCallback(()=>{
        let active=true;setPreferences(null);setError('');
        if(auth)void studentRequest<Preferences>('/notifications/preferences',auth.access_token)
            .then(result=>{if(active)setPreferences({messages:result.messages,friend_requests:result.friend_requests});})
            .catch(e=>{if(active)setError(e.message);});
        return()=>{active=false;};
    },[auth,retry]));
    return <ConnectedScreen title="Notification settings" navigation={navigation} section="Profile" account>
        <Text style={ui.copy}>Choose what appears in your in-app notification inbox. Switching these off does not delete messages or requests. OS push notifications require separate Apple/Google delivery credentials and are not enabled.</Text>
        {preferences?(Object.keys(preferences) as (keyof Preferences)[]).map(key=><View key={key} style={ui.row}><Text style={ui.copy}>{key==='messages'?'Unread messages':'Friend requests'}</Text><Switch trackColor={{ false: '#D0D0D0', true: '#CFEFED' }} thumbColor={preferences[key] ? '#52B3B1' : '#F5F5F5'}accessibilityLabel={key==='messages'?'Show unread message notifications':'Show friend request notifications'} disabled={busy} value={preferences[key]} onValueChange={value=>setPreferences({...preferences,[key]:value})}/></View>):<Text>{error||'Loading preferences…'}</Text>}
        {!!error&&<Action title="Retry" onPress={()=>setRetry(n=>n+1)}/>}
        <Action title="Save preferences" disabled={!preferences||busy} onPress={()=>{if(auth&&preferences)void run(async()=>{await studentRequest('/notifications/preferences',auth.access_token,'PUT',preferences);},'Preferences saved.');}}/>
        {!!notice&&<Text accessibilityRole="alert">{notice}</Text>}
    </ConnectedScreen>;
}
