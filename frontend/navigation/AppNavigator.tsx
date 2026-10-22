import { NavigationContainer } from "@react-navigation/native";
import {ActivityIndicator, View} from 'react-native';
import { createNativeStackNavigator } from "@react-navigation/native-stack";

import CareerExplorerScreen from "../screens/career-alignment/CareersExplorerScreen";
import CareerAlignmentScreen from '../screens/career-alignment/CareerAlignmentScreen';
import CareerDetailsScreen from '../screens/career-alignment/CareerDetailsScreen';
import SavedScreen from '../screens/career-alignment/SavedScreen';
import ProfileScreen from '../screens/ProfileScreen';
import EditProfileScreen from '../screens/EditProfileScreen';
import LoginScreen from '../screens/LoginScreen';
import OnboardingScreen from '../screens/OnboardingScreen';
import ProgressionScreen from '../screens/ProgressionScreen';
import ChoosePathwayScreen from '../screens/ChoosePathwayScreen';
import MapCourseScreen from '../screens/MapCourseScreen';
import FindRouteScreen from '../screens/FindRouteScreen';
import SettingsScreen from '../screens/settings/SettingsScreen';
import ChangePasswordScreen from '../screens/settings/ChangePasswordScreen';
import AccountRecoveryScreen from '../screens/settings/AccountRecoveryScreen';
import AccountDataScreen from '../screens/settings/AccountDataScreen';
import SafetyScreen from '../screens/settings/SafetyScreen';
import ModerationScreen from '../screens/settings/ModerationScreen';
import NotificationSettingsScreen from '../screens/settings/NotificationSettingsScreen';
import PrivacyScreen from '../screens/settings/PrivacyScreen';
import AboutScreen from '../screens/settings/AboutScreen';
import HelpSupportScreen from '../screens/settings/HelpSupportScreen';
import EditInterestsScreen from '../screens/profile/EditInterestsScreen';
import EditCareerInterestsScreen from '../screens/profile/EditCareerInterestsScreen';
import StudyGroupScreen from '../screens/study-groups/StudyGroupScreen';
import AllGroupsScreen from '../screens/study-groups/AllGroupsScreen';
import AllCoursesScreen from '../screens/study-groups/AllCoursesScreen';
import CreateGroupScreen from '../screens/study-groups/CreateGroupScreen';
import GroupDetailsScreen from '../screens/study-groups/GroupDetailsScreen';
import UsersGroupScreen from '../screens/study-groups/UsersGroupScreen';
import FriendsScreen from '../screens/study-groups/FriendsScreen';
import MessagesScreen from '../screens/study-groups/MessagesScreen';
import ChatScreen from '../screens/study-groups/ChatScreen';
import NotificationsScreen from '../screens/notifications/NotificationsScreen';
import QuizScreen from '../screens/career-alignment/QuizScreen';
import {useSession} from '../context/SessionContext';
import type {ComponentType} from 'react';
import type { Career } from '../types/programme';
import type { Milestone } from '../services/studentApi';
import HomeScreen from "../screens/HomeScreen";
import HomeDemoScreen from "../screens/HomeDemoScreen";
import ProgrammeDetailsScreen from "../screens/ProgrammeDetailsScreen";
import ProgrammesScreen from "../screens/ProgrammesScreen";
import RecommendationsScreen from "../screens/RecommendationsScreen";
import WayfinderScreen from "../screens/WayfinderScreen";
import IndoorWayfinderScreen from "../screens/IndoorWayfinderScreen";

