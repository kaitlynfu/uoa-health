import { requireNativeView, requireOptionalNativeModule } from "expo";
import type { ComponentType } from "react";
import { Platform, type ViewProps } from "react-native";

export type PoseEvent = { nativeEvent: { transform: number[]; timestamp: number } };
export type StatusEvent = { nativeEvent: { state: string; message: string } };
type Props = ViewProps & {
    active: boolean;
    waypoint: number[];
    onPose: (event: PoseEvent) => void;
    onStatus: (event: StatusEvent) => void;
};
const native = Platform.OS === "ios"
    ? requireOptionalNativeModule<{ isSupported(): boolean }>("WayfinderAr") : null;

export const homeArAvailable = Boolean(native?.isSupported());
export const HomeArView: ComponentType<Props> | null = native
    ? requireNativeView<Props>("WayfinderAr") : null;
