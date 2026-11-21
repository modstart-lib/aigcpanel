import { BaseTrackItemOption, TrackItem, TrackItemType } from "./track/type";

export type VideoEditorMode =
    "" | "editor" | "rectsSelector" | "timeRangesSelector";

export type VideoEditorOption = {
    // in seconds
    defaultRectSelectorDuration?: number;
};

export type RequireSome<T, K extends keyof T> = Pick<T, K> &
    Partial<Omit<T, K>>;

export type VideoEditorTrack = {
    type: TrackItem["type"];
    list: {
        // base
        id: string;
        type: TrackItemType;
        name: string;
        start: number; // start frame index
        end: number; // end frame index
        frameCount: number;
        format: string;
        option: BaseTrackItemOption;
        // visible
        centerX: number;
        centerY: number;
        scaleX: number;
        scaleY: number;
        width: number;
        height: number;
        rect: { x: number; y: number; width: number; height: number };
        // media
        offsetL: number;
        offsetR: number;
        // others
        source: any;
        // others for video
        ///// nothing
        // others for image
        ///// nothing
        // others for text
        fill?: string;
        stroke?: string;
        textBackgroundColor?: string;
        fontSize?: number;
        fontFamily?: string;
        content?: string;
        // others for audio
        ///// nothing
    }[];
};

export type VideoEditorData = {
    setting: {
        width: number;
        height: number;
        fps: number;
    };
    tracks: VideoEditorTrack[];
};
