import {useLayoutEffect} from 'react';
import type {NativeStackScreenProps} from '@react-navigation/native-stack';
import type {RootStackParamList} from '../navigation/AppNavigator';
import MenuButton from '../components/MenuButton';
import CampusWayfinderScreen from './CampusWayfinderScreen';

// Preserve the existing AR session, editor, published routes and auth guards.
// It mounts only after the user chooses Indoor on the Wayfinder hub.
export default function IndoorWayfinderScreen({navigation}: NativeStackScreenProps<RootStackParamList, 'IndoorWayfinder'>) {
    useLayoutEffect(() => {
        navigation.setOptions({headerRight: () => <MenuButton navigation={navigation}/>});
    }, [navigation]);
    return <CampusWayfinderScreen/>;
}
