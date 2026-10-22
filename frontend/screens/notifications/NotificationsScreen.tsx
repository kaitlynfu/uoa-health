
import {useCallback,useState} from 'react';
import {useFocusEffect} from '@react-navigation/native';
import {AppState,Text,View} from 'react-native';
import {ConnectedScreen,Action,ui,type AppNavigation} from '../../components/ConnectedScreen';
import {studentRequest} from '../../services/studentApi';
import {useSession} from '../../context/SessionContext';
import {messageDate} from '../../services/chatPresentation';

type Activity={key:string;kind:'friend'|'direct'|'group';target_id:number;title:string;created_at:string};

export default function NotificationsScreen({navigation}:{navigation:AppNavigation}) {
    const {auth}=useSession();
    const [items,setItems]=useState<Activity[]>([]),[error,setError]=useState(''),[busy,setBusy]=useState(false),[retry,setRetry]=useState(0);

    useFocusEffect(useCallback(()=>{
        let active=true,working=false;
        async function load(){
            if(!auth||working||AppState.currentState!=='active')return;
            working=true;setBusy(true);
            try{const result=await studentRequest<Activity[]>('/notifications',auth.access_token);if(active){setItems(result);setError('');}}
            catch(e){if(active)setError((e as Error).message);}
            finally{working=false;if(active)setBusy(false);}
        }
        void load();const timer=setInterval(()=>void load(),10000);
        const listener=AppState.addEventListener('change',state=>{if(state==='active')void load();});
        return()=>{active=false;clearInterval(timer);listener.remove();};
    },[auth,retry]));

    return <ConnectedScreen title="Notifications" description="Keep up with the latest updates and activity." background navigation={navigation} section="Profile" leftIcon="back" account>
        <Text style={ui.copy}>Unread conversations and incoming friend requests. Activity clears when you read the chat or respond to the request. This is an in-app inbox, not device push delivery.</Text>
        {!items.length&&<Text>{busy?'Loading activity…':'No unread activity.'}</Text>}
        {items.map(item=><View style={ui.card} key={item.key}><Text style={ui.title}>{item.title}</Text><Text style={ui.copy}>{messageDate(item.created_at)}</Text><Action title={item.kind==='friend'?'Review requests':'Open conversation'} onPress={()=>item.kind==='friend'?navigation.navigate('Friends',{tab:'Requests'}):navigation.navigate('Chat',{targetId:item.target_id,isGroup:item.kind==='group'})}/></View>)}
        {!!error&&<Text accessibilityRole="alert">{error}</Text>}
        <Action title="Refresh activity" disabled={busy} onPress={()=>setRetry(n=>n+1)}/>
        <Action title="Notification settings" onPress={()=>navigation.navigate('NotificationSettings')}/>
    </ConnectedScreen>;
}
