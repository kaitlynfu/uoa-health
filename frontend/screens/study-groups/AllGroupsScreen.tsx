import {useState} from 'react';
import {Pressable,Text,TextInput,View} from 'react-native';
import {ConnectedScreen,Action,ui,type AppNavigation} from '../../components/ConnectedScreen';
import {useSession} from '../../context/SessionContext';
import {useSocialPage} from '../../hooks/useSocialPage';
import {type GroupSummary,studyFormats} from '../../services/socialFeatures';
import {Section,SocialTile,Unavailable,social} from '../../components/SocialDesign';
export default function AllGroupsScreen({navigation,route}:{navigation:AppNavigation;route?:{params?:{course?:string}}}){
    const initialCourse=route?.params?.course??'';
    const {auth}=useSession();const [query,setQuery]=useState(''),[course,setCourse]=useState(initialCourse);
    const [format,setFormat]=useState(''),[filters,setFilters]=useState({query:'',course:initialCourse,format:''});
    const [showFilters,setShowFilters]=useState(Boolean(initialCourse));
    const path=`/social/groups?q=${encodeURIComponent(filters.query)}&course=${encodeURIComponent(filters.course)}${filters.format?`&study_format=${encodeURIComponent(filters.format)}`:''}`;
    const page=useSocialPage<GroupSummary>(auth?.access_token,path);
    return <ConnectedScreen title="Explore Groups" description="Find a group for your course, or start one of your own." background navigation={navigation} account>
        <View style={ui.row}><View style={{flex:1}}><Action title="My Groups" variant="secondary" onPress={()=>navigation.navigate('UserGroup')}/></View><View style={{flex:1}}><Action title="Create Group" variant="secondary" onPress={()=>navigation.navigate('CreateGroup')}/></View></View>
        <View style={ui.card}>
        <TextInput accessibilityLabel="Search study groups" placeholder="Group name, description or course" style={ui.input} value={query} onChangeText={setQuery} maxLength={100}/>
        <Pressable accessibilityRole="button" accessibilityState={{expanded:showFilters}} onPress={()=>setShowFilters(v=>!v)} style={{minHeight:44,justifyContent:'center'}}><Text style={social.link}>{showFilters?'Hide filters':'Filter by course or study format'} {showFilters?'−':'+'}</Text></Pressable>
        {showFilters&&<>
        <Text style={ui.copy}>Course</Text>
        <TextInput accessibilityLabel="Filter by course" placeholder="Course (optional)" style={ui.input} value={course} onChangeText={setCourse} maxLength={100}/>
        <Text style={ui.copy}>How would you like to meet?</Text>
        <View accessibilityRole="radiogroup" accessibilityLabel="Study format" style={social.chips}>{['',...studyFormats].map(value=><Pressable key={value} accessibilityRole="radio" aria-checked={format===value} accessibilityState={{checked:format===value}} onPress={()=>setFormat(value)} style={[social.chip,{minHeight:44},format===value&&{backgroundColor:'#CFEFED'}]}><Text>{value||'All formats'}</Text></Pressable>)}</View>
        </>}
        <Action title="Search groups" disabled={page.busy} onPress={()=>{const next={query:query.trim(),course:course.trim(),format};if(JSON.stringify(next)===JSON.stringify(filters))void page.refresh();else setFilters(next);}}/>
        {(filters.query||filters.course||filters.format)&&<Action title="Clear search and filters" variant="secondary" onPress={()=>{setQuery('');setCourse('');setFormat('');setFilters({query:'',course:'',format:''});}}/>}
        </View>
        <Section title="Study groups" action="Refresh" onPress={()=>{if(!page.busy)void page.refresh();}}/>
        {page.busy&&<Text>Loading groups…</Text>}{!!page.error&&<Text accessibilityRole="alert">{page.error}</Text>}
        {!page.busy&&!page.error&&page.items.length===0&&<Unavailable title="Find your people" icon="people-outline">No groups match this search yet. Try fewer filters, or create the first group for your course.</Unavailable>}
        {page.items.map(group=><SocialTile key={group.id} title={group.name} detail={[group.course,group.study_format,`${group.member_count} ${group.member_count===1?'member':'members'}`,group.joined?'Joined':'Public group'].filter(Boolean).join(' · ')} icon="people-outline" onPress={()=>navigation.navigate('GroupDetails',{groupId:group.id,groupName:group.name})}/>)}
        {page.more&&<Action title="Show more groups" variant="secondary" disabled={page.busy} onPress={()=>void page.loadMore()}/>}
    </ConnectedScreen>;
}
