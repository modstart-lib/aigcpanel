import { t } from "../../lang";

export type ProviderType = "openai"; // | 'anthropic' | 'gemini' | 'qwenlm' | 'azure-openai'

/** 模型类型：text 文本大模型 */
export type ModelType = "text";

const ModelTypeTitles: Record<ModelType, string> = {
    text: "model.typeText",
};

/** 模型类型选项（标题已多语言处理） */
export const modelTypeOptions = (): { value: ModelType; title: string }[] => {
    return (Object.keys(ModelTypeTitles) as ModelType[]).map((value) => ({
        value,
        title: t(ModelTypeTitles[value]),
    }));
};

export const modelTypeNormalize = (value: any): ModelType => {
    return "text";
};

export const modelTypeTitle = (type: ModelType): string => {
    return type in ModelTypeTitles ? t(ModelTypeTitles[type]) : type;
};

/** 模型能力标识 */
export type ModelCaps = {
    vision?: boolean; // 视觉识别能力（图片理解）
    tools?: boolean; // 工具调用能力（Function Calling）
};

export type Model = {
    id: string;
    provider: string;
    name: string;
    group: string;
    type: ModelType;
    caps?: ModelCaps;
    enabled: boolean;
    editable: boolean;
    rate?: number;
    /** 模型单次消耗 */
    cost?: number;
};

export type Provider = {
    id: string;
    type: ProviderType;
    logo: string | null;
    title: string;
    isSystem: boolean;
    apiUrl: string;
    /**
     * Api version prefix appended to `apiUrl`, `/v1` by default.
     * Use an empty string for providers whose endpoint has no version prefix,
     * and a custom value such as `/v1beta/openai` for providers with a
     * dedicated OpenAI compatible prefix.
     */
    apiPath?: string;
    websites: {
        official: string;
        docs: string;
        models: string;
    };
    data: {
        apiKey: string;
        apiHost: string;
        models: Model[];
        enabled: boolean;
    };
    runtime?: {};
};

export type ChatParam = {
    systemPrompt: string | null;
    /** 附加请求参数，直接合并到接口请求体 */
    extra?: Record<string, any>;
};
