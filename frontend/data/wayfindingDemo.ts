import { WayfindingDestination } from "../types/wayfinding";

/**
 * UI-only preview data copied from the Building 303 backend seed. These records
 * keep the screen prototype usable in Expo Go without a running API.
 */
export const DEMO_DESTINATIONS: WayfindingDestination[] = [
    {
        code: "303-G01",
        name: "Room 303-G01 (SLT1)",
        shortName: "SLT1",
        floor: "Ground floor",
        building: "Science Centre • Building 303",
        category: "lecture",
        accessible: true,
        popular: true,
    },
    {
        code: "303-101",
        name: "Room 303-101 (MLT3)",
        shortName: "MLT3",
        floor: "Level 1",
        building: "Science Centre • Building 303",
        category: "lecture",
        accessible: true,
        popular: true,
    },
    {
        code: "303-102",
        name: "Room 303-102 (MLT2)",
        shortName: "MLT2",
        floor: "Level 1",
        building: "Science Centre • Building 303",
        category: "lecture",
        accessible: true,
        popular: true,
    },
    {
        code: "303-148",
        name: "Room 303-148",
        shortName: "303-148",
        floor: "Level 1",
        building: "Science Centre • Building 303",
        category: "room",
        accessible: true,
    },
    {
        code: "303-201",
        name: "Room 303-201",
        shortName: "303-201",
        floor: "Level 2",
        building: "Science Centre • Building 303",
        category: "room",
        accessible: true,
    },
    {
        code: "303-2-LAB",
        name: "Level 2 teaching lab",
        shortName: "Teaching lab",
        floor: "Level 2",
        building: "Science Centre • Building 303",
        category: "lab",
        accessible: true,
        popular: true,
    },
    {
        code: "303-G-TOILET",
        name: "Ground-floor accessible toilet",
        shortName: "Accessible toilet",
        floor: "Ground floor",
        building: "Science Centre • Building 303",
        category: "facility",
        accessible: true,
    },
    {
        code: "303-1-TOILET",
        name: "Level 1 accessible toilet",
        shortName: "Accessible toilet",
        floor: "Level 1",
        building: "Science Centre • Building 303",
        category: "facility",
        accessible: true,
    },
];

export function getDemoDestination(code: string): WayfindingDestination {
    return DEMO_DESTINATIONS.find((destination) => destination.code === code)
        ?? DEMO_DESTINATIONS[0];
}
