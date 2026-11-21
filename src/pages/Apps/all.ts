import { defineAsyncComponent } from "vue";
import { t } from "../../lang";

import LongTextTts from "./LongTextTts/LongTextTts.vue";
import SubtitleTts from "./SubtitleTts/SubtitleTts.vue";
import SoundReplace from "./SoundReplace/SoundReplace.vue";
import SoundAsr from "../Video/SoundAsr.vue";

import VideoGenFlow from "./VideoGenFlow/VideoGenFlow.vue";

import LongTextTtsIcon from "~icons/mdi/waveform";
import SubtitleTtsIcon from "~icons/mdi/subtitles";
import SoundReplaceIcon from "~icons/mdi/microphone-variant";
import SoundAsrIcon from "~icons/mdi/microphone-outline";

import VideoGenFlowIcon from "~icons/mdi/video-vintage";

import TextToImage from "./TextToImage/TextToImage.vue";
import TextToImageIcon from "~icons/mdi/image-text";
import ImageToImage from "./ImageToImage/ImageToImage.vue";
import ImageToImageIcon from "~icons/mdi/image-filter-none";
import TextToVideo from "./TextToVideo/TextToVideo.vue";
import TextToVideoIcon from "~icons/mdi/video-outline";
import ImageToVideo from "./ImageToVideo/ImageToVideo.vue";
import ImageToVideoIcon from "~icons/mdi/video-image";

import FeedbackIcon from "./../../assets/image/feedback.svg";

import AudioNormalIcon from "~icons/mdi/volume-high";
import VideoBackgroundIcon from "~icons/mdi/image-filter-hdr";
import VideoBackgroundReplaceIcon from "~icons/mdi/wallpaper";
import VideoQuickCutIcon from "~icons/mdi/content-cut";
import VideoZoomIcon from "~icons/mdi/magnify";
import VideoMarkIcon from "~icons/mdi/watermark";
import VideoSubtitleIcon from "~icons/mdi/subtitles-outline";
import VideoSpeedIcon from "~icons/mdi/speedometer";
import VideoSizeConvertIcon from "~icons/mdi/aspect-ratio";
import VideoCompressIcon from "~icons/mdi/zip-box";
import VideoSpeedPartIcon from "~icons/mdi/fast-forward";
import VideoKeepPartIcon from "~icons/mdi/scissors-cutting";
import VideoMergeImageIcon from "~icons/mdi/image-plus";
import VideoMergeAudioIcon from "~icons/mdi/music-note-plus";
import VideoMergeIcon from "~icons/mdi/merge";
import MediaFormatConvertIcon from "~icons/mdi/transfer";
import FfmpegIcon from "~icons/mdi/console";

import GeneralModelIcon from "~icons/mdi/cube-outline";
import GeneralComfyUIIcon from "~icons/mdi/workflow-outline";

export const SoundApps: {
    name: string;
    title: string;
    description: string;
    icon: any;
    color: string;
    component: any;
}[] = [];

export const SoundToolApps = [
    {
        name: "SoundAsr",
        titleKey: "voice.recognition",
        title: t("voice.recognition"),
        descriptionKey: "desc.recognitionEdit",
        description: t("desc.recognitionEdit"),
        icon: SoundAsrIcon,
        color: "#f59e0b",
        component: SoundAsr,
    },
    {
        name: "LongTextTts",
        titleKey: "task.longTextToAudio",
        title: t("task.longTextToAudio"),
        descriptionKey: "desc.longTextToAudio",
        description: t("desc.longTextToAudio"),
        icon: LongTextTtsIcon,
        color: "#6366f1",
        component: LongTextTts,
    },
    {
        name: "SubtitleTts",
        titleKey: "task.subtitleToAudio",
        title: t("task.subtitleToAudio"),
        descriptionKey: "desc.subtitleToAudio",
        description: t("desc.subtitleToAudio"),
        icon: SubtitleTtsIcon,
        color: "#8b5cf6",
        component: SubtitleTts,
    },
    {
        name: "SoundReplace",
        titleKey: "voice.replace",
        title: t("voice.replace"),
        descriptionKey: "desc.videoVoiceReplace",
        description: t("desc.videoVoiceReplace"),
        icon: SoundReplaceIcon,
        color: "#ec4899",
        component: SoundReplace,
    },
    {
        name: "AudioNormal",
        titleKey: "app.audioNormal",
        title: t("app.audioNormal"),
        descriptionKey: "app.audioNormalDesc",
        description: t("app.audioNormalDesc"),
        icon: AudioNormalIcon,
        color: "#14b8a6",
        component: defineAsyncComponent(
            () => import("./AudioNormal/AudioNormal.vue"),
        ),
    },
];

export const VideoApps = [
    {
        name: "VideoGenFlow",
        titleKey: "avatar.oneClickSynthesis",
        title: t("avatar.oneClickSynthesis"),
        descriptionKey: "intro.textToVideo",
        description: t("intro.textToVideo"),
        icon: VideoGenFlowIcon,
        color: "#f59e0b",
        component: VideoGenFlow,
    },
];

