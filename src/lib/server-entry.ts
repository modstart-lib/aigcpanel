import Router from "../router";
import { t } from "../lang";

// The capability label (functionToLabel) is a category such as "数字人", not the
// page the user came from, so the guide also needs the page name to name itself.
const sourceLabels: Record<string, () => string> = {
    videoGen: () => t("avatar.synthesis"),
    soundTts: () => t("voice.synthesis"),
    asr: () => t("voice.recognition"),
    textToImage: () => t("model.txt2img"),
    imageToImage: () => t("model.img2img"),
    textToVideo: () => t("model.txt2video"),
    imageToVideo: () => t("model.img2video"),
    general: () => t("general.model.title"),
    comfyui: () => t("general.comfyui.title"),
};

// The model selector only emits `needModel`; hosts decide whether to leave the
// page, so modal hosts can keep unsaved input and show a hint instead.
export const goImportModel = (func: string) => {
    // `back` and `src` are part of the query so the target page can return and
    // name its source without relying on browser history (hash routing survives
    // reloads this way).
    const back = Router.currentRoute.value.fullPath;
    const src = sourceLabels[func]?.() || "";
    Router.push({
        path: "/server",
        query: { from: "selector", func, back, src },
    }).catch(() => {});
};
