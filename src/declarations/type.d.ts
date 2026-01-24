type DefsPage = {
    onShow: (cb: Function) => void;
    onHide: (cb: Function) => void;
    onMaximize: (cb: Function) => void;
    onUnmaximize: (cb: Function) => void;
    onEnterFullScreen: (cb: Function) => void;
    onLeaveFullScreen: (cb: Function) => void;
    onShowQuitConfirmDialog: (cb: Function) => void;
    onBroadcast: (type: string, cb: (data: any) => void) => void;
    offBroadcast: (type: string, cb: (data: any) => void) => void;
    registerCallPage: (
        name: string,
        cb: (resolve: (data: any) => void, reject: (error: string) => void, data: any) => void
    ) => void;
    createChannel: (cb: (data: any) => void) => string;
    destroyChannel: (channel: string) => void;
    ipcSendToHost: (channel: string, type: string, data?: any) => void;
    ipcSend: (channel: string, type: string, data?: any) => void;
};
type DefsMapi = {
    app: {
        getPreload: () => Promise<string>;
        resourcePathResolve: (filePath: string) => Promise<string>;
        extraPathResolve: (filePath: string) => Promise<string>;
        platformName: () => "win" | "osx" | "linux" | null;
        platformArch: () => "x86" | "arm64" | null;
        isPlatform: (platform: "win" | "osx" | "linux") => boolean;
        quit: () => Promise<void>;
        restart: () => Promise<void>;
        windowMin: (name?: string) => Promise<void>;
        windowMax: (name?: string) => Promise<void>;
        windowSetSize: (
            name: string | null,
            width: number,
            height: number,
            option?: {
                includeMinimumSize: boolean;
                center: boolean;
            }
        ) => Promise<void>;
        windowOpen: (name: string, option?: any) => Promise<void>;
        windowHide: (name?: string) => Promise<void>;
        windowClose: (name?: string) => Promise<void>;
        windowMove: (
            name: string | null,
            data: {
                mouseX: number;
                mouseY: number;
                width: number;
                height: number;
            }
        ) => Promise<void>;
        openExternal: (url: string) => Promise<void>;
        openPath: (url: string) => Promise<void>;
        showItemInFolder: (url: string) => Promise<void>;
        appEnv: () => Promise<any>;
        setRenderAppEnv: (env: any) => Promise<void>;
        isDarkMode: () => Promise<boolean>;
        shell: (
            command: string,
            option?: {
                cwd?: string;
                outputEncoding?: string;
                shell?: boolean;
            }
        ) => Promise<void>;
        spawnShell: (
            command: string | string[],
            option: {
                stdout?: (data: string, process: any) => void;
                stderr?: (data: string, process: any) => void;
                success?: (process: any) => void;
                error?: (msg: string, exitCode: number, process: any) => void;
                cwd?: string;
                outputEncoding?: string;
                env?: Record<string, any>;
                shell?: boolean;
            } | null
        ) => Promise<{
            stop: () => void;
            send: (data: any) => void;
            result: () => Promise<string>;
        }>;
        spawnBinary: (
            binary: string,
            args: string[],
            option?: {
                stdout?: (data: string, process: any) => void;
                stderr?: (data: string, process: any) => void;
                success?: (process: any) => void;
                error?: (msg: string, exitCode: number, process: any) => void;
                cwd?: string;
                outputEncoding?: string;
                env?: Record<string, any>;
                shell?: boolean;
            } | null
        ) => Promise<string>;
        availablePort: (start: number, lockKey?: string, lockTime?: number) => Promise<number>;
        fixExecutable: (executable: string) => Promise<void>;
        getClipboardText: () => Promise<string>;
        setClipboardText: (text: string) => Promise<void>;
        getClipboardImage: () => Promise<string>;
        setClipboardImage: (image: string) => Promise<void>;
        getUserAgent: () => string;
        toast: (
            msg: string,
            option?: {
                duration?: number;
                status?: "success" | "error";
            }
        ) => Promise<void>;
        setupList: () => Promise<
            {
                name: string;
                title: string;
                status: "success" | "fail";
                desc: string;
                steps: {
                    title: string;
                    image: string;
                }[];
            }[]
        >;
        setupOpen: (name: string) => Promise<void>;
        setupIsOk: () => Promise<boolean>;
        getBuildInfo: () => Promise<{
            buildTime: string;
        }>;
        collect: (options?: {}) => Promise<any>;
        setAutoLaunch: (enable: boolean, options?: {}) => Promise<boolean>;
        getAutoLaunch: (options?: {}) => Promise<boolean>;
    };
    config: {
        get: (key: string, defaultValue: any = null) => Promise<any>;
        set: (key: string, value: any) => Promise<void>;
        all: () => Promise<any>;
        getEnv: (key: string, defaultValue: any = null) => Promise<any>;
        setEnv: (key: string, value: any) => Promise<void>;
        allEnv: () => Promise<any>;
    };
    log: {
        root: () => string;
        info: (msg: string, data: any = null) => Promise<void>;
        error: (msg: string, data: any = null) => Promise<void>;
        collect: (option?: { startTime?: string; endTime?: string; limit?: number }) => Promise<string>;
    };
    storage: {
        all: () => Promise<any>;
        get: (group: string, key: string, defaultValue: any) => Promise<any>;
        set: (group: string, key: string, value: any) => Promise<void>;
        write: (group: string, value: any) => Promise<void>;
        read: (group: string, defaultValue: any = null) => Promise<any>;
    };
    db: {
        execute: (sql: string, params: any = []) => Promise<any>;
        insert: (sql: string, params: any = []) => Promise<any>;
        first: (sql: string, params: any = []) => Promise<any>;
        select: (sql: string, params: any = []) => Promise<any>;
        update: (sql: string, params: any = []) => Promise<any>;
        delete: (sql: string, params: any = []) => Promise<any>;
    };
    file: {
        fullPath: (path: string) => Promise<string>;
        exists: (path: string, option?: { isDataPath?: boolean }) => Promise<boolean>;
        isDirectory: (path: string, option?: { isDataPath?: boolean }) => Promise<boolean>;
        mkdir: (path: string, option?: { isDataPath?: boolean }) => Promise<void>;
        list: (path: string, option?: { isDataPath?: boolean }) => Promise<{
            name: string,
            pathname: string,
            isDirectory: boolean,
            size: number,
            lastModified: number,
        }[]>;
        listAll: (path: string, option?: { isDataPath?: boolean }) => Promise<any[]>;
        write: (path: string, data: any, option?: { isDataPath?: boolean }) => Promise<void>;
        writeBuffer: (path: string, data: any, option?: { isDataPath?: boolean }) => Promise<void>;
        writeStream: (path: string, stream: any, option?: { isDataPath?: boolean }) => Promise<void>;
        read: (path: string, option?: { isDataPath?: boolean }) => Promise<any>;
        readBuffer: (path: string, option?: { isDataPath?: boolean }) => Promise<any>;
        readStream: (path: string, option?: { isDataPath?: boolean }) => Promise<ReadableStream | null>;
        deletes: (path: string, option?: { isDataPath?: boolean }) => Promise<void>;
        clean: (paths: string[], option?: { isDataPath?: boolean }) => Promise<void>;
        rename: (
            pathOld: string,
            pathNew: string,
            option?: {
                isDataPath?: boolean;
                overwrite?: boolean;
            }
        ) => Promise<void>;
        copy: (pathOld: string, pathNew: string, option?: {
            isDataPath?: boolean,
            overwrite?: boolean;
        }) => Promise<void>;
        temp: (ext: string = "tmp", prefix: string = "file", suffix: string = "") => Promise<string>;
        tempDir: (prefix: string = "dir") => Promise<string>;
        watchText: (
            path: string,
            callback: (data: {}) => void,
            option?: {
                isDataPath?: boolean;
                limit?: number;
            }
        ) => Promise<{
            stop: Function;
        }>;
        appendText: (path: string, data: any, option?: { isDataPath?: boolean }) => Promise<void>;
        download: (
            url: string,
            path?: string | null,
            option?: {
                isDataPath?: boolean;
                userAgent?: string;
                progress?: (percent: number, total: number) => void;
            }
        ) => Promise<string>;
        openFile: (options: {
            filters?: {
                name: string;
                extensions: string[];
            }[],
            properties?: ("multiSelections")[]
        } = {}) => Promise<string | null>;
        openDirectory: (options: {} = {}) => Promise<string | null>;
        openSave: (options: {} = {}) => Promise<string | null>;
        ext: (path: string) => Promise<string>;
        stat: (path: string, option?: { isDataPath?: boolean }) => Promise<{
            size: number;
            isDirectory: boolean;
            lastModified: number;
        }>;
        textToName: (text: string, ext: string = "", maxLimit: number = 100) => string;
        pathToName: (path: string, includeExt: boolean = true, maxLimit: number = 100) => string;
        hubRootDefault: () => Promise<string>;
        hubRoot: () => Promise<string>;
        hubSave: (
            file: string,
            option?: {
                ext?: string;
                returnFullPath?: boolean;
                ignoreWhenInHub?: boolean;
                cleanOld?: boolean;
                saveGroup?: string;
                savePath?: string;
                savePathParam?: {
                    [key: string]: any;
                };
            }
        ) => Promise<string>;
        hubSaveContent: (
            content: string,
            option: {
                ext: string;
                returnFullPath?: boolean;
                saveGroup?: string;
                savePath?: string;
                savePathParam?: {
                    [key: string]: any;
                };
            }
        ) => Promise<string>;
        hubDelete: (
            file: string,
            option?: {
                isDataPath?: boolean;
                ignoreWhenNotInHub?: boolean;
                tryLaterWhenFailed?: boolean;
            }
        ) => Promise<void>;
        hubFullPath: (file: string) => Promise<string>;
        hubFile: (
            ext: string,
            option?: {
                returnFullPath?: boolean;
                saveGroup?: string;
                savePath?: string;
                savePathParam?: {
                    [key: string]: any;
                };
            }
        ) => Promise<string>;
        isHubFile: (file: string) => Promise<boolean>;
        cacheForget: (key: any) => Promise<void>;
        cacheSet: (key: any, data: any) => Promise<void>;
        cacheGet: <T>(key: any) => Promise<T | null>;
        cacheGetPath: (key: any) => Promise<string | null>;
    };
    updater: {
        checkForUpdate: () => Promise<ApiResult<any>>;
        getCheckAtLaunch: () => Promise<"yes" | "no">;
        setCheckAtLaunch: (value: "yes" | "no") => Promise<void>;
    };
    statistics: {
        tick: (name: string, data: any = null) => Promise<void>;
    };
    lang: {
        writeSourceKeyUse: (key: string) => Promise<void>;
    };
    event: {
        send: (name: string, type: string, data: any) => void;
        callPage: (
            name: string,
            type: string,
            data?: any,
            option?: {
                waitReadyTimeout?: number;
                timeout?: number;
            }
        ) => Promise<ApiResult<any>>;
        // channel main <-> render
        channelSend: (channel: string, data: any) => Promise<void>;
    };
    user: {
        open: (option?: {
            readyParam: {
                page?: string;
                [key: string]: any;
            };
        }) => Promise<void>;
        get: () => Promise<{
            apiToken: string;
            user: {
                id: string;
                name: string;
                avatar: string;
            };
            data: {};
            basic: {};
        }>;
        refresh: () => Promise<void>;
        getApiToken: () => Promise<string>;
        getWebEnterUrl: (url: string) => Promise<string>;
        openWebUrl: (url: string) => Promise<void>;
        apiPost: (
            url: string,
            data: Record<string, any>,
            option?: {
                throwException?: boolean;
            }
        ) => Promise<any>;
    };
    misc: {
        getZipFileContent: (path: string, pathInZip: string) => Promise<string>;
        unzip: (zipPath: string, dest: string, option?: { process: Function }) => Promise<void>;
        zip: (zipPath: string, sourceDir: string, option?: { end?: (archive: any) => void; }) => Promise<void>;
        request: (option: {
            url: string;
            method?: "GET" | "POST";
            responseType?: "json" | "text" | "arraybuffer";
            headers?: any;
            data?: any;
        }) => Promise<any>;
    };
    server: {
        listGpus: () => Promise<
            {
                id: string;
                name: string;
                size: number;
            }[]
        >;
        runningServerCount: (count: number | null) => Promise<number>;
        isSupport: (serverInfo: ServerInfo) => Promise<boolean>;
        start: (serverInfo: ServerInfo) => Promise<void>;
        stop: (serverInfo: ServerInfo) => Promise<void>;
        cancel: (serverInfo: ServerInfo) => Promise<void>;
        deletes: (serverInfo: ServerInfo) => Promise<void>;
        ping: (serverInfo: ServerInfo) => Promise<boolean>;
        config: (serverInfo: ServerInfo) => Promise<any>;
        callFunction: (
            serverInfo: ServerInfo,
            method: string,
            data: ServerCallFunctionData,
            option?: ServerCallFunctionOption
        ) => Promise<ServerCallFunctionResult>;
        callFunctionWithException: (
            serverInfo: ServerInfo,
            method: string,
            data: ServerCallFunctionData,
            option?: ServerCallFunctionOption
        ) => Promise<ServerCallFunctionResult>;
    };
};

declare global {
    interface Window {
        __page: DefsPage;
        $mapi: DefsMapi;
    }

    const __page: DefsPage;
    const $mapi: DefsMapi;
}

export {};


