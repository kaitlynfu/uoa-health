import {useEffect,useRef,useState,type PropsWithChildren} from 'react';
import {KeyboardAvoidingView,Platform,Pressable,ScrollView,StyleSheet,Text,View} from 'react-native';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';
import type {RootStackParamList} from '../navigation/AppNavigator';
import PageHeader from './PageHeader';
import NavBar from './NavBar';
import { Ionicons } from '@expo/vector-icons';
import {useSession} from '../context/SessionContext';
import {SafeAreaView} from 'react-native-safe-area-context';

export type AppNavigation=NativeStackNavigationProp<RootStackParamList>;

const signInContent={
    Saves:{icon:'bookmark-outline',title:'Sign in to view your saved items',description:'Keep your favourite programmes and careers in one place.'},
    Notifications:{icon:'notifications-outline',title:'Sign in to view your notifications',description:'Stay updated with important alerts and activity.'},
    Messages:{icon:'chatbubbles-outline',title:'Sign in to view your messages',description:'Chat with classmates and keep your conversations together.'},
    'Study Groups':{icon:'people-outline',title:'Sign in to access study groups',description:'Discover study groups, share ideas, and connect with classmates.'},
    'My Groups':{icon:'people-circle-outline',title:'Sign in to view your groups',description:'Access your study groups and stay connected with classmates.'},
    'Explore Groups':{icon:'compass-outline',title:'Sign in to explore study groups',description:'Find study groups that match your courses and interests.'},
    Friends:{icon:'person-add-outline',title:'Sign in to connect with friends',description:'Find classmates, make connections, and stay in touch.'},
    Wayfinder:{icon:'location-outline',title:'Sign in to access wayfinding',description:'Explore campus and find your way to important locations.'},
    Wayfinding:{icon:'location-outline',title:'Sign in to access wayfinding',description:'Explore campus and find your way to important locations.'},
    Milestones:{icon:'flag-outline',title:'Sign in to track your milestones',description:'Track your progress and stay on top of your academic journey.'},
    Profile:{icon:'person-circle-outline',title:'Sign in to see your profile',description:'Manage your profile, preferences, and personalised experience.'},
} satisfies Record<string,{icon:React.ComponentProps<typeof Ionicons>['name'];title:string;description:string}>;

// Teammate screens use the same teal header, rounded tiles and bottom navigation.
export function ConnectedScreen({title,navigation,children,account=false,section='Groups',leftIcon='back',description,background=false}:PropsWithChildren<{title:string;navigation:AppNavigation;account?:boolean;section?:string;leftIcon?:'menu'|'back';description?:string;background?:boolean}>) {
    const {auth}=useSession();
    const signIn=signInContent[title as keyof typeof signInContent]??{icon:'person-outline' as const,title:`Sign in to access ${title.toLowerCase()}`,description:'Sign in to access your personalised features and continue your journey.'};
    return <SafeAreaView style={ui.page}><PageHeader title={title} description={description} background={background} navigation={navigation} leftIcon={leftIcon} />
        <KeyboardAvoidingView style={{flex:1}} behavior={Platform.OS==='ios'?'padding':undefined}>
        <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={ui.content}>
            {account&&!auth?(
                <View style={ui.signInCard}>
                    <View style={ui.signInIconCircle}><Ionicons name={signIn.icon} size={42} color="#52B3B1"/></View>
                    <Text style={ui.signInTitle}>{signIn.title}</Text>
                    <Text style={ui.signInDescription}>{signIn.description}</Text>
                    <Pressable accessibilityRole="button" onPress={()=>navigation.navigate('Login')} style={ui.signInButton}><Text style={ui.signInButtonText}>Sign in</Text></Pressable>
                </View>
            ):children}
        </ScrollView></KeyboardAvoidingView><NavBar navigation={navigation} activeScreen={section} />
    </SafeAreaView>;
}

export function Action({title,onPress,disabled=false,variant='primary'}: {title:string;onPress:()=>void;disabled?:boolean;variant?:'primary'|'secondary'|'danger'}) {
    return <Pressable accessibilityRole="button" accessibilityState={{disabled}} disabled={disabled} onPress={onPress} style={[ui.button,variant==='secondary'&&ui.secondaryButton,variant==='danger'&&ui.dangerButton,disabled&&{opacity:.45}]}><Text style={[ui.buttonText,variant==='secondary'&&{color:'#287d7b'},variant==='danger'&&{color:'#A13232'}]}>{title}</Text></Pressable>;
}

export function useOperation() {
    const [busy,setBusy]=useState(false),[notice,setNotice]=useState('');
    const alive=useRef(true),locked=useRef(false);
    useEffect(()=>{alive.current=true;return()=>{alive.current=false;};},[]);
    async function run(action:()=>Promise<void>,success='') {
        if(locked.current)return;
        locked.current=true;setBusy(true);setNotice('');
        try {await action();if(alive.current)setNotice(success);}
        catch(e){if(alive.current)setNotice(e instanceof Error?e.message:'Request failed. Please retry.');}
        finally{locked.current=false;if(alive.current)setBusy(false);}
    }
    return {busy,notice,run,alive};
}
export const ui=StyleSheet.create({
    page:{flex:1,backgroundColor:'#fff',width:'100%',maxWidth:680,alignSelf:'center'},
    content:{padding:20,paddingTop:8,paddingBottom:110,gap:16},
    card:{backgroundColor:'#fff',borderWidth:1,borderColor:'#E2ECEB',borderRadius:20,padding:18,gap:12},
    title:{fontSize:20,fontWeight:'700',color:'#173b39'},
    copy:{fontSize:15,lineHeight:22,color:'#52615e'},
    input:{minHeight:48,borderRadius:12,borderWidth:1,borderColor:'#cad8d5',padding:14,fontSize:16,color:'#173b39',backgroundColor:'#fff'},
    button:{minHeight:48,padding:14,borderRadius:12,backgroundColor:'#52B3B1',justifyContent:'center'},
    buttonText:{color:'#173b39',fontWeight:'600',textAlign:'center',fontSize:15},
    secondaryButton:{backgroundColor:'#EAF6F5'},dangerButton:{backgroundColor:'#FFF1F0'},
    row:{flexDirection:'row',flexWrap:'wrap',gap:10,alignItems:'center'},
    signInCard:{backgroundColor:'#FFFFFF',borderWidth:1,borderColor:'#E8E8E8',borderRadius:24,paddingVertical:30,paddingHorizontal:24,marginTop:24,alignItems:'center',gap:16},
    signInIconCircle:{width:84,height:84,borderRadius:42,backgroundColor:'#E7F6F6',alignItems:'center',justifyContent:'center',marginBottom:4},
    signInTitle:{fontSize:22,fontWeight:'700',color:'#111111',textAlign:'center'},
    signInDescription:{fontSize:15,lineHeight:23,color:'#6B6B6B',textAlign:'center',maxWidth:360,marginBottom:8},
    signInButton:{backgroundColor:'#52B3B1',paddingVertical:14,paddingHorizontal:36,borderRadius:14,minWidth:120,alignItems:'center',justifyContent:'center'},
    signInButtonText:{color:'#173b39',fontSize:16,fontWeight:'700'},
});
