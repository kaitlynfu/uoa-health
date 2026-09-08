import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { GraphNode } from '../services/indoorNavigation';

type Props = {
    route: GraphNode[]; selected: number; ready: boolean; canUndo: boolean; message: string;
    select: (index:number)=>void; moveHere:()=>void; insertHere:()=>void; remove:()=>void;
    nudge:(right:number,ahead:number)=>void; undo:()=>void; reset:()=>void; save:()=>void; cancel:()=>void;
};
export default function HomeRouteEditor(p:Props) {
    const button=(title:string,action:()=>void,disabled=false)=><Pressable accessibilityRole="button"
        accessibilityState={{disabled}} disabled={disabled} onPress={action} style={[s.button,disabled&&s.disabled]}>
        <Text style={s.text}>{title}</Text></Pressable>;
    return <View style={s.panel}>
        <Text style={s.title}>Developer route editor · navigation paused</Text>
        <Text style={s.text}>Selected {p.selected}/{p.route.length-1}: {p.route[p.selected]?.label}</Text>
        <ScrollView horizontal contentContainerStyle={s.tabs}>
            {p.route.map((node,i)=><Pressable key={node.id} accessibilityRole="button"
                accessibilityState={{selected:p.selected===i}} onPress={()=>p.select(i)}
                style={[s.button,p.selected===i&&s.selected]}><Text style={s.text}>{i===0?'Start':String(i)}</Text></Pressable>)}
        </ScrollView>
        <Text style={s.text}>Hold phone over the desired clear floor spot. Moves are relative to where you face. Start stays fixed; adding at the last point inserts before the destination.</Text>
        <View style={s.row}>{button('Move here',p.moveHere,!p.ready||p.selected===0)}{button('Add after',p.insertHere,!p.ready||p.route.length>=100)}</View>
        <View style={s.row}>{button('← 10 cm',()=>p.nudge(-0.1,0),!p.ready||p.selected===0)}{button('10 cm →',()=>p.nudge(0.1,0),!p.ready||p.selected===0)}{button('Forward 10 cm',()=>p.nudge(0,0.1),!p.ready||p.selected===0)}{button('Back 10 cm',()=>p.nudge(0,-0.1),!p.ready||p.selected===0)}</View>
        <View style={s.row}>{button('Delete',p.remove,!p.ready||p.selected===0||p.selected===p.route.length-1)}{button('Undo',p.undo,!p.ready||!p.canUndo)}{button('Generated route',p.reset,!p.ready)}</View>
        <Text accessibilityLiveRegion="polite" style={s.message}>{p.message}</Text>
        <View style={s.row}>{button('Save & test',p.save,!p.ready)}{button('Discard / exit',p.cancel)}</View>
    </View>;
}
const s=StyleSheet.create({
    panel:{backgroundColor:'rgba(12,30,43,0.96)',borderRadius:12,padding:12,gap:7},
    row:{flexDirection:'row',gap:6,flexWrap:'wrap'},
    tabs:{flexDirection:'row',gap:6},
    button:{padding:9,minHeight:44,justifyContent:'center',backgroundColor:'#235073',borderRadius:7},disabled:{opacity:0.35},selected:{backgroundColor:'#a04b0c'},
    title:{fontSize:16,fontWeight:'700',color:'#ffd59a'},text:{fontSize:12,color:'white'},message:{fontSize:12,color:'#ffd59a'},
});
