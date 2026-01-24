import { getDataContent } from "../components/common/dataConfig";
import { t } from "../lang";
import { SoundGenerateReplaceContent } from "../pages/Sound/config/replaceContent";
import { TaskBiz } from "../service/TaskService";
import { useServerStore } from "../store/modules/server";

const serverStore = useServerStore();

type ServerCallOptionType = {
    cache: boolean,
}

export const serverSoundAsr = async (
    biz: TaskBiz,
    bizId: string,
    soundAsr: SoundAsrParamType,
    result: {},
    audio: string,
    option?: ServerCallOptionType
): Promise<{
    type: string;
    start: number;
    end: number;
    records: any[];
}> => {
    option = Object.assign({
        cache: true,
    }, option) as ServerCallOptionType;
    if (option.cache) {
        const cacheRecords = await $mapi.file.cacheGet<any[]>({soundAsr, audio});
        if (cacheRecords) {
            return {
                type: "success",
                start: 0,
                end: 0,
                records: cacheRecords,
            }
        }
    }
    const server = await serverStore.getByKey(soundAsr.serverKey);
    if (!server) {
        throw `SoundAsr server not found: ${soundAsr.serverKey}`;
    }
    const serverInfo = await serverStore.serverInfo(server);
    const res = await $mapi.server.callFunctionWithException(serverInfo, "asr", {
        id: serverStore.generateTaskId(biz, bizId),
        result: result,
        param: soundAsr.param,
        audio: audio,
    });
    if (res.code) {
        throw res.msg || "SoundAsr run fail";
    }
    const ret = {
        type: res.data.type,
        start: 0,
        end: 0,
        records: [],
    };
    switch (res.data.type) {
        case "success":
            ret.start = res.data.start;
            ret.end = res.data.end;
            ret.records = res.data.data.records || [];
            if (!ret.records || !ret.records.length) {
                throw t("error.soundAsrResultEmpty");
            }
            await $mapi.file.cacheSet({soundAsr, audio}, ret.records);
            break;
        case "retry":
            break;
        default:
            throw `unknown res.data.type : ${res.data.type}`;
    }
    return ret;
};

export const replaceSoundGenerateText = async (text: string): Promise<string> => {
    if (!text) {
        return text;
    }
    const param = await getDataContent<{
        key: string,
        value: string
    }[]>('SoundGenerateReplaceContent', SoundGenerateReplaceContent);
    if (!param || !param.length) {
        return text;
    }
    for (const p of param) {
        // replace all
        text = text.replaceAll(p.key, p.value);
    }
    return text;
}

export const serverSoundGenerate = async (
    biz: TaskBiz,
    bizId: string,
    soundGenerate: SoundGenerateParamType,
    result: {},
    text: string,
    option?: ServerCallOptionType
): Promise<{
    type: string;
    start: number;
    end: number;
    url: string;
}> => {
    text = await replaceSoundGenerateText(text);
    option = Object.assign({
        cache: true,
    }, option) as ServerCallOptionType;
    if (option.cache) {
        const cacheUrl = await $mapi.file.cacheGetPath({soundGenerate, text});
        if (cacheUrl) {
            return {
                type: "success",
                start: 0,
                end: 0,
                url: cacheUrl,
            }
        }
    }
    const server = await serverStore.getByNameVersion(soundGenerate.serverName, soundGenerate.serverVersion);
    if (!server) {
        throw "SoundGenerate server not found: " + soundGenerate.serverName;
    }
    const serverInfo = await serverStore.serverInfo(server);
    let res;
    if (soundGenerate.type == "SoundTts") {
        res = await serverStore.call(serverInfo, "soundTts", {
            id: serverStore.generateTaskId(biz, bizId),
            result: result,
            param: soundGenerate.ttsParam,
            text: text,
        });
    } else if (soundGenerate.type == "SoundClone") {
        res = await serverStore.call(serverInfo, "soundClone", {
            id: serverStore.generateTaskId(biz, bizId),
            result: result,
            param: soundGenerate.cloneParam,
            text: text,
            promptAudio: soundGenerate.promptUrl,
            promptText: soundGenerate.promptText,
        });
    } else {
        throw `SoundGenerate.error - type error ${soundGenerate.type}`;
    }
    // console.log("SoundReplace.runFunc.soundGenerate.res", res);
    if (res.code) {
        throw res.msg || "SoundGenerate fail";
    }
    const ret = {
        type: res.data.type,
        start: 0,
        end: 0,
        url: "",
    };
    switch (res.data.type) {
        case "success":
            ret.url = res.data.data.url;
            if (!ret.url) {
                throw t("error.soundGenerateResultEmpty");
            }
            await $mapi.file.cacheSet({soundGenerate, text}, ret.url);
            break;
        case "retry":
            break;
        default:
            throw `unknown res.data.type : ${res.data.type}`;
    }
    return ret;
};

