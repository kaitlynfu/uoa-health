import {useState} from 'react';
import {Text,View} from 'react-native';
import {ConnectedScreen,Action,ui,useOperation,type AppNavigation} from '../../components/ConnectedScreen';
import {useSocialPage} from '../../hooks/useSocialPage';
import {useSession} from '../../context/SessionContext';
import {studentRequest} from '../../services/studentApi';
type Report={id:number;reason:string;status:string;message_id:number|null;message_content:string|null};
export default function ModerationScreen({navigation}:{navigation:AppNavigation}){
    const {auth}=useSession(),{busy,notice,run}=useOperation();
    const page=useSocialPage<Report>(auth?.access_token,'/social/reports');
    const [removing,setRemoving]=useState<number|null>(null);
    return <ConnectedScreen title="Project report review" navigation={navigation} section="Profile" account>
        <Text style={ui.copy}>Only server-authorized moderators can read reports or remove reported messages. Keep report contents private. Resolving a report alone does not remove a message.</Text>
        {!!page.error&&<Text accessibilityRole="alert">{page.error}</Text>}
        {page.items.map(report=><View key={report.id} style={ui.card}><Text style={ui.title}>Report {report.id} · {report.status}</Text><Text selectable style={ui.copy}>{report.reason}</Text>{report.message_content&&<Text selectable style={ui.copy}>Reported message: {report.message_content}</Text>}
            {report.status==='open'&&<Action title="Mark reviewed / resolved" disabled={busy} onPress={()=>{if(auth)void run(async()=>{await studentRequest(`/social/reports/${report.id}/resolve`,auth.access_token,'POST');await page.refresh();});}}/>}
            {report.message_id!==null&&<Action title="Remove reported message" disabled={busy} onPress={()=>setRemoving(report.id)}/>}
            {removing===report.id&&<><Text style={ui.copy}>Permanently remove this message for everyone and resolve its report?</Text><Action title="Cancel removal" disabled={busy} onPress={()=>setRemoving(null)}/><Action title="Confirm permanent removal" disabled={busy} onPress={()=>{if(auth)void run(async()=>{await studentRequest(`/social/reports/${report.id}/message`,auth.access_token,'DELETE');setRemoving(null);await page.refresh();},'Message removed.');}}/></>}
        </View>)}
        {!!notice&&<Text accessibilityRole="alert">{notice}</Text>}
        <Action title="Refresh reports" disabled={page.busy||busy} onPress={()=>void page.refresh()}/>
        {page.more&&<Action title="More reports" disabled={page.busy||busy} onPress={()=>void page.loadMore()}/>}
    </ConnectedScreen>;
}
