import { mapError } from "../../../lib/error";
import { ChatParam, ProviderType } from "../types";
import { OpenAiModelProvider } from "./driver/openai";

const ModelProviderMap = {
    openai: OpenAiModelProvider,
};

export type ModelChatResult = {
    code: number;
    msg: string;
    data?: {
        content?: string;
        [key: string]: any;
    };
};

/**
 * Normalize a base url so that it can be safely joined with an api path.
 * - trims spaces and trailing slashes
 * - keeps a full `.../chat/completions` endpoint as is
 */
const normalizeBaseUrl = (url: string) => {
    return url.trim().replace(/\/+$/, "");
};

/**
 * Detect whether the url already contains an api version segment,
 * e.g. `/v1`, `/v4`, `/v1beta/openai`, `/v3/openai`, `/api/paas/v4`.
 */
const hasVersionSegment = (url: string) => {
    return /\/v\d+[a-z0-9]*(\/|$)/i.test(url);
};

export const ModelProvider = {
    /**
     * Build the chat completions endpoint.
     *
     * - `apiHost` (user input) takes precedence over the provider default `apiUrl`
     * - a pasted full endpoint (`.../chat/completions`) is used as is
     * - `apiPath` is the version prefix of the provider, `/v1` by default.
     *   It is skipped when the url already contains a version segment, so
     *   `https://api.siliconflow.cn/v1` does not become `/v1/v1/...`.
     */
    apiUrl(
        type: ProviderType,
        apiUrl: string,
        apiHost: string = "",
        apiPath: string = "/v1",
    ) {
        let url =
            normalizeBaseUrl(apiHost || "") || normalizeBaseUrl(apiUrl || "");
        if (!url) return "";
        const path = "chat/completions";
        // console.log('ModelProvider.apiUrl', {type, apiUrl, apiHost, apiPath, url});
        switch (type) {
            case "openai":
                // A pasted full endpoint (possibly with a query string, e.g. Azure) is kept as is
                if (new RegExp(`/${path}(\\?.*)?$`, "i").test(url)) {
                    return url;
                }
                if (!apiPath || hasVersionSegment(url)) {
                    return `${url}/${path}`;
                }
                return `${url}${apiPath}/${path}`;
        }
        throw new Error(`Unsupported provider type: ${type}`);
    },
    async chat(
        prompt: string,
        chatParam: ChatParam,
        config: {
            type: ProviderType;
            modelId: string;
            apiUrl: string;
            apiHost: string;
            apiKey: string;
            apiPath?: string;
        },
    ): Promise<ModelChatResult> {
        let url = this.apiUrl(
            config.type,
            config.apiUrl,
            config.apiHost,
            config.apiPath,
        );
        if (!(config.type in ModelProviderMap)) {
            return {
                code: -1,
                msg: `Unsupported provider type: ${config.type}`,
            };
        }
        const provider = new ModelProviderMap[config.type]({
            ...config,
            url,
        });
        try {
            return await provider.chat(prompt, chatParam);
        } catch (e) {
            const msg = mapError(e);
            // 第三方模型接口失败时留下地址与模型信息，便于用户上报后排查
            try {
                $mapi.log.error("modelProvider.chat.error", {
                    type: config.type,
                    url,
                    apiUrl: config.apiUrl,
                    apiHost: config.apiHost,
                    modelId: config.modelId,
                    promptLength: (prompt || "").length,
                    error: msg,
                });
            } catch {
                /* logging must never break the call */
            }
            return {
                code: -1,
                msg: `Request failed: ${msg}`,
            };
        }
    },
};
