import {useEffect,useState} from 'react';
import {Pressable,Text,TextInput,View} from 'react-native';
import {Action,ui,type AppNavigation} from './ConnectedScreen';
import {studentRequest,type Milestone,type Plan} from '../services/studentApi';
import {validCatalogueYear} from '../services/catalogueYear';

export default function ProgrammeCourses({programmeId,navigation}:{programmeId:number;navigation:AppNavigation}) {
    const [year,setYear]=useState('2027'),[plans,setPlans]=useState<Plan[]>([]),[plan,setPlan]=useState('');
    const [milestones,setMilestones]=useState<Milestone[]>([]),[loading,setLoading]=useState(false),[error,setError]=useState(''),[attempt,setAttempt]=useState(0);
    useEffect(()=>{
        let active=true;setPlans([]);setPlan('');setMilestones([]);setError('');
        if(!validCatalogueYear(year)){setLoading(false);return;}
        setLoading(true);
        studentRequest<Plan[]>(`/journey/programmes/${programmeId}/plans?catalogue_year=${year}`)
            .then(rows=>{if(active){setPlans(rows);setPlan(rows[0]?.code??'');if(!rows.length)setError('No published study plans for this year. Check the official programme information.');}})
            .catch(e=>{if(active)setError(e.message);}).finally(()=>{if(active)setLoading(false);});
        return()=>{active=false;};
    },[programmeId,year,attempt]);
    useEffect(()=>{
        let active=true;setMilestones([]);
        if(!plan)return;
        setLoading(true);setError('');
        studentRequest<Omit<Milestone,'completed'>[]>(`/journey/programmes/${programmeId}/milestones?catalogue_year=${year}&plan_code=${encodeURIComponent(plan)}`)
            .then(rows=>{if(active)setMilestones(rows.map(m=>({...m,completed:false})));})
            .catch(e=>{if(active)setError(e.message);}).finally(()=>{if(active)setLoading(false);});
        return()=>{active=false;};
    },[programmeId,year,plan,attempt]);
    return <View style={{gap:12}}>
        <Text style={ui.title}>Study plans and courses</Text>
        <Text style={ui.copy}>Preview this programme’s published milestones. Browsing does not change your journey. Course choices and prerequisites should be checked with the official catalogue.</Text>
        <TextInput accessibilityLabel="Study plan catalogue year" value={year} onChangeText={setYear} keyboardType="number-pad" maxLength={4} style={ui.input}/>
        {!validCatalogueYear(year)&&<Text accessibilityRole="alert">Enter a year between 2024 and 2100.</Text>}
        {plans.map(p=><Pressable accessibilityRole="radio" accessibilityState={{selected:plan===p.code}} key={p.code} onPress={()=>setPlan(p.code)} style={[ui.card,plan===p.code&&{backgroundColor:'#EAF6F5'}]}><Text style={ui.copy}>{plan===p.code?'✓ ':''}{p.name}</Text></Pressable>)}
        {loading&&<Text>Loading study plan…</Text>}
        {!!error&&<><Text accessibilityRole="alert">{error}</Text><Action title="Retry study plans" variant="secondary" onPress={()=>setAttempt(a=>a+1)}/></>}
        {!loading&&!error&&!!plan&&!milestones.length&&<Text>No milestones have been published for this plan.</Text>}
        {milestones.map(m=><Pressable accessibilityRole="button" accessibilityLabel={'Preview '+m.title} key={m.id} style={ui.card} onPress={()=>navigation.navigate('MapCourse',{milestone:m,preview:true})}><Text style={ui.title}>{m.title}</Text><Text style={ui.copy}>{m.stage==null?'Programme requirement':'Stage '+m.stage} · {m.points} points · {m.required?'Required':'Elective'}</Text></Pressable>)}
        <Action title="Choose this programme for my journey" onPress={()=>navigation.navigate('ChoosePathway',{programmeId})}/>
    </View>;
}
