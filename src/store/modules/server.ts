import { cloneDeep } from "lodash-es";
import { defineStore } from "pinia";
import { computed, ref, toRaw, ComputedRef } from "vue";
import { t } from "../../lang";
import { Dialog } from "../../lib/dialog";
import { OfflineAuth } from "../../lib/offlineAuth";
import { TimeUtil, wait } from "../../lib/util";
import { StorageService } from "../../service/StorageService";
import { TaskService } from "../../service/TaskService";
import {
    EnumServerStatus,
    EnumServerType,
    ServerRecord,
    ServerRuntime,
} from "../../types/Server";
import store from "../index";

import { useTaskStore } from "./task";
import { ServerInfo } from "../../../electron/mapi/server/type";


const taskStore = useTaskStore();
const serverRuntime = ref<Map<string, ServerRuntime>>(new Map());
const createServerStatus = (
    record: ServerRecord,
): ComputedRef<EnumServerStatus> => {
    return computed(() => {
        if (record.type === EnumServerType.CLOUD || record.autoStart) {
            return EnumServerStatus.RUNNING;
        }
        return (
            serverRuntime.value?.get(record.key)?.status ||
            EnumServerStatus.STOPPED
        );
    });
};
const getServerRuntimeComputedValue = (
    record: ServerRecord,
): ComputedRef<ServerRuntime> => {
    return computed(() => {
        const existing = serverRuntime.value?.get(record.key);
        if (existing) {
            return existing;
        }
        // 首次访问时创建运行时对象（含 logFile、自启动模型的事件通道），
        // 保证模型导入后「查看日志」等入口立即可用
        return getOrCreateServerRuntime(record);
    });
};
const getOrCreateServerRuntime = (record: ServerRecord): ServerRuntime => {
    const value = serverRuntime.value?.get(record.key);
    if (value) {
        return value;
    }
    const defaultValue = {
        status: EnumServerStatus.STOPPED,
        autoStartStatus: EnumServerStatus.STOPPED,
        eventChannelName: undefined,
        logFile: "",
    } as ServerRuntime;
    if (record.type === EnumServerType.CLOUD || record.autoStart) {
        defaultValue.status = EnumServerStatus.RUNNING;
        defaultValue.eventChannelName = createEventChannel(
            record,
            defaultValue,
        );
        defaultValue.logFile = `logs/${record.name}_${record.version}_${TimeUtil.dateString()}.log`;
    }
    serverRuntime.value?.set(record.key, defaultValue);
    return serverRuntime.value?.get(record.key) as ServerRuntime;
};
const deleteServerRuntime = (record: ServerRecord) => {
    serverRuntime.value?.delete(record.key);
};

