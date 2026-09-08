import { requireNativeView, requireOptionalNativeModule } from "expo";
import type { ComponentType } from "react";
import { Platform, type ViewProps } from "react-native";

export type PoseEvent = { nativeEvent: { transform: number[]; timestamp: number } };
export type StatusEvent = { nativeEvent: { state: string; message: string } };
export type MarkerEvent = { nativeEvent: { name: string; transform: number[]; timestamp: number } };
type Props = ViewProps & {
    active: boolean;
    waypoint: number[];
    onPose: (event: PoseEvent) => void;
    onStatus: (event: StatusEvent) => void;
    onMarker: (event: MarkerEvent) => void;
};
const native = Platform.OS === "ios"
    ? requireOptionalNativeModule<{ isSupported(): boolean; markerAlignmentVersion?: () => number;
        routeEditorAvailable?:()=>boolean; readHomeRoutes?:()=>string | null; writeHomeRoutes?:(value:string)=>void }>("WayfinderAr") : null;

export const homeArAvailable = Boolean(native?.isSupported());
export const markerArAvailable = homeArAvailable && native?.markerAlignmentVersion?.() === 1;
export const routeEditorAvailable = __DEV__ && native?.routeEditorAvailable?.() === true;
export function readHomeRoutes() { return native?.readHomeRoutes?.() ?? null; }
export function writeHomeRoutes(value:string) {
    if(!routeEditorAvailable || !native?.writeHomeRoutes) throw new Error('Route editing requires the new debug iPhone build.');
    native.writeHomeRoutes(value);
}
export const HomeArView: ComponentType<Props> | null = native
    ? requireNativeView<Props>("WayfinderAr") : null;
