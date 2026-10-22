import {useEffect,useRef,useState} from 'react';
import {Alert,AppState,Platform,Pressable,ScrollView,StyleSheet,Switch,Text,View} from 'react-native';
import {useIsFocused,useNavigation,usePreventRemove} from '@react-navigation/native';
import {Ionicons} from '@expo/vector-icons';
import NavBar from '../components/NavBar';
import {Action,ui} from '../components/ConnectedScreen';
import {Section,Unavailable,social} from '../components/SocialDesign';
import {useSession} from '../context/SessionContext';
import HomeRouteEditor from '../components/HomeRouteEditor';
import CampusRouteMap from '../components/CampusRouteMap';
import {HomeArView,campusArAvailable,readCampusDraft,writeCampusDraft,exportCampusEnvironment,importCampusEnvironment,
    type EnvironmentEvent,type MarkerEvent,type PoseEvent} from '../modules/wayfinder-ar';
import {campusRequest,campusBinding,recogniseCampus,validateCampusRoute,validateCampusPoints,
    type CampusRoute,type CampusLeg,type CampusSummary,type CampusCatalog} from '../services/campusRoutes';
import {routeRequest} from '../services/sharedRoutes';
import {observeMarker,type MarkerCandidate} from '../services/markerAlignment';
import {routeJoinIndex} from '../services/environmentRecognition';
import {nudgePoint} from '../services/routeEditor';
import {mapToWorld,worldToMap,waypointYaw,progressAt,arrivalDwell,distance,turnAt,
    type Alignment,type Point,type GraphNode} from '../services/indoorNavigation';

