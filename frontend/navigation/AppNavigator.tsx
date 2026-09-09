import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { Career } from "../types/programme";

import HomeScreen from "../screens/home/HomeScreen";
import CareerAlignmentScreen from "../screens/career-alignment/CareerAlignmentScreen";
import CareerExplorerScreen from "../screens/career-alignment/CareersExplorerScreen";
import CareerDetailsScreen from "../screens/career-alignment/CareerDetailsScreen";
import ProgrammeDetailsScreen from "../screens/career-alignment/ProgrammeDetailsScreen";
import QuizScreen from "../screens/career-alignment/QuizScreen";
import ProgrammesScreen from "../screens/career-alignment/ProgrammesScreen";
import SavedScreen from "../screens/career-alignment/SavedScreen";
import RecommendationsScreen from "../screens/career-alignment/RecommendationsScreen";
import WayfinderScreen from "../screens/wayfinder/WayfinderScreen";
import ProfileScreen from "../screens/profile/ProfileScreen";
import StudyGroupsScreen from "../screens/study-groups/StudyGroupScreen";
import ProgressionScreen from "../screens/progression-milestones/ProgressionScreen";
import NotificationScreen from "../screens/notifications/NotificationsScreen";

export type RootStackParamList = {
    Home: undefined;
    Profile: undefined;
    Notifications: undefined;

    // Career Alignment
    CareerAlignment: undefined;
    CareerExplorer: { category?: string } | undefined;
    CareerDetails: { career: Career };
    Quiz: undefined;
    Programmes: undefined;
    ProgrammeDetails: { programmeId: number };
    Saves: undefined;
    Recommendations: undefined;

    // Wayfinder
    Wayfinder: undefined;

    // Peer-to-peer Study Group Finder
    StudyGroups: undefined;

    // Progression/Milestones
    Progression: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function AppNavigator() {
    return (
        <NavigationContainer>
            <Stack.Navigator initialRouteName="Home">
                <Stack.Screen
                    name="Home"
                    component={HomeScreen}
                    options={{ headerShown: false }}
                />

                <Stack.Screen
                    name="Wayfinder"
                    component={WayfinderScreen}
                    options={{ title: "Campus Wayfinder" }}
                />

                <Stack.Screen
                    name="CareerAlignment"
                    component={CareerAlignmentScreen}
                    options={{ headerShown: false }}
                />

                <Stack.Screen
                    name="CareerExplorer"
                    component={CareerExplorerScreen}
                    options={{ headerShown: false }}
                />

                <Stack.Screen
                    name="CareerDetails"
                    component={CareerDetailsScreen}
                    options={{ headerShown: false }}
                />

                <Stack.Screen
                    name="Quiz"
                    component={QuizScreen}
                    options={{ title: "Career Quiz" }}
                />

                <Stack.Screen
                    name="Programmes"
                    component={ProgrammesScreen}
                    options={{ headerShown: false }}
                />

                <Stack.Screen
                    name="StudyGroups"
                    component={StudyGroupsScreen}
                    options={{ title: "Study Groups" }}
                />

                <Stack.Screen
                    name="Progression"
                    component={ProgressionScreen}
                    options={{ title: "Progression/Milestones "}}
                />
                
                <Stack.Screen
                    name="Profile"
                    component={ProfileScreen}
                    options={{ title: "Profile" }}
                />

                <Stack.Screen
                    name="ProgrammeDetails"
                    component={ProgrammeDetailsScreen}
                    options={{ headerShown: false }}
                />

                <Stack.Screen
                    name="Saves"
                    component={SavedScreen}
                    options={{ headerShown: false }}
                />

                <Stack.Screen
                    name="Recommendations"
                    component={RecommendationsScreen}
                    options={{ title: "Recommendations" }}
                />

                <Stack.Screen
                    name="Notifications"
                    component={NotificationScreen}
                    options={{ title: "Notifications "}}
                />
            </Stack.Navigator>
        </NavigationContainer>
    );
}