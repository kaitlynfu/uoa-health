import {useState} from 'react';
import {ConnectedScreen,type AppNavigation} from '../../components/ConnectedScreen';
import {SocialTile,SocialTabs} from '../../components/SocialDesign';
import {SocialCollection} from '../../components/SocialCollections';
export default function UsersGroupScreen({navigation}:{navigation:AppNavigation}) {
    const [tab,setTab]=useState<'Joined'|'Saved'>('Joined');
    return <ConnectedScreen title="My Groups" description="View and manage your study groups in one place." background navigation={navigation} account leftIcon="back">
        <SocialTabs items={['Joined','Saved'] as const} value={tab} onChange={setTab}/>
        <SocialCollection key={tab} kind={tab==='Saved'?'saved':'joined'} navigation={navigation}/>
        <SocialTile title="Explore groups" detail="Find a group and join its conversation." icon="compass-outline" tone="orange" onPress={()=>navigation.navigate('AllGroups')}/>
        <SocialTile title="Create a group" detail="Start a new study community." icon="add-outline" tone="purple" onPress={()=>navigation.navigate('CreateGroup')}/>
    </ConnectedScreen>;
}
