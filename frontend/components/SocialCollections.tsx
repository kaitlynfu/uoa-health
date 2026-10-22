import {useCallback,useRef,useState} from 'react';
import {useFocusEffect} from '@react-navigation/native';
import {AppState,Text,View} from 'react-native';
import {Action,ui,type AppNavigation} from './ConnectedScreen';
import {Section,SocialTile,Unavailable} from './SocialDesign';
import {useSession} from '../context/SessionContext';
import {getInbox,getSavedGroups,getJoinedGroups,setGroupSaved,type Conversation,type SocialGroup} from '../services/socialFeatures';
export function SocialCollection({kind,navigation}:{kind:'inbox'|'saved'|'joined';navigation:AppNavigation}) {
    const {auth}=useSession();const token=auth?.access_token;
    const [items,setItems]=useState<(Conversation|SocialGroup)[]>([]),[error,setError]=useState(''),[busy,setBusy]=useState(true),[more,setMore]=useState(false);
    const generation=useRef(0),working=useRef(false);
    const load=useCallback(async(offset:number,version:number)=>{
        working.current=true;setBusy(true);setError('');
        try {
            if(!token)return;
            const page=kind==='inbox'?await getInbox(token,offset):kind==='joined'?await getJoinedGroups(token,offset):await getSavedGroups(token,offset);
            if(generation.current!==version)return;
            setItems(previous=>offset?[...previous,...page]:page);setMore(page.length===50);
        }catch(e){if(generation.current===version)setError((e as Error).message);}
        finally{if(generation.current===version){setBusy(false);working.current=false;}}
    },[kind,token]);
    useFocusEffect(useCallback(()=>{
        const version=++generation.current;setItems([]);setMore(false);void load(0,version);
        const refresh=()=>{if(kind==='inbox'&&AppState.currentState==='active'&&!working.current)void load(0,version);};
        const timer=kind==='inbox'?setInterval(refresh,10000):undefined;
        const listener=AppState.addEventListener('change',state=>{if(state==='active')refresh();});
        return()=>{generation.current++;working.current=false;if(timer)clearInterval(timer);listener.remove();};
    },[load]));
    return <View style={{gap:12}}>
        <Section title={kind==='inbox'?'Recent conversations':kind==='joined'?'Groups you joined':'Saved for later'} action={busy?'Loading…':'Refresh'} onPress={()=>{if(!working.current)void load(0,generation.current);}}/>
        {busy&&<Text>Loading…</Text>}{!!error&&<Text accessibilityRole="alert">{error}</Text>}
        {!busy&&!error&&items.length===0&&<Unavailable title={kind==='inbox'?'Start a conversation':kind==='joined'?'Find your study group':'Keep a group for later'} icon={kind==='inbox'?'chatbubbles-outline':'people-outline'}>{kind==='inbox'?'Choose Find a friend or My groups above to start chatting.':kind==='joined'?'Explore groups below, open one you like and tap Join group.':'Open a group and tap Save group. You can come back to join when you’re ready.'}</Unavailable>}
        {items.map(item=>'last_message' in item?
            <SocialTile key={`${item.kind}:${item.target_id}`} title={`${item.name}${item.unread_count?` · ${item.unread_count} unread`:''}`} detail={item.last_message.content} icon="chatbubbles-outline" onPress={()=>navigation.navigate('Chat',{targetId:item.target_id,isGroup:item.kind==='group'})}/>:
            <View key={item.id} style={{gap:6}}><SocialTile title={item.name} detail={[item.course,item.study_format,item.location].filter(Boolean).join(' · ')||'Open group details'} icon="people-outline" onPress={()=>navigation.navigate('GroupDetails',{groupId:item.id,groupName:item.name})}/>
                {kind==='saved'&&<Action title={`Unsave ${item.name}`} variant="secondary" disabled={busy} onPress={()=>{
                    if(!token||working.current)return;working.current=true;setBusy(true);setError('');const version=generation.current;
                    void setGroupSaved(token,item.id,false).then(()=>{if(generation.current===version)void load(0,version);}).catch(e=>{if(generation.current===version){setError(e.message);setBusy(false);working.current=false;}});
                }}/>}</View>)}
        {more&&<Action title="Show more" variant="secondary" disabled={busy} onPress={()=>{if(!working.current)void load(items.length,generation.current);}}/>}
    </View>;
}
