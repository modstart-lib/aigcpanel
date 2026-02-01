import {ChatParam, ProviderType} from "../../types";
import {ModelChatResult} from "../provider";

export class AbstractModelProvider {
    config: {
        type: ProviderType;
        url: string;
        apiUrl: string;
        apiHost: string;
        apiKey: string;
        [key: string]: any;
    };

    constructor(config: {
        type: ProviderType;
        url: string;
        apiUrl: string;
        apiHost: string;
        apiKey: string;
        [key: string]: any;
    }) {
        this.config = config;
    }

    async chat(
        prompt: string,
        chatParam: ChatParam
    ): Promise<ModelChatResult> {
        return Promise.reject(new Error("Method not implemented."));
    }
}