const frameId=()=> 'campus-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2);
export default function CampusWayfinderScreen() {
    const {auth}=useSession(),token=auth?.access_token,focused=useIsFocused(),navigation=useNavigation<any>();
    const [catalog,setCatalog]=useState<CampusCatalog|null>(null),[canEdit,setCanEdit]=useState(false);
    const [showEditor,setShowEditor]=useState(false);
    const [start,setStart]=useState('303-G-ENTRANCE-B'),[destination,setDestination]=useState('303-104');
    const [accessible,setAccessible]=useState(false),[gaps,setGaps]=useState(false);
    const [route,setRoute]=useState<CampusRoute|null>(null),[legIndex,setLegIndex]=useState(0);
    const [camera,setCamera]=useState(false),[mode,setMode]=useState<'marker'|'world'>('marker');
    const [foreground,setForeground]=useState(AppState.currentState==='active');
    const [editing,setEditing]=useState(false),[selected,setSelected]=useState(1),[history,setHistory]=useState<GraphNode[][]>([]);
    const editorBase=useRef<CampusLeg|null>(null);
    const [busy,setBusy]=useState(false),[message,setMessage]=useState('Choose an available route to get started.');
    const [tracking,setTracking]=useState('initializing'),[mapping,setMapping]=useState('limited');
    const [alignment,setAlignment]=useState<Alignment|null>(null),alignmentRef=useRef<Alignment|null>(null);
    const [position,setPosition]=useState<Point|null>(null),[forward,setForward]=useState<Point>({x:0,y:1});
    const [index,setIndex]=useState(0),[arrived,setArrived]=useState(false),[showMap,setShowMap]=useState(false);
    const [saveRequest,setSaveRequest]=useState(''),pending=useRef<{id:string;route:CampusRoute;leg:number}|null>(null);
    const pose=useRef<{matrix:number[];timestamp:number;received:number}|null>(null),previous=useRef<Point|null>(null);
    const candidate=useRef<MarkerCandidate|null>(null),dwell=useRef<number|null>(null),blocked=useRef(false);
    const epoch=useRef(0);
    const leg=route?.legs[legIndex],active=focused&&foreground&&camera;
    const draftKey=(r:CampusRoute)=>String(auth?.user.id)+'-'+r.key;
    const ready=!!alignment&&active&&tracking==='normal'&&!busy&&!!pose.current&&Date.now()-pose.current.received<700;
    usePreventRemove(editing||busy,()=>{
        Alert.alert('Finish this operation first','Save your phone draft and exit the editor, or wait for the current save/publication.');
    });
    function clear(text:string) {
        alignmentRef.current=null;setAlignment(null);setPosition(null);previous.current=null;
        candidate.current=null;dwell.current=null;setMessage(text);
    }
    useEffect(()=>{
        const id=++epoch.current;
        setCanEdit(false);setCatalog(null);setCamera(false);setRoute(null);setBusy(false);setEditing(false);pending.current=null;
        clear('Loading campus routes…');
        if(!token) {setMessage('Sign in to download campus recordings.');return;}
        Promise.all([campusRequest<CampusCatalog>('catalog',token),routeRequest<{can_edit_routes:boolean}>('editor-access',token)])
            .then(([c,p])=>{if(id===epoch.current){setCatalog(c);setCanEdit(p.can_edit_routes===true);setMessage(c.published.length?'Choose a route above to download your directions.':'Check back here as more routes become available.');}})
            .catch(e=>{if(id===epoch.current)setMessage(e.message);});
        return ()=>{epoch.current++;};
    },[token]);
    useEffect(()=>{
        const listener=AppState.addEventListener('change',state=>{
            setForeground(state==='active');
            if(state!=='active'){
                clear('Tracking paused. Look around to recognise again, or rescan the editor marker.');
                if(pending.current){pending.current=null;setBusy(false);setSaveRequest('');setMessage('Capture interrupted. Keep your draft and capture again.');}
            }
        });
        return ()=>listener.remove();
    },[]);
    useEffect(()=>{if(!focused){clear('Tracking paused. Reopen recognition.');setCamera(false);}},[focused]);
    useEffect(()=>{
        if(!active)return;
        const timer=setInterval(()=>{
            if(alignmentRef.current&&(!pose.current||Date.now()-pose.current.received>1500)){
                clear('Tracking stopped. End and recognise the floor again.');setTracking('stale');blocked.current=true;
            }
        },500);
        return ()=>clearInterval(timer);
    },[active]);
    function persist(next:CampusRoute) {
        if(!canEdit)throw new Error('Editor access required.');
        // No room bytes in preferences: only geometry and keys to private native files.
        writeCampusDraft(draftKey(next),JSON.stringify({...next,legs:next.legs.map(({environment,sha256,...l})=>l)}));
    }
    async function prepare() {
        if(!token||busy||!canEdit)return;
        setBusy(true);const ticket=epoch.current;
        try {
            const query='template?start='+encodeURIComponent(start)+'&destination='+encodeURIComponent(destination)+
                '&accessible='+accessible+'&include_gaps='+gaps;
            const seed=validateCampusRoute(await campusRequest<CampusRoute>(query,token));
            if(ticket!==epoch.current)return;
            const fresh={...seed,legs:seed.legs.map(l=>({...l,frame_id:frameId(),captured:false}))};
            setRoute(fresh);setLegIndex(0);setMessage('Unverified survey draft. Start with floor leg 1. Load a phone draft if you have one.');
        } catch(e){if(ticket===epoch.current)setMessage((e as Error).message);}
        finally{if(ticket===epoch.current)setBusy(false);}
    }
    async function openPublished(summary:CampusSummary) {
        if(!token||busy)return;
        setBusy(true);const ticket=epoch.current;
        try {
            const result=validateCampusRoute(await campusRequest<CampusRoute>('routes/'+summary.key+'/'+summary.revision,token));
            if(ticket!==epoch.current)return;
            if(result.key!==summary.key||result.revision!==summary.revision||result.platform!=='ios-arkit-v1')throw new Error('Publication identity mismatch.');
            // Import every leg before navigation, so stairs never depend on a later download.
            for(const l of result.legs){
                if(!l.frame_id||!l.environment||!l.sha256)throw new Error('Incomplete floor recording.');
                await importCampusEnvironment(l.frame_id,l.environment,l.sha256,JSON.stringify(campusBinding(result,l)));
            }
            if(ticket!==epoch.current)return;
            setRoute({...result,legs:result.legs.map(({environment,...l})=>({...l,captured:true}))});
            setLegIndex(0);setMessage('Downloaded version '+result.revision+'. Choose a floor leg and recognise its surroundings.');
        }catch(e){if(ticket===epoch.current)setMessage((e as Error).message);}
        finally{if(ticket===epoch.current)setBusy(false);}
    }
    function loadDraft() {
        if(!route||!canEdit||busy)return;
        try{
            const raw=readCampusDraft(draftKey(route));
            if(!raw)throw new Error('No phone draft for this route/account.');
            const saved=validateCampusRoute(JSON.parse(raw));
            if(saved.key!==route.key||saved.legs.length!==route.legs.length)throw new Error('Wrong draft.');
            saved.legs.forEach((l,i)=>validateCampusPoints(l.points,route.legs[i].points));
            // Retain draft's expected revision: never silently bypass a publication conflict.
            setRoute(saved);setLegIndex(0);setMessage('Private draft loaded. Re-test every floor before publishing.');
        }catch(e){setMessage((e as Error).message);}
    }
    function begin(nextMode:'marker'|'world') {
        if(!leg||!campusArAvailable||busy|| (nextMode==='marker'&&!canEdit))return;
        if(nextMode==='world'&&!leg.captured){setMessage('Save/download this floor recording first.');return;}
        // A new editor calibration gets a new frame/file so a publication is never overwritten locally.
        if(nextMode==='marker'&&route){
            setRoute({...route,legs:route.legs.map((l,i)=>i===legIndex?{...l,frame_id:frameId(),captured:false}:l)});
        }
        setMode(nextMode);setMapping('limited');setTracking('initializing');setSaveRequest('');
        pose.current=null;blocked.current=false;setIndex(0);setArrived(false);setSelected(Math.min(1,leg.points.length-1));
        setEditing(false);setHistory([]);clear(nextMode==='world'?'Look around the recorded area. No arrows until recognised.':'Scan the 20 cm floor image at the designated start, top pointing towards '+leg.heading_label+'.');
        setCamera(true);
    }
    function align(a:Alignment,matrix:number[],join:boolean) {
        if(!leg)return;
        const p=worldToMap(matrix[12],matrix[14],a);
        alignmentRef.current=a;setAlignment(a);setPosition(p);previous.current=p;
        setForward({x:-a.fz*matrix[8]+a.fx*matrix[10],y:-a.fx*matrix[8]-a.fz*matrix[10]});
        setIndex(join?routeJoinIndex(leg.points,p):0);setArrived(false);
        setMessage(join?'Floor recognised. Follow only clear walkable space.':'Editor aligned. Walk, adjust and record this floor leg.');
    }
    function receiveMarker(event:MarkerEvent){
        if(mode!=='marker'||!active||!canEdit||alignmentRef.current||tracking!=='normal'||!pose.current||blocked.current)return;
        if(Date.now()-pose.current.received>500||Math.abs(pose.current.timestamp-event.nativeEvent.timestamp)>.2)return;
        const result=observeMarker(candidate.current,event.nativeEvent);candidate.current=result.candidate;
        if(result.alignment)align(result.alignment,pose.current.matrix,false);
    }
    function receivePose(event:PoseEvent){
        if(!active)return;
        const {transform:m,timestamp}=event.nativeEvent;
        if(m.length!==16||!m.every(Number.isFinite)||!Number.isFinite(timestamp))return;
        if(pose.current&&timestamp<=pose.current.timestamp)clear('Session restarted. Locate the floor again.');
        pose.current={matrix:m,timestamp,received:Date.now()};
        const a=alignmentRef.current;
        if(!a||tracking!=='normal'||!leg)return;
        const p=worldToMap(m[12],m[14],a);
        if(previous.current&&distance(previous.current,p)>.9){blocked.current=true;clear('Position jumped. End and recognise again.');return;}
        previous.current=p;setPosition(p);
        setForward({x:-a.fz*m[8]+a.fx*m[10],y:-a.fx*m[8]-a.fz*m[10]});
        if(editing||arrived||busy)return;
        const progress=progressAt(leg.points,index,p),arrival=arrivalDwell(dwell.current,timestamp,progress.next,progress.offRoute<.8);
        dwell.current=arrival.nearSince;if(arrival.reached)advance();
    }
    function advance(){
        if(!leg||editing)return;dwell.current=null;
        if(index>=leg.points.length-1)setArrived(true);else setIndex(i=>i+1);
    }
    function replacePoints(points:GraphNode[]){
        if(!route||!leg||!editing||!ready||!canEdit||!alignmentRef.current||!pose.current||Date.now()-pose.current.received>700)return;
        if(points.length>100||points.some(p=>!Number.isFinite(p.x)||!Number.isFinite(p.y)||Math.abs(p.x)>200||Math.abs(p.y)>200))return;
        setHistory(h=>[...h.slice(-19),leg.points]);
        setRoute({...route,legs:route.legs.map((l,i)=>i===legIndex?{...l,points,captured:false}:l)});
        setMessage('Draft changed. Save floor recording again before publishing.');
    }
    function move(p:Point){
        if(!leg||selected===0)return;
        replacePoints(leg.points.map((n,i)=>i===selected?{...n,...p}:n));
    }
    function savePhone(){
        if(!route||!canEdit)return false;
        try{route.legs.forEach(l=>validateCampusPoints(l.points,l.points));persist(route);setEditing(false);setHistory([]);setIndex(0);setArrived(false);setMessage('Draft saved on this phone. Record all floor legs before publishing.');return true;}
        catch(e){setMessage((e as Error).message);return false;}
    }
    async function restoreGeometry(source:'phone'|'previous'|'generated'){
        if(!route||!leg||!canEdit||!editing||busy||!token)return;
        const ticket=epoch.current;setBusy(true);
        try{
            let loaded:CampusRoute;
            if(source==='phone'){
                const raw=readCampusDraft(draftKey(route));
                if(!raw)throw new Error('No saved phone draft for this route.');
                loaded=validateCampusRoute(JSON.parse(raw));
            }else{
                if(source==='previous'&&route.revision<2)throw new Error('No earlier published version.');
                const path=source==='previous'?'routes/'+route.key+'/'+(route.revision-1):
                    'template?start='+encodeURIComponent(route.start)+'&destination='+encodeURIComponent(route.destination)+
                    '&accessible='+route.accessible+'&include_gaps='+route.include_gaps;
                loaded=validateCampusRoute(await campusRequest<CampusRoute>(path,token));
            }
            if(ticket!==epoch.current)return;
            if(!alignmentRef.current||!pose.current||Date.now()-pose.current.received>700)throw new Error('Tracking changed. Locate the floor and try again.');
            if(loaded.key!==route.key||loaded.legs[legIndex]?.floor!==leg.floor)throw new Error('Draft belongs to another floor/route.');
            const points=validateCampusPoints(loaded.legs[legIndex].points,leg.points);
            replacePoints(points);setSelected(Math.min(selected,points.length-1));
            setMessage('Loaded geometry into this floor draft. Check alignment and record again; nothing published.');
        }catch(e){if(ticket===epoch.current)setMessage((e as Error).message);}
        finally{if(ticket===epoch.current)setBusy(false);}
    }
    function capture(){
        if(!route||!leg||!ready||!canEdit||mapping!=='mapped'||!alignmentRef.current)return;
        try{
            validateCampusPoints(leg.points,leg.points);persist(route);
            const id=frameId(),a=alignmentRef.current;
            // Each capture gets an immutable private file. Re-downloading an older
            // publication must never overwrite this editor's newer room draft.
            const savedLeg={...leg,frame_id:frameId()},snapshot={...route,legs:route.legs.map((l,i)=>i===legIndex?savedLeg:l)};
            pending.current={id,route:snapshot,leg:legIndex};setBusy(true);
            setSaveRequest(JSON.stringify({id,storageKey:savedLeg.frame_id,routes:JSON.stringify(campusBinding(snapshot,savedLeg)),alignment:[a.x,a.z,a.height,a.fx,a.fz]}));
            setMessage('Saving floor recording… Keep this screen open.');
        }catch(e){setMessage((e as Error).message);}
    }
    function receiveEnvironment(event:EnvironmentEvent){
        const e=event.nativeEvent;
        if(e.kind==='saved'||e.kind==='error'){
            const saved=pending.current;
            if(!saved||e.requestID!==saved.id)return;
            pending.current=null;setBusy(false);setSaveRequest('');
            if(e.kind==='error'){setMessage(e.message??'Capture failed. Draft kept.');return;}
            const next={...saved.route,legs:saved.route.legs.map((l,i)=>i===saved.leg?{...l,captured:true}:l)};
            try{persist(next);setRoute(next);setEditing(false);setHistory([]);setArrived(false);setIndex(0);setCamera(false);clear('Floor recording saved. Test recognition with the paper covered.');}
            catch(err){setMessage((err as Error).message);}
            return;
        }
        if(e.kind!=='located'||mode!=='world'||!active||blocked.current||alignmentRef.current||tracking!=='normal'||!route||!leg||!pose.current)return;
        try{
            const a=recogniseCampus(e,route,leg,pose.current,Date.now());
            if(a)align(a,pose.current.matrix,true);
        }catch(err){blocked.current=true;clear((err as Error).message);}
    }
    async function publish(){
        if(!route||!token||!canEdit||busy)return;
        if(route.legs.some(l=>!l.captured)){setMessage('Capture EVERY floor leg after its latest edits before publishing.');return;}
        const capturedRoute=route,ticket=epoch.current;
        setBusy(true);
        try{
            persist(capturedRoute);
            const legs=[];
            for(const l of capturedRoute.legs)legs.push({floor:l.floor,frame_id:l.frame_id,points:l.points,environment:await exportCampusEnvironment(l.frame_id!)});
            if(ticket!==epoch.current)return;
            const result=await campusRequest<CampusSummary>('publish',token,{expected_revision:capturedRoute.revision,
                start:capturedRoute.start,destination:capturedRoute.destination,accessible:capturedRoute.accessible,
                include_gaps:capturedRoute.include_gaps,surveyed:true,legs});
            if(ticket!==epoch.current)return;
            const next={...capturedRoute,revision:result.revision};setRoute(next);persist(next);setEditing(false);
            setMessage('Published version '+result.revision+'. Other accounts can download this exact route and its floor recordings.');
            const refreshed=await campusRequest<CampusCatalog>('catalog',token);
            if(ticket===epoch.current)setCatalog(refreshed);
        }catch(e){if(ticket===epoch.current)setMessage((e as Error).message);}
        finally{if(ticket===epoch.current)setBusy(false);}
    }
    function confirmPublish(){
        Alert.alert('Publish surveyed route and surroundings?', 'Confirm you walked every leg, checked all doors and floor connections, and tested recognition with the paper covered. Campus spatial recordings will be available to all signed-in users. Do not publish private/restricted areas.',[
            {text:'Cancel',style:'cancel'},{text:'Verified — publish',onPress:publish},
        ]);
    }
    const button=(title:string,onPress:()=>void,disabled=false)=><Pressable accessibilityRole="button" disabled={disabled||busy}
        onPress={onPress} style={[s.button,(disabled||busy)&&s.disabled]}><Text style={s.buttonText}>{title}</Text></Pressable>;
    const progress=position&&leg?progressAt(leg.points,index,position):null;
    const offRoute=(progress?.offRoute??0)>.9,displayIndex=editing?selected:index,waypoint:number[]=[];
    if(alignment&&active&&tracking==='normal'&&leg&&(editing||(!arrived&&!offRoute))&&leg.points[displayIndex]){
        const target=mapToWorld(leg.points[displayIndex],alignment);
        waypoint.push(target.x,target.y,target.z,waypointYaw(leg.points[Math.max(0,displayIndex-1)],leg.points[displayIndex],alignment));
    }
    if(camera&&route&&leg)return <View style={{flex:1,backgroundColor:'#07131c'}}>
        {HomeArView&&active&&<HomeArView key={leg.frame_id+mode} style={StyleSheet.absoluteFill} active recordingEnabled={canEdit}
            environmentKey={leg.frame_id} localizationMode={mode} waypoint={waypoint} saveEnvironmentRequest={saveRequest}
            onPose={receivePose} onMarker={receiveMarker} onEnvironment={receiveEnvironment}
            onMapping={({nativeEvent})=>setMapping(nativeEvent.state)}
            onStatus={({nativeEvent})=>{setTracking(nativeEvent.state);if(nativeEvent.state!=='normal')clear(nativeEvent.message);}}/>}
        <View style={s.overlay} pointerEvents="box-none">
            <View style={s.card}>
                <Text style={s.title}>303 · Floor {leg.floor} · {route.destination}</Text>
                <Text style={s.white}>{alignment?'Located':'Not located'} · {tracking} · {mapping==='mapped'?'Ready to record':'Look around to map'}</Text>
                <Text style={s.white}>{arrived?'Floor leg complete':progress&&alignment?progress.remaining.toFixed(1)+' m remaining on this floor':'Arrows hidden until located'}</Text>
                <Text accessibilityLiveRegion="polite" style={s.white}>{message}</Text>
            </View>
            <ScrollView style={{maxHeight:'57%'}} contentContainerStyle={{gap:8,paddingBottom:22}}>
                {showMap&&<CampusRouteMap points={leg.points} position={position}/>}
                {editing?<HomeRouteEditor route={leg.points} selected={selected} ready={ready} busy={busy}
                    message={message} canUndo={history.length>0} select={setSelected} moveHere={()=>position&&move(position)}
                    insertHere={()=>{if(!position||leg.points.length<2)return;const after=Math.min(selected,leg.points.length-2);
                        replacePoints([...leg.points.slice(0,after+1),{...position,id:frameId(),label:'Surveyed waypoint'},...leg.points.slice(after+1)]);setSelected(after+1);}}
                    remove={()=>{if(selected<=0||selected>=leg.points.length-1)return;replacePoints(leg.points.filter((_,i)=>i!==selected));setSelected(selected-1);}}
                    nudge={(right,ahead)=>move(nudgePoint(leg.points[selected],forward,right,ahead))}
                    undo={()=>{if(!ready||!history.length)return;const points=history.at(-1)!;setHistory(h=>h.slice(0,-1));
                        setRoute({...route,legs:route.legs.map((l,i)=>i===legIndex?{...l,points,captured:false}:l)});setSelected(Math.min(selected,points.length-1));}}
                    reset={()=>restoreGeometry('generated')}
                    save={savePhone} cancel={()=>{if(editorBase.current)setRoute({...route,legs:route.legs.map((l,i)=>i===legIndex?editorBase.current!:l)});
                        setEditing(false);setHistory([]);setIndex(0);setArrived(false);setMessage('Unsaved editor changes discarded.');}}
                    restoreLocal={()=>restoreGeometry('phone')}
                    restorePrevious={()=>restoreGeometry('previous')}
                    publish={confirmPublish}/>:<View style={s.card}>
                    {arrived?<Text style={s.white}>{leg.transition?'Put your phone away while taking the '+leg.transition+'. On the next floor, stop and recognise its recording.':'You have reached this route’s destination.'}</Text>:
                        <Text style={s.white}>{offRoute?'Away from route — stop and check the map. No shortcut through walls.':alignment?leg.points[index]?.label+' · '+turnAt(leg.points,index):'Look around stable features in the recorded area.'}</Text>}
                    {button('Confirm nearby waypoint',advance,!ready||arrived||!progress||progress.next>.8||offRoute)}
                    {canEdit&&button('Edit floor arrows',()=>{editorBase.current=leg;setEditing(true);setSelected(Math.min(Math.max(1,index),leg.points.length-1));setHistory([]);},!ready)}
                    {arrived&&legIndex<route.legs.length-1&&button('At next floor — recognise surroundings',()=>{
                        clear('Locate the next floor.');setCamera(false);setLegIndex(i=>i+1);setArrived(false);
                    })}
                </View>}
                {canEdit&&button('Save floor recording + edited arrows',capture,!ready||mapping!=='mapped')}
                {button(showMap?'Hide schematic':'Show schematic',()=>setShowMap(v=>!v))}
                {button('End camera / floor selection',()=>{if(editing&&!savePhone())return;setCamera(false);clear('Select a floor or published route.');})}
            </ScrollView>
        </View>
    </View>;
    return <View style={{flex:1,backgroundColor:'#fff'}}>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.setup}>
        <View style={s.hero}>
            <View style={s.heroIcon}><Ionicons name="navigate-outline" size={28} color="#6554D9"/></View>
            <Text style={s.heading}>Find your room</Text>
            <Text style={s.copy}>Indoor directions for Building 303.</Text>
            <View style={s.steps}>{[
                ['1','Choose a route','Pick where you’re going from the routes below.'],
                ['2','Look around','Let the camera recognise your surroundings. No QR code needed.'],
                ['3','Follow the arrows','Keep your path clear. At a new floor, stop and look around again.'],
            ].map(([number,title,detail])=><View key={number} style={s.step}><View style={s.stepNumber}><Text style={s.stepNumberText}>{number}</Text></View><View style={{flex:1}}><Text style={s.stepTitle}>{title}</Text><Text style={s.copy}>{detail}</Text></View></View>)}</View>
        </View>
        {!campusArAvailable&&<Unavailable title="Open on a compatible iPhone" icon="phone-portrait-outline">{Platform.OS==='ios'?'Install the latest iPhone build to use indoor AR directions.':'You can browse this screen here. Camera directions are available in the iPhone app.'}</Unavailable>}
        {!token?<View style={ui.card}><Text style={ui.title}>Sign in to get started</Text><Text style={ui.copy}>Download an available route, then use your camera to find your position.</Text><Action title="Sign in" onPress={()=>navigation.navigate('Login')}/></View>:<>
            <Section title="Available routes" action={busy?'Loading…':'Refresh'} onPress={async()=>{
                if(busy)return;
                setBusy(true);const ticket=epoch.current;
                try{const c=await campusRequest<CampusCatalog>('catalog',token);if(ticket===epoch.current)setCatalog(c);}
                catch(e){if(ticket===epoch.current)setMessage((e as Error).message);}
                finally{if(ticket===epoch.current)setBusy(false);}
            }}/>
            {catalog?.published.length===0&&<Unavailable title="Routes are being prepared" icon="map-outline">There aren’t any ready-to-use routes for this building yet. Once a route is published, you can choose it here. You don’t need to set up or record the building yourself.</Unavailable>}
            {!catalog&&<Text style={s.copy}>Check the connection status below, or tap Refresh to try again.</Text>}
            {catalog?.published.map(p=><Pressable key={p.key} accessibilityRole="button" accessibilityLabel={'Download route from '+p.start+' to '+p.destination} accessibilityState={{disabled:busy||!campusArAvailable}} disabled={busy||!campusArAvailable} onPress={()=>openPublished(p)} style={[ui.card,{flexDirection:'row',alignItems:'center'},busy&&s.disabled]}>
                <View style={s.heroIcon}><Ionicons name="location-outline" size={25} color="#257D80"/></View><View style={{flex:1}}><Text style={s.stepTitle}>{p.destination}</Text><Text style={s.copy}>From {p.start}</Text><Text style={s.tag}>{p.accessible?'Step-free · lift available':'Standard route'} · Download route</Text></View><Ionicons name="chevron-forward" size={22} color="#257D80"/>
            </Pressable>)}
        </>}
        <Text accessibilityLiveRegion="polite" style={s.status}>{busy?'Working… ':''}{message}</Text>
        {route&&leg&&<View style={ui.card}>
            <Text style={s.tag}>YOUR SELECTED ROUTE</Text>
            <Text style={s.heading}>{route.start} → {route.destination}</Text>
            {route.survey_gaps.map((gap,i)=><Text key={i} style={s.warning}>Survey gap: {gap}</Text>)}
            <Text style={s.copy}>Choose the floor you’re on. Stand safely, hold your phone up and slowly look around to start.</Text>
            <View style={social.chips}>{route.legs.map((l,i)=><Pressable key={i} accessibilityRole="button" accessibilityState={{selected:i===legIndex,disabled:busy}} disabled={busy} onPress={()=>{setLegIndex(i);setMessage('Selected floor '+l.floor+'. Locate it before following arrows.');}} style={[s.choice,i===legIndex&&s.choiceSelected]}><Text style={s.choiceText}>{i===legIndex?'✓ ':''}Floor {l.floor}</Text><Text style={s.copy}>{l.captured?'Ready to recognise':'Needs recording'}</Text></Pressable>)}</View>
            <CampusRouteMap points={leg.points}/>
            {button('Start camera · recognise this floor',()=>begin('world'),!leg.captured||!campusArAvailable)}
            {!leg.captured&&<Text style={s.copy}>This floor still needs a recording before visitors can use it.</Text>}
            <Text style={s.copy}>Stop if the arrows don’t match a clear, walkable path.</Text>
        </View>}
        {canEdit&&<>
            <Pressable accessibilityRole="button" accessibilityState={{expanded:showEditor}} onPress={()=>setShowEditor(v=>!v)} style={[ui.card,{flexDirection:'row',alignItems:'center'}]}><Ionicons name="construct-outline" size={22} color="#647774"/><View style={{flex:1}}><Text style={s.stepTitle}>Route editor tools</Text><Text style={s.copy}>For preparing and publishing routes</Text></View><Ionicons name={showEditor?'chevron-up':'chevron-down'} size={20} color="#647774"/></Pressable>
            {showEditor&&<View style={ui.card}>
                <Text style={s.heading}>Prepare a route</Text><Text style={s.copy}>Choose the start and destination, then survey each floor on your iPhone.</Text>
                <Text style={s.stepTitle}>Starting location</Text>
                <View style={social.chips}>{catalog?.starts.map(p=><Pressable key={p.code} accessibilityRole="button" accessibilityState={{selected:p.code===start,disabled:busy}} disabled={busy} onPress={()=>setStart(p.code)} style={[s.choice,p.code===start&&s.choiceSelected]}><Text style={s.choiceText}>{p.code===start?'✓ ':''}{p.name} · {p.floor}</Text></Pressable>)}</View>
                <Text style={s.stepTitle}>Destination room</Text>
                <View style={social.chips}>{catalog?.destinations.map(p=><Pressable key={p.code} accessibilityRole="button" accessibilityState={{selected:p.code===destination,disabled:busy}} disabled={busy} onPress={()=>setDestination(p.code)} style={[s.choice,p.code===destination&&s.choiceSelected]}><Text style={s.choiceText}>{p.code===destination?'✓ ':''}{p.code}</Text></Pressable>)}</View>
                <View style={s.row}><Switch accessibilityLabel="Step-free route" value={accessible} disabled={busy} onValueChange={setAccessible}/><Text style={[s.copy,{flex:1}]}>Step-free route using lifts</Text></View>
                <View style={s.row}><Switch accessibilityLabel="Include survey gaps" value={gaps} disabled={busy} onValueChange={setGaps}/><Text style={[s.copy,{flex:1}]}>Include survey gaps to verify on site</Text></View>
                {button('Prepare route for survey',prepare,!campusArAvailable)}
                {route&&leg&&<>
                    <Section title={'Set up floor '+leg.floor}/>
                    <Text style={s.copy}>Place the same 20 × 20 cm printed image flat at {leg.start_label}. Point its top arrow towards {leg.heading_label}. Use a safe landing, never stairs, and keep it still during calibration.</Text>
                    {button('Align using floor image',()=>begin('marker'),!campusArAvailable)}
                    {button('Load my phone draft',loadDraft)}
                    {button('Save draft on phone',savePhone)}
                    <Text style={s.copy}>Record and test every floor before publishing. Published recordings let users recognise their surroundings without a marker.</Text>
                    {button('Publish verified route',confirmPublish,route.legs.some(l=>!l.captured))}
                </>}
                <Action title="Home routes · editor test" variant="secondary" onPress={()=>navigation.navigate('HomeDemo')}/>
            </View>}
        </>}
        </ScrollView><NavBar navigation={navigation} activeScreen="Wayfinder"/>
    </View>;
}
const s=StyleSheet.create({
    setup:{padding:20,gap:16,paddingBottom:110,width:'100%',maxWidth:680,alignSelf:'center'},heading:{fontSize:23,lineHeight:29,fontWeight:'700',color:'#173B39'},
    hero:{backgroundColor:'#F2FAF9',padding:22,borderRadius:24,gap:8,borderWidth:1,borderColor:'#E1F0EE'},
    heroIcon:{width:50,height:50,borderRadius:18,backgroundColor:'#F1ECFF',alignItems:'center',justifyContent:'center'},
    steps:{gap:18,marginTop:16},step:{flexDirection:'row',gap:12},stepNumber:{width:28,height:28,borderRadius:14,backgroundColor:'#DDEFEA',alignItems:'center',justifyContent:'center'},
    stepNumberText:{color:'#257D80',fontWeight:'700'},stepTitle:{fontSize:16,lineHeight:22,fontWeight:'700',color:'#173B39'},
    copy:{fontSize:14,lineHeight:21,color:'#647774'},status:{fontSize:14,lineHeight:21,color:'#526966',paddingHorizontal:4},
    tag:{fontSize:12,lineHeight:19,fontWeight:'600',color:'#257D80'},
    choice:{minHeight:44,padding:12,borderRadius:14,borderWidth:1,borderColor:'#E1EAE8',backgroundColor:'#F7F9F9'},choiceSelected:{backgroundColor:'#E0F2EE',borderColor:'#257D80'},choiceText:{fontSize:14,fontWeight:'600',color:'#285956'},
    warning:{color:'#854b12',lineHeight:21},button:{minHeight:48,padding:14,borderRadius:14,backgroundColor:'#287D7B',marginVertical:2,justifyContent:'center'},buttonText:{color:'white',fontWeight:'600',fontSize:15,textAlign:'center'},
    disabled:{opacity:.4},row:{flexDirection:'row',alignItems:'center',gap:8},overlay:{flex:1,padding:12,justifyContent:'space-between'},
    card:{padding:13,gap:8,borderRadius:12,backgroundColor:'rgba(6,25,40,.94)'},white:{color:'white'},title:{color:'white',fontSize:21,fontWeight:'700'},
});
