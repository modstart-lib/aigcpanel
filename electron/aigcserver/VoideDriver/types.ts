/**
 * 云端语音模型 provider 的类型定义。
 *
 * 每个厂商驱动（VoideDriver/*）把厂商 HTTP 接口适配为 AIGCPanel 统一的
 * soundTts 调用；VoiceApi.ts 负责注册与查找。
 */

export type VoiceApiConfig = {
    provider: string;
    [key: string]: any;
};

export type VoiceApiParam = {
    name: string;
    type: string;
    title: string;
    defaultValue?: any;
    placeholder?: string;
    options?: { value: string; label: string }[];
    [key: string]: any;
};

export type VoiceApiFunctionDef = {
    content?: string;
    param?: VoiceApiParam[];
};

export type VoiceApiProvider = {
    id: string;
    title: string;
    /** 厂商默认接口地址（用户可在界面覆盖） */
    defaultApiUrl: string;
    /** 该 provider 支持的 function 定义（用于 config()） */
    functions(config: VoiceApiConfig): { [func: string]: VoiceApiFunctionDef };
    /** 语音合成，返回音频文件绝对路径 */
    soundTts(config: VoiceApiConfig, data: any): Promise<string>;
};
