import {ConnectedScreen,type AppNavigation} from '../../components/ConnectedScreen';
import {Section,SocialTile} from '../../components/SocialDesign';
export default function StudyGroupScreen({navigation}:{navigation:AppNavigation}) {
    return <ConnectedScreen title="Study Groups" description="Find your people. Learn better together." background navigation={navigation} account leftIcon="menu">
        <Section title="Start here"/>
        <SocialTile title="Find a study group" detail="Explore groups by course, see who’s there and join the conversation." icon="compass-outline" onPress={()=>navigation.navigate('AllGroups')}/>
        <SocialTile title="My groups" detail="Your joined and saved study groups." icon="people-outline" tone="purple" onPress={()=>navigation.navigate('UserGroup')}/>
        <SocialTile title="Create a group" detail="Choose a course and invite classmates to study with you." icon="add-outline" tone="orange" onPress={()=>navigation.navigate('CreateGroup')}/>
        <Section title="Connect"/>
        <SocialTile title="Friends" detail="Find people by name and manage incoming and outgoing requests." icon="person-add-outline" onPress={()=>navigation.navigate('Friends',{tab:'Friends'})}/>
        <SocialTile title="Messages" detail="Open direct or group conversations." icon="chatbubbles-outline" tone="purple" onPress={()=>navigation.navigate('Messages')}/>
    </ConnectedScreen>;
}
