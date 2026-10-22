import {useEffect,useMemo,useRef,useState} from 'react';
import {ActivityIndicator,Pressable,ScrollView,StyleSheet,Text,View} from 'react-native';
import {SafeAreaView,useSafeAreaInsets} from 'react-native-safe-area-context';
import {Ionicons} from '@expo/vector-icons';
import {Action,ui,useOperation,type AppNavigation} from '../../components/ConnectedScreen';
import PageHeader from '../../components/PageHeader';
import NavBar from '../../components/NavBar';
import {useSession} from '../../context/SessionContext';
import {studentRequest,type Profile} from '../../services/studentApi';
import {adaptCareer} from '../../services/careerAdapter';
import {careerQuestions,mergeQuizPreferences,questionChoices,quizCareers,quizComplete,quizResult,toggleQuizChoice,type QuizAnswers} from '../../services/careerQuiz';
import type {Career,PersonalisedRecommendation} from '../../types/programme';
import type {CareerRecord} from '../../services/studentApi';

const MAIN = '#52B3B1';
const LIGHT = '#CFEFED';
const PALE = '#EAF7F5';

type Phase='intro'|'questions'|'results';
export default function QuizScreen({navigation}:{navigation:AppNavigation}) {
    const {auth,preferences,setPreferences}=useSession();
    const {busy,notice,run,alive}=useOperation();
    const insets=useSafeAreaInsets(),scroll=useRef<ScrollView>(null);
    const [phase,setPhase]=useState<Phase>('intro'),[step,setStep]=useState(0);
    const [answers,setAnswers]=useState<QuizAnswers>({}),[saved,setSaved]=useState(false);
    const [careers,setCareers]=useState<Career[]>([]),[programmes,setProgrammes]=useState<PersonalisedRecommendation[]>([]);
    const [careerLoading,setCareerLoading]=useState(false),[programmeLoading,setProgrammeLoading]=useState(false);
    const [careerError,setCareerError]=useState(''),[programmeError,setProgrammeError]=useState(''),[attempt,setAttempt]=useState(0);
    const result=useMemo(()=>quizComplete(answers)?quizResult(answers):null,[answers]);
    const question=careerQuestions[step],selected=questionChoices(question,answers);
    const token=auth?.access_token;
    const currentToken=useRef(token);currentToken.current=token;
    useEffect(()=>{scroll.current?.scrollTo({y:0,animated:false});},[phase,step]);
    useEffect(()=>{
        if(phase!=='results'||!result)return;
        let active=true;
        setCareers([]);setProgrammes([]);setCareerError('');setProgrammeError('');
        setCareerLoading(true);setProgrammeLoading(true);
        studentRequest<CareerRecord[]>('/careers?limit=200').then(rows=>{
            if(active)setCareers(quizCareers(rows.map(row=>adaptCareer(row)),result));
        }).catch(()=>{if(active)setCareerError('Could not load careers. Your quiz results are still here.');})
            .finally(()=>{if(active)setCareerLoading(false);});
        studentRequest<PersonalisedRecommendation[]>('/programmes/recommend/personalised',undefined,'POST',{
            interests:result.preferences.interests,career_goals:result.preferences.career_interests,limit:4,
        }).then(rows=>{if(active)setProgrammes(rows);})
            .catch(()=>{if(active)setProgrammeError('Could not load programmes. Try again when you are connected.');})
            .finally(()=>{if(active)setProgrammeLoading(false);});
        return()=>{active=false;};
    },[phase,result,attempt]);
    function changeAnswer(id:string){setSaved(false);setAnswers(previous=>toggleQuizChoice(previous,question.id,id));}
    function saveResults(){
        if(!result||saved)return;
        void run(async()=>{
            const existing=token?await studentRequest<Profile>('/profile/me',token):preferences;
            if(!alive.current||currentToken.current!==token)return;
            const merged=mergeQuizPreferences(existing,result.preferences);
            if(token)await studentRequest('/profile/me',token,'PATCH',merged);
            if(!alive.current||currentToken.current!==token)return;
            setPreferences(merged);setSaved(true);
        });
    }
    return <SafeAreaView edges={['top','left','right']} style={styles.page}>
        <PageHeader title="Career Quiz" background={false} navigation={navigation} leftIcon="back"/>
        <ScrollView ref={scroll} showsVerticalScrollIndicator={false} contentContainerStyle={[styles.content,{paddingBottom:110+insets.bottom}]}>
            {phase==='intro'?<>
                <View style={styles.hero}>
                    <View style={styles.heroIcon}><Ionicons name="compass-outline" size={38} color="#52B3B1"/></View>
                    <Text accessibilityRole="header" style={styles.heading}>Find a direction that interests you</Text>
                    <Text style={ui.copy}>Discover the health career areas you are curious about, then explore careers and programmes that connect to them.</Text>
                    <View style={styles.meta}><Text style={styles.metaText}>6 questions</Text><Text style={styles.metaText}>About 2 minutes</Text></View>
                </View>
                <View style={ui.card}>
                    <Text style={styles.sectionTitle}>How it works</Text>
                    {['Choose one or two answers for each question.','See your interest areas and why they appeared.','Explore real careers and programmes, then save your interests if you want.'].map((text,index)=><View key={text} style={styles.explanation}><View style={styles.number}><Text style={styles.numberText}>{index+1}</Text></View><Text style={[ui.copy,{flex:1}]}>{text}</Text></View>)}
                </View>
                <Action title="Start Career Quiz" onPress={()=>setPhase('questions')}/>
                <Text style={styles.footnote}>This is an interest exploration quiz. It does not assess your ability or eligibility for a programme.</Text>
            </>:phase==='questions'?<>
                <View accessibilityRole="progressbar" accessibilityLabel="Quiz progress" accessibilityValue={{min:0,max:careerQuestions.length,now:step+1,text:`Question ${step+1} of ${careerQuestions.length}`}}>
                    <View style={styles.progressLabels}><Text style={styles.eyebrow}>QUESTION {step+1} OF {careerQuestions.length}</Text><Text style={styles.small}>Pick up to 2</Text></View>
                    <View style={styles.progressTrack}><View style={[styles.progressFill,{width:`${(step+1)/careerQuestions.length*100}%`}]}/></View>
                </View>
                <View key={question.id} style={{gap:8}}><Text accessibilityRole="header" accessibilityLiveRegion="polite" style={styles.heading}>{question.title}</Text><Text style={ui.copy}>{question.detail}</Text></View>
                <Text style={styles.small}>Choose one or two. Tap a selected answer to remove it.</Text>
                <View style={{gap:10}}>{question.choices.map(choice=>{
                    const checked=selected.some(item=>item.id===choice.id),disabled=!checked&&selected.length===2;
                    return <Pressable key={choice.id} accessibilityRole="checkbox" accessibilityLabel={choice.label} accessibilityState={{checked,disabled}} disabled={disabled} onPress={()=>changeAnswer(choice.id)} style={({pressed})=>[styles.choice,checked&&styles.selectedChoice,disabled&&{opacity:.55},pressed&&{opacity:.8}]}>
                        <View style={[styles.check,checked&&styles.checked]}>{checked&&<Ionicons name="checkmark" size={17} color="#fff"/>}</View><Text style={[styles.choiceText,checked&&{color:'#1E6568'}]}>{choice.label}</Text>
                    </Pressable>;
                })}</View>
                <Text accessibilityLiveRegion="polite" style={styles.small}>{selected.length===2?'2 selected. Deselect an answer to choose another.':selected.length?'1 selected. You can choose one more.':'Select an answer to continue.'}</Text>
                <Action title={step===careerQuestions.length-1?'See my results':'Continue'} disabled={!selected.length} onPress={()=>{if(step===careerQuestions.length-1){if(result)setPhase('results');}else setStep(step+1);}}/>
                <Action title={step===0?'Back to introduction':'Previous question'} variant="secondary" onPress={()=>step===0?setPhase('intro'):setStep(step-1)}/>
            </>:result&&<>
                <View style={styles.hero}><Text style={styles.eyebrow}>YOUR QUIZ RESULTS</Text><Text accessibilityRole="header" style={styles.heading}>Your interests point towards…</Text><Text style={ui.copy}>These areas appeared in your answers. Areas with more selected answers appear first; equally ranked areas share a place.</Text></View>
                {result.areas.map(area=>{
                    const rank=result.areas.filter(item=>item.score>area.score).length+1;
                    return <View style={ui.card} key={area.id}>
                        <View style={styles.areaHeader}><View style={[styles.areaIcon,{backgroundColor:area.background}]}><Ionicons name={area.icon} size={26} color={area.color}/></View><View style={{flex:1,gap:3}}><Text style={styles.eyebrow}>{rank===1?'TOP INTEREST AREA':`INTEREST AREA · ${rank}`}</Text><Text style={styles.sectionTitle}>{area.title}</Text></View></View>
                        <Text style={ui.copy}>{area.description}</Text><Text style={styles.small}>You chose: {area.reasons.slice(0,2).join(' · ')}{area.reasons.length>2?` · and ${area.reasons.length-2} more`:''}</Text>
                        <Pressable accessibilityRole="button" accessibilityLabel={`Explore ${area.title} careers`} onPress={()=>navigation.navigate('CareerExplorer',{category:area.category})}><Text style={styles.link}>Explore this career area →</Text></Pressable>
                    </View>;
                })}
                <View style={styles.saveCard}>
                    <Text style={styles.sectionTitle}>Make For you reflect your answers</Text>
                    <Text style={ui.copy}>Add these quiz interests and career areas alongside your existing choices.</Text>
                    <View style={styles.chips}>{result.preferences.interests.map(term=><View key={term} style={styles.chip}><Text style={styles.chipText}>{term}</Text></View>)}</View>
                    <Text style={styles.small}>Career areas: {result.preferences.career_interests.join(' · ')}</Text>
                    <Text style={styles.small}>{auth?'Save to your account to use these interests in For you.':'Guest choices last for this session. Sign in separately if you want to save interests to an account.'}</Text>
                    {!!notice&&<Text accessibilityRole="alert" style={styles.error}>{notice}</Text>}
                    {saved?<><Text accessibilityLiveRegion="polite" style={styles.link}>{auth?'Added to your saved interests.':'Added for this session.'}</Text><Action title="Open For you" onPress={()=>navigation.navigate('Recommendations')}/></>:<Action title={busy?'Saving interests…':'Add results to For you'} disabled={busy} onPress={saveResults}/>}
                </View>
                <Text accessibilityRole="header" style={styles.sectionTitle}>Careers to explore</Text>
                <Text style={ui.copy}>Examples from our catalogue in your selected areas. Open a career to see its linked programmes.</Text>
                {careerLoading?<ActivityIndicator accessibilityLabel="Loading quiz career suggestions"/>:careerError?<Retry message={careerError} onPress={()=>setAttempt(n=>n+1)}/>:careers.length?careers.map(career=><Pressable key={career.id} accessibilityRole="button" accessibilityLabel={`Explore career: ${career.title}`} onPress={()=>navigation.navigate('CareerDetails',{career})} style={styles.resultCard}><View style={{flex:1,gap:5}}><Text style={styles.cardTitle}>{career.title}</Text><Text style={styles.small}>{career.category}</Text></View><Ionicons name="chevron-forward" size={20} color="#666"/></Pressable>):<View style={ui.card}><Text style={ui.copy}>No careers in these areas are listed in the current catalogue yet. You can explore all careers below.</Text></View>}
                <Text accessibilityRole="header" style={styles.sectionTitle}>Programmes to explore</Text>
                <Text style={ui.copy}>Suggested using keyword matches between your quiz interests and the programme catalogue.</Text>
                {programmeLoading?<ActivityIndicator accessibilityLabel="Loading quiz programme suggestions"/>:programmeError?<Retry message={programmeError} onPress={()=>setAttempt(n=>n+1)}/>:programmes.length?programmes.map(programme=><Pressable key={programme.id} accessibilityRole="button" accessibilityLabel={`Explore programme: ${programme.name}`} onPress={()=>navigation.navigate('ProgrammeDetails',{programmeId:programme.id})} style={styles.resultCard}><View style={{flex:1,gap:7}}><Text style={styles.cardTitle}>{programme.name}</Text><Text style={styles.small}>Catalogue matches: {[...new Set([...programme.matched_interests,...programme.matched_career_goals])].join(' · ')}</Text><Text style={styles.link}>View programme and entry requirements →</Text></View></Pressable>):<View style={ui.card}><Text style={ui.copy}>No programme keyword matches yet. Browse all programmes to explore other options.</Text></View>}
                <Action title="Browse all careers" variant="secondary" onPress={()=>navigation.navigate('CareerExplorer')}/>
                <Action title="Browse all programmes" variant="secondary" onPress={()=>navigation.navigate('Programmes')}/>
                <Action title="Review my answers" variant="secondary" disabled={busy} onPress={()=>{setStep(0);setPhase('questions');}}/>
                <Action title="Retake quiz" variant="secondary" disabled={busy} onPress={()=>{setAnswers({});setSaved(false);setStep(0);setPhase('intro');}}/>
                <Text style={styles.footnote}>Use these results as a starting point. Career areas use simple answer counts; programme suggestions use catalogue keywords. Neither is a suitability score or a guarantee of entry.</Text>
            </>}
        </ScrollView><NavBar navigation={navigation} activeScreen="Career"/>
    </SafeAreaView>;
}
function Retry({message,onPress}:{message:string;onPress:()=>void}){
    return <View style={ui.card}><Text accessibilityRole="alert" style={styles.error}>{message}</Text><Action title="Retry suggestions" variant="secondary" onPress={onPress}/></View>;
}
const styles=StyleSheet.create({
    page:{flex:1,backgroundColor:'#fff',width:'100%',maxWidth:680,alignSelf:'center'},content:{padding:20,paddingTop:8,gap:16},
    hero:{backgroundColor:'#F5FAF9',borderRadius:24,padding:22,gap:14,borderWidth:1,borderColor:'#DDEFED'},
    heroIcon:{width:64,height:64,borderRadius:32,backgroundColor:PALE,alignItems:'center',justifyContent:'center'},
    heading:{fontSize:25,lineHeight:32,fontWeight:'700',color:'#173B39'},sectionTitle:{fontSize:19,lineHeight:25,fontWeight:'700',color:'#173B39'},cardTitle:{fontSize:16,lineHeight:23,fontWeight:'700',color:'#173B39'},
    meta:{flexDirection:'row',flexWrap:'wrap',gap:10},metaText:{fontSize:13,fontWeight:'600',color:'#52B3B1',paddingVertical:7,paddingHorizontal:12,backgroundColor:PALE,borderRadius:15},
    explanation:{flexDirection:'row',gap:12,alignItems:'flex-start'},number:{width:28,height:28,borderRadius:14,backgroundColor:PALE,alignItems:'center',justifyContent:'center'},numberText:{fontSize:14,fontWeight:'700',color:MAIN},
    small:{fontSize:13,lineHeight:20,color:'#5B6B6B'},footnote:{fontSize:13,lineHeight:20,color:'#5B6B6B',paddingHorizontal:4},eyebrow:{fontSize:11,lineHeight:16,fontWeight:'700',letterSpacing:1,color:MAIN},
    progressLabels:{flexDirection:'row',flexWrap:'wrap',justifyContent:'space-between',gap:8,marginBottom:10},progressTrack:{height:6,borderRadius:3,backgroundColor:PALE,overflow:'hidden'},progressFill:{height:6,borderRadius:3,backgroundColor:MAIN},
    choice:{flexDirection:'row',alignItems:'center',gap:12,borderWidth:1,borderColor:'#DDE7E5',backgroundColor:'#fff',borderRadius:16,padding:16,minHeight:66},selectedChoice:{backgroundColor:PALE,borderColor:MAIN},choiceText:{flex:1,fontSize:15,lineHeight:22,color:'#173B39'},
    check:{width:24,height:24,borderRadius:8,borderWidth:1.5,borderColor:'#A7BEBC',alignItems:'center',justifyContent:'center'},checked:{backgroundColor:MAIN,borderColor:MAIN},
    areaHeader:{flexDirection:'row',alignItems:'center',gap:14},areaIcon:{width:52,height:52,borderRadius:18,alignItems:'center',justifyContent:'center'},link:{fontSize:14,lineHeight:22,fontWeight:'600',color:MAIN,paddingVertical:6},
    saveCard:{padding:20,gap:14,backgroundColor:'#F5FAF9',borderWidth:1,borderColor:'#DDEFED',borderRadius:20},chips:{flexDirection:'row',flexWrap:'wrap',gap:7},chip:{paddingHorizontal:10,paddingVertical:6,backgroundColor:PALE,borderRadius:14},chipText:{fontSize:12,lineHeight:18,color:'#52B3B1'},
    resultCard:{flexDirection:'row',alignItems:'center',gap:12,borderRadius:18,borderWidth:1,borderColor:'#E2ECEB',padding:18,backgroundColor:'#fff'},error:{fontSize:14,lineHeight:21,color:'#A13232'},
});
