import {useState} from 'react';
import {KeyboardAvoidingView,Modal,Platform,Pressable,ScrollView,StyleSheet,Text,TextInput,View} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {studentRequest,type Journey,type Milestone} from '../services/studentApi';

type Props={milestone:Milestone;token:string;onClose:()=>void;onSaved:(journey:Journey)=>void};
export default function MilestoneCourseEditor({milestone,token,onClose,onSaved}:Props){
    const [title,setTitle]=useState(milestone.custom_title || milestone.title);
    const [code,setCode]=useState(milestone.custom_course_code || '');
    const [saving,setSaving]=useState(false);
    const [error,setError]=useState('');
    const originalTitle=milestone.original_title || milestone.title;
    async function save(reset=false){
        if(saving)return;
        if(!reset&&!title.trim()){setError('Enter a course name.');return;}
        setSaving(true);setError('');
        try{
            const journey=await studentRequest<Journey>('/journey/me/milestones/'+milestone.id,token,'PATCH',{
                custom_title:reset||title.trim()===originalTitle?null:title.trim(),
                custom_course_code:reset?null:code.trim().toUpperCase()||null,
            });
            onSaved(journey);
        }catch(e){setError(e instanceof Error?e.message:'Could not save your course. Please retry.');}
        finally{setSaving(false);}
    }
    return <Modal visible transparent animationType="fade" onRequestClose={()=>{if(!saving)onClose();}}>
        <SafeAreaView style={styles.overlay}>
            <KeyboardAvoidingView style={styles.keyboard} behavior={Platform.OS==='ios'?'padding':'height'}>
                <View style={styles.card} accessibilityViewIsModal>
                    <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content}>
                        <Text accessibilityRole="header" style={styles.heading}>Edit course</Text>
                        <Text style={styles.copy}>Replace an elective placeholder with your chosen course, or personalise a course label.</Text>
                        <Text style={styles.original}>Original milestone: {originalTitle}</Text>
                        <Text style={styles.label}>Course code (optional)</Text>
                        <TextInput accessibilityLabel="Course code (optional)" style={styles.input} value={code} onChangeText={setCode} maxLength={30} autoCapitalize="characters" placeholder="e.g. CHEM 110" placeholderTextColor="#717171" editable={!saving}/>
                        <Text style={styles.label}>Course name</Text>
                        <TextInput accessibilityLabel="Course name" style={styles.input} value={title} onChangeText={setTitle} maxLength={100} placeholder="e.g. Chemistry of the Living World" placeholderTextColor="#717171" editable={!saving}/>
                        <Text style={styles.note}>Saved to your account. Points and completion stay the same. This is a personal label; check that your choice meets the programme requirements.</Text>
                        {!!error&&<Text accessibilityRole="alert" style={styles.error}>{error}</Text>}
                        <Pressable accessibilityRole="button" accessibilityState={{disabled:saving}} disabled={saving} style={[styles.save,saving&&styles.disabled]} onPress={()=>save()}><Text style={styles.saveText}>{saving?'Saving…':'Save course'}</Text></Pressable>
                        {(milestone.custom_title||milestone.custom_course_code)&&<Pressable accessibilityRole="button" disabled={saving} style={styles.secondary} onPress={()=>save(true)}><Text style={styles.link}>Restore original label</Text></Pressable>}
                        <Pressable accessibilityRole="button" disabled={saving} style={styles.secondary} onPress={onClose}><Text style={styles.link}>Cancel</Text></Pressable>
                    </ScrollView>
                </View>
            </KeyboardAvoidingView>
        </SafeAreaView>
    </Modal>;
}
const styles=StyleSheet.create({
    overlay:{flex:1,backgroundColor:'rgba(0,0,0,0.4)',padding:16},
    keyboard:{flex:1,justifyContent:'center',alignItems:'center'},
    card:{width:'100%',maxWidth:500,maxHeight:'95%',borderRadius:20,backgroundColor:'white',overflow:'hidden'},
    content:{padding:22,gap:12},
    heading:{fontSize:22,fontWeight:'700',color:'#111'},
    copy:{fontSize:14,lineHeight:21,color:'#555'},
    original:{fontSize:12,lineHeight:18,color:'#555',backgroundColor:'#F2FAF9',padding:12,borderRadius:10},
    label:{fontSize:14,fontWeight:'600',color:'#222'},
    input:{minHeight:48,borderWidth:1,borderColor:'#CCC',borderRadius:10,paddingHorizontal:12,paddingVertical:12,fontSize:15,color:'#111',backgroundColor:'#FFF'},
    note:{fontSize:12,lineHeight:18,color:'#666'},
    error:{fontSize:13,lineHeight:19,color:'#B3261E'},
    save:{minHeight:48,borderRadius:12,backgroundColor:'#52B3B1',alignItems:'center',justifyContent:'center',padding:12},
    saveText:{fontSize:15,fontWeight:'700',color:'#173b39'},
    secondary:{minHeight:44,justifyContent:'center',alignItems:'center'},
    link:{fontSize:14,fontWeight:'600',color:'#287d7b'},
    disabled:{opacity:0.6},
});