export const ToolApps = [
    {
        name: "TextToImage",
        titleKey: "model.txt2img",
        title: t("model.txt2img"),
        descriptionKey: "desc.txt2img",
        description: t("desc.txt2img"),
        icon: TextToImageIcon,
        color: "#3b82f6",
        component: TextToImage,
    },
    {
        name: "ImageToImage",
        titleKey: "model.img2img",
        title: t("model.img2img"),
        descriptionKey: "desc.img2img",
        description: t("desc.img2img"),
        icon: ImageToImageIcon,
        color: "#06b6d4",
        component: ImageToImage,
    },
    {
        name: "TextToVideo",
        titleKey: "model.txt2video",
        title: t("model.txt2video"),
        descriptionKey: "desc.txt2video",
        description: t("desc.txt2video"),
        icon: TextToVideoIcon,
        color: "#8b5cf6",
        component: TextToVideo,
    },
    {
        name: "ImageToVideo",
        titleKey: "model.img2video",
        title: t("model.img2video"),
        descriptionKey: "desc.img2video",
        description: t("desc.img2video"),
        icon: ImageToVideoIcon,
        color: "#10b981",
        component: ImageToVideo,
    },
];

export const VideoProcessingApps = [
    {
        name: "VideoBackground",
        titleKey: "app.videoBackground",
        title: t("app.videoBackground"),
        descriptionKey: "app.videoBackgroundDesc",
        description: t("app.videoBackgroundDesc"),
        icon: VideoBackgroundIcon,
        color: "#22c55e",
        component: defineAsyncComponent(
            () => import("./VideoBackground/VideoBackground.vue"),
        ),
    },
    {
        name: "VideoBackgroundReplace",
        titleKey: "app.videoBackgroundReplace",
        title: t("app.videoBackgroundReplace"),
        descriptionKey: "app.videoBackgroundReplaceDesc",
        description: t("app.videoBackgroundReplaceDesc"),
        icon: VideoBackgroundReplaceIcon,
        color: "#6d28d9",
        component: defineAsyncComponent(
            () => import("./VideoBackgroundReplace/VideoBackgroundReplace.vue"),
        ),
    },
    {
        name: "VideoQuickCut",
        titleKey: "app.videoQuickCut",
        title: t("app.videoQuickCut"),
        descriptionKey: "app.videoQuickCutDesc",
        description: t("app.videoQuickCutDesc"),
        icon: VideoQuickCutIcon,
        color: "#ef4444",
        component: defineAsyncComponent(
            () => import("./VideoQuickCut/VideoQuickCut.vue"),
        ),
    },
    {
        name: "VideoZoom",
        titleKey: "app.videoZoom",
        title: t("app.videoZoom"),
        descriptionKey: "app.videoZoomDesc",
        description: t("app.videoZoomDesc"),
        icon: VideoZoomIcon,
        color: "#f97316",
        component: defineAsyncComponent(
            () => import("./VideoZoom/VideoZoom.vue"),
        ),
    },
    {
        name: "VideoMark",
        titleKey: "app.videoMark",
        title: t("app.videoMark"),
        descriptionKey: "app.videoMarkDesc",
        description: t("app.videoMarkDesc"),
        icon: VideoMarkIcon,
        color: "#a855f7",
        component: defineAsyncComponent(
            () => import("./VideoMark/VideoMark.vue"),
        ),
    },
    {
        name: "VideoSubtitle",
        titleKey: "app.videoSubtitle",
        title: t("app.videoSubtitle"),
        descriptionKey: "app.videoSubtitleDesc",
        description: t("app.videoSubtitleDesc"),
        icon: VideoSubtitleIcon,
        color: "#0ea5e9",
        component: defineAsyncComponent(
            () => import("./VideoSubtitle/VideoSubtitle.vue"),
        ),
    },
    {
        name: "VideoSpeed",
        titleKey: "app.videoSpeed",
        title: t("app.videoSpeed"),
        descriptionKey: "app.videoSpeedDesc",
        description: t("app.videoSpeedDesc"),
        icon: VideoSpeedIcon,
        color: "#84cc16",
        component: defineAsyncComponent(
            () => import("./VideoSpeed/VideoSpeed.vue"),
        ),
    },
    {
        name: "VideoSizeConvert",
        titleKey: "app.videoSizeConvert",
        title: t("app.videoSizeConvert"),
        descriptionKey: "app.videoSizeConvertDesc",
        description: t("app.videoSizeConvertDesc"),
        icon: VideoSizeConvertIcon,
        color: "#f43f5e",
        component: defineAsyncComponent(
            () => import("./VideoSizeConvert/VideoSizeConvert.vue"),
        ),
    },
    {
        name: "VideoCompress",
        titleKey: "app.videoCompress",
        title: t("app.videoCompress"),
        descriptionKey: "app.videoCompressDesc",
        description: t("app.videoCompressDesc"),
        icon: VideoCompressIcon,
        color: "#78716c",
        component: defineAsyncComponent(
            () => import("./VideoCompress/VideoCompress.vue"),
        ),
    },
    {
        name: "VideoSpeedPart",
        titleKey: "app.videoSpeedPart",
        title: t("app.videoSpeedPart"),
        descriptionKey: "app.videoSpeedPartDesc",
        description: t("app.videoSpeedPartDesc"),
        icon: VideoSpeedPartIcon,
        color: "#d946ef",
        component: defineAsyncComponent(
            () => import("./VideoSpeedPart/VideoSpeedPart.vue"),
        ),
    },
    {
        name: "VideoKeepPart",
        titleKey: "app.videoKeepPart",
        title: t("app.videoKeepPart"),
        descriptionKey: "app.videoKeepPartDesc",
        description: t("app.videoKeepPartDesc"),
        icon: VideoKeepPartIcon,
        color: "#64748b",
        component: defineAsyncComponent(
            () => import("./VideoKeepPart/VideoKeepPart.vue"),
        ),
    },
    {
        name: "VideoMergeImage",
        titleKey: "app.videoMergeImage",
        title: t("app.videoMergeImage"),
        descriptionKey: "app.videoMergeImageDesc",
        description: t("app.videoMergeImageDesc"),
        icon: VideoMergeImageIcon,
        color: "#10b981",
        component: defineAsyncComponent(
            () => import("./VideoMergeImage/VideoMergeImage.vue"),
        ),
    },
    {
        name: "VideoMergeAudio",
        titleKey: "app.videoMergeAudio",
        title: t("app.videoMergeAudio"),
        descriptionKey: "app.videoMergeAudioDesc",
        description: t("app.videoMergeAudioDesc"),
        icon: VideoMergeAudioIcon,
        color: "#7c3aed",
        component: defineAsyncComponent(
            () => import("./VideoMergeAudio/VideoMergeAudio.vue"),
        ),
    },
    {
        name: "VideoMerge",
        titleKey: "app.videoMerge",
        title: t("app.videoMerge"),
        descriptionKey: "app.videoMergeDesc",
        description: t("app.videoMergeDesc"),
        icon: VideoMergeIcon,
        color: "#dc2626",
        component: defineAsyncComponent(
            () => import("./VideoMerge/VideoMerge.vue"),
        ),
    },
    {
        name: "MediaFormatConvert",
        titleKey: "app.mediaFormatConvert",
        title: t("app.mediaFormatConvert"),
        descriptionKey: "app.mediaFormatConvertDesc",
        description: t("app.mediaFormatConvertDesc"),
        icon: MediaFormatConvertIcon,
        color: "#2563eb",
        component: defineAsyncComponent(
            () => import("./MediaFormatConvert/MediaFormatConvert.vue"),
        ),
    },
    {
        name: "Ffmpeg",
        titleKey: "app.ffmpeg",
        title: t("app.ffmpeg"),
        descriptionKey: "app.ffmpegDesc",
        description: t("app.ffmpegDesc"),
        icon: FfmpegIcon,
        color: "#374151",
        component: defineAsyncComponent(() => import("./Ffmpeg/Ffmpeg.vue")),
    },
];

