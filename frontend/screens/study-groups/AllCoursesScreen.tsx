
import {useCallback,useState} from 'react';
import {useFocusEffect} from '@react-navigation/native';
import {Pressable,Text,View,StyleSheet} from 'react-native';
import {ConnectedScreen,Action,ui,type AppNavigation} from '../../components/ConnectedScreen';
import {useSession} from '../../context/SessionContext';
import {studentRequest,ApiError,type Journey} from '../../services/studentApi';
import {Section,SocialTile} from '../../components/SocialDesign';

export default function AllCoursesScreen({navigation}:{navigation:AppNavigation}){
    const {auth}=useSession();
    const [journey,setJourney]=useState<Journey|null>(null);
    const [error,setError]=useState('');
    const [loading,setLoading]=useState(true);
    const [attempt,setAttempt]=useState(0);

    useFocusEffect(useCallback(()=>{
        let active=true;
        setJourney(null);
        setError('');
        setLoading(true);

        if(auth)studentRequest<Journey>('/journey/me',auth.access_token)
            .then(j=>{if(active)setJourney(j);})
            .catch(e=>{if(active)setError(e instanceof ApiError&&e.status===404?'Choose a study pathway to see its courses and milestones.':e.message);})
            .finally(()=>{if(active)setLoading(false);});

        return()=>{active=false;};
    },[auth,attempt]));

    return <ConnectedScreen title="Study plan courses" description="Connect your study plan with a group of classmates." navigation={navigation} background={true} account>
        <Text style={styles.intro}>These are milestones from your selected study plan—not verified enrolments. Explore groups to search by course name or code.</Text>

        {loading?<Text style={ui.copy}>Loading study plan…</Text>:error?(
            <>
                <Text accessibilityRole="alert" style={ui.copy}>{error}</Text>
                <Action title="Retry" onPress={()=>setAttempt(n=>n+1)}/>
                <Pressable style={styles.bottomLink} onPress={()=>navigation.navigate('ChoosePathway')}>
                    <Text style={styles.linkText}>Choose pathway →</Text>
                </Pressable>
            </>
        ):journey?.milestones.map(m=>{
            const course=m.title.match(/\b[A-Z]{2,}\s*\d{3}[A-Z]?\b/)?.[0];

            return <View style={styles.card} key={m.id}>
                <Text style={ui.title}>{m.title}</Text>
                <Text style={styles.status}>{m.completed?'Completed':'Not marked completed'}</Text>
                <View style={styles.divider}/>
                <View style={styles.links}>
                    <Pressable onPress={()=>navigation.navigate('MapCourse',{milestone:m})}>
                        <Text style={styles.linkText}>View milestone →</Text>
                    </Pressable>
                    {course&&<Pressable onPress={()=>navigation.navigate('AllGroups',{course})}>
                        <Text style={styles.linkText}>Find groups for {course} →</Text>
                    </Pressable>}
                </View>
            </View>;
        })}

        {!loading&&!error&&journey?.milestones.length===0&&(
            <Text style={ui.copy}>No milestones are available for your current study plan.</Text>
        )}

        <Section title="Explore more"/>
        <SocialTile title="Find a study group" detail="Browse groups across courses and connect with classmates." icon="compass-outline" onPress={()=>navigation.navigate('AllGroups')}/>
        <SocialTile title="Change study pathway" detail="Choose a different pathway to explore its milestones." icon="git-branch-outline" tone="purple" onPress={()=>navigation.navigate('ChoosePathway')}/>
    </ConnectedScreen>;
}

const styles=StyleSheet.create({
    intro:{color:'#666666',fontSize:13,lineHeight:19,marginBottom:16},
    card:{backgroundColor:'#ffffff',borderWidth:1,borderColor:'#e8e8e8',borderRadius:14,padding:16,marginBottom:12},
    code:{color:'#52B3B1',fontSize:13,fontWeight:'700',marginBottom:8},
    status:{color:'#777777',fontSize:12,marginTop:8},
    divider:{height:1,backgroundColor:'#e8e8e8',marginVertical:14},
    links:{gap:14},
    linkText:{color:'#287d7b',fontSize:13,fontWeight:'500'},
    bottomLinks:{borderTopWidth:1,borderTopColor:'#e8e8e8',marginTop:8,paddingTop:16,gap:18},
    bottomLink:{marginTop:16},
});
