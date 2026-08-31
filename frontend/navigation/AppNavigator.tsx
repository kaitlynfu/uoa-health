import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";

import CareerExplorerScreen from "../screens/CareerExplorerScreen";
import CameraGuidanceScreen from "../screens/CameraGuidanceScreen";
import DestinationSearchScreen from "../screens/DestinationSearchScreen";
import HomeScreen from "../screens/HomeScreen";
import ProgrammeDetailsScreen from "../screens/ProgrammeDetailsScreen";
import ProgrammesScreen from "../screens/ProgrammesScreen";
import QRScannerScreen from "../screens/QRScannerScreen";
import RecommendationsScreen from "../screens/RecommendationsScreen";
import RoutePreviewScreen from "../screens/RoutePreviewScreen";
import WayfinderScreen from "../screens/WayfinderScreen";

export type RootStackParamList = {
    Home: undefined;
    Programmes: undefined;
    ProgrammeDetails: { programmeId: number };
    CareerExplorer: undefined;
    Recommendations: undefined;
    Wayfinder: { checkpointCode?: string } | undefined;
    DestinationSearch: undefined;
    RoutePreview: { destinationCode: string; checkpointCode?: string };
    QRScanner: { destinationCode?: string } | undefined;
    CameraGuidance: { checkpointCode: string; destinationCode: string };
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
                    options={{ title: "Wayfinder", headerBackTitle: "Home" }}
                />

                <Stack.Screen
                    name="DestinationSearch"
                    component={DestinationSearchScreen}
                    options={{ title: "Choose destination", headerBackTitle: "Wayfinder" }}
                />

                <Stack.Screen
                    name="RoutePreview"
                    component={RoutePreviewScreen}
                    options={{ title: "Route preview", headerBackTitle: "Destinations" }}
                />

                <Stack.Screen
                    name="QRScanner"
                    component={QRScannerScreen}
                    options={{ title: "Scan checkpoint", headerBackTitle: "Wayfinder" }}
                />

                <Stack.Screen
                    name="CameraGuidance"
                    component={CameraGuidanceScreen}
                    options={{ title: "Navigation preview", headerBackTitle: "Scanner" }}
                />
            </Stack.Navigator>
        </NavigationContainer>
    );
}
