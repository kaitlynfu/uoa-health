import {useEffect,useState} from 'react';
import {Pressable,Text,TextInput,View} from 'react-native';
import {Ionicons} from '@expo/vector-icons';
import {ConnectedScreen,Action,ui,useOperation,type AppNavigation} from '../../components/ConnectedScreen';
import {Avatar,Section,SocialTabs,Unavailable} from '../../components/SocialDesign';
import {useSession} from '../../context/SessionContext';
import {studentRequest} from '../../services/studentApi';
import {type FriendConnection,type SocialPerson} from '../../services/socialFeatures';
import {useSocialPage} from '../../hooks/useSocialPage';
const tabs=['Friends','Requests','Find people'] as const;
type Tab=typeof tabs[number];
export default function FriendsScreen({navigation,route}:{navigation:AppNavigation;route?:{params?:{tab?:Tab}}}){
    const {auth}=useSession();
    const [tab,setTab]=useState<Tab>(route?.params?.tab??'Friends'),[direction,setDirection]=useState<'Received'|'Sent'>('Received');
    useEffect(()=>{if(route?.params?.tab){setTab(route.params.tab);setDirection('Received');}},[route?.params?.tab]);
    const [query,setQuery]=useState(''),[search,setSearch]=useState('');
    const [manage,setManage]=useState<number|null>(null),[removing,setRemoving]=useState<SocialPerson|null>(null);
    const operation=useOperation();
    const path=tab==='Find people'?(search.length>=2?'/social/users?q='+encodeURIComponent(search):null):tab==='Friends'?'/social/friends':'/social/friends/requests?direction='+(direction==='Received'?'incoming':'outgoing');
    const page=useSocialPage<SocialPerson|FriendConnection>(auth?.access_token,path);
    const busy=operation.busy||page.busy;
    function change(person:SocialPerson,kind:'request'|'accept'|'remove'){
        if(!auth)return;
        void operation.run(async()=>{
            if(kind==='request')await studentRequest('/social/friends/request',auth.access_token,'POST',{friend_id:person.id});
            else await studentRequest('/social/friends/'+person.id+(kind==='accept'?'/accept':''),auth.access_token,kind==='accept'?'POST':'DELETE');
            setRemoving(null);setManage(null);await page.refresh();
        },kind==='request'?'Request sent.':kind==='accept'?'Friend request accepted.':'Connection removed.');
    }
    function searchPeople(){if(search===query.trim())void page.refresh();else setSearch(query.trim());}
    return <ConnectedScreen title="Friends" description="Find classmates, keep in touch and study together." background navigation={navigation} account section="Messages" leftIcon='back'>
        <SocialTabs items={tabs} value={tab} onChange={value=>{setTab(value);setManage(null);setRemoving(null);}}/>
        {tab==='Requests'&&<SocialTabs items={['Received','Sent'] as const} value={direction} onChange={setDirection}/>}
        {tab==='Find people'&&<View style={ui.card}>
            <Text style={ui.title}>Who are you looking for?</Text>
            <Text style={ui.copy}>Enter at least two letters of their display name.</Text>
            <TextInput accessibilityLabel="Search people by name" placeholder="Search classmates by name" style={ui.input} value={query} onChangeText={setQuery} maxLength={100} returnKeyType="search" onSubmitEditing={()=>{if(query.trim().length>=2)searchPeople();}}/>
            <Action title="Find people" disabled={busy||query.trim().length<2} onPress={searchPeople}/>
        </View>}
        {tab!=='Find people'&&<Section title={tab==='Friends'?'Your friends':direction==='Received'?'Waiting for your reply':'Requests you sent'} action="Refresh" onPress={()=>{if(!busy)void page.refresh();}}/>}
        {page.busy&&<Text style={ui.copy}>Loading people…</Text>}
        {!!page.error&&<View style={ui.card}><Text accessibilityRole="alert" style={ui.copy}>{page.error}</Text><Action title="Try again" variant="secondary" onPress={()=>void page.refresh()}/></View>}
        {!!operation.notice&&<Text accessibilityRole="alert" style={ui.copy}>{operation.notice}</Text>}
        {!page.busy&&!page.error&&path&&page.items.length===0&&<Unavailable title={tab==='Friends'?'Meet your study circle':tab==='Find people'?'No matches yet':'You’re all caught up'} icon="people-outline">{tab==='Friends'?'Use Find people to search for a classmate and send your first request.':tab==='Find people'?'Try another name or check the spelling.':direction==='Received'?'New friend requests will appear here.':'You have no pending requests.'}</Unavailable>}
        {page.items.map(item=>{const person='user' in item?item.user:item;return <View key={person.id} style={ui.card}>
            <View style={{flexDirection:'row',gap:12,alignItems:'center'}}><Avatar name={person.display_name}/><View style={{flex:1}}><Text style={[ui.title,{fontSize:17}]}>{person.display_name}</Text><Text style={ui.copy}>{person.connection==='friend'?'Friend':person.connection==='incoming'?'Wants to connect':person.connection==='outgoing'?'Request sent':'Classmate'}</Text></View>
                {person.connection==='friend'&&<><Pressable accessibilityRole="button" accessibilityLabel={'Message '+person.display_name} onPress={()=>navigation.navigate('Chat',{targetId:person.id,isGroup:false})} style={{minWidth:44,minHeight:44,alignItems:'center',justifyContent:'center',borderRadius:22,backgroundColor:'#EAF6F5'}}><Ionicons name="chatbubble-outline" size={22} color="#257D80"/></Pressable><Pressable accessibilityRole="button" accessibilityLabel={'Manage friendship with '+person.display_name} accessibilityState={{expanded:manage===person.id}} onPress={()=>setManage(manage===person.id?null:person.id)} style={{minWidth:44,minHeight:44,justifyContent:'center',alignItems:'center'}}><Ionicons name="ellipsis-horizontal" size={22} color="#647774"/></Pressable></>}
            </View>
            {person.connection==='none'&&<Action title="Add friend" disabled={busy} onPress={()=>change(person,'request')}/>}
            {person.connection==='incoming'&&<View style={ui.row}><View style={{flex:1}}><Action title="Accept" disabled={busy} onPress={()=>change(person,'accept')}/></View><View style={{flex:1}}><Action title="Decline" variant="secondary" disabled={busy} onPress={()=>setRemoving(person)}/></View></View>}
            {person.connection==='outgoing'&&<Action title="Cancel request" variant="secondary" disabled={busy} onPress={()=>setRemoving(person)}/>}
            {manage===person.id&&<Action title="Remove friend" variant="danger" disabled={busy} onPress={()=>setRemoving(person)}/>}
            {removing?.id===person.id&&<><Text style={ui.copy}>Remove this connection with {person.display_name}?</Text><Action title="Keep connection" variant="secondary" onPress={()=>setRemoving(null)}/><Action title="Confirm removal" variant="danger" disabled={busy} onPress={()=>change(person,'remove')}/></>}
        </View>;})}
        {page.more&&<Action title="Show more people" variant="secondary" disabled={busy} onPress={()=>void page.loadMore()}/>}
    </ConnectedScreen>;
}