const createEventChannel = (
    server: ServerRecord,
    serverRuntime?: ServerRuntime,
) => {
    if (!serverRuntime) {
        serverRuntime = getOrCreateServerRuntime(server);
    }
    const eventChannel = window.__page.createChannel(function (channelData) {
        const { type, data } = channelData;
        switch (type) {
            case "success":
                clearTimeout(serverRuntime.pingCheckTimer);
                serverRuntime.status = EnumServerStatus.STOPPED;
                window.__page.destroyChannel(eventChannel);
                updateRunningServerCount().then();
                break;
            case "error":
                clearTimeout(serverRuntime.pingCheckTimer);
                serverRuntime.status = EnumServerStatus.ERROR;
                window.__page.destroyChannel(eventChannel);
                updateRunningServerCount().then();
                break;
            case "preparing":
                // 权重按需下载（config.json 的 prepare）：展示下载进度
                // 已暂停/已就绪时忽略迟到的进度事件（进程被杀后 stdout 可能还会到达），
                // 否则界面会被拨回「正在下载」，看起来像自动恢复下载
                if (
                    data &&
                    data.phase !== "paused" &&
                    data.phase !== "error" &&
                    data.phase !== "done" &&
                    (serverRuntime.status === EnumServerStatus.PAUSED ||
                        serverRuntime.prepareReady === true)
                ) {
                    break;
                }
                if (data && data.phase === "done") {
                    // 下载完成：标记就绪（避免被后续事件/刷新回退为「未就绪」）
                    serverRuntime.prepare = null;
                    serverRuntime.prepareReady = true;
                    serverRuntime.prepareError = null;
                    serverRuntime.status = EnumServerStatus.STOPPED;
                    break;
                }
                serverRuntime.prepare = data || null;
                serverRuntime.prepareReady = false;
                if (data && data.phase === "error") {
                    serverRuntime.status = EnumServerStatus.ERROR;
                    serverRuntime.prepareError = data.error || null;
                } else if (data && data.phase === "paused") {
                    serverRuntime.status = EnumServerStatus.PAUSED;
                } else {
                    serverRuntime.status = EnumServerStatus.PREPARING;
                    serverRuntime.prepareError = null;
                }
                break;
            case "starting":
                serverRuntime.prepare = null;
                serverRuntime.status = EnumServerStatus.STARTING;
                break;
            case "stopping":
            case "stopped":
                break;
            case "action":
                switch (data.type) {
                    case "LoginRequired":
                        Dialog.tipError(data.msg || t("common.loginRequired"));
                        setTimeout(() => {
                            $mapi.user.open().then();
                        }, 2000);
                        break;
                    
                    // 离线授权未激活：弹窗输入授权码，写入 auth.json 后继续启动
                    case "OfflineAuthRequired": {
                        (async () => {
                            const token = await OfflineAuth.require({
                                machineId: data.machineId,
                                packageName: data.packageName,
                                version: data.version,
                                reason: data.reason,
                            });
                            const serverInfo =
                                await serverStoreInstance.serverInfo(server);
                            if (!token) {
                                await $mapi.server.cancelOfflineAuth(
                                    serverInfo,
                                );
                                return;
                            }
                            const res = await $mapi.server.submitOfflineAuth(
                                serverInfo,
                                token,
                            );
                            if (res && res.code) {
                                // 保存失败：结束挂起任务，避免一直「运行中」
                                await $mapi.server.cancelOfflineAuth(
                                    serverInfo,
                                );
                                Dialog.tipError(
                                    res.msg || t("offlineAuth.saveFailed"),
                                );
                                serverRuntime.status = EnumServerStatus.ERROR;
                                return;
                            }
                            window.$mapi.app.toast(t("offlineAuth.saved"), {
                                status: "success",
                            });
                        })().catch(async (e) => {
                            // 兜底：任何异常都要结束挂起任务，避免任务一直显示「运行中」
                            try {
                                const info =
                                    await serverStoreInstance.serverInfo(
                                        server,
                                    );
                                await $mapi.server.cancelOfflineAuth(info);
                            } catch (cancelError) {
                                // ignore
                            }
                            Dialog.tipError(String(e));
                        });
                        break;
                    }
                }
                break;
            case "liveTalk":
                StorageService.add("LiveTalk", {
                    title: data.title,
                    content: {
                        content: data.content,
                    },
                }).then();
                break;
            case "taskRunning":
            case "taskResult":
            case "taskStatus":
                const { id } = data;
                const { biz, bizId } = serverStoreInstance.parseTaskId(id);
                // console.log('task', {type, biz, bizId, data})
                const taskUpdate = async (bizId: string, data: any) => {
                    const bizer = taskStore.get(biz);
                    if (bizer && bizer.update) {
                        await bizer.update(bizId, data);
                    } else {
                        await TaskService.update(bizId, data);
                    }
                };
                const taskFireRunning = async () => {
                    taskStore.fireChange(
                        {
                            biz,
                            bizId,
                        } as any,
                        "running",
                    );
                };
                if ("taskRunning" === type) {
                    taskUpdate(bizId, {
                        status: "running",
                        startTime: TimeUtil.timestampMS(),
                    }).then(taskFireRunning);
                } else if ("taskResult" === type) {
                    taskUpdate(bizId, {
                        result: data.result,
                    }).then(taskFireRunning);
                }
                break;
            default:
                console.log("eventChannel.unknown", type, data);
                break;
        }
    });
    return eventChannel;
};