export const serverTextToImage = async (
    biz: TaskBiz,
    bizId: string,
    textToImage: TextToImageParamType,
    result: {},
    prompt: string,
    option?: ServerCallOptionType
): Promise<{
    type: string;
    start: number;
    end: number;
    url: string;
}> => {
    option = Object.assign({
        cache: true,
    }, option) as ServerCallOptionType;
    if (option.cache) {
        const cacheUrl = await $mapi.file.cacheGetPath({textToImage, prompt});
        if (cacheUrl) {
            return {
                type: "success",
                start: 0,
                end: 0,
                url: cacheUrl,
            }
        }
    }
    const server = await serverStore.getByNameVersion(textToImage.serverName, textToImage.serverVersion);
    if (!server) {
        throw "TextToImage server not found: " + textToImage.serverName;
    }
    const serverInfo = await serverStore.serverInfo(server);
    const res = await serverStore.call(serverInfo, "textToImage", {
        id: serverStore.generateTaskId(biz, bizId),
        result: result,
        param: textToImage.param,
        prompt: prompt,
    });
    if (res.code) {
        throw res.msg || "TextToImage fail";
    }
    const ret = {
        type: res.data.type,
        start: 0,
        end: 0,
        url: "",
    };
    switch (res.data.type) {
        case "success":
            ret.url = res.data.data.url;
            if (!ret.url) {
                throw t("error.textToImageResultEmpty");
            }
            await $mapi.file.cacheSet({textToImage, prompt}, ret.url);
            break;
        case "retry":
            break;
        default:
            throw `unknown res.data.type : ${res.data.type}`;
    }
    return ret;
};

export const serverImageToImage = async (
    biz: TaskBiz,
    bizId: string,
    imageToImage: ImageToImageParamType,
    result: {},
    prompt: string,
    image: string,
    option?: ServerCallOptionType
): Promise<{
    type: string;
    start: number;
    end: number;
    url: string;
}> => {
    option = Object.assign({
        cache: true,
    }, option) as ServerCallOptionType;
    if (option.cache) {
        const cacheUrl = await $mapi.file.cacheGetPath({imageToImage, prompt, image});
        if (cacheUrl) {
            return {
                type: "success",
                start: 0,
                end: 0,
                url: cacheUrl,
            }
        }
    }
    const server = await serverStore.getByNameVersion(imageToImage.serverName, imageToImage.serverVersion);
    if (!server) {
        throw "ImageToImage server not found: " + imageToImage.serverName;
    }
    const serverInfo = await serverStore.serverInfo(server);
    const res = await serverStore.call(serverInfo, "imageToImage", {
        id: serverStore.generateTaskId(biz, bizId),
        result: result,
        param: imageToImage.param,
        prompt: prompt,
        image: image,
    });
    if (res.code) {
        throw res.msg || "ImageToImage fail";
    }
    const ret = {
        type: res.data.type,
        start: 0,
        end: 0,
        url: "",
    };
    switch (res.data.type) {
        case "success":
            ret.url = res.data.data.url;
            if (!ret.url) {
                throw t("error.imageToImageResultEmpty");
            }
            await $mapi.file.cacheSet({imageToImage, prompt, image}, ret.url);
            break;
        case "retry":
            break;
        default:
            throw `unknown res.data.type : ${res.data.type}`;
    }
    return ret;
};
