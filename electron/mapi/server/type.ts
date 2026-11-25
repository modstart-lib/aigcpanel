import api from "./api";
import { EnumServerType } from "../../../src/types/Server";

export type ServerApiType = typeof api;

export type SendType =
    | never
    // 服务
    | "starting"
    | "preparing"
    | "stopping"
    | "stopped"
    | "success"
    | "error"
    // 其他
    | "action"
    // 任务
    | "taskRunning"
    | "taskResult"
    | "taskStatus";

export type ServerInfo = {
    type: EnumServerType;
    localPath: string;
    name: string;
    version: string;
    setting: {
        [key: string]: any;
    };
    logFile: string;
    eventChannelName: string;
    config: any;
};

export type ServerContext = {
    ServerApi: ServerApiType | null;
    ServerInfo: ServerInfo | null;

    send: (type: SendType, data: any) => void;

    init: () => Promise<void>;
    start: () => Promise<void>;
    cancel: () => Promise<any>;
    // Abort only when taskId is the job the server is currently running.
    // Resolves true when it really aborted; implementations that cannot tell
    // jobs apart leave it undefined and keep the legacy cancel() behaviour.
    cancelTask?: (taskId: string) => Promise<boolean>;
    stop: () => Promise<void>;
    url: () => string;
    ping: () => Promise<boolean>;
    config: () => Promise<any>;

    [key: string]: any;
};

export type ServerFunctionDataType = {
    id: string;
    result: {
        [key: string]: any;
    };
    [key: string]: any;
};

export type ServerFunctionOptionType = {
    [key: string]: any;
};
