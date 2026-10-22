import {Pressable,Share,Text,View} from 'react-native';
import {useCallback,useState} from 'react';
import {useFocusEffect} from '@react-navigation/native';
import type {NativeStackScreenProps} from '@react-navigation/native-stack';
import type {RootStackParamList} from '../../navigation/AppNavigator';
import {ConnectedScreen,Action,ui,useOperation} from '../../components/ConnectedScreen';
import {useSession} from '../../context/SessionContext';
import {studentRequest} from '../../services/studentApi';
import {getGroupDetails,setGroupSaved,type GroupSummary,type GroupMember} from '../../services/socialFeatures';
import {useSocialPage} from '../../hooks/useSocialPage';
import {positiveId} from '../../services/socialNavigation';
import {Ionicons} from '@expo/vector-icons';
import {Avatar,Section,social} from '../../components/SocialDesign';

function Members({token,id,selfId,onMessage,onSelectOwner,busy}:{token:string;id:number;selfId:number;onMessage:(id:number)=>void;onSelectOwner?:(member:GroupMember)=>void;busy:boolean}){
    const page=useSocialPage<GroupMember>(token,'/social/groups/'+id+'/members');
    return <View style={{gap:12}}>
        <Section title={onSelectOwner?'Choose a New Owner':'Members'} action="Refresh" onPress={()=>{if(!page.busy)void page.refresh();}}/>
        {page.busy&&<Text style={ui.copy}>Loading members…</Text>}{!!page.error&&<Text accessibilityRole="alert" style={ui.copy}>{page.error}</Text>}
        {onSelectOwner&&!page.busy&&!page.error&&!page.more&&page.items.every(member=>member.user.id===selfId)&&<Text style={ui.copy}>Another member needs to join before you can transfer ownership.</Text>}
        {page.items.map(member=><View key={member.user.id} style={[ui.card,{flexDirection:'row',alignItems:'center'}]}><Avatar name={member.user.display_name}/><View style={{flex:1}}><Text style={[ui.title,{fontSize:16}]}>{member.user.display_name}{member.user.id===selfId?' (you)':''}</Text><Text style={ui.copy}>{member.role==='admin'?'Group owner':'Member'}</Text></View>
            {member.user.id!==selfId&&(onSelectOwner?<Pressable disabled={busy} accessibilityRole="button" accessibilityLabel={'Choose '+member.user.display_name+' as owner'} style={{minHeight:44,justifyContent:'center'}} onPress={()=>onSelectOwner(member)}><Text style={social.link}>Choose</Text></Pressable>:<Pressable accessibilityRole="button" accessibilityLabel={'Message '+member.user.display_name} style={{minWidth:44,minHeight:44,justifyContent:'center',alignItems:'center'}} onPress={()=>onMessage(member.user.id)}><Ionicons name="chatbubble-outline" size={22} color="#257D80"/></Pressable>)}
        </View>)}
        {page.more&&<Action title="Show more members" variant="secondary" disabled={page.busy} onPress={()=>void page.loadMore()}/>}
    </View>;
}
export default function GroupDetailsScreen({navigation,route}:NativeStackScreenProps<RootStackParamList,'GroupDetails'>) {
    const {auth}=useSession();const {busy,notice,run}=useOperation();
    const [manage,setManage]=useState(false),[confirmLeave,setConfirmLeave]=useState(false),[confirmDelete,setConfirmDelete]=useState(false);
    const [choosingOwner,setChoosingOwner]=useState(false),[newOwner,setNewOwner]=useState<GroupMember|null>(null);
    let id:number|null=null;try{id=positiveId(route.params?.groupId);}catch{}
    const [details,setDetails]=useState<GroupSummary|null>(null),[detailsError,setDetailsError]=useState(''),[retry,setRetry]=useState(0);
    useFocusEffect(useCallback(()=>{
        let active=true;setDetails(null);setDetailsError('');
        if(auth&&id)void getGroupDetails(auth.access_token,id).then(result=>{if(active)setDetails(result);}).catch(e=>{if(active)setDetailsError(e.message);});
        return()=>{active=false;};
    },[auth,id,retry]));
    return <ConnectedScreen title="Group Details" navigation={navigation} account>
        {!id?<Text accessibilityRole="alert">Choose a group from Explore groups to get started.</Text>:<>
        <View style={[ui.card,{backgroundColor:'#F6FAF9',alignItems:'center'}]}>
            <View style={{width:72,height:72,borderRadius:24,backgroundColor:'#F1ECFF',alignItems:'center',justifyContent:'center'}}><Ionicons name="people" size={34} color="#6554D9"/></View>
            <Text style={[ui.title,{textAlign:'center'}]}>{details?.name??route.params.groupName??'Study group'}</Text>
            {details&&<><Text style={ui.copy}>{details.member_count} {details.member_count===1?'member':'members'} · {details.joined?'You’re a member':'Open to join'}</Text><View style={social.chips}>{[details.course,details.study_format,details.group_type].filter(Boolean).map((label,i)=><View key={i} style={social.chip}><Text style={ui.copy}>{label}</Text></View>)}</View></>}
        </View>
        {!!notice&&<Text accessibilityRole="alert" style={ui.copy}>{notice}</Text>}
        {route.params.created&&<Text style={ui.copy}>Your group is ready. Classmates can find it by name in Explore groups.</Text>}
        {details?<><Text style={ui.copy}>{details.description||'A space to connect, ask questions and study together.'}</Text>
            <Action title={details.joined?'Open Group Chat':'Join Group'} disabled={busy} onPress={()=>{if(details.joined)navigation.navigate('Chat',{targetId:id!,isGroup:true});else if(auth)void run(async()=>{await studentRequest('/social/groups/'+id+'/join',auth.access_token,'POST');setRetry(n=>n+1);},'You joined the group. Open the chat to say hello.');}}/>
            <Action title={details.saved?'Remove From Saved Groups':'Save Group for Later'} variant="secondary" disabled={busy} onPress={()=>{if(auth)void run(async()=>{await setGroupSaved(auth.access_token,id!,!details.saved);setRetry(n=>n+1);},details.saved?'Group removed from saved groups.':'Group saved.');}}/>
            {!details.joined&&<Text style={ui.copy}>Join to meet the members and chat. Saving keeps the group in My groups for later.</Text>}
            <Action title="Share Group With Classmates" variant="secondary" disabled={busy} onPress={()=>void run(async()=>{
                await Share.share({title:details.name,message:`Join “${details.name}”${details.course?' for '+details.course:''} in UoA Health. Open Study groups → Find a study group and search for the group name. Anyone signed in can join.`});
            })}/>
            <Section title="When and where"/>
            <View style={ui.card}>{[
                ['book-outline',details.course||'No specific course'],
                ['location-outline',details.location||'Ask in the chat about a meeting place'],
                ['calendar-outline',details.preferred_days.length?details.preferred_days.join(', '):'Arrange a time in the group chat'],
            ].map(([icon,label])=><View key={icon} style={{flexDirection:'row',gap:12,alignItems:'center'}}><Ionicons name={icon as 'book-outline'|'location-outline'|'calendar-outline'} size={22} color="#257D80"/><Text style={[ui.copy,{flex:1}]}>{label}</Text></View>)}</View>
            {details.joined&&auth&&<Members key={id+':'+retry} token={auth.access_token} id={id!} selfId={auth.user.id} busy={busy} onMessage={peer=>navigation.navigate('Chat',{targetId:peer,isGroup:false})}/>}
            {details.joined&&<><Pressable accessibilityRole="button" accessibilityState={{expanded:manage}} style={[ui.card,{flexDirection:'row',alignItems:'center'}]} onPress={()=>setManage(v=>!v)}><Ionicons name="settings-outline" size={22} color="#647774"/><Text style={[ui.copy,{flex:1}]}>{details.role==='admin'?'Manage your group':'Membership options'}</Text><Ionicons name={manage?'chevron-up':'chevron-down'} size={20} color="#647774"/></Pressable>
            {manage&&<View style={ui.card}>
                {details.role==='admin'?<>
                    <Action title="Edit Group Details" variant="secondary" disabled={busy} onPress={()=>navigation.navigate('CreateGroup',{groupId:id!})}/>
                    <Action title={choosingOwner?'Cancel Choosing an Owner':'Transfer Group Ownership'} variant="secondary" disabled={busy} onPress={()=>{setChoosingOwner(v=>!v);setNewOwner(null);}}/>
                    {choosingOwner&&auth&&<><Text style={ui.copy}>Choose an existing member. They will manage this group, and you will become a regular member.</Text><Members token={auth.access_token} id={id!} selfId={auth.user.id} busy={busy} onMessage={()=>{}} onSelectOwner={setNewOwner}/></>}
                    {newOwner&&<><Text style={ui.copy}>Make {newOwner.user.display_name} the group owner?</Text><Action title="Confirm New Owner" disabled={busy} onPress={()=>{if(auth)void run(async()=>{await studentRequest('/social/groups/'+id+'/ownership',auth.access_token,'POST',{new_owner_id:newOwner.user.id});setNewOwner(null);setChoosingOwner(false);setRetry(n=>n+1);},'Ownership Transferred.');}}/></>}
                    <Action title="Delete Group" variant="danger" disabled={busy} onPress={()=>setConfirmDelete(true)}/>
                </>:<Action title="Leave Group" variant="danger" disabled={busy} onPress={()=>setConfirmLeave(true)}/>}
                {confirmDelete&&<><Text style={ui.copy}>Permanently delete this group and all its messages? This affects every member and cannot be undone.</Text><Action title="Keep Group" variant="secondary" disabled={busy} onPress={()=>setConfirmDelete(false)}/><Action title="Confirm Delete Group" variant="danger" disabled={busy} onPress={()=>{if(auth)void run(async()=>{await studentRequest('/social/groups/'+id,auth.access_token,'DELETE');navigation.replace('AllGroups');});}}/></>}
                {confirmLeave&&<><Text style={ui.copy}>Leave this group? You can rejoin later to access its messages.</Text><Action title="Stay in Group" variant="secondary" disabled={busy} onPress={()=>setConfirmLeave(false)}/><Action title="Confirm Leave Group" variant="danger" disabled={busy} onPress={()=>{if(auth)void run(async()=>{await studentRequest('/social/groups/'+id+'/leave',auth.access_token,'DELETE');setConfirmLeave(false);setRetry(n=>n+1);},'You left the group.');}}/></>}
            </View>}</>}
        </>:detailsError?<View style={ui.card}><Text accessibilityRole="alert" style={ui.copy}>{detailsError}</Text><Action title="Try Again" variant="secondary" onPress={()=>setRetry(n=>n+1)}/></View>:<Text style={ui.copy}>Loading group details…</Text>}
        </>}
    </ConnectedScreen>;
}
