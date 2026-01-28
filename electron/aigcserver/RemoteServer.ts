import {SendType, ServerApiType, ServerFunctionDataType, ServerInfo} from "../mapi/server/type";
import {AigcServerUtil} from "./util";
import {Files} from "../mapi/file/main";
import axios from "axios";
import {Base64} from "js-base64";
import {Log} from "../mapi/log/main";

type LauncherResultType = {
    result: {
        [key: string]: any;
    };
    endTime: number | null;
};

const RemoteApi = {
    async config(url: string) {
        try {
            const response = await axios.post(`${url}/config`);
            return response.data;
        } catch (e: any) {
            Log.error("RemoteApi.config.error", e);
            throw e;
        }
    },

    async submit(url: string, data: any) {
        try {
            const response = await axios.post(`${url}/submit`, data);
            return response.data;
        } catch (e: any) {
            Log.error("RemoteApi.submit.error", e);
            throw e;
        }
    },

    async query(url: string, token: string) {
        try {
            const response = await axios.post(`${url}/query`, {token});
            const data = response.data;
            if (data && data.data && data.data.logs) {
                // Decode logs from Base64
                try {
                    data.data.logs = Base64.decode(data.data.logs);
                } catch (decodeError) {
                    Log.error("RemoteApi.query.decodeError", decodeError);
                }
            }
            return data;
        } catch (e: any) {
            Log.error("RemoteApi.query.error", e);
            throw e;
        }
    },

    async cancel(url: string) {
        try {
            const response = await axios.post(`${url}/cancel`);
            return response.data;
        } catch (e: any) {
            Log.error("RemoteApi.cancel.error", e);
            // Ignore cancel errors usually
            return {code: -1, msg: e.message};
        }
    },

    async upload(url: string, filePath: string) {
        try {
            // Check if environment is Node.js (Electron main process)
            if (typeof process !== 'undefined' && process.versions && process.versions.node) {
                const fs = await import('fs');
                const FormData = (await import('form-data')).default;

                const form = new FormData();
                form.append('file', fs.createReadStream(filePath));

                const response = await axios.post(`${url}/upload`, form, {
                    headers: {
                        ...form.getHeaders()
                    }
                });
                return response.data;
            } else {
                throw new Error("Upload only supported in Electron main process");
            }
        } catch (e: any) {
            Log.error("RemoteApi.upload.error", e);
            throw e;
        }
    }
};

