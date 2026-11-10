import { t } from "../lang";
import { escapeHtml } from "./sanitize";

export const allFunctions = [
    { value: "comfyui", label: "ComfyUI" },
    { value: "soundTts", label: t("voice.synthesis") },
    { value: "soundClone", label: t("voice.clone") },
    { value: "videoGen", label: t("avatar.digitalHuman") },
    { value: "asr", label: t("voice.recognition") },
    { value: "textToImage", label: t("model.txt2img") },
    { value: "imageToImage", label: t("model.img2img") },
    { value: "textToVideo", label: t("model.txt2video") },
    { value: "imageToVideo", label: t("model.img2video") },
    { value: "live", label: t("avatar.smartLive") },
    { value: "general", label: t("model.general") },
];

export function functionToLabels(functions: string[]) {
    return functions.map((f) => functionToLabel(f));
}

export function functionToLabel(f: string) {
    for (const func of allFunctions) {
        if (func.value === f) {
            return func.label;
        }
    }
    return f;
}

// Produces HTML for SafeHtml: the config comes from remote model servers, so
// every interpolated value is escaped here and sanitized again at render time.
export function buildServerContent(config: any) {
    const contentLines: string[] = [];
    if (config?.content) {
        contentLines.push(config.content as string);
    }
    if (config?.functions) {
        for (const func in config.functions) {
            if (config.functions[func]?.content) {
                contentLines.push(
                    '<p class="font-bold">' +
                        escapeHtml(functionToLabel(func)) +
                        "</p>",
                );
                contentLines.push(config.functions[func].content as string);
            }
        }
    }
    return contentLines.join("\n");
}

export function contentToFilenamePathPart(text: string, limit: number = 10) {
    return (
        text
            // 只保留字母、文字信息
            .replace(/[^a-zA-Z0-9\u4e00-\u9fa5]/g, "")
            .substring(0, limit)
    );
}
