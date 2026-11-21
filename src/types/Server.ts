export enum EnumServerStatus {
    STOPPED = "stopped",
    STARTING = "starting",
    PREPARING = "preparing",
    PAUSED = "paused",
    RUNNING = "running",
    STOPPING = "stopping",
    ERROR = "error",
}

export enum EnumServerType {
    LOCAL = "local",
    LOCAL_DIR = "localDir",
    CLOUD = "cloud",
    REMOTE = "remote",
    /** 云厂商 API 直连模型（如火山引擎、阿里云百炼语音） */
    API = "api",
}

export type ServerRecord = {
    key: string;
    name: string;
    title: string;
    version: string;
    type?: EnumServerType;
    functions: string[];
    localPath?: string;
    autoStart?: boolean;
    settings?: {
        name: string;
        type: string;
        title: any;
        default: any;
        placeholder: string;
        options?: {
            value: any;
            label: string;
        }[];
    }[];
    setting?: {
        [key: string]: any;
    };
    cloudConfig?: any;
    remoteConfig?: any; // Remote model config: { url: string, name: string, version: string, ... }
    // 云厂商 API 模型配置：{ provider: "volcengine" | "aliyun", ...credentials }
    apiConfig?: any;
    status?: any;
    runtime?: ServerRuntime | any;
    config?: {
        [key: string]: any;
    };
};

export type ServerPrepareProgress = {
    phase?: string;
    percent?: number;
    doneSize?: number;
    totalSize?: number;
    doneFiles?: number;
    files?: number;
    file?: string;
    error?: string | null;
};

export type ServerRuntime = {
    status: EnumServerStatus;
    autoStartStatus: EnumServerStatus;
    // shellController: any,
    // httpUrl: string,
    logFile: string;
    pingCheckTimer?: any;
    startTimestampMS?: number;
    eventChannelName?: string;
    // 权重按需下载进度（status = PREPARING / PAUSED 时展示）
    prepare?: ServerPrepareProgress | null;
    // 权重是否已就绪（配置了 prepare 的模型；未就绪时展示下载入口）
    prepareReady?: boolean;
    // 需要下载的权重总大小（字节，来自 config.json 的 prepare.size）
    prepareTotalSize?: number;
    // 下载失败原因（status = ERROR 且来自 prepare 时展示）
    prepareError?: string | null;
};