// 通用模型分组（工具"通用"）：
// - GeneralModel：调用系统无法识别的其他类型模型（config.json 声明 general 数组）
// - GeneralComfyUI：调用 ComfyUI 服务中 biz 未归类的通用工作流
export const GeneralApps = [
    {
        name: "GeneralModel",
        titleKey: "general.model.title",
        title: t("general.model.title"),
        descriptionKey: "general.model.appDesc",
        description: t("general.model.appDesc"),
        icon: GeneralModelIcon,
        color: "#0d9488",
        component: defineAsyncComponent(
            () => import("./GeneralModel/GeneralModel.vue"),
        ),
    },
    {
        name: "GeneralComfyUI",
        titleKey: "general.comfyui.title",
        title: t("general.comfyui.title"),
        descriptionKey: "general.comfyui.appDesc",
        description: t("general.comfyui.appDesc"),
        icon: GeneralComfyUIIcon,
        color: "#0891b2",
        component: defineAsyncComponent(
            () => import("./GeneralComfyUI/GeneralComfyUI.vue"),
        ),
    },
];

export const AllApps = [
    ...(SoundApps.map((app) => ({
        ...app,
        url: `/video?tab=${app.name}`,
    })) as any),
    ...(SoundToolApps.map((app) => ({
        ...app,
        url: `/tool?tab=${app.name}`,
    })) as any),
    ...(ToolApps.map((app) => ({
        ...app,
        url: `/tool?tab=${app.name}`,
    })) as any),
    ...(VideoProcessingApps.map((app) => ({
        ...app,
        url: `/tool?tab=${app.name}`,
    })) as any),
    ...(GeneralApps.map((app) => ({
        ...app,
        url: `/tool?tab=${app.name}`,
    })) as any),
    {
        titleKey: "feedback.toolRequest",
        title: t("feedback.toolRequest"),
        descriptionKey: "msg.moreTools",
        description: t("msg.moreTools"),
        icon: FeedbackIcon,
        url: "https://aigcpanel.com/wish",
    },
];
