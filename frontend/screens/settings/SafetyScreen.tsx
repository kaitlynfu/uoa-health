import {useEffect,useState} from 'react';
import {Text,TextInput,View} from 'react-native';
import {ConnectedScreen,Action,ui,useOperation,type AppNavigation} from '../../components/ConnectedScreen';
import {useSession} from '../../context/SessionContext';
import {studentRequest} from '../../services/studentApi';
import {useSocialPage} from '../../hooks/useSocialPage';

export default function SafetyScreen({navigation}:{navigation:AppNavigation}){
    const {auth}=useSession(), {busy,notice,run}=useOperation();
    const page=useSocialPage<{id:number;display_name:string}>(auth?.access_token,'/social/blocked');
    const reports=useSocialPage<{id:number;reason:string;status:string}>(auth?.access_token,'/social/reports/mine');
    const [reason,setReason]=useState('');
    const [moderator,setModerator]=useState(false);
    useEffect(()=>{let active=true;if(auth)void studentRequest<{can_moderate:boolean}>('/social/moderation/access',auth.access_token).then(result=>{if(active)setModerator(result.can_moderate);}).catch(()=>{});return()=>{active=false;};},[auth]);
    return <ConnectedScreen title="Safety & support" navigation={navigation} account>
        <Text style={ui.title}>Blocked people</Text>
        <Text style={ui.copy}>Blocking stops direct messages and friend requests in both directions, removes the friendship, and hides their group messages from you. It does not remove them from shared groups or stop others seeing your posts.</Text>
        {page.items.map(peer=><View style={ui.card} key={peer.id}><Text style={ui.title}>{peer.display_name}</Text><Action title="Unblock" disabled={busy} onPress={()=>{if(auth)void run(async()=>{await studentRequest(`/social/blocked/${peer.id}`,auth.access_token,'DELETE');await page.refresh();},'Unblocked. Friendship was not restored.');}}/></View>)}
        {!!page.error&&<Text accessibilityRole="alert">{page.error}</Text>}
        <Action title="Refresh blocked people" onPress={()=>void page.refresh()} disabled={page.busy}/>
        {page.more&&<Action title="More blocked people" onPress={()=>void page.loadMore()} disabled={page.busy}/>}
        <Text style={ui.title}>Report a problem or ask for help</Text>
        <Text style={ui.copy}>Describe the screen, steps and problem. Do not include passwords or recovery codes. Reports go to configured project moderators; this is not an emergency service.</Text>
        <TextInput accessibilityLabel="Problem description" style={[ui.input,{minHeight:120}]} multiline maxLength={2000} value={reason} onChangeText={setReason} editable={!busy}/>
        <Action title="Submit report" disabled={busy||reason.trim().length<10} onPress={()=>{if(auth)void run(async()=>{await studentRequest<{id:number}>('/social/reports',auth.access_token,'POST',{reason});setReason('');await reports.refresh();},'Report saved for project-team review.');}}/>
        {!!notice&&<Text accessibilityRole="alert">{notice}</Text>}
        <Text style={ui.title}>Your reports</Text>
        <Text style={ui.copy}>Only you and authorized moderators can review your submissions. Resolved means the project team has reviewed the report.</Text>
        {reports.items.map(report=><View style={ui.card} key={report.id}><Text style={ui.title}>Report {report.id} · {report.status==='open'?'Awaiting review':'Reviewed'}</Text><Text style={ui.copy}>{report.reason}</Text></View>)}
        {!!reports.error&&<Text accessibilityRole="alert">{reports.error}</Text>}
        <Action title="Refresh report status" disabled={reports.busy} variant="secondary" onPress={()=>void reports.refresh()}/>
        {reports.more&&<Action title="Older reports" disabled={reports.busy} variant="secondary" onPress={()=>void reports.loadMore()}/>}
        {moderator&&<Action title="Review project reports" onPress={()=>navigation.navigate('Moderation')}/>}
    </ConnectedScreen>;
}
