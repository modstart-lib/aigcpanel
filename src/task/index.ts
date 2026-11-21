import { nextTick } from "vue";
import {
    AudioNormal,
    AudioNormalCleaner,
} from "../pages/Apps/AudioNormal/task";
import { Ffmpeg, FfmpegCleaner } from "../pages/Apps/Ffmpeg/task";
import {
    ImageToImage,
    ImageToImageCleaner,
} from "../pages/Apps/ImageToImage/task";
import {
    ImageToVideo,
    ImageToVideoCleaner,
} from "../pages/Apps/ImageToVideo/task";
import {
    LongTextTts,
    LongTextTtsCleaner,
} from "../pages/Apps/LongTextTts/task";
import {
    MediaFormatConvert,
    MediaFormatConvertCleaner,
} from "../pages/Apps/MediaFormatConvert/task";
import {
    SoundReplace,
    SoundReplaceCleaner,
} from "../pages/Apps/SoundReplace/task";
import {
    SubtitleTts,
    SubtitleTtsCleaner,
} from "../pages/Apps/SubtitleTts/task";
import {
    TextToImage,
    TextToImageCleaner,
} from "../pages/Apps/TextToImage/task";
import {
    TextToVideo,
    TextToVideoCleaner,
} from "../pages/Apps/TextToVideo/task";
import {
    VideoBackground,
    VideoBackgroundCleaner,
} from "../pages/Apps/VideoBackground/task";
import {
    VideoBackgroundReplace,
    VideoBackgroundReplaceCleaner,
} from "../pages/Apps/VideoBackgroundReplace/task";
import {
    VideoCompress,
    VideoCompressCleaner,
} from "../pages/Apps/VideoCompress/task";
import { VideoGenFlow } from "../pages/Apps/VideoGenFlow/task";
import {
    VideoKeepPart,
    VideoKeepPartCleaner,
} from "../pages/Apps/VideoKeepPart/task";
import { VideoMark, VideoMarkCleaner } from "../pages/Apps/VideoMark/task";
import { VideoMerge, VideoMergeCleaner } from "../pages/Apps/VideoMerge/task";
import {
    VideoMergeAudio,
    VideoMergeAudioCleaner,
} from "../pages/Apps/VideoMergeAudio/task";
import {
    VideoMergeImage,
    VideoMergeImageCleaner,
} from "../pages/Apps/VideoMergeImage/task";
import {
    VideoQuickCut,
    VideoQuickCutCleaner,
} from "../pages/Apps/VideoQuickCut/task";
import {
    VideoSizeConvert,
    VideoSizeConvertCleaner,
} from "../pages/Apps/VideoSizeConvert/task";
import { VideoSpeed, VideoSpeedCleaner } from "../pages/Apps/VideoSpeed/task";
import {
    VideoSpeedPart,
    VideoSpeedPartCleaner,
} from "../pages/Apps/VideoSpeedPart/task";
import {
    VideoSubtitle,
    VideoSubtitleCleaner,
} from "../pages/Apps/VideoSubtitle/task";
import { VideoZoom, VideoZoomCleaner } from "../pages/Apps/VideoZoom/task";
import {
    GeneralModel,
    GeneralModelCleaner,
} from "../pages/Apps/GeneralModel/task";
import {
    GeneralComfyUI,
    GeneralComfyUICleaner,
} from "../pages/Apps/GeneralComfyUI/task";
import { TaskService } from "../service/TaskService";

import { useServerStore } from "../store/modules/server";
import { useTaskStore } from "../store/modules/task";
import { SoundAsr } from "./SoundAsr";
import { SoundGenerate } from "./SoundGenerate";
import { VideoGen } from "./VideoGen";


const taskStore = useTaskStore();
const serverStore = useServerStore();

export const tasks = {
    // basics
    SoundGenerate,
    SoundAsr,
    VideoGen,
    // sound apps
    LongTextTts,
    SubtitleTts,
    SoundReplace,
    AudioNormal,
    // video apps
    VideoGenFlow,
    TextToImage,
    ImageToImage,
    TextToVideo,
    ImageToVideo,
    // video processing apps
    VideoBackground,
    VideoBackgroundReplace,
    VideoQuickCut,
    VideoZoom,
    VideoMark,
    VideoSubtitle,
    VideoSpeed,
    VideoSizeConvert,
    VideoCompress,
    VideoSpeedPart,
    VideoKeepPart,
    VideoMergeImage,
    VideoMergeAudio,
    VideoMerge,
    MediaFormatConvert,
    Ffmpeg,
    // general apps
    GeneralModel,
    GeneralComfyUI,
    
};

export const taskCleaners = {
    // sound cleaners
    LongTextTts: LongTextTtsCleaner,
    SubtitleTts: SubtitleTtsCleaner,
    SoundReplace: SoundReplaceCleaner,
    AudioNormal: AudioNormalCleaner,
    // video cleaners
    TextToImage: TextToImageCleaner,
    ImageToImage: ImageToImageCleaner,
    TextToVideo: TextToVideoCleaner,
    ImageToVideo: ImageToVideoCleaner,
    // video processing cleaners
    VideoBackground: VideoBackgroundCleaner,
    VideoBackgroundReplace: VideoBackgroundReplaceCleaner,
    VideoQuickCut: VideoQuickCutCleaner,
    VideoZoom: VideoZoomCleaner,
    VideoMark: VideoMarkCleaner,
    VideoSubtitle: VideoSubtitleCleaner,
    VideoSpeed: VideoSpeedCleaner,
    VideoSizeConvert: VideoSizeConvertCleaner,
    VideoCompress: VideoCompressCleaner,
    VideoSpeedPart: VideoSpeedPartCleaner,
    VideoKeepPart: VideoKeepPartCleaner,
    VideoMergeImage: VideoMergeImageCleaner,
    VideoMergeAudio: VideoMergeAudioCleaner,
    VideoMerge: VideoMergeCleaner,
    MediaFormatConvert: MediaFormatConvertCleaner,
    Ffmpeg: FfmpegCleaner,
    // general cleaners（归档到 hub 的结果文件清理）
    GeneralModel: GeneralModelCleaner,
    GeneralComfyUI: GeneralComfyUICleaner,
    
};

export const TaskManager = {
    init() {
        for (const k in tasks) {
            taskStore.register(k, tasks[k]);
        }
        window.__page.registerCallPage(
            "httpserver:submitTask",
            async (
                resolve: (data: any) => void,
                reject: (error: string) => void,
                data: any,
            ) => {
                try {
                    const { biz, taskId } = data;
                    await taskStore.dispatch(biz, taskId, {});
                    resolve({ taskId });
                } catch (e: any) {
                    reject(String(e));
                }
            },
        );
        // CLI 安装/卸载模型后刷新 server 列表
        window.__page.registerCallPage(
            "httpserver:serverReload",
            async (
                resolve: (data: any) => void,
                reject: (error: string) => void,
            ) => {
                try {
                    await useServerStore().reloadRecords();
                    resolve({ ok: true });
                } catch (e: any) {
                    reject(String(e));
                }
            },
        );
        
        nextTick(async () => {
            await serverStore.waitReady();
            for (const k in tasks) {
                await TaskService.restoreForTask(k as any);
            }
            
            for (const k in taskCleaners) {
                TaskService.registerCleaner(k as any, taskCleaners[k]);
            }
        }).then();
    },
    count() {
        return taskStore.records.length;
    },
};
