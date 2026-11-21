import {
    SendType,
    ServerApiType,
    ServerFunctionDataType,
    ServerInfo,
} from "../mapi/server/type";
import { Log } from "../mapi/log/main";
import {
    getVoiceApiProvider,
    maskVoiceApiConfig,
    VoiceApiConfig,
} from "./VoiceApi";

/**
 * 云厂商 API 语音模型（type=api）的 ServerContext。
 *
 * 不做本地进程管理，直接把 soundTts 请求转发给厂商 HTTP 接口，
 * 由 VoiceApi 的厂商驱动适配后返回音频文件路径。
 */
export const ApiServer = function (serverInfo: ServerInfo) {
    const me = this;
    this.ServerApi = null as ServerApiType | null;
    this.ServerInfo = null as ServerInfo | null;
    this.apiConfig = (serverInfo?.config?.apiConfig || {}) as VoiceApiConfig;

    this.send = function (type: SendType, data: any) {
        this.ServerApi.event.sendChannel(this.ServerInfo.eventChannelName, {
            type,
            data,
        });
    };
    this.url = function () {
        return "";
    };
    this.init = async function () {};
    this.config = async function () {
        const provider = getVoiceApiProvider(me.apiConfig.provider);
        return {
            code: 0,
            msg: "ok",
            data: {
                httpUrl: null,
                content: "",
                functions: provider ? provider.functions(me.apiConfig) : {},
            },
        };
    };
    this.start = async function () {
        this.send("starting", this.ServerInfo);
        this.send("success", this.ServerInfo);
    };
    this.ping = async function (): Promise<boolean> {
        return true;
    };
    this.stop = async function () {
        this.send("stopping", this.ServerInfo);
        this.send("stopped", this.ServerInfo);
    };
    this.cancel = async function () {};
    this.soundTts = async function (data: ServerFunctionDataType) {
        const provider = getVoiceApiProvider(me.apiConfig.provider);
        if (!provider) {
            throw new Error(`不支持的语音厂商：${me.apiConfig.provider}`);
        }
        const startTime = Date.now();
        Log.info("apiServer.soundTts.start", {
            config: maskVoiceApiConfig(me.apiConfig),
            param: data?.param || {},
            textLength: (data?.text || "").length,
        });
        try {
            const url = await provider.soundTts(me.apiConfig, data);
            Log.info("apiServer.soundTts.done", {
                provider: me.apiConfig.provider,
                duration: Date.now() - startTime,
                url,
            });
            return {
                code: 0,
                msg: "ok",
                data: {
                    type: "success",
                    start: Date.now(),
                    end: Date.now(),
                    data: { url },
                },
            };
        } catch (e: any) {
            Log.error("apiServer.soundTts.error", {
                provider: me.apiConfig.provider,
                model: me.apiConfig.model || "",
                config: maskVoiceApiConfig(me.apiConfig),
                duration: Date.now() - startTime,
                error: (e && e.message) || String(e),
            });
            throw e;
        }
    };
};
