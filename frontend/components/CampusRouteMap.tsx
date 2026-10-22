import {View,Text} from 'react-native';
import type {GraphNode,Point} from '../services/indoorNavigation';

// Schematic of the current floor leg, not a surveyed wall/obstacle map.
export default function CampusRouteMap({points,position}:{points:GraphNode[];position?:Point|null}) {
    const xs=points.map(p=>p.x),ys=points.map(p=>p.y);
    const minX=Math.min(...xs)-1,minY=Math.min(...ys)-1;
    const scale=Math.min(260/(Math.max(...xs)-minX+1),180/(Math.max(...ys)-minY+1));
    const xy=(p:Point)=>({left:15+(p.x-minX)*scale,top:15+(p.y-minY)*scale});
    return <View style={{backgroundColor:'#eff5fa',padding:8,borderRadius:8}}>
        <Text>Floor-leg schematic · numbered arrows · not obstacles</Text>
        <View style={{height:215,width:300,alignSelf:'center'}}>
            {points.slice(1).map((p,i)=>{
                const a=xy(points[i]),b=xy(p),length=Math.hypot(b.left-a.left,b.top-a.top);
                return <View key={'line'+i} style={{position:'absolute',height:2,backgroundColor:'#2172ad',
                    width:length,left:(a.left+b.left)/2-length/2,top:(a.top+b.top)/2,
                    transform:[{rotate:Math.atan2(b.top-a.top,b.left-a.left)+'rad'}]}}/>;
            })}
            {points.map((p,i)=><Text key={p.id} style={{position:'absolute',...xy(p),fontSize:11,color:'#123',backgroundColor:'white'}}>{i}</Text>)}
            {position&&<Text style={{position:'absolute',...xy(position),color:'#b33'}}>●</Text>}
        </View>
        <Text>0 = {points[0]?.label}. The paper’s top arrow points towards waypoint 1.</Text>
    </View>;
}