const updateRunningServerCount = async () => {
    const count = serverStoreInstance.records.filter((r) => {
        return (
            r.type === EnumServerType.LOCAL_DIR &&
            r.status === EnumServerStatus.RUNNING &&
            !r.autoStart
        );
    }).length;
    await $mapi.server.runningServerCount(count);
};

export const serverStore = defineStore("server", {
    state: () => ({
        isReady: false,
        records: [] as ServerRecord[],
    }),
    actions: {
        async waitReady() {
            await wait(() => this.isReady);
            
        },
        async init() {
            await $mapi.storage.get("server", "records", []).then((records) => {
                records.forEach((record: ServerRecord) => {
                    record.status = createServerStatus(record);
                    record.runtime = getServerRuntimeComputedValue(record);
                });
                this.records = records.filter((record: ServerRecord) => {
                    return record.type !== EnumServerType.CLOUD;
                });
            });
            taskStore.onChange(null, (bizId, type) => {
                if (type === "requestCancel") {
                    TaskService.get(bizId).then((record) => {
                        if (
                            record &&
                            record.serverName &&
                            record.serverVersion
                        ) {
                            this.cancelByNameVersion(
                                record.serverName,
                                record.serverVersion,
                            ).then();
                        }
                    });
                }
            });
            await this.refresh();
            this.isReady = true;
            this.autoPrepare().then();
        },
        // 权重按需下载：应用启动后自动补齐未就绪的模型权重（串行执行，避免并发占满带宽）
        async autoPrepare() {
            const records = this.records.filter(
                (record) => !!record.config?.prepare,
            );
            for (const record of records) {
                try {
                    const serverInfo = await this.serverInfo(record);
                    const status: any =
                        await $mapi.server.prepareStatus(serverInfo);
                    this.applyPrepareStatus(record, status);
                    if (!status || status.ready === true) {
                        continue;
                    }
                    // 用户主动暂停过的模型不自动续传（等用户点「继续下载」）
                    if (status.paused) {
                        continue;
                    }
                    await this.prepare(record);
                } catch (e) {
                    console.error("server.autoPrepare", record.key, e);
                }
            }
        },
        // 把主进程返回的 prepare 状态同步到界面（就绪/暂停/失败/未开始）
        applyPrepareStatus(record: ServerRecord, status: any) {
            if (!status || status.required === false) {
                return;
            }
            const serverRuntime = getOrCreateServerRuntime(record);
            serverRuntime.prepareReady = !!status.ready;
            serverRuntime.prepareTotalSize = status.size || 0;
            serverRuntime.prepareError = status.error || null;
            if (status.ready) {
                serverRuntime.prepare = null;
                return;
            }
            const percent = status.percent || 0;
            if (status.running) {
                serverRuntime.prepare = {
                    phase: "download",
                    percent,
                    totalSize: status.size || 0,
                };
                serverRuntime.status = EnumServerStatus.PREPARING;
            } else if (status.paused) {
                serverRuntime.prepare = {
                    phase: "paused",
                    percent,
                    totalSize: status.size || 0,
                };
                serverRuntime.status = EnumServerStatus.PAUSED;
            } else if (status.error) {
                serverRuntime.prepare = {
                    phase: "error",
                    percent,
                    totalSize: status.size || 0,
                    error: status.error,
                };
                serverRuntime.status = EnumServerStatus.ERROR;
            } else {
                serverRuntime.prepare = {
                    phase: "idle",
                    percent: 0,
                    totalSize: status.size || 0,
                };
            }
        },
        // 触发权重下载（已在下载中则复用主进程的同一个任务）
        async prepare(server: ServerRecord) {
            const record = this.findRecord(server) || server;
            const serverRuntime = getOrCreateServerRuntime(record);
            if (serverRuntime.status === EnumServerStatus.PREPARING) {
                return;
            }
            // 下载日志写入与运行日志相同的文件（客户端「查看日志」可直接查看）
            if (!serverRuntime.logFile) {
                serverRuntime.logFile = `logs/${record.name}_${record.version}_${TimeUtil.dateString()}.log`;
            }
            serverRuntime.status = EnumServerStatus.PREPARING;
            serverRuntime.prepare = { phase: "start", percent: 0 };
            serverRuntime.eventChannelName = createEventChannel(record);
            const serverInfo = await this.serverInfo(record);
            try {
                const status: any = await $mapi.server.prepare(serverInfo);
                if (status && status.ready === false) {
                    // 用户暂停：保持 PAUSED，不当作失败
                    if (status.paused) {
                        serverRuntime.prepare = {
                            phase: "paused",
                            percent: status.percent || 0,
                            totalSize: status.size || 0,
                        };
                        serverRuntime.status = EnumServerStatus.PAUSED;
                        return;
                    }
                    throw new Error(status.error || "prepare failed");
                }
                serverRuntime.prepareReady = true;
                serverRuntime.prepare = null;
                serverRuntime.status = EnumServerStatus.STOPPED;
            } catch (e) {
                if (serverRuntime.status !== EnumServerStatus.PAUSED) {
                    serverRuntime.status = EnumServerStatus.ERROR;
                }
                throw e;
            }
        },
        // 暂停权重下载（保留已下载文件与 .part，写暂停标记；「继续下载」可续传）
        async pausePrepare(server: ServerRecord) {
            const record = this.findRecord(server) || server;
            const serverRuntime = getOrCreateServerRuntime(record);
            // 已就绪的模型无需暂停
            if (serverRuntime.prepareReady === true) {
                return;
            }
            const serverInfo = await this.serverInfo(record);
            const percent =
                (serverRuntime.prepare && serverRuntime.prepare.percent) || 0;
            await $mapi.server.pausePrepare(serverInfo);
            serverRuntime.prepare = {
                phase: "paused",
                percent,
                totalSize: serverRuntime.prepareTotalSize || 0,
            };
            serverRuntime.status = EnumServerStatus.PAUSED;
        },
        // 从 storage 重新加载 server records（CLI 安装/卸载模型后由页面事件触发），
        // 不会重复注册任务取消监听。
        async reloadRecords() {
            await $mapi.storage.get("server", "records", []).then((records) => {
                records.forEach((record: ServerRecord) => {
                    record.status = createServerStatus(record);
                    record.runtime = getServerRuntimeComputedValue(record);
                });
                this.records = records.filter((record: ServerRecord) => {
                    return record.type !== EnumServerType.CLOUD;
                });
            });
            await this.refresh();
            this.autoPrepare().then();
        },
        async refresh() {
            const dirs = await $mapi.file.list("model", {
                isDataPath: true,
            });
            const localRecords: ServerRecord[] = [];
            for (let dir of dirs) {
                const config = await $mapi.file.read(
                    `model/${dir.name}/config.json`,
                    {
                        isDataPath: true,
                    },
                );
                let json;
                try {
                    json = JSON.parse(config);
                } catch (e) {
                    continue;
                }
                if (!json) {
                    continue;
                }
                localRecords.push({
                    key: this.generateServerKey({
                        name: json.name,
                        version: json.version,
                    } as any),
                    name: json.name || dir.name,
                    title: json.title || dir.name,
                    version: json.version || "1.0.0",
                    type: EnumServerType.LOCAL,
                    // EasyServer（含 ComfyUI，其 entry 亦为 __EasyServer__）默认自启动
                    autoStart: json.entry === "__EasyServer__",
                    functions: json.functions || [],
                    localPath: `model/${dir.name}`,
                    settings: json.settings || [],
                    setting: json.setting || {},
                    config: json,
                } as ServerRecord);
            }
            let changed = false;
            for (let lr of localRecords) {
                const record = this.records.find(
                    (record) => record.key === lr.key,
                );
                if (!record) {
                    lr.status = createServerStatus(lr);
                    lr.runtime = getServerRuntimeComputedValue(lr);
                    this.records.unshift(lr as any);
                    changed = true;
                } else {
                    if (!record.settings && lr.settings) {
                        record.settings = lr.settings;
                        changed = true;
                    }
                    // 同步 functions / config / title（模型能力或配置更新后保持最新）
                    if (
                        JSON.stringify(record.functions) !==
                        JSON.stringify(lr.functions)
                    ) {
                        record.functions = lr.functions;
                        changed = true;
                    }
                    if (
                        JSON.stringify(record.config) !==
                        JSON.stringify(lr.config)
                    ) {
                        record.config = lr.config;
                        changed = true;
                    }
                    if (record.title !== lr.title) {
                        record.title = lr.title;
                        changed = true;
                    }
                    // 存量记录自动补齐 autoStart 标记（entry 已为 __EasyServer__ 的模型）
                    if (lr.autoStart && !record.autoStart) {
                        record.autoStart = true;
                        changed = true;
                    }
                }
            }
            if (changed) {
                await this.sync();
                // 新发现的本地模型同样按需补齐权重
                this.autoPrepare().then();
            }
        },
        async prepareForTask(bizId: string, bizParam: any) {
            const record = await TaskService.get(bizId as any);
            // console.log('SoundTts.runFunc.record', record)
            if (!record) {
                throw "record not found";
            }
            let server: any = null;
            let serverInfo: any = null;
            if (record.serverName && record.serverVersion) {
                server = await this.getByNameVersion(
                    record.serverName,
                    record.serverVersion,
                );
                // console.log('SoundTts.runFunc.server', server)
                if (!server) {
                    throw "server not found";
                }
                serverInfo = await this.serverInfo(server);
            }
            return {
                record,
                server,
                serverInfo,
            };
        },
        generateTaskId(biz: string, bizId: string) {
            return `${biz}_${bizId}`;
        },
        parseTaskId(taskId: string) {
            const parts = taskId.split("_");
            if (parts.length < 2) {
                throw new Error("InvalidTaskId");
            }
            return {
                biz: parts[0],
                bizId: parts.slice(1).join("_"),
            };
        },
        findRecord(server: ServerRecord) {
            return this.records.find((record) => record.key === server.key);
        },
        start: async function (server: ServerRecord) {
            const record = this.findRecord(server);
            if (!record) {
                throw "RecordNotFound";
            }
            if (
                record.status === EnumServerStatus.STOPPED ||
                record.status === EnumServerStatus.ERROR
            ) {
            } else if (record.status === EnumServerStatus.RUNNING) {
                // 已在运行，直接返回
                return;
            } else if (record.status === EnumServerStatus.STARTING) {
                // 已在启动中，直接返回（调用方负责等待就绪）
                return;
            } else {
                throw "StatusError";
            }
            const serverRuntime = getOrCreateServerRuntime(server);
            serverRuntime.status = EnumServerStatus.STARTING;
            serverRuntime.startTimestampMS = TimeUtil.timestampMS();
            serverRuntime.logFile = `logs/${server.name}_${server.version}_${TimeUtil.dateString()}_${
                serverRuntime.startTimestampMS
            }.log`;
            serverRuntime.eventChannelName = createEventChannel(server);
            const serverInfo = await this.serverInfo(server);
            try {
                await $mapi.server.start(serverInfo);
            } catch (e) {
                // 权重准备失败等启动前置错误：标记 ERROR（用户主动停止时不覆盖 STOPPED）
                if (serverRuntime.status !== EnumServerStatus.STOPPED) {
                    serverRuntime.status = EnumServerStatus.ERROR;
                }
                throw e;
            }
            let pingTimeout = 60 * 5 * 1000;
            let pingStart = TimeUtil.timestampMS();
            const pingCheck = () => {
                const now = TimeUtil.timestampMS();
                if (now - pingStart > pingTimeout) {
                    // console.log('ping.timeout')
                    serverRuntime.status = EnumServerStatus.ERROR;
                    $mapi.server.stop(serverInfo);
                    return;
                }
                $mapi.server
                    .ping(serverInfo)
                    .then((success) => {
                        if (success) {
                            serverRuntime.status = EnumServerStatus.RUNNING;
                            updateRunningServerCount().then();
                        } else {
                            serverRuntime.pingCheckTimer = setTimeout(
                                pingCheck,
                                2000,
                            );
                        }
                    })
                    .catch((err) => {
                        serverRuntime.pingCheckTimer = setTimeout(
                            pingCheck,
                            2000,
                        );
                    });
            };
            serverRuntime.pingCheckTimer = setTimeout(pingCheck, 2 * 1000);
        },
        async stop(server: ServerRecord) {
            const record = this.findRecord(server);
            if (
                record?.status !== EnumServerStatus.RUNNING &&
                record?.status !== EnumServerStatus.STARTING &&
                record?.status !== EnumServerStatus.STOPPING
            ) {
                // 未运行或已停止，直接返回（幂等）
                return;
            }
            const serverRuntime = getOrCreateServerRuntime(server);
            serverRuntime.status = EnumServerStatus.STOPPING;
            const serverInfo = await this.serverInfo(server);
            serverInfo.logFile = serverRuntime.logFile;
            await $mapi.server.stop(serverInfo);
        },
        async cancel(server: ServerRecord) {
            const record = this.findRecord(server);
            if (record?.status === EnumServerStatus.RUNNING) {
            } else {
                throw new Error("StatusError");
            }
            const serverRuntime = getOrCreateServerRuntime(server);
            const serverInfo = await this.serverInfo(server);
            serverInfo.logFile = serverRuntime.logFile;
            await $mapi.server.cancel(serverInfo);
        },
        async updateSetting(key: string, setting: any) {
            const record = this.records.find((record) => record.key === key);
            if (!record) {
                return;
            }
            record.setting = Object.assign(record.setting || {}, setting);
            await this.sync();
        },
        async delete(server: ServerRecord) {
            const index = this.records.findIndex(
                (record) => record.key === server.key,
            );
            if (index === -1) {
                return;
            }
            const record = this.records[index];
            // 权重下载中禁止删除（先暂停下载）。
            // 注意：autoStart 模型的 record.status 恒为 RUNNING，必须看 runtime 状态，
            // 并以主进程实际运行状态为准，避免「正在下载还能删掉」。
            if (record.runtime?.status === EnumServerStatus.PREPARING) {
                Dialog.tipError(t("error.serverPreparingDelete"));
                throw new Error("PreparingStatusError");
            }
            const recordInfo = await this.serverInfo(record);
            try {
                const prepareStatus: any =
                    await $mapi.server.prepareStatus(recordInfo);
                if (prepareStatus && prepareStatus.running) {
                    Dialog.tipError(t("error.serverPreparingDelete"));
                    throw new Error("PreparingStatusError");
                }
            } catch (e: any) {
                if (e?.message === "PreparingStatusError") {
                    throw e;
                }
                // 状态查询失败不阻断删除
            }
            if (
                record.autoStart ||
                record.status === EnumServerStatus.STOPPED ||
                record.status === EnumServerStatus.ERROR ||
                record.status === EnumServerStatus.PAUSED
            ) {
            } else {
                if (record.type === EnumServerType.LOCAL_DIR) {
                    throw new Error("StatusError");
                }
            }
            const serverInfo = await this.serverInfo(server);
            $mapi.server.deletes(serverInfo).then();
            if (record.type === EnumServerType.LOCAL) {
                await $mapi.file.deletes(record.localPath as string, {
                    isDataPath: true,
                });
            }
            this.records.splice(index, 1);
            deleteServerRuntime(server);
            await this.sync();
        },
        async add(server: ServerRecord) {
            let record = this.records.find(
                (record) => record.key === server.key,
            );
            if (record) {
                return;
            }
            server.status = createServerStatus(server);
            server.runtime = getServerRuntimeComputedValue(server);
            this.records.unshift(server);
            await this.sync();
            // 新增模型后按需补齐权重（配置了 prepare 且未就绪的模型自动开始下载）
            this.autoPrepare().then();
        },
        async sync() {
            const savedRecords = toRaw(cloneDeep(this.records));
            savedRecords.forEach((record) => {
                record.status = undefined;
                record.runtime = undefined;
            });
            await $mapi.storage.set("server", "records", savedRecords);
        },
        async getByKey(key: string): Promise<ServerRecord | undefined> {
            
            return this.records.find((record) => record.key === key);
        },
        async getByNameVersion(
            name: string,
            version: string,
        ): Promise<ServerRecord | undefined> {
            
            return this.records.find(
                (record) => record.name === name && record.version === version,
            );
        },
        async cancelByNameVersion(name: string, version: string) {
            const record = await this.getByNameVersion(name, version);
            if (record) {
                await this.cancel(record);
            }
        },
        generateServerKey(server: ServerRecord) {
            return `${server.name}|${server.version}`;
        },
        // 模型是否可用：配置了 prepare 但权重未就绪时不可用（下拉置灰 / 提交前校验）
        serverAvailability(server: ServerRecord): {
            available: boolean;
            reason: string;
        } {
            const config: any = server.config || {};
            if (!config.prepare) {
                return { available: true, reason: "" };
            }
            const runtime: any = server.runtime || {};
            if (runtime.prepareReady !== false) {
                // true=已就绪；undefined=状态尚未同步（不阻断，调用时仍会兜底校验）
                return { available: true, reason: "" };
            }
            const percent = Math.round(runtime.prepare?.percent || 0);
            const phase = runtime.prepare?.phase;
            if (phase === "error") {
                return { available: false, reason: t("status.prepareFailed") };
            }
            if (phase === "paused") {
                return {
                    available: false,
                    reason: `${t("status.pausedWeights")} ${percent}%`,
                };
            }
            if (runtime.status === EnumServerStatus.PREPARING) {
                return {
                    available: false,
                    reason: `${t("status.preparingWeights")} ${percent}%`,
                };
            }
            return { available: false, reason: t("model.weightsNotReady") };
        },
        async call(
            serverInfo: ServerInfo,
            method: string,
            data: ServerCallFunctionData,
            option?: ServerCallFunctionOption,
        ): Promise<ServerCallFunctionResult> {
            // 提交前校验：权重未就绪的模型直接提示，不再创建必失败的任务
            const callRecord = await this.getByNameVersion(
                serverInfo.name,
                serverInfo.version,
            );
            if (callRecord) {
                const availability = this.serverAvailability(callRecord);
                if (!availability.available) {
                    Dialog.tipError(
                        t("error.serverWeightsNotReady", {
                            reason: availability.reason,
                        }),
                    );
                    throw new Error(availability.reason);
                }
            }
            await this.callStart(serverInfo);
            try {
                // comfyui 类型服务：自启动（任务触发自动拉起、空闲自动退出）
                const server = await this.getByNameVersion(
                    serverInfo.name,
                    serverInfo.version,
                );
                if (server && server.config?.type === "comfyui") {
                    const runtime = getOrCreateServerRuntime(server);
                    let serverInfoForPing = await this.serverInfo(server);
                    // 以 HTTP ping 判断服务是否已在运行（不依赖 runtime.status，
                    // 兼容 autoStart 模型初始状态恒为 RUNNING 但进程未启动的情况）
                    let ready = false;
                    try {
                        ready = await $mapi.server.ping(serverInfoForPing);
                    } catch (e) {
                        ready = false;
                    }
                    if (!ready) {
                        // 直接强制拉起服务：不能走 serverStore.start()——
                        // autoStart 模型 record.status 恒为 RUNNING，会导致
                        // start() 的状态检查短路直接返回（服务永不启动）。
                        runtime.status = EnumServerStatus.STARTING;
                        runtime.startTimestampMS = TimeUtil.timestampMS();
                        runtime.logFile = `logs/${server.name}_${server.version}_${TimeUtil.dateString()}_${runtime.startTimestampMS}.log`;
                        runtime.eventChannelName = createEventChannel(server);
                        // 重新获取 serverInfo（含 logFile / eventChannelName）
                        serverInfoForPing = await this.serverInfo(server);
                        await $mapi.server.start(serverInfoForPing);
                    }
                    // 等待服务就绪：优先 HTTP ping（不依赖事件通道）。
                    // 用独立变量记录是否真正就绪——runtime.status 对 autoStart
                    // 模型初始就是 RUNNING，不能作为就绪判断依据。
                    let startedOk = false;
                    const deadline = Date.now() + 5 * 60 * 1000;
                    while (Date.now() < deadline) {
                        let ok = false;
                        try {
                            ok = await $mapi.server.ping(serverInfoForPing);
                        } catch (e) {
                            ok = false;
                        }
                        if (ok) {
                            runtime.status = EnumServerStatus.RUNNING;
                            startedOk = true;
                            break;
                        }
                        await wait(2000);
                    }
                    if (!startedOk) {
                        throw new Error("comfyui server start timeout");
                    }
                }
                return await $mapi.server.callFunctionWithException(
                    serverInfo,
                    method,
                    data,
                    option,
                );
            } finally {
                // 无论调用成功/失败都必须复位 autoStartStatus，
                // 否则 autoStart 模型状态会一直停留在"运行中"。
                // 此处容错避免 callEnd 异常覆盖真实调用结果。
                try {
                    await this.callEnd(serverInfo);
                } catch (e) {
                    // ignore callEnd error
                }
            }
        },
        async callStart(serverInfo: ServerInfo) {
            const server = await this.getByNameVersion(
                serverInfo.name,
                serverInfo.version,
            );
            if (!server) {
                throw new Error("ServerNotFound");
            }
            const serverRuntime = getOrCreateServerRuntime(server);
            if (server.autoStart) {
                serverRuntime.autoStartStatus = EnumServerStatus.RUNNING;
            }
        },
        async callEnd(serverInfo: ServerInfo) {
            const server = await this.getByNameVersion(
                serverInfo.name,
                serverInfo.version,
            );
            if (!server) {
                throw new Error("ServerNotFound");
            }
            const serverRuntime = getOrCreateServerRuntime(server);
            if (server.autoStart) {
                serverRuntime.autoStartStatus = EnumServerStatus.STOPPED;
            }
        },
        async serverInfo(server: ServerRecord) {
            // 只序列化纯数据字段：record 上的 status/runtime 可能包含 ComputedRef，
            // 直接 JSON.stringify(server) 会因循环引用抛
            // 「TypeError: Converting circular structure to JSON」，导致离线授权等
            // IPC 调用在序列化阶段就失败、任务一直挂在「运行中」。
            const raw: any = toRaw(server);
            const configSource: any = {};
            Object.keys(raw).forEach((key) => {
                if (key === "status" || key === "runtime") return;
                const value = raw[key];
                if (typeof value === "function") return;
                configSource[key] = toRaw(value);
            });
            const result = {
                localPath: "",
                name: server.name,
                version: server.version,
                type: server.type,
                setting: toRaw(server.setting),
                logFile: "",
                eventChannelName: "",
                config: JSON.parse(JSON.stringify(configSource)),
            };
            if (server.type === EnumServerType.LOCAL) {
                result.localPath = await $mapi.file.fullPath(
                    server.localPath as string,
                );
            } else if (server.type === EnumServerType.LOCAL_DIR) {
                result.localPath = server.localPath as string;
            } else if (server.type === EnumServerType.CLOUD) {
                result.localPath = server.localPath as string;
            } else if (server.type === EnumServerType.REMOTE) {
                result.localPath = await $mapi.file.fullPath(
                    server.localPath as string,
                );
            } else if (server.type === EnumServerType.API) {
                // API 类型模型无本地目录，使用稳定的唯一 key 作为模块缓存标识
                result.localPath = (server.localPath as string) || server.key;
            }
            const serverRuntime = getOrCreateServerRuntime(server);
            if (serverRuntime) {
                result.logFile = serverRuntime.logFile;
                result.eventChannelName =
                    serverRuntime.eventChannelName as string;
            }
            return result as ServerInfo;
        },
    },
});

const serverStoreInstance = serverStore(store);
serverStoreInstance.init().then();

export const useServerStore = () => {
    return serverStoreInstance;
};
