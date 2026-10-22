import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRoute } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
const tabs = [
    {label:'Home',route:'Home',icon:'home' as const,outline:'home-outline' as const,active:['Home']},
    {label:'Saved',route:'Saves',icon:'bookmark' as const,outline:'bookmark-outline' as const,active:['Saves']},
    {label:'Wayfinder',route:'Wayfinder',icon:'navigate' as const,outline:'navigate-outline' as const,active:['Wayfinder','IndoorWayfinder','FindRoute','HomeDemo']},
    {label:'Messages',route:'Messages',icon:'chatbubbles' as const,outline:'chatbubbles-outline' as const,active:['Messages','Chat','Friends']},
    {label:'Profile',route:'Profile',icon:'person-circle' as const,outline:'person-circle-outline' as const,active:['Profile','EditProfile','Settings','EditInterests','EditCareerInterests']},
];
export default function NavBar({navigation,activeScreen}:any) {
    const insets=useSafeAreaInsets();
    // Legacy screens still pass broad sections such as Career/Groups. Route
    // identity keeps Saved and Messages highlighted correctly inside those stacks.
    const currentRoute=useRoute().name;
    return <View accessibilityRole="tablist" accessibilityLabel="Main navigation" style={[styles.nav,{paddingBottom:Math.max(insets.bottom,12)}]}>
        {tabs.map(tab => {
            const selected=tab.active.includes(currentRoute) || (tab.route==='Profile'&&activeScreen==='Profile');
            return <TouchableOpacity key={tab.route} accessibilityRole="tab" accessibilityLabel={tab.label} accessibilityState={{selected}} aria-selected={selected} style={styles.item} onPress={()=>{if(currentRoute!==tab.route) navigation.navigate(tab.route);}}>
                <View style={[styles.iconWrap,selected&&styles.activeIcon]}><Ionicons name={selected?tab.icon:tab.outline} size={23} color={selected?'#52B3B1':'#708386'}/></View>
                <Text maxFontSizeMultiplier={1.2} style={[styles.label,selected&&styles.selected]}>{tab.label}</Text>
            </TouchableOpacity>;
        })}
    </View>;
}
const styles=StyleSheet.create({
    nav:{position:'absolute',bottom:0,left:0,right:0,flexDirection:'row',backgroundColor:'#FFFFFF',paddingTop:10,borderTopWidth:1,borderTopColor:'#E4ECE8'},
    item:{flex:1,minHeight:48,alignItems:'center',justifyContent:'center',gap:3},
    iconWrap:{width:48,height:30,borderRadius:15,alignItems:'center',justifyContent:'center'},activeIcon:{backgroundColor:'#F5F5F5'},
    label:{fontSize:11,fontWeight:'500',color:'#708386'},selected:{color:'#52B3B1',fontWeight:'700'},
});
