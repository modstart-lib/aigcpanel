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

/**
 * config.json 的 functions 既可能是对象（{ [name]: {...定义} }），
 * 也可能是数组（旧格式/种子数据）；模型记录里统一存为能力名数组，
 * 否则渲染层 `record.functions.includes(...)` 会直接报错。
 */
export function serverFunctionNames(functions: any): string[] {
    if (Array.isArray(functions)) {
        return functions.map((f) => String(f));
    }
    if (functions && typeof functions === "object") {
        return Object.keys(functions);
    }
    return [];
}

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

/**
 * ParamForm 支持的参数类型（config.json / meta.json 的唯一合法取值）。
 * 导入模型时会校验；不要在这些值之外做兼容映射。
 */
export const SERVER_PARAM_TYPES = [
    "input",
    "textarea",
    "inputNumber",
    "select",
    "switch",
    "slider",
    "speaker",
    "soundPromptId",
    "file",
    "audio",
] as const;

export type ServerParamType = (typeof SERVER_PARAM_TYPES)[number];

/**
 * 校验 config.json 里所有会影响 ParamForm 渲染的参数类型。
 * 返回空数组表示通过；否则返回可直接展示给用户的错误列表。
 */
export function validateServerParamTypes(config: any): string[] {
    const errors: string[] = [];
    const seen = new Set<string>();
    const checkParamList = (path: string, param: any) => {
        if (!Array.isArray(param)) {
            return;
        }
        param.forEach((item: any, index: number) => {
            if (!item || typeof item !== "object") {
                return;
            }
            const name = item.name || `#${index + 1}`;
            const type = item.type;
            const where = `${path}.${name}`;
            if (!type) {
                const message = `${where} 缺少 type（支持：${SERVER_PARAM_TYPES.join(" / ")}）`;
                if (!seen.has(message)) {
                    seen.add(message);
                    errors.push(message);
                }
                return;
            }
            if (!(SERVER_PARAM_TYPES as readonly string[]).includes(type)) {
                const message = `${where} 使用了不支持的类型 "${type}"（支持：${SERVER_PARAM_TYPES.join(" / ")}）`;
                if (!seen.has(message)) {
                    seen.add(message);
                    errors.push(message);
                }
            }
        });
    };
    const checkFunctions = (path: string, functions: any) => {
        if (
            !functions ||
            typeof functions !== "object" ||
            Array.isArray(functions)
        ) {
            return;
        }
        Object.keys(functions).forEach((funcName) => {
            const func = functions[funcName];
            if (func && typeof func === "object") {
                checkParamList(`${path}.${funcName}.param`, func.param);
            }
        });
    };

    checkFunctions("functions", config?.functions);
    checkFunctions("easyServer.functions", config?.easyServer?.functions);
    if (Array.isArray(config?.general)) {
        config.general.forEach((general: any) => {
            if (general && typeof general === "object") {
                checkParamList(
                    `general.${general.name || "unnamed"}.param`,
                    general.param,
                );
            }
        });
    }
    return errors;
}
