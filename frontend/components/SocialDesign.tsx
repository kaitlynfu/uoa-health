// Kaitlyn's pastel group cards and MJ's grouped-list visual language, without fixture data.
import type {ComponentProps, PropsWithChildren} from 'react';
import {Ionicons} from '@expo/vector-icons';
import {Pressable,StyleSheet,Text,View} from 'react-native';
type Icon = ComponentProps<typeof Ionicons>['name'];

export function SocialTile({title,detail,icon,onPress,tone='mint'}:{title:string;detail:string;icon:Icon;onPress:()=>void;tone?:'mint'|'purple'|'orange'|'green'|'blue'}) {
    return <Pressable accessibilityRole="button" onPress={onPress} style={social.tile}>
        <View style={[social.icon,{backgroundColor:tones[tone].background}]}>
            <Ionicons name={icon} size={26} color={tones[tone].color}/>
        </View>
        <View style={{flex:1}}>
            <Text style={social.title}>{title}</Text>
            <Text style={social.copy}>{detail}</Text>
        </View>
        <Ionicons name="chevron-forward" size={20} color="#777"/>
    </Pressable>;
}

export function Unavailable({title,children,icon='information-circle-outline'}:PropsWithChildren<{title:string;icon?:Icon}>) {
    return <View style={social.empty}>
        <View style={social.emptyIcon}>
            <Ionicons name={icon} size={25} color="#52B3B1"/>
        </View>
        <View style={{flex:1}}>
            <Text style={social.title}>{title}</Text>
            <Text style={social.copy}>{children}</Text>
        </View>
    </View>;
}

export function Section({title,action,onPress}:{title:string;action?:string;onPress?:()=>void}) {
    return <View style={social.section}><Text accessibilityRole="header" style={social.heading}>{title}</Text>{action&&<Pressable accessibilityRole="button" onPress={onPress} style={{minHeight:44,justifyContent:'center'}}><Text style={social.link}>{action} ›</Text></Pressable>}</View>;
}
export function DisabledChips({items}:{items:string[]}) {
    return <View style={social.chips}>{items.map(item=><View key={item} accessibilityState={{disabled:true}} style={social.chip}><Text style={social.copy}>{item}</Text></View>)}</View>;
}
export function SocialTabs<T extends string>({items,value,onChange}:{items:readonly T[];value:T;onChange:(value:T)=>void}) {
    return <View accessibilityRole="tablist" style={social.tabs}>{items.map(item=><Pressable key={item} accessibilityRole="tab" aria-selected={value===item} accessibilityState={{selected:value===item}} onPress={()=>onChange(item)} style={[social.tab,value===item&&social.selectedTab]}><Text style={[social.tabText,value===item&&{color:'#287d7b',fontWeight:'700'}]}>{item}</Text></Pressable>)}</View>;
}
export function Avatar({name}:{name:string}) {
    return <View style={social.avatar}><Text style={social.avatarText}>{name.trim().split(/\s+/).slice(0,2).map(part=>part[0]).join('').toUpperCase()||'?'}</Text></View>;
}

const tones={
    mint:{color:'#52B3B1',background:'#EAF7F5'},
    purple:{color:'#5F4DD8',background:'#E8E3FF'},
    orange:{color:'#E87931',background:'#FFE4D4'},
    green:{color:'#2D9F74',background:'#DDF3E9'},
    blue:{color:'#4C7EDB',background:'#DFE9FF'},
};

export const social=StyleSheet.create({
    tile:{flexDirection:'row',alignItems:'center',gap:14,borderWidth:1,borderColor:'#EEEEEE',borderRadius:18,padding:16,minHeight:88,backgroundColor:'#FFFFFF'},
    icon:{width:54,height:54,borderRadius:27,backgroundColor:'#EAF7F5',alignItems:'center',justifyContent:'center',flexShrink:0},
    title:{fontSize:16,fontWeight:'600',color:'#111'},copy:{fontSize:14,lineHeight:21,color:'#66758A',marginTop:4},
    heading:{fontSize:18,fontWeight:'700',color:'#111',flexShrink:1},
    section:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',gap:12,marginTop:8,minHeight:44},
    link:{fontSize:14,fontWeight:'600',color:'#287d7b'},
    empty:{backgroundColor:'#F6F7F8',borderRadius:18,padding:18,flexDirection:'row',gap:12,alignItems:'center'},
    emptyIcon:{width:48,height:48,borderRadius:24,backgroundColor:'#EAF7F5',alignItems:'center',justifyContent:'center',flexShrink:0},
    chips:{flexDirection:'row',flexWrap:'wrap',gap:8},chip:{borderRadius:20,borderWidth:1,borderColor:'#E8E8E8',backgroundColor:'#F7F7F7',paddingHorizontal:14,paddingVertical:9},
    tabs:{flexDirection:'row',backgroundColor:'#F3F7F7',borderRadius:15,padding:4,gap:4},
    tab:{flex:1,minHeight:44,paddingVertical:10,paddingHorizontal:6,borderRadius:12,alignItems:'center',justifyContent:'center'},
    selectedTab:{backgroundColor:'#fff'},tabText:{fontSize:13,color:'#647774',textAlign:'center'},
    avatar:{width:46,height:46,borderRadius:23,backgroundColor:'#E8F5F3',alignItems:'center',justifyContent:'center'},
    avatarText:{fontSize:16,fontWeight:'700',color:'#257D80'},
});
