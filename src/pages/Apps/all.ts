import {t} from "../../lang";

import LongTextTts from "./LongTextTts/LongTextTts.vue";
import SubtitleTts from "./SubtitleTts/SubtitleTts.vue";
import SoundReplace from "./SoundReplace/SoundReplace.vue";

import VideoGenFlow from "./VideoGenFlow/VideoGenFlow.vue";

import LongTextTtsIcon from "./LongTextTts/assets/icon.svg";
import SubtitleTtsIcon from "./SubtitleTts/assets/icon.svg";
import SoundReplaceIcon from "./SoundReplace/assets/icon.svg";

import VideoGenFlowIcon from "./VideoGenFlow/assets/icon.svg";

import TextToImage from "./TextToImage/TextToImage.vue";
import TextToImageIcon from "./TextToImage/assets/icon.svg";
import ImageToImage from "./ImageToImage/ImageToImage.vue";
import ImageToImageIcon from "./ImageToImage/assets/icon.svg";

import FeedbackIcon from "./../../assets/image/feedback.svg";

export const SoundApps = [
    {
        name: "LongTextTts",
        title: t("task.longTextToAudio"),
        description: t("desc.longTextToAudio"),
        icon: LongTextTtsIcon,
        component: LongTextTts,
    },
    {
        name: "SubtitleTts",
        title: t("task.subtitleToAudio"),
        description: t("desc.subtitleToAudio"),
        icon: SubtitleTtsIcon,
        component: SubtitleTts,
    },
    {
        name: "SoundReplace",
        title: t("voice.replace"),
        description: t("desc.videoVoiceReplace"),
        icon: SoundReplaceIcon,
        component: SoundReplace,
    },
];

export const VideoApps = [
    {
        name: "VideoGenFlow",
        title: t("avatar.oneClickSynthesis"),
        description: t("intro.textToVideo"),
        icon: VideoGenFlowIcon,
        component: VideoGenFlow,
    },
];

export const ToolApps = [
    {
        name: "TextToImage",
        title: t("model.txt2img"),
        description: t("desc.txt2img"),
        icon: TextToImageIcon,
        component: TextToImage,
    },
    {
        name: "ImageToImage",
        title: t("model.img2img"),
        description: t("desc.img2img"),
        icon: ImageToImageIcon,
        component: ImageToImage,
    }
];

export const AllApps = [
    ...(SoundApps.map(app => ({
        ...app,
        url: `/sound?tab=${app.name}`,
    })) as any),
    ...(VideoApps.map(app => ({
        ...app,
        url: `/video?tab=${app.name}`,
    })) as any),
    ...(ToolApps.map(app => ({
        ...app,
        url: `/tool?tab=${app.name}`,
    })) as any),
    {
        title: t("feedback.toolRequest"),
        description: t("msg.moreTools"),
        icon: FeedbackIcon,
        url: "https://aigcpanel.com/wish",
    },
];
