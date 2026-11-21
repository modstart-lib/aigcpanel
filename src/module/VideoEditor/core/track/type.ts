import type { AudioTrackItem } from "./item/AudioTrackItem";
import type { ImageTrackItem } from "./item/ImageTrackItem";
import type { TextTrackItem } from "./item/TextTrackItem";
import type { VideoTrackItem } from "./item/VideoTrackItem";

export type TrackItemType =
    "video" | "audio" | "text" | "image" | "effect" | "transition" | "filter";

export type TrackItem =
    AudioTrackItem | ImageTrackItem | TextTrackItem | VideoTrackItem;

export type VisibleTrackItem = ImageTrackItem | TextTrackItem | VideoTrackItem;

export type MediaTrackItem = AudioTrackItem | VideoTrackItem;

export type AllTrackSource = ImageTrackSource &
    VideoTrackSource &
    AudioTrackSource &
    TextTrackSource;

export interface BaseTrackSource {
    // base
    id: string;
    duration: number;
    start: number;
}

export interface ImageTrackSource extends BaseTrackSource {
    url: string;
    name: string;
    format: string;
    centerX: number;
    centerY: number;
    scaleX: number;
    scaleY: number;
    width: number;
    height: number;
}

export interface VideoTrackSource extends BaseTrackSource {
    url: string;
    name: string;
    format: string;
    centerX: number;
    centerY: number;
    scaleX: number;
    scaleY: number;
    width: number;
    height: number;
}

export interface AudioTrackSource extends BaseTrackSource {
    url: string;
    name: string;
    format: string;
}

export interface TextTrackSource extends BaseTrackSource {
    content: string;
    fontSize?: number;
    fontFamily?: string;
    fill: string;
    stroke: string;
    textBackgroundColor: string;
}

export interface BaseTrackItem {
    id: string;
    type: TrackItemType;
    name: string;
    start: number; // start frame index
    end: number; // end frame index
    frameCount: number;
    format: string;
    source: any;
    option: BaseTrackItemOption;
}

export type BaseTrackItemOption = {
    // lock all
    locked?: boolean;
    // position lock, can not move position
    positionLocked?: boolean;
    // size lock, can not resize
    sizeLocked?: boolean;
    // time lock, can not change start/end time
    timeLocked?: boolean;
    // image, video init scale
    initScale?: number;
    // tracker name show type
    trackerNameType?: "name" | "duration";
};

export interface BaseVisibleTrackItem {
    centerX: number;
    centerY: number;
    scaleX: number;
    scaleY: number;
    width: number;
    height: number;
}

export interface BaseMediaTrackItem {
    offsetL: number;
    offsetR: number;
}

export type TrackActionType =
    "Undo" | "Redo" | "Split" | "Delete" | "RectSelector" | "TimeRangeSelector";

export type TrackActionItem = {
    type: TrackActionType;
    title: string;
    disabled: boolean;
    comp?: any;
    icon?: any;
};

export interface TrackLineItem {
    type: TrackItem["type"];
    main?: boolean;
    list: TrackItem[];
}

export type TrackAddType = "RectSelector" | "TimeRangeSelector";

export type TrackResizeOption = {
    init?: boolean;
};
