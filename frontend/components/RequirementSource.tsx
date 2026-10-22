import {useState} from 'react';
import {StyleSheet,Text,TouchableOpacity,View} from 'react-native';
import {Ionicons} from '@expo/vector-icons';
import {requirementBlocks} from '../services/requirementBlocks';

export default function RequirementSource({text}:{text?:string|null}) {
    const [showAll,setShowAll]=useState(false);
    const blocks=requirementBlocks(text);
    return <View style={styles.source}>
        <Text style={styles.warning}>Scores alone may not guarantee entry. Check selection conditions, required subjects and application dates on the official programme page.</Text>
        <TouchableOpacity accessibilityRole="button" accessibilityState={{expanded: showAll}} style={styles.toggle} onPress={()=>setShowAll(value=>!value)}>
            <Ionicons name="document-text-outline" size={19} color="#287d7b"/>
            <Text style={styles.title}>{showAll?'Hide original requirements':'Read original requirements'}</Text>
            <Ionicons name={showAll?'chevron-up':'chevron-down'} size={17} color="#777777"/>
        </TouchableOpacity>
        {showAll&&<View style={styles.content}>{blocks.length?blocks.map((block,index)=><Text selectable key={index} style={styles.copy}>{block}</Text>):<Text style={styles.copy}>Requirements are unavailable. Check the official programme page.</Text>}</View>}
        <Text style={styles.note}>Source wording is retained. Use “View Full Details” to check the official programme information.</Text>
    </View>;
}
const styles=StyleSheet.create({
    source:{borderTopWidth:1,borderTopColor:'#EEEEEE',marginTop:14,paddingTop:14,paddingBottom:12,gap:10},
    warning:{fontSize:12,lineHeight:18,color:'#555555'},
    toggle:{minHeight:44,flexDirection:'row',alignItems:'center',gap:10},
    title:{flex:1,fontSize:13,fontWeight:'600',color:'#287d7b'},
    content:{backgroundColor:'#F7F7F7',borderRadius:12,padding:14,gap:12},
    copy:{fontSize:14,lineHeight:21,color:'#555555'},
    note:{fontSize:11,lineHeight:17,color:'#666666'},
});
