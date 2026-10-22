
import {useState} from 'react';
import {Linking,Pressable,Text,View,StyleSheet} from 'react-native';
import {Ionicons} from '@expo/vector-icons';
import type {NativeStackScreenProps} from '@react-navigation/native-stack';
import type {RootStackParamList} from '../navigation/AppNavigator';
import {ConnectedScreen,Action,ui} from '../components/ConnectedScreen';

export default function MapCourseScreen({navigation,route}:NativeStackScreenProps<RootStackParamList,'MapCourse'>){
    const milestone=route.params.milestone;
    const [error,setError]=useState('');
    const preview=route.params.preview;
    const status=preview?'Study plan preview':milestone.completed?'Completed':'Not marked completed';

    return <ConnectedScreen title="Milestone details" navigation={navigation} section="Journey" background={true}>
        <View style={styles.card}>
            <View style={styles.topRow}>
                <Text style={styles.code}>{milestone.custom_course_code || milestone.code}</Text>
                <Text style={[styles.status,milestone.completed&&!preview&&styles.completed]}>{status}</Text>
            </View>
            <Text style={ui.title}>{milestone.title}</Text>
            <Text style={styles.meta}>Stage {milestone.stage??'not specified'} · {milestone.points} points</Text>
            <View style={styles.divider}/>
            {(milestone.custom_title || milestone.custom_course_code) && <Text style={styles.description}>Your course label · Original milestone: {milestone.original_title || milestone.title}</Text>}
            <Text style={styles.sectionTitle}>Original milestone guidance</Text>
            <Text style={styles.description}>{milestone.description||'No additional description provided.'}</Text>
        </View>

        <Text style={styles.disclaimer}>Progress is self-reported, not a verified enrolment or an eligibility decision. Prerequisite data has not been verified for this catalogue. Check the official course information and seek academic advice before selecting courses.</Text>

        {!!milestone.official_url&&(
            <View style={styles.officialSection}>
                <Pressable accessibilityRole="link" accessibilityLabel="Open original course information" style={styles.officialLink} onPress={()=>{
                    try{
                        const url=new URL(milestone.official_url!);
                        if(url.protocol!=='https:')throw new Error();
                        void Linking.openURL(url.href).catch(()=>setError('Could not open the official page.'));
                    }catch{
                        setError('The official link is not a valid HTTPS address.');
                    }
                }}>
                    <View style={styles.officialIcon}>
                        <Ionicons name="open-outline" size={21} color="#287d7b"/>
                    </View>
                    <Text style={styles.officialTitle}>Open original course information</Text>
                    <Ionicons name="arrow-forward" size={19} color="#287d7b"/>
                </Pressable>
                {!!error&&<Text accessibilityRole="alert" style={styles.error}>{error}</Text>}
            </View>
        )}

        <Action title={preview?'Back to programme':'Back to progression'} onPress={()=>preview?navigation.goBack():navigation.navigate('Progression')}/>
        <Action title="Explore study groups" onPress={()=>navigation.navigate('AllGroups')}/>
    </ConnectedScreen>;
}

const styles=StyleSheet.create({
    card:{backgroundColor:'#ffffff',borderWidth:1,borderColor:'#e8e8e8',borderRadius:14,padding:16,marginBottom:14},
    topRow:{flexDirection:'row',justifyContent:'space-between',alignItems:'center',gap:8,marginBottom:12},
    code:{color:'#52B3B1',fontSize:13,fontWeight:'700'},
    status:{color:'#666666',backgroundColor:'#f5f5f5',borderRadius:20,paddingHorizontal:10,paddingVertical:5,fontSize:12,overflow:'hidden'},
    completed:{color:'#287d7b',backgroundColor:'#EAF6F5'},
    meta:{color:'#777777',fontSize:13,marginTop:8},
    divider:{height:1,backgroundColor:'#e8e8e8',marginVertical:16},
    sectionTitle:{color:'#555555',fontSize:14,fontWeight:'600',marginBottom:8},
    description:{color:'#555555',fontSize:14,lineHeight:21},
    disclaimer:{color:'#777777',fontSize:12,lineHeight:18,marginBottom:14},
    officialSection:{marginBottom:18},
    officialLink:{flexDirection:'row',alignItems:'center',backgroundColor:'#F7FBFB',borderWidth:1,borderColor:'#DDEDEC',borderRadius:14,padding:13},
    officialIcon:{width:42,height:42,borderRadius:12,backgroundColor:'#EAF6F5',alignItems:'center',justifyContent:'center',marginRight:12},
    officialTitle:{color:'#287d7b',fontSize:14,fontWeight:'600',flex:1},
    error:{color:'#b42318',fontSize:13,marginTop:10},
});