export type RootStackParamList = {
    Home: undefined;
    Programmes: undefined;
    ProgrammeDetails: { programmeId: number };
    CareerExplorer: {category?: string; search?: string} | undefined;
    CareerAlignment: undefined;
    CareerDetails: {career: Career};
    Saves: {tab?: 'Careers' | 'Programmes'} | undefined;
    Profile: undefined;
    EditProfile: undefined;
    Login: undefined;
    Onboarding: undefined;
    StudyGroups: undefined;
    Settings: undefined;
    ChangePassword: undefined;
    AccountRecovery: undefined;
    AccountData: undefined;
    Safety: undefined;
    Moderation: undefined;
    NotificationSettings: undefined;
    Privacy: undefined;
    AboutApp: undefined;
    HelpSupport: undefined;
    EditInterests: undefined;
    EditCareerInterests: undefined;
    AllGroups: {course?:string}|undefined;
    AllCourses: undefined;
    CreateGroup: {groupId?:number}|undefined;
    GroupDetails: {groupId:number;groupName?:string;created?:boolean};
    UserGroup: undefined;
    Friends: {tab?: 'Friends' | 'Requests' | 'Find people'} | undefined;
    Messages: undefined;
    Chat: {targetId:number;isGroup:boolean};
    Progression: undefined;
    ChoosePathway: {programmeId?: number} | undefined;
    MapCourse: {milestone: Milestone;preview?:boolean};
    FindRoute: {destination?: string} | undefined;
    Notifications: undefined;
    Quiz: undefined;
    Recommendations: undefined;
    Wayfinder: undefined;
    IndoorWayfinder: undefined;
    HomeDemo: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

// Discard account-specific forms/messages when switching accounts, and discard
// a conversation's state when opening a different target on the same route.
function forSession(Screen:ComponentType<any>, accountOnly=false) {
    return function SessionScreen(props:any) {
        const {auth}=useSession();
        const identity=accountOnly?auth?.user.id:auth?.access_token;
        return <Screen key={`${identity??'guest'}:${JSON.stringify(props.route?.params??{})}`} {...props}/>;
    };
}
const ConnectedInterests=forSession(EditInterestsScreen),ConnectedCareers=forSession(EditCareerInterestsScreen);
const ConnectedGroups=forSession(StudyGroupScreen),ConnectedAllGroups=forSession(AllGroupsScreen),ConnectedCourses=forSession(AllCoursesScreen);
const ConnectedCreate=forSession(CreateGroupScreen),ConnectedDetails=forSession(GroupDetailsScreen),ConnectedUserGroups=forSession(UsersGroupScreen);
const ConnectedFriends=forSession(FriendsScreen),ConnectedMessages=forSession(MessagesScreen),ConnectedChat=forSession(ChatScreen);
const ConnectedAccountData=forSession(AccountDataScreen), ConnectedSafety=forSession(SafetyScreen);
const ConnectedModeration=forSession(ModerationScreen);
// Password rotation keeps its success notice; changing accounts clears secrets.
const ConnectedPassword=forSession(ChangePasswordScreen,true),ConnectedRecovery=forSession(AccountRecoveryScreen,true);
const ConnectedNotifications=forSession(NotificationsScreen),ConnectedNotificationSettings=forSession(NotificationSettingsScreen),ConnectedQuiz=forSession(QuizScreen);

export default function AppNavigator() {
    const {auth, ready}=useSession();
    if (!ready) return <View style={{flex:1,justifyContent:'center'}}><ActivityIndicator accessibilityLabel="Restoring sign-in"/></View>;
    return (
        <NavigationContainer>
            <Stack.Navigator initialRouteName={auth ? 'Home' : 'Login'}>
                <Stack.Screen name="CareerAlignment" component={CareerAlignmentScreen} options={{headerShown:false}} />
                <Stack.Screen name="CareerDetails" component={CareerDetailsScreen} options={{headerShown:false}} />
                <Stack.Screen name="Saves" component={SavedScreen} options={{headerShown:false}} />
                <Stack.Screen name="Profile" component={ProfileScreen} options={{headerShown:false}}/>
                <Stack.Screen name="EditProfile" component={EditProfileScreen} options={{title:'Edit profile', headerShown:false}} />
                <Stack.Screen name="Login" component={LoginScreen} options={{headerShown:false}}/>
                <Stack.Screen name="Onboarding" component={OnboardingScreen} options={{title:'Make it yours', headerShown:false}} />
                <Stack.Screen name="StudyGroups" component={ConnectedGroups} options={{headerShown:false}} />
                <Stack.Screen name="Settings" component={SettingsScreen} options={{headerShown:false}} />
                <Stack.Screen name="ChangePassword" component={ConnectedPassword} options={{headerShown:false}} />
                <Stack.Screen name="AccountRecovery" component={ConnectedRecovery} options={{headerShown:false}} />
                <Stack.Screen name="AccountData" component={ConnectedAccountData} options={{headerShown:false}} />
                <Stack.Screen name="Safety" component={ConnectedSafety} options={{headerShown:false}} />
                <Stack.Screen name="Moderation" component={ConnectedModeration} options={{headerShown:false}} />
                <Stack.Screen name="NotificationSettings" component={ConnectedNotificationSettings} options={{headerShown:false}} />
                <Stack.Screen name="Privacy" component={PrivacyScreen} options={{headerShown:false}} />
                <Stack.Screen name="AboutApp" component={AboutScreen} options={{headerShown:false}} />
                <Stack.Screen name="HelpSupport" component={HelpSupportScreen} options={{headerShown:false}} />
                <Stack.Screen name="EditInterests" component={ConnectedInterests} options={{headerShown:false}} />
                <Stack.Screen name="EditCareerInterests" component={ConnectedCareers} options={{headerShown:false}} />
                <Stack.Screen name="AllGroups" component={ConnectedAllGroups} options={{headerShown:false}} />
                <Stack.Screen name="AllCourses" component={ConnectedCourses} options={{headerShown:false}} />
                <Stack.Screen name="CreateGroup" component={ConnectedCreate} options={{headerShown:false}} />
                <Stack.Screen name="GroupDetails" component={ConnectedDetails} options={{headerShown:false}} />
                <Stack.Screen name="UserGroup" component={ConnectedUserGroups} options={{headerShown:false}} />
                <Stack.Screen name="Friends" component={ConnectedFriends} options={{headerShown:false}} />
                <Stack.Screen name="Messages" component={ConnectedMessages} options={{headerShown:false}} />
                <Stack.Screen name="Chat" component={ConnectedChat} options={{headerShown:false}} />
                <Stack.Screen name="Progression" component={ProgressionScreen} options={{headerShown:false}} />
                <Stack.Screen name="ChoosePathway" component={ChoosePathwayScreen} options={{title:'Choose pathway', headerShown:false}} />
                <Stack.Screen name="MapCourse" component={MapCourseScreen} options={{title:'Milestone details', headerShown:false}} />
                <Stack.Screen name="FindRoute" component={FindRouteScreen} options={{headerShown:false}} />
                <Stack.Screen name="Notifications" component={ConnectedNotifications} options={{headerShown:false}} />
                <Stack.Screen name="Quiz" component={ConnectedQuiz} options={{headerShown:false}} />
                <Stack.Screen
                    name="Home"
                    component={HomeScreen}
                    options={{ headerShown: false }}
                />

                <Stack.Screen
                    name="Programmes"
                    component={ProgrammesScreen}
                    options={{ headerShown: false }}
                />

                <Stack.Screen
                    name="ProgrammeDetails"
                    component={ProgrammeDetailsScreen}
                    options={{ headerShown: false }}
                />

                <Stack.Screen
                    name="CareerExplorer"
                    component={CareerExplorerScreen}
                    options={{ headerShown: false }}
                />

                <Stack.Screen
                    name="Recommendations"
                    component={RecommendationsScreen}
                    options={{ title: "Recommendations",headerShown: false }}
                />

                <Stack.Screen
                    name="Wayfinder"
                    component={WayfinderScreen}
                    options={{ headerShown: false }}
                />

                <Stack.Screen name="IndoorWayfinder" component={IndoorWayfinderScreen} options={{title: 'Indoor wayfinder', headerBackTitle: 'Wayfinder'}}/>
                <Stack.Screen name="HomeDemo" component={HomeDemoScreen}
                    options={{ title: "Home route demo", headerBackTitle: "Indoor" }} />
            </Stack.Navigator>
        </NavigationContainer>
    );
}
