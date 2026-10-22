import {useCallback,useState} from 'react';
import {useFocusEffect} from '@react-navigation/native';
import {Text,View} from 'react-native';
import {ConnectedScreen,Action,ui,type AppNavigation} from '../../components/ConnectedScreen';
import {Section,SocialTile} from '../../components/SocialDesign';
import {useSession} from '../../context/SessionContext';
import {studentRequest,type Profile} from '../../services/studentApi';
import {SocialCollection} from '../../components/SocialCollections';
export default function MessagesScreen({navigation}:{navigation:AppNavigation}) {
    const {auth}=useSession();
    const [suggestions,setSuggestions]=useState<{id:number;display_name:string;shared_count:number}[]>([]),[matching,setMatching]=useState(false),[suggestionError,setSuggestionError]=useState('');
    useFocusEffect(useCallback(()=>{
        let active=true;setSuggestions([]);setSuggestionError('');setMatching(false);
        if(auth)void Promise.all([studentRequest<Profile>('/profile/me',auth.access_token),studentRequest<{id:number;display_name:string;shared_count:number}[]>('/social/suggestions',auth.access_token)])
            .then(([profile,rows])=>{if(active){setMatching(profile.matching_enabled);setSuggestions(rows);}}).catch(e=>{if(active)setSuggestionError(e.message);});
        return()=>{active=false;};
    },[auth]));
    return <ConnectedScreen title="Messages" description="Your conversations with classmates and study groups." background navigation={navigation} account section="Messages" leftIcon="back">
        <View style={ui.row}><View style={{flex:1}}><Action title="Find a friend" onPress={()=>navigation.navigate('Friends',{tab:'Find people'})}/></View><View style={{flex:1}}><Action title="My Groups" variant="secondary" onPress={()=>navigation.navigate('UserGroup')}/></View></View>
        <SocialCollection kind="inbox" navigation={navigation}/>
        <Section title="Meet classmates"/>
        {matching?<><Text style={ui.copy}>People who share your interests and goals.</Text>{!suggestions.length&&!suggestionError&&<Text style={ui.copy}>Suggestions will appear as more students join.</Text>}{suggestions.map(peer=><SocialTile key={peer.id} title={peer.display_name} detail={peer.shared_count+' shared interests or goals · Start a conversation'} icon="person-outline" onPress={()=>navigation.navigate('Chat',{targetId:peer.id,isGroup:false})}/>)}</>:<SocialTile title="Discover people with shared interests" detail="Choose whether to appear in peer suggestions in your profile." icon="sparkles-outline" tone="purple" onPress={()=>navigation.navigate('EditProfile')}/>}
        {!!suggestionError&&<Text accessibilityRole="alert" style={ui.copy}>Peer suggestions are unavailable right now. Your conversations are still above.</Text>}
        {matching&&<Action title="Manage discovery preferences" variant="secondary" onPress={()=>navigation.navigate('EditProfile')}/>}
    </ConnectedScreen>;
}
