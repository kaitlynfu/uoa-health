import {useEffect,useState} from 'react';
import {Text,TextInput} from 'react-native';
import {ConnectedScreen,Action,ui,useOperation,type AppNavigation} from '../../components/ConnectedScreen';
import {useSession} from '../../context/SessionContext';
import {studentRequest} from '../../services/studentApi';

export default function AccountRecoveryScreen({navigation}:{navigation:AppNavigation}){
    const {auth}=useSession(), {busy,notice,run}=useOperation();
    const [email,setEmail]=useState(auth?.user.email??''),[code,setCode]=useState(''),[password,setPassword]=useState('');
    const [confirm,setConfirm]=useState('');
    const verification=!!auth;
    const [delivery,setDelivery]=useState<boolean|null>(null),[deliveryError,setDeliveryError]=useState(''),[attempt,setAttempt]=useState(0);
    useEffect(()=>{
        let active=true;setDelivery(null);setDeliveryError('');
        studentRequest<{email_delivery:boolean}>('/auth/features').then(features=>{if(active)setDelivery(features.email_delivery);})
            .catch(()=>{if(active)setDeliveryError('Could not check email availability. Check your connection and retry.');});
        return()=>{active=false;};
    },[attempt]);
    return <ConnectedScreen title={verification?'Verify email':'Reset password'} navigation={navigation}>
        {delivery===null?<><Text accessibilityRole="alert">{deliveryError||'Checking email availability…'}</Text>{!!deliveryError&&<Action title="Retry" onPress={()=>setAttempt(a=>a+1)}/>}</>:delivery===false?<>
            <Text style={ui.title}>Email recovery is being prepared</Text><Text style={ui.copy}>{verification?'Email verification is not available yet. You can keep using your account.':'Password-reset emails are not available yet. If you know your password, return to Log in. If you are already signed in, you can change your password in Settings.'}</Text>
            <Action title={verification?'Back to Settings':'Back to Log in'} onPress={()=>navigation.navigate(verification?'Settings':'Login')}/>
        </>:<>
        <Text style={ui.copy}>Request a one-use code, then enter it here. Codes expire after 30 minutes.</Text>
        <TextInput accessibilityLabel="Account email" style={ui.input} value={email} onChangeText={setEmail} editable={!verification&&!busy} autoCapitalize="none" keyboardType="email-address" maxLength={320}/>
        <Action title="Send email code" disabled={busy||!email.trim()} onPress={()=>void run(async()=>{
            await studentRequest<{message:string}>(verification?'/auth/email/verification/request':'/auth/password/reset/request',auth?.access_token,'POST',verification?undefined:{email});
        },verification?'Verification code requested. Check your email.':'If this email is registered, a reset code will be sent.')}/>
        <TextInput accessibilityLabel="Email code" style={ui.input} value={code} onChangeText={setCode} autoCapitalize="none" autoCorrect={false} maxLength={128} editable={!busy} placeholder="Paste the code from your email"/>
        {!verification&&<><TextInput accessibilityLabel="New password" style={ui.input} value={password} onChangeText={setPassword} secureTextEntry maxLength={128} autoCapitalize="none" autoCorrect={false} editable={!busy} placeholder="New password (at least 10 characters)"/>
            <TextInput accessibilityLabel="Confirm new password" style={ui.input} value={confirm} onChangeText={setConfirm} secureTextEntry maxLength={128} editable={!busy} placeholder="Confirm new password"/></>}
        <Action title={verification?'Verify email':'Reset password'} disabled={busy||code.trim().length<20||(!verification&&(password.length<10||password!==confirm))} onPress={()=>void run(async()=>{
            await studentRequest(verification?'/auth/email/verification':'/auth/password/reset',auth?.access_token,'POST',verification?{code:code.trim()}:{code:code.trim(),new_password:password});
            setCode('');setPassword('');setConfirm('');
        },verification?'Email verified.':'Password reset. Return to Log in and use the new password.')}/>
        {!!notice&&<Text accessibilityRole="alert">{notice}</Text>}
        {!verification&&<Action title="Back to Log in" onPress={()=>navigation.navigate('Login')}/>}
        </>}
    </ConnectedScreen>;
}
