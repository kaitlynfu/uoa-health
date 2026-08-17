import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";

import CareerExplorerScreen from "../screens/CareerExplorerScreen";
import HomeScreen from "../screens/HomeScreen";
import ProgrammeDetailsScreen from "../screens/ProgrammeDetailsScreen";
import ProgrammesScreen from "../screens/ProgrammesScreen";
import RecommendationsScreen from "../screens/RecommendationsScreen";
import WayfinderScreen from "../screens/WayfinderScreen";

export type RootStackParamList = {
    Home: undefined;
    Programmes: undefined;
    ProgrammeDetails: { programmeId: number };
    CareerExplorer: undefined;
    Recommendations: undefined;
    Wayfinder: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function AppNavigator() {
    return (
        <NavigationContainer>
            <Stack.Navigator initialRouteName="Home">
                <Stack.Screen
                    name="Home"
                    component={HomeScreen}
                    options={{ title: "Home" }}
                />

                <Stack.Screen
                    name="Programmes"
                    component={ProgrammesScreen}
                    options={{ title: "Programmes" }}
                />

                <Stack.Screen
                    name="ProgrammeDetails"
                    component={ProgrammeDetailsScreen}
                    options={{ title: "Programme Details" }}
                />

                <Stack.Screen
                    name="CareerExplorer"
                    component={CareerExplorerScreen}
                    options={{ title: "Career Explorer" }}
                />

                <Stack.Screen
                    name="Recommendations"
                    component={RecommendationsScreen}
                    options={{ title: "Recommendations" }}
                />

                <Stack.Screen
                    name="Wayfinder"
                    component={WayfinderScreen}
                    options={{ title: "Campus Wayfinder" }}
                />
            </Stack.Navigator>
        </NavigationContainer>
    );
}