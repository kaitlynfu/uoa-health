
import {useEffect,useState} from 'react';
import {Pressable,Text,TextInput,View} from 'react-native';
import {Ionicons} from '@expo/vector-icons';
import {ConnectedScreen,ui,useOperation,type AppNavigation} from '../../components/ConnectedScreen';
import {useSession} from '../../context/SessionContext';
import {createSocialGroup,getGroupDetails,groupTypes,studyFormats,weekDays,type GroupDraft,type SocialGroup} from '../../services/socialFeatures';
import {studentRequest} from '../../services/studentApi';

const MAIN='#52B3B1';
const PALE='#EAF7F5';

export default function CreateGroupScreen({navigation,route}:{navigation:AppNavigation;route?:{params?:{groupId?:number}}}) {
    const {auth}=useSession();const {busy,notice,run,alive}=useOperation();
    const [draft,setDraft]=useState<GroupDraft>({name:'',course:'',description:'',location:'',group_type:'Other',study_format:'Hybrid',preferred_days:[]});
    const groupId=route?.params?.groupId;
    const [loading,setLoading]=useState(!!groupId),[loadError,setLoadError]=useState(''),[attempt,setAttempt]=useState(0);

    useEffect(()=>{
        let active=true;
        if(!groupId||!auth)return;
        setLoading(true);setLoadError('');
        void getGroupDetails(auth.access_token,groupId).then(group=>{if(active)setDraft({name:group.name,course:group.course,description:group.description,location:group.location,group_type:group.group_type,study_format:group.study_format,preferred_days:group.preferred_days});}).catch(e=>{if(active)setLoadError(e.message);}).finally(()=>{if(active)setLoading(false);});
        return()=>{active=false;};
    },[groupId,auth,attempt]);

    function chips<T extends string>(items:readonly T[],selected:readonly string[],change:(v:T)=>void,multiple=false){
        return <View style={{flexDirection:'row',flexWrap:'wrap',gap:9}}>{items.map(item=>{
            const active=selected.includes(item);
            return <Pressable key={item} accessibilityRole={multiple?'checkbox':'radio'} accessibilityLabel={item} accessibilityState={{checked:active,disabled:busy}} disabled={busy} onPress={()=>change(item)} style={{minHeight:44,paddingHorizontal:17,paddingVertical:10,borderRadius:14,borderWidth:1,borderColor:active?MAIN:'#CAD8D5',backgroundColor:active?PALE:'#FFFFFF',alignItems:'center',justifyContent:'center'}}><Text style={{fontSize:14,fontWeight:active?'700':'500',color:active?'#287d7b':'#52615E'}}>{item}</Text></Pressable>;
        })}</View>;
    }

    const fields=([{key:'name',label:'Group name',placeholder:'e.g. BIOSCI 107 study circle'},{key:'course',label:'Course',placeholder:'e.g. BIOSCI 107 (optional)'},{key:'description',label:'Group description',placeholder:'What will you work on? Who is the group for?'},{key:'location',label:'Location',placeholder:'e.g. Science Centre or online (optional)'}] as const);

    if(groupId&&(loading||loadError))return <ConnectedScreen title="Edit Group" navigation={navigation} account background><Text style={ui.copy}>{loadError||'Loading group…'}</Text>{!!loadError&&<Pressable accessibilityRole="button" onPress={()=>setAttempt(n=>n+1)} style={{backgroundColor:MAIN,padding:14,borderRadius:14,alignItems:'center'}}><Text style={{color:'#173b39',fontWeight:'700'}}>Retry</Text></Pressable>}</ConnectedScreen>;

    return <ConnectedScreen title={groupId?'Edit Group':'Create Group'} description="Give classmates a clear idea of what you’ll study together." background navigation={navigation} account>
        <View style={{flexDirection:'row',alignItems:'center',gap:14,paddingVertical:8}}>
            <View style={{width:48,height:48,borderRadius:24,backgroundColor:PALE,alignItems:'center',justifyContent:'center'}}>
                <Ionicons name="people-outline" size={24} color={MAIN}/>
            </View>
            <View style={{flex:1,gap:4}}>
                <Text style={{fontSize:16,fontWeight:'700',color:'#111111'}}>Make it easy to join</Text>
                <Text style={{fontSize:14,lineHeight:21,color:'#6B6B6B'}}>Give your group a name and add a few details to help classmates find and join your study group.</Text>
            </View>
        </View>

        <View style={{gap:20,marginTop:4}}>
            {fields.map(field=><View key={field.key} style={{gap:9}}>
                <Text style={{fontSize:15,fontWeight:'700',color:'#111111'}}>{field.label}</Text>
                <TextInput accessibilityLabel={field.label} placeholder={field.placeholder} placeholderTextColor="#9AA8A6" selectionColor={MAIN} style={[ui.input,{backgroundColor:'#FFFFFF',borderColor:'#DCE8E6',borderRadius:14,minHeight:50,paddingHorizontal:16,fontSize:15,color:'#173B39'},field.key==='description'&&{minHeight:100,textAlignVertical:'top',paddingTop:14}]} multiline={field.key==='description'} value={draft[field.key]} editable={!busy} maxLength={{name:100,course:100,description:2000,location:200}[field.key]} onChangeText={value=>setDraft(d=>({...d,[field.key]:value}))}/>
            </View>)}
        </View>

        <View style={{gap:12,marginTop:4}}>
            <Text style={{fontSize:16,fontWeight:'700',color:'#111111'}}>Group type</Text>
            {chips(groupTypes,[draft.group_type],value=>setDraft(d=>({...d,group_type:value})))}
        </View>

        <View style={{gap:12,marginTop:4}}>
            <Text style={{fontSize:16,fontWeight:'700',color:'#111111'}}>Study format</Text>
            {chips(studyFormats,[draft.study_format],value=>setDraft(d=>({...d,study_format:value})))}
        </View>

        <View style={{gap:12,marginTop:4}}>
            <Text style={{fontSize:16,fontWeight:'700',color:'#111111'}}>Preferred days</Text>
            <Text style={{fontSize:14,lineHeight:22,color:'#6B6B6B'}}>Optional. Pick when you’re usually available; agree on meeting times in your group chat.</Text>
            {chips(weekDays,draft.preferred_days,value=>setDraft(d=>({...d,preferred_days:d.preferred_days.includes(value)?d.preferred_days.filter(day=>day!==value):[...d.preferred_days,value]})),true)}
        </View>

        {!!notice&&<Text accessibilityRole="alert" style={{fontSize:14,color:'#52B3B1',marginTop:8}}>{notice}</Text>}

        <View style={{marginTop:16,marginBottom:20}}>
            <Pressable accessibilityRole="button" accessibilityState={{disabled:busy||!draft.name.trim()}} disabled={busy||!draft.name.trim()} onPress={()=>{if(auth)void run(async()=>{const payload={...draft,name:draft.name.trim()};const group=groupId?await studentRequest<SocialGroup>(`/social/groups/${groupId}`,auth.access_token,'PUT',payload):await createSocialGroup(auth.access_token,payload);if(alive.current)navigation.replace('GroupDetails',{groupId:group.id,groupName:group.name,created:!groupId});});}} style={{backgroundColor:MAIN,borderRadius:14,minHeight:52,alignItems:'center',justifyContent:'center',opacity:busy||!draft.name.trim()?0.45:1}}>
                <Text style={{color:'#173b39',fontSize:16,fontWeight:'700'}}>{busy?'Saving…':groupId?'Save Group Details':'Create Group'}</Text>
            </Pressable>
        </View>
    </ConnectedScreen>;
}
