import { useEffect, useRef, useState } from "react";
import { useIsFocused, useNavigation, usePreventRemove } from "@react-navigation/native";
import { Alert, AppState, Keyboard, KeyboardAvoidingView, Modal, Platform, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import HomeRouteMap from "../components/HomeRouteMap";
import HomeRouteEditor from "../components/HomeRouteEditor";
import { useSession } from '../context/SessionContext';
import { routeRequest, checkedSharedRoute, type SharedRoute } from '../services/sharedRoutes';
import { canReuseAlignment, manualTestAlignment, roomSaveStatus } from '../services/routeSession';
import { homeDestinations, homeGraph } from "../data/homeDemo";
import { HomeArView, markerArAvailable, routeEditorAvailable, environmentAvailable, readEnvironmentRoutes, readHomeRoutes, writeHomeRoutes, type PoseEvent, type MarkerEvent, type EnvironmentEvent } from "../modules/wayfinder-ar";
import { recognisedAlignment, routeJoinIndex as recognitionJoinIndex } from '../services/environmentRecognition';
import { decodeRoutes, encodeRoutes, moveWaypoint, insertWaypoint, deleteWaypoint, nudgePoint, validateRoute, type SavedRoutes } from "../services/routeEditor";
import { observeMarker, type MarkerCandidate } from "../services/markerAlignment";
import { arrivalDwell, distance, mapToWorld, progressAt, relativeBearing, routeLength,
    shortestPath, turnAt, waypointYaw, worldToMap, type Alignment, type Point, type GraphNode } from "../services/indoorNavigation";

const generatedRoutes: SavedRoutes = Object.fromEntries(homeDestinations.map(d=>[d.id,shortestPath(homeGraph,'start',d.id)]));

export default function HomeDemoScreen() {
    const { auth } = useSession();
    const token = auth?.access_token;
    const [canEdit,setCanEdit] = useState(false);
    const [busy,setBusy] = useState(false);
    const [sessionRoute,setSessionRoute] = useState<GraphNode[] | null>(null);
    const [revision,setRevision] = useState(0);
    const [phoneHeight,setPhoneHeight] = useState('');
    const [manualSetup,setManualSetup] = useState(false);
    const [manualError,setManualError] = useState('');
    const [manualReady,setManualReady] = useState(false);
    const [mode,setMode] = useState<'marker'|'world'>('marker');
    const [mapping,setMapping] = useState('limited');
    const [saveRequest,setSaveRequest] = useState('');
    const [environmentMessage,setEnvironmentMessage] = useState('');
    const [savingEnvironment,setSavingEnvironment] = useState(false);
    const [hasEnvironment,setHasEnvironment] = useState(()=>{
        try {return environmentAvailable && !!readEnvironmentRoutes();} catch {return false;}
    });
    const pendingEnvironment=useRef<string|null>(null);
    const worldBlocked=useRef(false);
    const [sharedMessage,setSharedMessage] = useState('Published routes are checked when you open the camera.');
    const focused = useIsFocused();
    const navigation = useNavigation();
    const [loaded] = useState(()=>{
        try { return {routes:decodeRoutes(readHomeRoutes(),generatedRoutes),error:''}; }
        catch { return {routes:{} as SavedRoutes,error:'Saved edits could not be read. Showing generated routes; editing is disabled to preserve the stored data.'}; }
    });
    const [savedRoutes,setSavedRoutes] = useState(loaded.routes);
    const [editing,setEditing] = useState(false);
    const [draft,setDraft] = useState<GraphNode[] | null>(null);
    const [selected,setSelected] = useState(1);
    const [history,setHistory] = useState<GraphNode[][]>([]);
    const [editorMessage,setEditorMessage] = useState('');
    const [foreground, setForeground] = useState(AppState.currentState === "active");
    const [destination, setDestination] = useState("living");
    const [cameraOpen, setCameraOpen] = useState(false);
    const [tracking, setTracking] = useState("initializing");
    const [notice, setNotice] = useState("Scan the fixed HOME START floor marker before starting.");
    const [alignment, setAlignment] = useState<Alignment | null>(null);
    const [position, setPosition] = useState<Point | null>(null);
    const [forward, setForward] = useState<Point>({ x: 0, y: 1 });
    const [index, setIndex] = useState(1);
    const [arrived, setArrived] = useState(false);
    const [showMap, setShowMap] = useState(false);
    const lastPose = useRef<{ matrix: number[]; received: number; timestamp: number } | null>(null);
    const previousPosition = useRef<Point | null>(null);
    const nearSince = useRef<number | null>(null);
    const alignmentRef = useRef<Alignment | null>(null);
    const candidate = useRef<MarkerCandidate | null>(null);
    const baseRoute = sessionRoute ?? generatedRoutes[destination];
    const route = editing && draft ? draft : baseRoute;
    const active = focused && foreground && cameraOpen;

    useEffect(()=>{
        let cancelled=false;
        setCanEdit(false);
        if(token) routeRequest<{can_edit_routes:boolean}>('editor-access',token)
            .then(value=>{if(!cancelled) setCanEdit(value.can_edit_routes === true);})
            .catch(()=>{if(!cancelled) setCanEdit(false);});
        return ()=>{cancelled=true;};
    },[token]);

    async function openSharedSession(nextMode:'marker'|'world'='marker') {
        if(busy || savingEnvironment) return;
        setBusy(true);
        try {
            if(nextMode==='world') {
                if(!environmentAvailable) throw new Error('Rebuild the iPhone app to enable saved-room recognition.');
                const raw=readEnvironmentRoutes();
                if(!raw) throw new Error('No room recording yet. An editor must align once, walk the room and save the environment first.');
                decodeRoutes(raw,generatedRoutes);
            }
            const value=await routeRequest<SharedRoute>('home-routes/'+destination);
            setSessionRoute(checkedSharedRoute(value,destination,generatedRoutes[destination]));
            setRevision(value.revision);
            setSharedMessage(value.revision ? 'Published version '+value.revision : 'No published edits yet; using generated route.');
            setMode(nextMode);worldBlocked.current=false;setMapping('limited');setSaveRequest('');setEnvironmentMessage('');
            clearAlignment(nextMode==='world'?'Look around a recorded area. Arrows wait for room recognition.':'Point the camera at the fixed HOME START floor marker.');
            lastPose.current=null;setTracking('initializing');setArrived(false);setIndex(1);setCameraOpen(true);
        } catch(error) { setSharedMessage(error instanceof Error ? error.message : 'Could not load shared route. Retry.'); }
        finally {setBusy(false);}
    }

    async function changeDestinationInSession(nextDestination: string) {
        if(busy || editing || savingEnvironment) return;
        setBusy(true);nearSince.current=null;
        try {
            const value=await routeRequest<SharedRoute>('home-routes/'+nextDestination);
            const next=checkedSharedRoute(value,nextDestination,generatedRoutes[nextDestination]);
            // The same native view remains mounted. Never replace the alignment
            // with the latest camera pose or restore it after a tracking reset.
            const a=alignmentRef.current, pose=lastPose.current;
            const reusable=canReuseAlignment(!!a,active,tracking,pose?.received,Date.now());
            setDestination(nextDestination);setSessionRoute(next);setRevision(value.revision);
            setArrived(false);nearSince.current=null;
            if(reusable && a && pose) {
                const current=worldToMap(pose.matrix[12],pose.matrix[14],a);
                setIndex(recognitionJoinIndex(next,current));setPosition(current);
                setNotice('Destination changed. Existing floor alignment retained.');
            } else {
                setIndex(1);clearAlignment('Tracking is no longer reliable. Scan the fixed marker before continuing.');
            }
        } catch(error) {
            Alert.alert('Destination unchanged',error instanceof Error ? error.message : 'Could not load route.');
        } finally {setBusy(false);}
    }

    function chooseDestinationInSession() {
        Alert.alert('Choose destination', 'Keep the current floor alignment. No rescan while tracking remains reliable.',[
            ...homeDestinations.filter(d=>d.id!==destination).map(d=>({text:d.label,onPress:()=>changeDestinationInSession(d.id)})),
            {text:'Cancel',style:'cancel'},
        ]);
    }

    function alignManuallyForTesting() {
        if(mode!=='marker' || !canEdit || busy || savingEnvironment || !active || tracking!=='normal') {
            setNotice('Wait for camera tracking to become Ready, then tap Align here now.');return;
        }
                const pose=lastPose.current;
                if(!pose || Date.now()-pose.received>=700) {setNotice('Waiting for fresh camera tracking. Hold position and tap Align here now again when Ready.');return;}
                const a=manualTestAlignment(pose.matrix,Number(phoneHeight.trim().replace(',','.')));
                if(!a) {setNotice('Hold the phone upright facing along the aisle—not straight down—and tap Align here now again.');return;}
                candidate.current=null;alignmentRef.current=a;setAlignment(a);
                setPosition({x:0,y:0});previousPosition.current={x:0,y:0};
                setForward({x:0,y:1});nearSince.current=null;setIndex(1);setArrived(false);
                Keyboard.dismiss();setManualSetup(false);setManualError('');
                setManualReady(false);
                setNotice('Developer manual alignment. Check arrow placement before walking.');
    }

    async function publishEdits() {
        if(!canEdit || !token || !draft || busy || savingEnvironment) return;
        setBusy(true);
        try {
            validateRoute(draft,generatedRoutes[destination]);
            // Preserve the draft even if the network fails or another editor wins.
            const local={...savedRoutes,[destination]:draft};
            writeHomeRoutes(encodeRoutes(local,generatedRoutes));setSavedRoutes(local);
            const value=await routeRequest<SharedRoute>('home-routes/'+destination,token,
                {expected_revision:revision,marker:'home-start-v1',points:draft});
            setSessionRoute(checkedSharedRoute(value,destination,generatedRoutes[destination]));setRevision(value.revision);
            setEditing(false);setDraft(null);setHistory([]);setIndex(1);setArrived(false);
            clearAlignment('Published version '+value.revision+'. Other users load it when starting a new session. Scan again to test.');
        } catch(error) {setEditorMessage(error instanceof Error ? error.message : 'Publishing failed. Your draft is kept.');}
        finally {setBusy(false);}
    }

    usePreventRemove(editing || savingEnvironment, ({data})=>{
        if(savingEnvironment) {Alert.alert('Saving environment','Wait for the result before leaving.');return;}
        Alert.alert('Discard unsaved route edits?', 'Your saved route will not change.',[
            {text:'Keep editing',style:'cancel'},
            {text:'Discard',style:'destructive',onPress:()=>{
                setEditing(false);setDraft(null);navigation.dispatch(data.action);
            }},
        ]);
    });

    function editingReady() {
        return canEdit && !busy && !savingEnvironment && routeEditorAvailable && !loaded.error && active && !!alignmentRef.current && tracking==='normal' &&
            !!position && !!lastPose.current && Date.now()-lastPose.current.received<700;
    }
    function startEditing() {
        if(!editingReady()) return;
        setDraft(baseRoute.map(p=>({...p})));setHistory([]);
        setSelected(Math.max(1,Math.min(index,baseRoute.length-1)));
        setEditorMessage('Private phone draft. Review against published version '+revision+' before publishing.');
        nearSince.current=null;setEditing(true);
    }
    function changeDraft(next:GraphNode[],selection=selected) {
        if(!editing || !editingReady() || !draft || next===draft) return;
        setHistory(h=>[...h.slice(-29),draft]);setDraft(next);
        setSelected(Math.max(0,Math.min(selection,next.length-1)));
        setEditorMessage('Unsaved. Check each segment is walkable before saving.');
    }
    function discardEdits() {
        if(savingEnvironment) return;
        Alert.alert('Discard unsaved edits?', 'The saved route is unchanged.',[
            {text:'Keep editing',style:'cancel'},
            {text:'Discard',style:'destructive',onPress:()=>{
                setEditing(false);setDraft(null);setHistory([]);
                clearAlignment('Scan the fixed marker to resume navigation.');
            }},
        ]);
    }
    function saveEdits() {
        if(!editingReady() || !draft) return;
        try {
            validateRoute(draft,generatedRoutes[destination]);
            const next={...savedRoutes,[destination]:draft};
            writeHomeRoutes(encodeRoutes(next,generatedRoutes));
            setSavedRoutes(next);setSessionRoute(draft);setEditing(false);setDraft(null);setHistory([]);
            setArrived(false);setIndex(1);
            clearAlignment(mode==='world'?'Route saved on this phone. Waiting for room recognition.':'Route saved on this phone. Scan the marker and test from the start.');
        } catch(error) { setEditorMessage(error instanceof Error ? error.message : 'Could not save route. Your draft is still here.'); }
    }

    function clearAlignment(message: string) {
        candidate.current = null;
        alignmentRef.current = null;
        setAlignment(null);
        setArrived(false);
        setPosition(null);
        previousPosition.current = null;
        nearSince.current = null;
        setNotice(message);
    }

    function saveEnvironment() {
        if(!environmentAvailable || !editingReady() || mapping!=='mapped') return;
        Alert.alert(hasEnvironment?'Replace this phone’s room recording?':'Save this phone’s room recording?',
            'Walk and look around the route first. This saves private spatial data only on this phone; it does not publish or replace routes. Room recognition depends on stable visible surroundings.',[
                {text:'Cancel',style:'cancel'},{text:'Save recording',onPress:()=>{
                    if(!editingReady() || mapping!=='mapped' || !alignmentRef.current) {
                        setEnvironmentMessage('Recording was not saved: alignment or tracking changed. Locate the route again before saving.');return;
                    }
                    const a=alignmentRef.current,id=Date.now()+'-'+Math.random().toString(36).slice(2);
                    // Snapshot identifies the coordinate frame. Guidance still fetches
                    // published geometry, never overwrites it with this older snapshot.
                    const routes=encodeRoutes({...generatedRoutes,[destination]:baseRoute},generatedRoutes);
                    pendingEnvironment.current=id;setSavingEnvironment(true);
                    setEnvironmentMessage('Saving room… keep this screen open.');
                    setSaveRequest(JSON.stringify({id,routes,alignment:[a.x,a.z,a.height,a.fx,a.fz]}));
                }},
            ]);
    }

    function receiveEnvironment({nativeEvent:e}:EnvironmentEvent) {
        if(e.kind==='saved' || e.kind==='error') {
            if(!pendingEnvironment.current || e.requestID!==pendingEnvironment.current) return;
            pendingEnvironment.current=null;setSavingEnvironment(false);setSaveRequest('');
            setEnvironmentMessage(e.message ?? 'Could not save environment.');
            if(e.kind==='saved') setHasEnvironment(true);
            return;
        }
        if(e.kind!=='located' || mode!=='world' || worldBlocked.current || !active || alignmentRef.current || tracking!=='normal') return;
        const frame=lastPose.current;
        let a:Alignment|null;
        try {
            a=recognisedAlignment(e,frame,generatedRoutes,destination,Date.now());
        } catch {
            worldBlocked.current=true;clearAlignment('Recording is incompatible. End and use setup to record again.');return;
        }
        if(!a || !frame) return;
        const p=worldToMap(frame.matrix[12],frame.matrix[14],a);
        alignmentRef.current=a;setAlignment(a);setPosition(p);previousPosition.current=p;nearSince.current=null;
        setForward({x:-a.fz*frame.matrix[8]+a.fx*frame.matrix[10],y:-a.fx*frame.matrix[8]-a.fz*frame.matrix[10]});
        setIndex(recognitionJoinIndex(route,p));setArrived(false);
        setNotice('Room recognised. Arrows use the saved origin, not your current position.');
    }

    useEffect(()=>{
        if(!savingEnvironment) return;
        const timer=setTimeout(()=>{
            pendingEnvironment.current=null;setSavingEnvironment(false);setSaveRequest('');
            setEnvironmentMessage('Save result timed out. A recording may still finish saving; check recognition before replacing it.');
        },30000);
        return ()=>clearTimeout(timer);
    },[savingEnvironment]);

    useEffect(() => {
        const listener = AppState.addEventListener("change", state => {
            setForeground(state === "active");
            if (state !== "active") {
                clearAlignment('Session paused. Locate the room again after resuming.');
                if(pendingEnvironment.current) {
                    pendingEnvironment.current=null;setSavingEnvironment(false);setSaveRequest('');
                    setEnvironmentMessage('Save interrupted. Check recognition before recording again.');
                }
            } else {
                try {setHasEnvironment(environmentAvailable && !!readEnvironmentRoutes());} catch {setHasEnvironment(false);}
            }
        });
        return () => listener.remove();
    }, []);

    useEffect(() => {
        if (!focused) {
            clearAlignment(mode==='world'?'Look around the recorded area again.':'Scan the fixed marker again.');
            // Keep the editor draft/screen when another screen temporarily covers it.
            // On refocus it must reacquire the marker before edits can resume.
            if (!editing) setCameraOpen(false);
            lastPose.current = null;
        }
    }, [focused, editing, mode]);

    useEffect(() => {
        if (!active) return;
        const timer = setInterval(() => {
            if (alignmentRef.current && (!lastPose.current || Date.now() - lastPose.current.received > 1500)) {
                clearAlignment(mode==='world'?'Camera tracking stopped. Look around the recorded area, or end and retry.':'Camera tracking stopped. Scan the fixed marker again.');
                setTracking("stale");
            }
        }, 500);
        return () => clearInterval(timer);
    }, [active, mode]);

    function receivePose(event: PoseEvent) {
        if (!active) return;
        const { transform: matrix, timestamp } = event.nativeEvent;
        if (matrix.length !== 16 || !matrix.every(Number.isFinite) || !Number.isFinite(timestamp)) return;
        if (lastPose.current && timestamp <= lastPose.current.timestamp) {
            clearAlignment(mode==='world'?'AR session changed. Waiting for room recognition.':'AR origin changed. Scan the fixed marker again.');
        }
        lastPose.current = { matrix, timestamp, received: Date.now() };
        const a = alignmentRef.current;
        if (!a || tracking !== "normal") return;
        const p = worldToMap(matrix[12], matrix[14], a);
        if (previousPosition.current && distance(previousPosition.current, p) > 0.9) {
            if(mode==='world') worldBlocked.current=true;
            clearAlignment(mode==='world'?'Tracking position jumped. End this session and retry room recognition.':'Tracking position jumped. Scan the fixed marker again.');
            return;
        }
        previousPosition.current = p;
        setPosition(p);
        setForward({ x: -a.fz * matrix[8] + a.fx * matrix[10],
            y: -a.fx * matrix[8] - a.fz * matrix[10] });
        if(editing || arrived || busy || savingEnvironment) { nearSince.current=null;return; }
        const progress = progressAt(route, index, p);
        const arrival = arrivalDwell(nearSince.current, timestamp, progress.next, progress.offRoute < 0.8);
        nearSince.current = arrival.nearSince;
        if (arrival.reached) advance();
    }

    function advance() {
        if(editing || busy || savingEnvironment) return;
        nearSince.current = null;
        if (index >= route.length - 1) setArrived(true);
        else setIndex(i => i + 1);
    }

    function receiveMarker(event: MarkerEvent) {
        if (mode!=='marker' || !active || alignmentRef.current || tracking !== "normal") return;
        const frame = lastPose.current;
        const observation = event.nativeEvent;
        if (!frame || Date.now()-frame.received>500 || Math.abs(frame.timestamp-observation.timestamp)>0.2) {
            candidate.current = null;
            return;
        }
        const result = observeMarker(candidate.current, observation);
        candidate.current = result.candidate;
        const a = result.alignment;
        if (!a) {
            setNotice(result.candidate ? "Marker found. Hold it fully in view until alignment is stable…" :
                "Show the whole HOME START marker, lying flat on the floor.");
            return;
        }
        const p = worldToMap(frame.matrix[12],frame.matrix[14],a);
        if (Math.hypot(p.x,p.y)>2.5) {
            candidate.current = null;
            setNotice("Move closer to the marker to begin; do not stand on it.");
            return;
        }
        alignmentRef.current = a;
        setAlignment(a);
        setPosition(p);
        previousPosition.current = p;
        nearSince.current = null;
        setForward({x:-a.fz*frame.matrix[8]+a.fx*frame.matrix[10],y:-a.fx*frame.matrix[8]-a.fz*frame.matrix[10]});
        setIndex(Math.hypot(p.x,p.y)<=0.6 ? 1 : 0);
        setArrived(false);
        setNotice("Aligned to the fixed marker. Route distances remain estimates.");
    }

    const progress = position ? progressAt(route, index, position) : null;
    const offRoute = (progress?.offRoute ?? 0) > 0.9;
    const canNavigate = !busy && !savingEnvironment && active && alignment && tracking === "normal" && (!arrived || editing);
    const displayIndex = editing ? selected : index;
    const waypoint: number[] = [];
    if (canNavigate && (editing || !offRoute) && route[displayIndex]) {
        const target = mapToWorld(route[displayIndex], alignment);
        const previous = route[Math.max(0, displayIndex - 1)];
        waypoint.push(target.x, target.y, target.z, waypointYaw(previous, route[displayIndex], alignment));
    }
    const angle = position && route[index] ? relativeBearing(position, route[index], forward) : 0;
    const facingHint = Math.abs(angle) > 2.3 ? "Turn around to find the waypoint" :
        Math.abs(angle) > 0.55 ? (angle > 0 ? "Look right for the waypoint" : "Look left for the waypoint") : "Waypoint ahead";

    if (Platform.OS !== 'ios') return <SafeAreaView style={styles.page}>
        <ScrollView contentContainerStyle={styles.setup}>
            <Text style={styles.title}>Home wayfinding</Text>
            <Text style={styles.copy}>AR home navigation is currently available on supported iPhones only. You can still use the other app features and Building 303 route previews on Android.</Text>
        </ScrollView>
    </SafeAreaView>;

    if (!cameraOpen) return <SafeAreaView style={styles.page}>
        <ScrollView contentContainerStyle={styles.setup}>
            <Text style={styles.title}>Home wayfinding</Text>
            <Text style={styles.copy}>{hasEnvironment?'Room recording available on this phone.':'No room recording on this phone yet. Align once and record the surroundings to skip scanning on later visits.'}</Text>
            {!environmentAvailable && <Text style={styles.warning}>Saved-room recognition requires the new 1.1.0 native iPhone build.</Text>}
            {!!loaded.error && <Text style={styles.warning}>{loaded.error}</Text>}
            <Text style={styles.copy}>Start: fixed HOME START marker centred at the new red X in the clear aisle in Bedroom 1. Choose where to go.</Text>
            <HomeRouteMap route={route} />
            {homeDestinations.map(item => {
                const length = routeLength(generatedRoutes[item.id]);
                return <Pressable key={item.id} accessibilityRole="button"
                    accessibilityState={{ selected: destination === item.id }}
                    disabled={busy} onPress={() => {setDestination(item.id);setSessionRoute(null);}} style={[styles.destination, destination === item.id && styles.selected]}>
                    <Text style={styles.destinationName}>{item.label}</Text>
                    <Text style={styles.copy}>Generated preview: about {length.toFixed(1)} m · published route loads at start</Text>
                </Pressable>;
            })}
            <Text style={styles.copy}>Print docs/home-start-marker.html at 100% and measure the square: 20 × 20 cm. Tape it flat on the floor, centre at X, with its small black top arrow pointing down the plan along the aisle. Do not move or duplicate it.</Text>
            <Text style={styles.copy}>Scan from nearby, from any direction. The marker determines route placement, not where you stand. Arrows stay hidden until it is recognised steadily. Draft routes still need clearance checks; there is no furniture detection. Arrows sit 15 cm above the marker's floor level.</Text>
            {!markerArAvailable && <Text style={styles.warning}>This installed app does not contain Marker v1. Rebuild on your Mac; reloading JavaScript alone cannot add image tracking.</Text>}
            <Text style={styles.copy}>{sharedMessage}</Text>
            {canEdit && <Text style={styles.copy}>{routeEditorAvailable ? 'Editor access enabled. Private drafts stay on this phone until you publish.' : 'Rebuild the iPhone app to enable the editor in Release.'}</Text>}
            {environmentAvailable && <Pressable accessibilityRole="button" disabled={busy||!hasEnvironment} style={[styles.button,(!hasEnvironment||busy)&&styles.disabled]} onPress={()=>openSharedSession('world')}>
                <Text style={styles.buttonText}>Recognise room — no scan</Text>
            </Pressable>}
            <Pressable accessibilityRole="button" disabled={busy || !markerArAvailable || !route.length}
                style={[styles.button, (!markerArAvailable||busy) && styles.disabled]} onPress={()=>openSharedSession('marker')}>
                <Text style={styles.buttonText}>{busy?'Loading published route…':'Initial setup / marker alignment'}</Text></Pressable>
        </ScrollView>
    </SafeAreaView>;

    return <View style={styles.cameraPage}>
        {HomeArView && active && <HomeArView style={StyleSheet.absoluteFill} active={active}
            {...(environmentAvailable ? {localizationMode:mode,recordingEnabled:canEdit,saveEnvironmentRequest:saveRequest,
                onMapping:({nativeEvent}:{nativeEvent:{state:string}})=>setMapping(nativeEvent.state),onEnvironment:receiveEnvironment} : {})}
            waypoint={waypoint} onPose={receivePose} onMarker={receiveMarker} onStatus={({ nativeEvent }) => {
                setTracking(nativeEvent.state);
                if (nativeEvent.state !== "normal") {
                    clearAlignment(nativeEvent.message + (mode==='world'?' Look around the recorded area, or end and retry.':" Scan the fixed marker again."));
                } else if (!alignmentRef.current) setNotice(mode==='world'?'Look around the recorded area. Waiting for room recognition.':canEdit?"Camera tracking ready, but route alignment is missing. Return to HOME START and align manually again, or scan its marker.":'Camera tracking ready. Scan the fixed HOME START marker to locate the route.');
            }} />}
        <SafeAreaView style={styles.overlay} pointerEvents="box-none">
            <View style={styles.card}>
                <Text style={styles.whiteTitle}>{editing ? 'Editing: '+route.at(-1)?.label : arrived ? "You've arrived" : route.at(-1)?.label}</Text>
                <Text style={styles.whiteCopy}>{editing ? 'Draft only · automatic progression paused' : arrived ? "Route completed" : alignment && progress ?
                    `About ${progress.remaining.toFixed(1)} m remaining · waypoint ${index}/${route.length - 1}` : mode==='world'?'Recognising surroundings…':"Align at the home start"}</Text>
                <Text style={styles.whiteCopy}>Camera tracking: {tracking === "normal" ? "Ready" : tracking} · Map: {alignment ? (mode==='world'?'Room recognised':'Aligned') : "Not located"}</Text>
                {!!environmentMessage && <Text style={styles.whiteCopy}>{environmentMessage}</Text>}
                {canEdit && environmentAvailable && <Pressable accessibilityRole="button" disabled={!editingReady()||mapping!=='mapped'}
                    accessibilityState={{disabled:!editingReady()||mapping!=='mapped'}}
                    style={(!editingReady()||mapping!=='mapped')&&styles.disabled} onPress={saveEnvironment}>
                    <Text style={styles.link}>{roomSaveStatus({saving:savingEnvironment,aligned:!!alignment,world:mode==='world',busy,routeError:!!loaded.error,ready:editingReady(),mapped:mapping==='mapped'})}</Text>
                </Pressable>}
            </View>
            <View style={styles.bottom} pointerEvents="box-none">
                {showMap && !editing && <HomeRouteMap route={route} position={position} />}
                {editing && draft ? <>
                    {!alignment && <View style={styles.card}><Text style={styles.whiteCopy}>{notice} Your draft is kept; locate the room to continue editing.</Text></View>}
                    <HomeRouteEditor route={draft} selected={selected} ready={Boolean(editingReady())}
                        canUndo={history.length>0} message={editorMessage} select={setSelected}
                        moveHere={()=>position&&changeDraft(moveWaypoint(draft,selected,position))}
                        insertHere={()=>{
                            if(!position) return;
                            const after=Math.min(selected,draft.length-2);
                            changeDraft(insertWaypoint(draft,selected,position,'custom-'+Date.now()+'-'+Math.random().toString(36).slice(2,8)),after+1);
                        }}
                        remove={()=>changeDraft(deleteWaypoint(draft,selected),selected-1)}
                        nudge={(right,ahead)=>changeDraft(moveWaypoint(draft,selected,nudgePoint(draft[selected],forward,right,ahead)))}
                        undo={()=>{
                            if(!editingReady() || !history.length) return;
                            const previous=history.at(-1)!;setDraft(previous);setHistory(h=>h.slice(0,-1));
                            setSelected(Math.min(selected,previous.length-1));setEditorMessage('Undone. Draft not yet saved.');
                        }}
                        reset={()=>Alert.alert('Restore generated route?', 'This replaces the draft only. Undo is available; saving applies it.',[
                            {text:'Cancel',style:'cancel'},
                            {text:'Restore',onPress:()=>changeDraft(generatedRoutes[destination].map(p=>({...p})),1)},
                        ])}
                        restoreLocal={()=>{
                            const local=savedRoutes[destination];
                            if(!local) {setEditorMessage('No saved phone draft for this destination.');return;}
                            Alert.alert('Load phone draft?', 'This may be older than the published route. Loading does not publish it.',[
                                {text:'Cancel',style:'cancel'}, {text:'Load draft',onPress:()=>changeDraft(local.map(p=>({...p})),1)},
                            ]);
                        }}
                        restorePrevious={async()=>{
                            if(!token || busy) return;
                            setBusy(true);
                            try {
                                const versions=await routeRequest<SharedRoute[]>('home-routes/'+destination+'/history',token);
                                const previous=versions.find(v=>v.revision<revision);
                                if(!previous) {setEditorMessage('No earlier publication is available.');return;}
                                const points=checkedSharedRoute(previous,destination,generatedRoutes[destination]);
                                setHistory(h=>[...h.slice(-29),draft]);setDraft(points);setSelected(1);
                                setEditorMessage('Loaded version '+previous.revision+' as a draft. Nothing published. Undo is available.');
                            } catch(error) {setEditorMessage(error instanceof Error ? error.message : 'Could not load history.');}
                            finally {setBusy(false);}
                        }}
                        busy={busy||savingEnvironment} publish={()=>Alert.alert('Publish this home route for everyone?', 'Only publish after checking the route is walkable. This does not change Building 303.',[
                            {text:'Cancel',style:'cancel'},{text:'Publish',onPress:publishEdits},
                        ])} save={saveEdits} cancel={discardEdits} />
                </> : <View style={styles.card}>
                    {!alignment ? <>
                        <Text style={styles.whiteCopy}>{notice}</Text>
                        <Text style={styles.whiteCopy}>{mode==='world'?'Look around a previously recorded area. No scan is required. If recognition fails, end and retry or use initial setup.':'Keep the entire 20 cm floor marker visible and well lit. Its top must point down the plan.'}</Text>
                        {canEdit && mode==='marker' && <>
                            {manualReady && <>
                                <Text style={styles.whiteCopy}>Height: {phoneHeight} m. Hold the camera above HOME START, facing down the aisle. Wait for tracking Ready, then confirm below.</Text>
                                <Pressable accessibilityRole="button" style={styles.smallButton} disabled={busy||tracking!=='normal'} onPress={alignManuallyForTesting}>
                                    <Text style={styles.buttonText}>Align here now</Text>
                                </Pressable>
                                <Pressable accessibilityRole="button" onPress={()=>setManualReady(false)}><Text style={styles.link}>Cancel manual alignment</Text></Pressable>
                            </>}
                            <Pressable accessibilityRole="button" style={styles.smallButton} disabled={busy} onPress={()=>{setManualError('');setManualSetup(true);}}>
                                <Text style={styles.link}>Developer: align at known start without marker</Text>
                            </Pressable>
                        </>}
                    </> : arrived ? <Text style={styles.whiteCopy}>Reached {route.at(-1)?.label}. Change destination below to keep the current alignment.</Text> : offRoute ? <>
                        <Text style={styles.whiteTitle}>Pause and check the map</Text>
                        <Text style={styles.whiteCopy}>{index === 0 ? "Room located, but no unambiguous nearby route segment was found. Return to the configured route start; no shortcut through rooms is provided." : "You appear away from this route segment. Do not follow an arrow through furniture or walls. Return to the route, or end and locate the room again if the map has drifted."}</Text>
                    </> : <>
                        <Text style={styles.whiteTitle}>{progress?.next.toFixed(1)} m to next waypoint</Text>
                        <Text style={styles.whiteCopy}>{facingHint} · {turnAt(route, index)}</Text>
                        <Text style={styles.whiteCopy}>{route[index]?.label}</Text>
                        <Pressable accessibilityRole="button" style={[styles.smallButton,
                            (!progress || progress.next > 0.8) && styles.disabled]}
                            disabled={!canNavigate || !progress || progress.next > 0.8} onPress={advance}>
                            <Text style={styles.buttonText}>Confirm nearby waypoint</Text>
                        </Pressable>
                    </>}
                    {canEdit && routeEditorAvailable && !loaded.error && <Pressable accessibilityRole="button" disabled={!editingReady()}
                        style={[styles.smallButton,!editingReady()&&styles.disabled]} onPress={startEditing}>
                        <Text style={styles.buttonText}>Developer: edit this route</Text>
                    </Pressable>}
                    <View style={styles.actions}>
                        <Pressable accessibilityRole="button" disabled={busy||savingEnvironment} onPress={chooseDestinationInSession}><Text style={styles.link}>{busy?'Loading…':'Change destination · keep alignment'}</Text></Pressable>
                        <Pressable accessibilityRole="button" onPress={() => setShowMap(v => !v)}><Text style={styles.link}>{showMap ? "Hide map" : "Show map"}</Text></Pressable>
                        <Pressable accessibilityRole="button" disabled={savingEnvironment} onPress={() => {
                            clearAlignment("Scan the fixed marker to begin another route.");
                            setCameraOpen(false);
                        }}><Text style={styles.link}>End / choose destination</Text></Pressable>
                    </View>
                </View>}
            </View>
        </SafeAreaView>
        <Modal visible={manualSetup} animationType="slide" presentationStyle="fullScreen"
            onRequestClose={()=>{Keyboard.dismiss();setManualSetup(false);}}>
            <SafeAreaView style={styles.page}>
                <KeyboardAvoidingView style={{flex:1}} behavior={Platform.OS==='ios'?'padding':'height'}>
                    <ScrollView contentContainerStyle={styles.setup} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag">
                        <Text style={styles.title}>Set your starting position</Text>
                        <Text style={styles.copy}>No QR code needed. This is a one-time manual setup before recording the room—not automatic location detection.</Text>
                        <Text style={styles.copy}>1. Go to HOME START: the red X in the Bedroom 1 aisle on the home plan. Do not choose a random starting spot.</Text>
                        <Text style={styles.copy}>2. Hold the phone upright, with its camera above that point, facing down the aisle in the plan’s start direction.</Text>
                        <Text style={styles.copy}>3. Measure from the floor to the phone’s camera lens—not your body height. Enter metres below. For example, 120 cm = 1.20 m.</Text>
                        <Text style={styles.destinationName}>Camera height above floor (metres)</Text>
                        <TextInput accessibilityLabel="Camera height above floor in metres" keyboardType="decimal-pad"
                            placeholder="For example, 1.20" placeholderTextColor="#657786" value={phoneHeight}
                            onChangeText={value=>{setPhoneHeight(value);setManualError('');}}
                            style={styles.heightInput} />
                        <Pressable accessibilityRole="button" style={styles.smallButton} onPress={()=>Keyboard.dismiss()}>
                            <Text style={styles.buttonText}>Done entering height — hide keyboard</Text>
                        </Pressable>
                        <Text style={styles.copy}>4. Tap Return to camera. Once the live camera is visible and tracking says Ready, hold the phone at the measured position and direction and tap Align here now. No alignment is captured on this form.</Text>
                        {!!manualError && <Text accessibilityRole="alert" style={styles.warning}>{manualError}</Text>}
                    </ScrollView>
                    <View style={styles.manualFooter}>
                        <Pressable accessibilityRole="button" style={styles.smallButton} onPress={()=>{Keyboard.dismiss();setManualSetup(false);}}>
                            <Text style={styles.buttonText}>Cancel</Text>
                        </Pressable>
                        <Pressable accessibilityRole="button" style={styles.button} onPress={()=>{
                            const height=Number(phoneHeight.trim().replace(',','.'));
                            if(!Number.isFinite(height)||height<0.2||height>2.5) {setManualError('Enter a measured camera height from 0.2 to 2.5 metres.');return;}
                            setPhoneHeight(String(height));Keyboard.dismiss();setManualSetup(false);setManualReady(true);
                            lastPose.current=null;
                            setNotice('Height saved. Wait for camera tracking Ready, then hold at HOME START and tap Align here now.');
                        }}>
                            <Text style={styles.buttonText}>Return to camera</Text>
                        </Pressable>
                    </View>
                </KeyboardAvoidingView>
            </SafeAreaView>
        </Modal>
    </View>;
}

const styles = StyleSheet.create({
    page: { flex: 1, backgroundColor: "#f5f8fb" },
    heightInput: {backgroundColor:'white',borderWidth:1,borderColor:'#657786',borderRadius:10,padding:16,fontSize:20,color:'#173b58',minHeight:56},
    manualFooter: {padding:16,backgroundColor:'#f5f8fb'},
    setup: { padding: 20, gap: 12, paddingBottom: 40 },
    title: { color: "#173b58", fontSize: 28, fontWeight: "800" },
    copy: { color: "#496173", fontSize: 14, lineHeight: 20 },
    destination: { borderWidth: 1, borderColor: "#cad7e3", padding: 14, borderRadius: 12, backgroundColor: "white" },
    selected: { borderColor: "#176de5", backgroundColor: "#e8f2ff" },
    destinationName: { color: "#173b58", fontSize: 16, fontWeight: "700" },
    warning: { color: "#854d0e", fontSize: 14, lineHeight: 20 },
    button: { marginTop: 10, backgroundColor: "#176de5", padding: 16, borderRadius: 12, alignItems: "center" },
    buttonText: { color: "white", fontWeight: "700", textAlign: "center" },
    disabled: { opacity: 0.4 },
    cameraPage: { flex: 1, backgroundColor: "#06131d" },
    overlay: { flex: 1, padding: 16, justifyContent: "space-between" },
    card: { borderRadius: 16, padding: 16, backgroundColor: "rgba(4,20,31,0.93)", gap: 6 },
    whiteTitle: { fontSize: 22, fontWeight: "800", color: "white" },
    whiteCopy: { fontSize: 14, lineHeight: 20, color: "#d5e4ef" },
    bottom: { gap: 10 },
    actions: { flexDirection: "row", flexWrap: "wrap", paddingTop: 14, gap: 10 },
    link: { color: "#91c5ff", fontSize: 12, fontWeight: "700", paddingVertical: 6 },
    smallButton: { padding: 10, backgroundColor: "#235073", borderRadius: 10, marginTop: 8 },
});
