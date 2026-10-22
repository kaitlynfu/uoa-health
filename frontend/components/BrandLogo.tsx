import {Image,Platform,Text,type StyleProp,type TextStyle} from 'react-native';
import {APP_NAME} from '../constants/brand';

export default function BrandLogo({size = 40}: {size?: number}) {
    return <Image accessibilityLabel={`${APP_NAME} logo`} source={require('../assets/uoa-health-mark-transparent.png')} resizeMode="contain" style={{width: size, height: size, tintColor:'#167E83'}}/>;
}

export function BrandWordmark({size=22,style}:{size?:number;style?:StyleProp<TextStyle>}) {
    const [first,...rest]=APP_NAME.split(' ');
    return <Text accessibilityLabel={APP_NAME} style={[{fontFamily:Platform.select({ios:'Avenir Next',android:'sans-serif',default:'system-ui'}),fontSize:size,lineHeight:size*1.25,fontWeight:'800',letterSpacing:-0.6,color:'#164F5A',flexShrink:1},style]}>{first} <Text style={{color:'#168488'}}>{rest.join(' ')}</Text></Text>;
}
