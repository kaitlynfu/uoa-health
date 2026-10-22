// Preserve MJ's chat bubble/composer layout, with bounded history and live refresh.
import {useCallback,useRef,useState} from 'react';
import {useFocusEffect} from '@react-navigation/native';
import {AppState,FlatList,KeyboardAvoidingView,Platform,Pressable,StyleSheet,Text,TextInput,View,type ViewToken} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {Ionicons} from '@expo/vector-icons';
import type {NativeStackScreenProps} from '@react-navigation/native-stack';
import type {RootStackParamList} from '../../navigation/AppNavigator';
import PageHeader from '../../components/PageHeader';
import {Action,ui,useOperation} from '../../components/ConnectedScreen';
import {useSession} from '../../context/SessionContext';
import {studentRequest,sendMessage,type SocialMessage} from '../../services/studentApi';
import {positiveId,messageTarget} from '../../services/socialNavigation';
import {markConversationRead} from '../../services/socialFeatures';
import {mergeMessages,messageDate} from '../../services/chatPresentation';

const pageSize=50;
export default function ChatScreen({navigation,route}:NativeStackScreenProps<RootStackParamList,'Chat'>) {
    const {auth}=useSession();
    const [content,setContent]=useState(''),[messages,setMessages]=useState<SocialMessage[]>([]);
    const [loading,setLoading]=useState(true),[error,setError]=useState(''),[name,setName]=useState('Conversation');
    const [olderBusy,setOlderBusy]=useState(false),[hasOlder,setHasOlder]=useState(false);
    const [blocked,setBlocked]=useState(false),[confirmBlock,setConfirmBlock]=useState(false),[showOptions,setShowOptions]=useState(false);
    const [reporting,setReporting]=useState<number|null>(null),[reason,setReason]=useState('');
    const {busy,notice,run,alive}=useOperation();
    const list=useRef<FlatList<SocialMessage>>(null), nearBottom=useRef(true), scrollNext=useRef(true);
    const refresh=useRef<()=>Promise<void>>(async()=>{}), focused=useRef(false);
    const latestReceived=useRef(0);
    const [readError,setReadError]=useState('');
    const reading=useRef<{token:string;kind:'direct'|'group';id:number;through:number}|null>(null);
    const viewConfig=useRef({itemVisiblePercentThreshold:50,minimumViewTime:500}).current;
    const onVisible=useRef(({viewableItems}:{viewableItems:ViewToken<SocialMessage>[]})=>{
        const context=reading.current;
        if(!context||AppState.currentState!=='active')return;
        const through=Math.max(0,...viewableItems.filter(v=>v.isViewable).map(v=>v.item.id));
        if(through<=context.through)return;
        context.through=through;
        void markConversationRead(context.token,context.kind,context.id,through).then(()=>{
            if(reading.current===context)setReadError('');
        }).catch(()=>{if(reading.current===context){context.through=0;setReadError('Read status could not be saved. Refresh to retry.');}});
    }).current;
    let id:number|null=null;try{id=positiveId(route.params?.targetId);}catch{}
    const isGroup=route.params?.isGroup===true, kind=isGroup?'group':'direct';
    const path=`/social/messages/${kind}/${id}`;
    useFocusEffect(useCallback(()=>{
        let current=true, fetching=false, first=true;
        focused.current=true;setError('');setReadError('');setLoading(true);
        latestReceived.current=0;
        reading.current=auth&&id?{token:auth.access_token,kind,id,through:0}:null;
        async function load(){
            if(!current||fetching||AppState.currentState!=='active'||!auth||!id)return;
            fetching=true;
            try{
                // Forward paging catches up without silently dropping messages when
                // more than one page arrives between refreshes or while offline.
                for(let page=0;page<4&&current;page++){
                    const initial=first;
                    const cursor=initial?'':`&after_id=${latestReceived.current}`;
                    const result=await studentRequest<SocialMessage[]>(`${path}?limit=${pageSize}${cursor}`,auth.access_token);
                    if(!current)break;
                    scrollNext.current=initial||nearBottom.current;
                    setMessages(previous=>initial?result:mergeMessages(previous,result));
                    if(initial)setHasOlder(result.length===pageSize);
                    if(result.length)latestReceived.current=result[result.length-1].id;
                    setError('');first=false;
                    if(initial||result.length<pageSize)break;
                }
            }catch(e){if(current)setError(e instanceof Error?e.message:'Could not refresh messages.');}
            finally{fetching=false;if(current)setLoading(false);}
        }
        refresh.current=load;
        if(auth&&id){
            void studentRequest<{name:string;blocked?:boolean}>(`/social/conversations/${kind}/${id}/metadata`,auth.access_token)
                .then(result=>{if(current){setName(result.name);setBlocked(result.blocked===true);}}).catch(()=>{});
            void load();
        }else setLoading(false);
        const timer=setInterval(()=>{void load();},7000);
        const subscription=AppState.addEventListener('change',state=>{if(state==='active')void load();});
        return()=>{current=false;focused.current=false;reading.current=null;refresh.current=async()=>{};clearInterval(timer);subscription.remove();};
    },[auth,path,id,kind]));
    async function older(){
        if(!auth||olderBusy||!messages.length)return;
        setOlderBusy(true);
        try{
            const result=await studentRequest<SocialMessage[]>(`${path}?limit=${pageSize}&before_id=${messages[0].id}`,auth.access_token);
            if(alive.current&&focused.current){scrollNext.current=false;setMessages(previous=>mergeMessages(previous,result));setHasOlder(result.length===pageSize);}
        }catch(e){if(alive.current)setError(e instanceof Error?e.message:'Could not load history.');}
        finally{if(alive.current)setOlderBusy(false);}
    }
    const disabled=busy||loading||blocked||!content.trim()||!id;
    function send(){
        if(!auth||disabled)return;
        void run(async()=>{
            const sent=await sendMessage(auth.access_token,messageTarget(id,isGroup,content));
            if(alive.current){setContent('');scrollNext.current=true;nearBottom.current=true;setMessages(previous=>mergeMessages(previous,[sent]));await refresh.current();}
        },'Message sent.');
    }
    return <SafeAreaView style={styles.page}>
        <PageHeader title={name} background={false} navigation={navigation} leftIcon="back"/>
        {!auth?<View style={ui.content}><Text style={ui.copy}>Sign in to view this conversation.</Text><Action title="Sign in" onPress={()=>navigation.navigate('Login')}/></View>:!id?<Text accessibilityRole="alert">Invalid conversation. Go back and select a conversation.</Text>:
        <KeyboardAvoidingView style={{flex:1}} behavior={Platform.OS==='ios'?'padding':'height'}>
            <View style={styles.status}><Text style={[ui.copy,{flex:1}]}>{isGroup?'Group conversation':'Direct conversation'}</Text><Pressable accessibilityRole="button" accessibilityLabel="Refresh messages" disabled={busy||loading} onPress={()=>{void refresh.current();}} style={styles.refresh}><Ionicons name="refresh" size={22} color="#287d7b"/></Pressable>{!isGroup&&<Pressable accessibilityRole="button" accessibilityLabel="Conversation options" accessibilityState={{expanded:showOptions}} onPress={()=>setShowOptions(v=>!v)} style={styles.refresh}><Ionicons name="ellipsis-horizontal" size={22} color="#287d7b"/></Pressable>}</View>
            {!isGroup&&(showOptions||blocked)&&<View style={{paddingHorizontal:20}}>{blocked?<Action title="Manage blocked people" variant="secondary" onPress={()=>navigation.navigate('Safety')}/>:<Action title="Block this person" variant="danger" disabled={busy} onPress={()=>setConfirmBlock(true)}/>}</View>}
            {confirmBlock&&<View style={ui.card}><Text style={ui.copy}>Block {name}? This stops direct messages and friend requests and removes the friendship. Shared groups remain visible to other members.</Text><Action title="Cancel" disabled={busy} onPress={()=>setConfirmBlock(false)}/><Action title="Confirm block" disabled={busy} onPress={()=>{if(auth&&id)void run(async()=>{await studentRequest(`/social/blocked/${id}`,auth.access_token,'PUT');setBlocked(true);setConfirmBlock(false);},'Person blocked.');}}/></View>}
            {reporting!==null&&<View style={ui.card}><Text style={ui.title}>Report message</Text><TextInput accessibilityLabel="Report reason" style={ui.input} value={reason} onChangeText={setReason} multiline maxLength={2000} placeholder="Describe the problem (at least 10 characters)"/><Action title="Cancel report" disabled={busy} onPress={()=>{setReporting(null);setReason('');}}/><Action title="Submit message report" disabled={busy||reason.trim().length<10} onPress={()=>{if(auth)void run(async()=>{await studentRequest('/social/reports',auth.access_token,'POST',{message_id:reporting,reason});setReporting(null);setReason('');},'Report saved for project-team review.');}}/></View>}
            {!!error&&<Text accessibilityRole="alert" style={styles.notice}>{error}</Text>}
            {!!readError&&<Text accessibilityRole="alert" style={styles.notice}>{readError}</Text>}
            <FlatList ref={list} data={messages} keyExtractor={m=>String(m.id)} keyboardShouldPersistTaps="handled" keyboardDismissMode="interactive" viewabilityConfig={viewConfig} onViewableItemsChanged={onVisible}
                maintainVisibleContentPosition={{minIndexForVisible:0}}
                onScroll={({nativeEvent:e})=>{nearBottom.current=e.contentSize.height-e.layoutMeasurement.height-e.contentOffset.y<100;}}
                scrollEventThrottle={100} contentContainerStyle={styles.messages}
                onContentSizeChange={()=>{if(scrollNext.current){list.current?.scrollToEnd({animated:false});scrollNext.current=false;}}}
                ListHeaderComponent={hasOlder?<Action title={olderBusy?'Loading…':'Load older messages'} disabled={olderBusy} onPress={()=>{void older();}}/>:null}
                ListEmptyComponent={<Text style={ui.copy}>{loading?'Loading messages…':error?'Refresh to try again.':'No messages in this conversation yet.'}</Text>}
                renderItem={({item:m})=>{
                    const mine=m.sender_id===auth.user.id, sender=m.sender_name||'Member';
                    return <View style={[styles.messageRow,mine&&{justifyContent:'flex-end'}]}>
                        {!mine&&<View style={styles.avatar}><Text style={styles.avatarText}>{sender.slice(0,1).toUpperCase()}</Text></View>}
                        <View style={[styles.bubble,{backgroundColor:mine?'#CFEFED':'#F6F6F6'}]}>
                            <Text style={styles.sender}>{mine?'You':sender}</Text><Text selectable style={styles.message}>{m.content}</Text>
                            <Text style={styles.time}>{messageDate(m.created_at)}</Text>
                            {!mine&&<Pressable accessibilityRole="button" accessibilityLabel={`Report message from ${sender}`} style={{minHeight:44,justifyContent:'center'}} onPress={()=>{setReporting(m.id);setReason('');}}><Text style={styles.time}>Report</Text></Pressable>}
                        </View>
                    </View>;
                }}/>
            {!!notice&&<Text accessibilityRole="alert" style={styles.notice}>{notice}</Text>}
            <View style={styles.composer}>
                <TextInput accessibilityLabel="Message" placeholder="Message…" multiline maxLength={2000} editable={!busy} value={content} onChangeText={setContent} style={styles.input}/>
                <Pressable accessibilityRole="button" accessibilityLabel={busy?'Sending message':'Send message'} accessibilityState={{disabled:!!disabled}} disabled={!!disabled} onPress={send} style={[styles.send,disabled&&{opacity:.4}]}><Ionicons name="send" size={20} color="#173b39"/></Pressable>
            </View>
        </KeyboardAvoidingView>}
    </SafeAreaView>;
}
const styles=StyleSheet.create({
    page:{flex:1,backgroundColor:'#fff',width:'100%',maxWidth:680,alignSelf:'center'},
    status:{flexDirection:'row',paddingHorizontal:20,alignItems:'center'},refresh:{minHeight:44,minWidth:44,alignItems:'center',justifyContent:'center'},
    messages:{padding:20,flexGrow:1,justifyContent:'flex-end'},messageRow:{flexDirection:'row',alignItems:'flex-end',marginBottom:12,gap:8},
    avatar:{width:34,height:34,borderRadius:17,backgroundColor:'#E1E9F8',alignItems:'center',justifyContent:'center'},
    avatarText:{fontSize:14,color:'#3475D3'},bubble:{maxWidth:'80%',borderRadius:16,padding:12},
    sender:{fontSize:12,color:'#466b68',marginBottom:4},message:{fontSize:15,lineHeight:22,color:'#111'},
    time:{fontSize:10,color:'#66758A',marginTop:6},notice:{paddingHorizontal:20,paddingVertical:8,color:'#287d7b'},
    composer:{flexDirection:'row',alignItems:'flex-end',gap:10,borderTopWidth:1,borderColor:'#eee',padding:14},
    input:{flex:1,minHeight:44,maxHeight:120,borderRadius:22,backgroundColor:'#F6F6F6',paddingHorizontal:16,paddingVertical:12,fontSize:16,color:'#111'},
    send:{width:46,height:46,borderRadius:23,backgroundColor:'#52B3B1',alignItems:'center',justifyContent:'center'},
});
