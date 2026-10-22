import type {Career} from '../types/programme';

export const careerAreas = [
    {id:'clinical',title:'Clinical care',category:'Clinical',icon:'medical-outline',color:'#5F4DD8',background:'#E8E3FF',goal:'clinical',description:'Explore hands-on care, treatment and support for patients.'},
    {id:'research',title:'Research & discovery',category:'Research',icon:'flask-outline',color:'#24805C',background:'#DDF3E9',goal:'research',description:'Explore scientific questions, laboratory work and new discoveries.'},
    {id:'public',title:'Public health',category:'Public Health',icon:'earth-outline',color:'#247F91',background:'#DFF3F5',goal:'public health',description:'Explore prevention, health policy and wellbeing across communities.'},
    {id:'mental',title:'Mental health & wellbeing',category:'Mental Health',icon:'chatbubbles-outline',color:'#B95F21',background:'#FFE4D4',goal:'mental health',description:'Explore how people think, feel and access support.'},
    {id:'technology',title:'Health technology',category:'Tech',icon:'laptop-outline',color:'#356AC3',background:'#DFE9FF',goal:'health technology',description:'Explore data, digital tools and technology that improve healthcare.'},
] as const;
export type CareerAreaId=typeof careerAreas[number]['id'];
type Choice={id:string;label:string;area:CareerAreaId;interest:string};
type Question={id:string;title:string;detail:string;choices:readonly Choice[]};
export const careerQuestions:readonly Question[] = [
    {id:'subjects',title:'What would you most like to learn about?',detail:'Think about the topics you would enjoy exploring.',choices:[
        {id:'body',label:'How the body works and how to treat illness',area:'clinical',interest:'human biology'},
        {id:'science',label:'The science behind diseases and new discoveries',area:'research',interest:'biomedical science'},
        {id:'communities',label:'Why some communities have better health than others',area:'public',interest:'public health'},
        {id:'mind',label:'How thoughts, emotions and behaviour affect wellbeing',area:'mental',interest:'psychology'},
        {id:'digital',label:'How data and digital tools can improve healthcare',area:'technology',interest:'health informatics'},
    ]},
    {id:'activities',title:'Which activity sounds most rewarding?',detail:'Imagine spending part of your day doing this.',choices:[
        {id:'care',label:'Helping someone feel better through direct care',area:'clinical',interest:'patient care'},
        {id:'investigate',label:'Running an experiment to answer a scientific question',area:'research',interest:'research'},
        {id:'prevent',label:'Planning ways to prevent illness in a community',area:'public',interest:'health promotion'},
        {id:'support',label:'Listening to someone and helping them find support',area:'mental',interest:'mental health'},
        {id:'build',label:'Designing a tool that makes healthcare easier',area:'technology',interest:'technology'},
    ]},
    {id:'setting',title:'Where could you picture yourself working?',detail:'Choose the settings you are curious about, even if you have not tried them.',choices:[
        {id:'clinic',label:'A clinic or hospital, working with patients',area:'clinical',interest:'clinical practice'},
        {id:'laboratory',label:'A laboratory or research team',area:'research',interest:'laboratory science'},
        {id:'community',label:'A community organisation or health policy team',area:'public',interest:'health policy'},
        {id:'wellbeing',label:'A wellbeing service, supporting people one-to-one',area:'mental',interest:'wellbeing'},
        {id:'innovation',label:'A team developing health software or devices',area:'technology',interest:'health technology'},
    ]},
    {id:'problems',title:'What kind of problem would you like to solve?',detail:'There are no right or wrong answers.',choices:[
        {id:'treatment',label:'Finding the best way to care for an individual patient',area:'clinical',interest:'treatment'},
        {id:'causes',label:'Understanding what causes disease',area:'research',interest:'disease research'},
        {id:'access',label:'Making healthcare more accessible and fair',area:'public',interest:'health equity'},
        {id:'stress',label:'Helping people manage stress and emotional challenges',area:'mental',interest:'mental wellbeing'},
        {id:'systems',label:'Making health information and tools more useful',area:'technology',interest:'health data'},
    ]},
    {id:'learning',title:'Which learning experience would you choose?',detail:'Pick what you would be most excited to try.',choices:[
        {id:'practical',label:'Practising hands-on care skills',area:'clinical',interest:'healthcare'},
        {id:'experiment',label:'Testing ideas and analysing an experiment',area:'research',interest:'scientific research'},
        {id:'campaign',label:'Designing a community health campaign',area:'public',interest:'population health'},
        {id:'behaviour',label:'Exploring human behaviour through case studies',area:'mental',interest:'behavioural science'},
        {id:'prototype',label:'Building a prototype or exploring a health dataset',area:'technology',interest:'digital health'},
    ]},
    {id:'impact',title:'What impact would feel most meaningful to you?',detail:'Choose what matters to you right now. Your interests can change.',choices:[
        {id:'recovery',label:'Seeing someone recover with the care I provide',area:'clinical',interest:'patient care'},
        {id:'discovery',label:'Contributing to a discovery that improves health',area:'research',interest:'medical research'},
        {id:'population',label:'Improving health for a whole community',area:'public',interest:'community health'},
        {id:'confidence',label:'Helping someone feel understood and supported',area:'mental',interest:'mental health'},
        {id:'tools',label:'Creating useful technology for patients and health teams',area:'technology',interest:'health technology'},
    ]},
];
export type QuizAnswers=Readonly<Record<string,readonly string[]>>;
export function questionChoices(question:Question,answers:QuizAnswers):Choice[] {
    const selected=new Set(answers[question.id]??[]);
    return question.choices.filter(choice=>selected.has(choice.id)).slice(0,2);
}
export function quizComplete(answers:QuizAnswers):boolean {
    return careerQuestions.every(question=>{
        const ids=answers[question.id]??[];
        return ids.length>=1&&ids.length<=2&&new Set(ids).size===ids.length&&ids.every(id=>question.choices.some(choice=>choice.id===id));
    });
}
export function toggleQuizChoice(answers:QuizAnswers,questionId:string,choiceId:string):QuizAnswers {
    const question=careerQuestions.find(item=>item.id===questionId);
    if(!question?.choices.some(choice=>choice.id===choiceId))return answers;
    const selected=questionChoices(question,answers).map(choice=>choice.id);
    if(!selected.includes(choiceId)&&selected.length===2)return answers;
    return {...answers,[questionId]:selected.includes(choiceId)?selected.filter(id=>id!==choiceId):[...selected,choiceId]};
}
export function quizResult(answers:QuizAnswers) {
    if(!quizComplete(answers))throw new Error('Answer each question with one or two choices to see your results.');
    const ranked=careerAreas.map(area=>({...area,score:0,reasons:[] as string[]}));
    for(const question of careerQuestions){
        const choices=questionChoices(question,answers);
        for(const choice of choices){
            const area=ranked.find(item=>item.id===choice.area)!;
            // A question contributes one point, shared if two answers are chosen.
            area.score+=1/choices.length;area.reasons.push(choice.label);
        }
    }
    ranked.sort((a,b)=>b.score-a.score||a.title.localeCompare(b.title));
    return {areas:ranked.filter(area=>area.score>0),preferences:quizPreferences(answers)};
}
export function quizPreferences(answers:QuizAnswers) {
    const choices=careerQuestions.flatMap(question=>questionChoices(question,answers));
    const areas=careerAreas.filter(area=>choices.some(choice=>choice.area===area.id));
    return {interests:uniqueTerms(choices.map(choice=>choice.interest)),career_interests:areas.map(area=>area.goal)};
}
function uniqueTerms(terms:readonly string[]) {
    const seen=new Set<string>();
    return terms.map(term=>term.trim()).filter(term=>{const key=term.toLowerCase();if(!key||seen.has(key))return false;seen.add(key);return true;});
}
export function mergeQuizPreferences(existing:{interests:readonly string[];career_interests:readonly string[]},additions:ReturnType<typeof quizPreferences>) {
    const merged={interests:uniqueTerms([...existing.interests,...additions.interests]),career_interests:uniqueTerms([...existing.career_interests,...additions.career_interests])};
    if(merged.interests.length>30||merged.career_interests.length>30)throw new Error('Your saved interests are full. Edit your interests in Profile to make room, then try saving these results again.');
    return merged;
}
export function quizCareers(careers:readonly Career[],result:ReturnType<typeof quizResult>):Career[] {
    const ranked=careers.map(career=>({career,area:result.areas.find(area=>area.category===career.category)}))
        .filter((item):item is typeof item & {area:NonNullable<typeof item.area>}=>Boolean(item.area))
        .sort((a,b)=>b.area.score-a.area.score||a.career.title.localeCompare(b.career.title));
    const examples:Career[]=[];
    // Show one catalogue example per selected area before filling remaining slots.
    for(const area of result.areas){const example=ranked.find(item=>item.area.id===area.id)?.career;if(example)examples.push(example);}
    for(const {career} of ranked)if(!examples.some(item=>item.id===career.id))examples.push(career);
    return examples.slice(0,6);
}
