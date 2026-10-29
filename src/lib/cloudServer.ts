import Router from "../router";
import { StorageUtil } from "./storage";

/**
 * Where a cloud model is actually used.
 *
 * Cloud models are never "added": they live in the remote catalog and the
 * creation pages read the same catalog through ServerSelector. This mapping
 * lets the catalog send the user straight to the page that consumes the
 * model, pre-selecting it when the target form keeps its selection in
 * localStorage.
 */
export type CloudUseTarget = {
    /** Route hosting the creation flow for this model function. */
    path: string;
    /** Tab (query param) of that route. */
    tab: string;
    /** localStorage key of the form holding the model selection. */
    storageKey?: string;
    /** Field of that form holding the model key. */
    storageField?: string;
};

type CloudUseRule = {
    functionName: string;
    target: CloudUseTarget;
};

// Order matters: the first function of the record that has a target wins.
const USE_RULES: CloudUseRule[] = [
    {
        functionName: "videoGen",
        target: {
            path: "/video",
            tab: "videoGen",
            storageKey: "VideoGenForm.formData",
            storageField: "serverKey",
        },
    },
    {
        functionName: "soundTts",
        target: {
            path: "/video",
            tab: "soundGenerate",
            storageKey: "SoundGenerateForm.formData",
            storageField: "ttsServerKey",
        },
    },
    {
        functionName: "soundClone",
        target: {
            path: "/video",
            tab: "voice",
        },
    },
    {
        functionName: "asr",
        target: {
            path: "/tool",
            tab: "SoundAsr",
        },
    },
    {
        functionName: "textToImage",
        target: {
            path: "/tool",
            tab: "TextToImage",
        },
    },
    {
        functionName: "imageToImage",
        target: {
            path: "/tool",
            tab: "ImageToImage",
        },
    },
    {
        functionName: "textToVideo",
        target: {
            path: "/tool",
            tab: "TextToVideo",
        },
    },
    {
        functionName: "imageToVideo",
        target: {
            path: "/tool",
            tab: "ImageToVideo",
        },
    },
    {
        functionName: "comfyui",
        target: {
            path: "/tool",
            tab: "GeneralComfyUI",
        },
    },
    {
        functionName: "general",
        target: {
            path: "/tool",
            tab: "GeneralModel",
        },
    },
    {
        functionName: "live",
        target: {
            path: "/live",
            tab: "",
        },
    },
];

export function cloudServerUseTarget(
    functions: string[],
): CloudUseTarget | null {
    for (const rule of USE_RULES) {
        if (functions.includes(rule.functionName)) {
            return rule.target;
        }
    }
    return null;
}

/**
 * Jump to the page that uses this cloud model, pre-selecting it when the
 * target form restores its state from localStorage.
 *
 * @return false when no page consumes any of the model functions.
 */
export function cloudServerUse(record: {
    key: string;
    runtime: { functions: string[] };
}): boolean {
    const target = cloudServerUseTarget(record.runtime.functions);
    if (!target) {
        return false;
    }
    if (target.storageKey && target.storageField) {
        let data = StorageUtil.getObject(target.storageKey, {}) || {};
        if (typeof data !== "object" || Array.isArray(data)) {
            data = {};
        }
        data[target.storageField] = record.key;
        StorageUtil.set(target.storageKey, data);
    }
    const query: Record<string, string> = {};
    if (target.tab) {
        query.tab = target.tab;
    }
    Router.push({ path: target.path, query }).catch(() => {});
    return true;
}
