export enum EnumServerStatus {
    STOPPED = "stopped",
    STARTING = "starting",
    RUNNING = "running",
    STOPPING = "stopping",
    ERROR = "error",
}

export enum EnumServerType {
    LOCAL = "local",
    LOCAL_DIR = "localDir",
    CLOUD = "cloud",
    REMOTE = "remote",
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
    remoteConfig?: any;  // Remote model config: { url: string, name: string, version: string, ... }
    status?: any;
    runtime?: ServerRuntime | any;
    config?: {
        [key: string]: any;
    }
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
};
