import { requireNativeView, requireOptionalNativeModule } from "expo";
import type { ComponentType } from "react";
import { Platform, type ViewProps } from "react-native";

export type PoseEvent = { nativeEvent: { transform: number[]; timestamp: number } };
export type StatusEvent = { nativeEvent: { state: string; message: string } };
export type MarkerEvent = { nativeEvent: { name: string; transform: number[]; timestamp: number } };
export type EnvironmentEvent = {nativeEvent:{kind:string;message?:string;requestID?:string;timestamp?:number;alignment?:number[];sessionID?:string;routes?:string}};
type Props = ViewProps & {
    active: boolean;
    environmentKey?: string;
    waypoint: number[];
    onPose: (event: PoseEvent) => void;
    onStatus: (event: StatusEvent) => void;
    onMarker: (event: MarkerEvent) => void;
    localizationMode?: 'marker' | 'world';
    recordingEnabled?: boolean;
    saveEnvironmentRequest?: string;
    onMapping?: (event:{nativeEvent:{state:string}})=>void;
    onEnvironment?: (event:EnvironmentEvent)=>void;
};
const native = Platform.OS === "ios"
    ? requireOptionalNativeModule<{ isSupported(): boolean; markerAlignmentVersion?: () => number;
        routeEditorAvailable?:()=>boolean; readHomeRoutes?:()=>string | null; writeHomeRoutes?:(value:string)=>void;
        environmentVersion?:()=>number;readEnvironmentRoutes?:()=>string|null;
        campusEnvironmentVersion?:()=>number;
        readCampusDraft?:(key:string)=>string|null;writeCampusDraft?:(key:string,value:string)=>void;
        exportCampusEnvironment?:(key:string)=>Promise<string>;
        importCampusEnvironment?:(key:string,encoded:string,digest:string,binding:string)=>Promise<void> }>("WayfinderAr") : null;

export const campusArAvailable = Boolean(native?.isSupported() && native?.campusEnvironmentVersion?.()===1);
export function readCampusDraft(key:string) { return native?.readCampusDraft?.(key) ?? null; }
export function writeCampusDraft(key:string,value:string) {
    if(!native?.writeCampusDraft) throw new Error('Rebuild the iPhone app for campus editing.');
    native.writeCampusDraft(key,value);
}
export async function exportCampusEnvironment(key:string) {
    if(!native?.exportCampusEnvironment) throw new Error('Rebuild for campus recording.');
    return native.exportCampusEnvironment(key);
}
export async function importCampusEnvironment(key:string,data:string,digest:string,binding:string) {
    if(!native?.importCampusEnvironment) throw new Error('Rebuild for campus recognition.');
    return native.importCampusEnvironment(key,data,digest,binding);
}

export const homeArAvailable = Boolean(native?.isSupported());
export const markerArAvailable = homeArAvailable && native?.markerAlignmentVersion?.() === 1;
export const routeEditorAvailable = native?.routeEditorAvailable?.() === true;
export const environmentAvailable = homeArAvailable && native?.environmentVersion?.() === 1;
export function readEnvironmentRoutes() { return native?.readEnvironmentRoutes?.() ?? null; }
export function readHomeRoutes() { return native?.readHomeRoutes?.() ?? null; }
export function writeHomeRoutes(value:string) {
    if(!routeEditorAvailable || !native?.writeHomeRoutes) throw new Error('Route editing requires the updated iPhone build.');
    native.writeHomeRoutes(value);
}
export const HomeArView: ComponentType<Props> | null = native
    ? requireNativeView<Props>("WayfinderAr") : null;
