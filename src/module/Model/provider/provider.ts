import {ChatParam, ProviderType} from "../types";
import {OpenAiModelProvider} from "./driver/openai";
import {mapError} from "../../../lib/error";

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

export const ModelProvider = {
    apiUrl(type: ProviderType, apiUrl: string, apiHost: string = "") {
        let url = apiUrl;
        if (apiHost) {
            url = apiHost;
        }
        // console.log('ModelProvider.apiUrl', {type, apiUrl, apiHost, url});
        switch (type) {
            case "openai":
                /**
                 * 根据传入的 url 判断是否需要在其末尾加 `/v[数字]/`。
                 * - 如果 以 `/` 结尾，则不加
                 * - 要加：其余情况。
                 */
                if (url.endsWith('/')) {
                    return `${url}chat/completions`;
                }
                if (url.endsWith('/chat/completions')) {
                    return url;
                }
                return `${url}/v1/chat/completions`;
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
        }
    ): Promise<ModelChatResult> {
        let url = this.apiUrl(config.type, config.apiUrl, config.apiHost);
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
            return provider.chat(prompt, chatParam);
        } catch (e) {
            return {
                code: -1,
                msg: `Request failed: ${mapError(e)}`,
            };
        }
    },
};
