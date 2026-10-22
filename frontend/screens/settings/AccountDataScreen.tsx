import {useState} from 'react';
import {Share,Text,TextInput,View} from 'react-native';
import {ConnectedScreen,Action,ui,useOperation,type AppNavigation} from '../../components/ConnectedScreen';
import {useSession} from '../../context/SessionContext';
import {studentRequest} from '../../services/studentApi';

export default function AccountDataScreen({navigation}:{navigation:AppNavigation}){
    const {auth,logout}=useSession(), {busy,notice,run}=useOperation();
    const [email,setEmail]=useState(''),[password,setPassword]=useState(''),[confirm,setConfirm]=useState(false);
    return <ConnectedScreen title="Your account data" navigation={navigation} account>
        <Text style={ui.copy}>Export your profile, saves, journey progress, group memberships and messages you wrote. The export contains private information; share it only somewhere you trust.</Text>
        <Action title="Export my data" disabled={busy} onPress={()=>{if(auth)void run(async()=>{
            const result=await studentRequest('/account/export',auth.access_token);
            await Share.share({title:'UoA Health account export',message:JSON.stringify(result,null,2)});
        });}}/>
        <Text style={ui.title}>Delete account</Text>
        <Text style={ui.copy}>This permanently removes your profile, saves, progress, memberships and messages you wrote. Groups transfer to the oldest remaining member, or are deleted if empty. An anonymous “Former member” ID remains for shared route history and messages other people wrote. Backups expire under the team's retention policy; deletion does not immediately erase historical backups.</Text>
        {!confirm?<Action title="I want to delete my account" onPress={()=>setConfirm(true)}/>:<View style={ui.card}>
            <Text style={ui.copy}>This cannot be undone. Confirm your email and current password.</Text>
            <TextInput accessibilityLabel="Confirm account email" style={ui.input} value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" editable={!busy}/>
            <TextInput accessibilityLabel="Confirm current password" style={ui.input} value={password} onChangeText={setPassword} secureTextEntry autoCapitalize="none" maxLength={128} editable={!busy}/>
            <Action title="Cancel" disabled={busy} onPress={()=>{setConfirm(false);setPassword('');}}/>
            <Action title="Permanently delete my account" disabled={busy||!password||email.trim().toLowerCase()!==auth?.user.email} onPress={()=>{if(auth)void run(async()=>{
                await studentRequest('/account',auth.access_token,'DELETE',{email,password});
                setPassword('');try{await logout();}catch{/* Server session was already removed by deletion. */}
                navigation.reset({index:0,routes:[{name:'Login'}]});
            });}}/>
        </View>}
        {!!notice&&<Text accessibilityRole="alert">{notice}</Text>}
    </ConnectedScreen>;
}