export const RemoteServer = function (config: any) {

    const me = this;
    let controllerWatching = {
        id: null as string | null,
        token: null as string | null,
        launcherResult: null as LauncherResultType | null,
        resolve: null as ((value: any) => void) | null,
        reject: null as ((reason?: any) => void) | null,
        promiseResolved: false,
        timer: null as any
    };

    // Initialize with remoteConfig
    this.serverConfig = {
        remoteConfig: config.config.remoteConfig || {}
    };

    this.isRunning = false;
    this.ServerApi = null as ServerApiType | null;
    this.ServerInfo = null as ServerInfo | null;
    this.serverRuntime = {
        startTime: 0,
    };

    const getBaseUrl = () => {
        return this.serverConfig.remoteConfig.url;
    };

    const downloadUrl = async (url: string) => {
        const fullUrl = `${getBaseUrl()}/${url}`;
        const ext = Files.ext(fullUrl);
        const localPath = await this.ServerApi.file.temp(ext);
        await this.ServerApi.requestUrlFileToLocal(fullUrl, localPath);
        return localPath;
    }

    this.send = function (type: SendType, data: any) {
        this.ServerApi.event.sendChannel(this.ServerInfo.eventChannelName, {type, data});
    };

    this.init = async function () {
    };

    this.config = async function () {
        const ret = await RemoteApi.config(getBaseUrl());
        if (!ret.data) {
            throw new Error(ret.msg || "Remote config fetch failed");
        }
        const config = ret.data
        return {
            code: 0,
            msg: "ok",
            data: {
                httpUrl: getBaseUrl(),
                content: config.description || "",
                functions: config.functions || {},
            },
        };
    };

    this.start = async function () {
        // For remote server, start just means marking it as running and checking connection
        this.serverRuntime.startTime = Date.now();
        this.send("starting", this.ServerInfo);

        // Simple ping check
        try {
            await RemoteApi.config(getBaseUrl());
            this.send("running", this.ServerInfo);
        } catch (e) {
            Log.error("RemoteServer.start.error", e);
            this.send("error", this.ServerInfo);
            this.serverRuntime.startTime = 0;
        }
    };

    this.ping = async function (): Promise<boolean> {
        try {
            if (this.serverRuntime.startTime <= 0) {
                return false;
            }
            // Optional: periodically check remote health
            await RemoteApi.config(getBaseUrl());
            return true;
        } catch (e) {
            return false;
        }
    };

    this.stop = async function () {
        this.send("stopping", this.ServerInfo);
        this.serverRuntime.startTime = 0;
        this.send("stopped", this.ServerInfo);
        this.send("success", this.ServerInfo);
    };

    this.cancel = async function () {
        // Stop local polling
        if (controllerWatching.timer) {
            clearTimeout(controllerWatching.timer);
            controllerWatching.timer = null;
        }

        // Call remote cancel
        try {
            await RemoteApi.cancel(getBaseUrl());
        } catch (e) {
            Log.error("RemoteServer.cancel.error", e);
        }

        // Notify failure/cancellation locally
        if (controllerWatching.reject && !controllerWatching.promiseResolved) {
            controllerWatching.promiseResolved = true;
            controllerWatching.reject("Task cancelled");
        }
    };

    // Main execution logic for remote tasks
    this._runRemoteTask = async function (
        payload: any,
        option: {
            timeout: number;
        }
    ) {
        option = Object.assign(
            {
                timeout: 24 * 3600,
            },
            option
        );
        const baseUrl = getBaseUrl();

        // 1. Submit task
        let token = null;
        // console.log('RemoteServer.submit.payload', JSON.stringify(payload));
        try {
            const submitRes = await RemoteApi.submit(baseUrl, payload);
            // console.log('RemoteServer.submit.result', JSON.stringify(submitRes));
            if (submitRes.code !== 0) {
                throw new Error(submitRes.msg || "Remote submit failed");
            }
            token = submitRes.data.token;
            controllerWatching.token = token;
        } catch (e) {
            throw e;
        }

        const pollInterval = 1000;
        const startTime = Date.now();

        const pollError = (msg: string) => {
            if (controllerWatching.reject && !controllerWatching.promiseResolved) {
                controllerWatching.promiseResolved = true;
                controllerWatching.reject(msg);
            }
        }

        const poll = async () => {
            if (option.timeout > 0 && Date.now() - startTime > option.timeout * 1000) {
                await this.cancel();
                pollError("Task timeout");
                return;
            }

            try {
                const queryRes = await RemoteApi.query(baseUrl, token);
                // console.log('RemoteServer.query.result', JSON.stringify(queryRes));
                if (queryRes.code !== 0) {
                    Log.error("RemoteServer.query.error", queryRes);
                    pollError(queryRes.msg || "Remote query failed");
                    return;
                } else {
                    const {logs, status} = queryRes.data;
                    if (logs) {
                        this.ServerApi.file.appendText(this.ServerInfo.logFile, logs, {isDataPath: true});
                        const result = this.ServerApi.extractResultFromLogs(controllerWatching.id, logs);
                        if (result) {
                            if (controllerWatching.launcherResult) {
                                controllerWatching.launcherResult.result = Object.assign(controllerWatching.launcherResult.result, result);
                            }
                            if (controllerWatching.id) {
                                this.send("taskResult", {id: controllerWatching.id, result});
                            }
                        }
                        // Error detection
                        if (controllerWatching.launcherResult) {
                            controllerWatching.launcherResult.result.error =
                                AigcServerUtil.errorDetect(logs) || controllerWatching.launcherResult.result.error;
                        }
                    }
                    // Check status
                    if (status === "success") {
                        if (controllerWatching.resolve && !controllerWatching.promiseResolved) {
                            controllerWatching.promiseResolved = true;
                            controllerWatching.resolve(undefined);
                        }
                        return;
                    } else if (status === "error") {
                        pollError(controllerWatching.launcherResult?.result?.error || "Remote task failed")
                        return;
                    }
                }
                // Continue polling
                controllerWatching.timer = setTimeout(poll, pollInterval);
            } catch (e) {
                Log.error("RemoteServer.poll.error", e);
                pollError(e.message || "Remote poll failed");
            }
        };
        poll();
    };

    // Helper to upload file if it exists locally
    this._uploadIfNeeded = async function (path: string): Promise<string> {
        if (path && typeof path === 'string') {
            if (path.startsWith("http://") || path.startsWith("https://")) {
                return path;
            }
            if (await this.ServerApi.file.exists(path)) {
                const res = await RemoteApi.upload(getBaseUrl(), path);
                if (res.code === 0 && res.data && res.data.file) {
                    return res.data.file;
                }
                throw new Error(`Upload failed for ${path}: ${res.msg}`);
            }
        }
        return path;
    };


    this._callFunc = async function (
        data: ServerFunctionDataType,
        configCalculator: (data: ServerFunctionDataType) => Promise<any>,
        resultDataCalculator: (data: ServerFunctionDataType, launcherResult: LauncherResultType) => Promise<any>,
        option: {
            timeout: number;
        }
    ) {
        option = Object.assign(
            {
                timeout: 24 * 3600,
            },
            option
        );
        const resultData = {
            // success, retry
            type: "success",
            start: 0,
            end: 0,
            data: {},
        };
        if (this.isRunning) {
            resultData.type = "retry";
            return {
                code: 0,
                msg: "ok",
                data: resultData,
            };
        }
        this.isRunning = true;
        resultData.start = Date.now();

        try {
            this.send("taskRunning", {id: data.id});
            const configData = await configCalculator(data);
            configData.setting = this.ServerInfo.setting;
            const configJsonPath = await this.ServerApi.launcherPrepareConfigJson(configData);
            const remoteConfigPath = await this._uploadIfNeeded(configJsonPath);
            await Files.deletes(configJsonPath);
            const launcherResult: LauncherResultType = {
                result: {},
                endTime: null,
            };
            const payload = {
                entryPlaceholders: {"CONFIG": remoteConfigPath}
            };
            await (async () => {
                return new Promise((resolve, reject) => {
                    controllerWatching.id = data.id;
                    controllerWatching.launcherResult = launcherResult;
                    controllerWatching.resolve = resolve;
                    controllerWatching.reject = reject;
                    controllerWatching.promiseResolved = false;
                    me._runRemoteTask(payload, option);
                });
            })();
            resultData.end = Date.now();
            resultData.data = await resultDataCalculator(data, launcherResult);
            return {
                code: 0,
                msg: "ok",
                data: resultData,
            };
        } catch (e) {
            throw e;
        } finally {
            this.isRunning = false;
        }
    };

    // Specific functions - same as EasyServer but with file upload support

    this.soundTts = async function (data: ServerFunctionDataType) {
        return this._callFunc(
            data,
            async (data: ServerFunctionDataType) => {
                return {
                    id: data.id,
                    mode: "local",
                    modelConfig: {
                        type: "soundTts",
                        param: data.param,
                        text: data.text,
                    },
                };
            },
            async (data: ServerFunctionDataType, launcherResult: LauncherResultType) => {
                if (!("url" in launcherResult.result)) {
                    if (launcherResult.result.error) {
                        throw launcherResult.result.error;
                    }
                    throw "执行失败，请查看模型日志";
                }
                return {
                    url: await downloadUrl(launcherResult.result.url),
                };
            }
        );
    };

    this.soundClone = async function (data: ServerFunctionDataType) {
        if (data.promptAudio) {
            data.promptAudio = await this._uploadIfNeeded(data.promptAudio);
        }
        return this._callFunc(
            data,
            async (data: ServerFunctionDataType) => {
                return {
                    id: data.id,
                    mode: "local",
                    modelConfig: {
                        type: "soundClone",
                        param: data.param,
                        text: data.text,
                        promptAudio: data.promptAudio,
                        promptText: data.promptText,
                    },
                };
            },
            async (data: ServerFunctionDataType, launcherResult: LauncherResultType) => {
                if (!("url" in launcherResult.result)) {
                    if (launcherResult.result.error) {
                        throw launcherResult.result.error;
                    }
                    throw "执行失败，请查看模型日志";
                }
                return {
                    url: await downloadUrl(launcherResult.result.url),
                };
            }
        );
    };

    this.videoGen = async function (data: ServerFunctionDataType) {
        if (data.video) {
            data.video = await this._uploadIfNeeded(data.video);
        }
        if (data.audio) {
            data.audio = await this._uploadIfNeeded(data.audio);
        }
        return this._callFunc(
            data,
            async (data: ServerFunctionDataType) => {
                return {
                    id: data.id,
                    mode: "local",
                    modelConfig: {
                        type: "videoGen",
                        param: data.param,
                        video: data.video,
                        audio: data.audio,
                    },
                };
            },
            async (data: ServerFunctionDataType, launcherResult: LauncherResultType) => {
                if (!("url" in launcherResult.result)) {
                    if (launcherResult.result.error) {
                        throw launcherResult.result.error;
                    }
                    throw "执行失败，请查看模型日志";
                }
                return {
                    url: await downloadUrl(launcherResult.result.url),
                };
            }
        );
    };

    this.asr = async function (data: ServerFunctionDataType) {
        if (data.audio) {
            data.audio = await this._uploadIfNeeded(data.audio);
        }

        return this._callFunc(
            data,
            async (data: ServerFunctionDataType) => {
                return {
                    id: data.id,
                    mode: "local",
                    modelConfig: {
                        type: 'asr',
                        audio: data.audio,
                        param: data.param,
                    },
                };
            },
            async (data: ServerFunctionDataType, launcherResult: LauncherResultType) => {
                if (!("records" in launcherResult.result)) {
                    if (launcherResult.result.error) {
                        throw launcherResult.result.error;
                    }
                    throw "执行失败，请查看模型日志";
                }
                return {
                    records: launcherResult.result.records,
                };
            }
        );
    };

    this.textToImage = async function (data: ServerFunctionDataType) {
        return this._callFunc(
            data,
            async (data: ServerFunctionDataType) => {
                return {
                    id: data.id,
                    mode: "local",
                    modelConfig: {
                        type: "textToImage",
                        prompt: data.prompt,
                        param: data.param,
                    },
                };
            },
            async (data: ServerFunctionDataType, launcherResult: LauncherResultType) => {
                if (!("url" in launcherResult.result)) {
                    if (launcherResult.result.error) {
                        throw launcherResult.result.error;
                    }
                    throw "执行失败，请查看模型日志";
                }
                return {
                    url: await downloadUrl(launcherResult.result.url),
                };
            }
        );
    };

    this.imageToImage = async function (data: ServerFunctionDataType) {
        if (data.image) {
            data.image = await this._uploadIfNeeded(data.image);
        }

        return this._callFunc(
            data,
            async (data: ServerFunctionDataType) => {
                return {
                    id: data.id,
                    mode: "local",
                    modelConfig: {
                        type: "imageToImage",
                        image: data.image,
                        prompt: data.prompt,
                        param: data.param,
                    },
                };
            },
            async (data: ServerFunctionDataType, launcherResult: LauncherResultType) => {
                if (!("url" in launcherResult.result)) {
                    if (launcherResult.result.error) {
                        throw launcherResult.result.error;
                    }
                    throw "执行失败，请查看模型日志";
                }
                return {
                    url: await downloadUrl(launcherResult.result.url),
                };
            }
        );
    };
};
