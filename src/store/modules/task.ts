// ------------------------------------------------------------------------------
// ----------------------------- Task Schedule Store ----------------------------
// ------------------------------------------------------------------------------
// Register TaskBiz
//   taskStore.register('TestSync', TestSync)
//   taskStore.register('TestAsync', TestAsync)
// Dispatch Task
//   await taskStore.dispatch('TestSync', StringUtil.random())
//   await taskStore.dispatch('TestAsync', StringUtil.random(), {'a':1}, {timeout: 3 * 1000})
// Schedule call order
//   Sync Task runFunc -> successFunc | failFunc
//   Async Task runFunc -> queryFunc -> successFunc | failFunc
// ------------------------------------------------------------------------------
// ------------------------------------------------------------------------------
// ------------------------------------------------------------------------------

import { cloneDeep } from "lodash-es";
import { defineStore } from "pinia";
import { toRaw } from "vue";
import { mapError } from "../../lib/error";
import { StringUtil, TimeUtil } from "../../lib/util";
import store from "../index";

export type TaskRecordStatus =
    "queue" | "running" | "querying" | "success" | "fail" | "delete";

export type TaskRecordRunStatus = "retry" | "success" | "querying";

export type TaskRecordQueryStatus = "running" | "success" | "fail";

export type TaskChangeType =
    "running" | "success" | "fail" | "change" | "requestCancel";

export type TaskRecord = {
    id: string;
    status: TaskRecordStatus;
    msg: string;
    biz: string;
    bizId: string;
    bizParam: any;
    // 开始运行时间
    runStart: number;
    // 是否正在调用 runFunc
    runCalling: boolean;
    // 超过 runAfter 才会执行，0表示是一个新任务，＞0表示是一个重试任务
    runAfter: number;
    // 是否正在调用 queryFunc
    queryCalling: boolean;
    // 超过 queryAfter 才会查询
    queryAfter: number;
    // 查询间隔
    queryInterval: number;
    // 是否正在调用 successFunc
    successCalling: boolean;
    // 超时时间
    timeout: number;
};

export type TaskBiz = {
    // sync task run,  return success | retry
    // async task run, return querying | success | retry
    runFunc: (bizId: string, bizParam: any) => Promise<TaskRecordRunStatus>;
    // async task query status, return running | success | fail
    queryFunc?: (
        bizId: string,
        bizParam: any,
    ) => Promise<TaskRecordQueryStatus>;
    // sync task success callback
    // async task success callback
    successFunc: (bizId: string, bizParam: any) => Promise<void>;
    // Make sure the "failFunc" function always not throw an error
    failFunc: (bizId: string, msg: string, bizParam: any) => Promise<void>;
    // request cancel callback, when user request cancel a task, will call this function
    requestCancelFunc?: (bizId: string, bizParam: any) => Promise<void>;
    // ----------------------------------------------------
    // the following not use in schedule, only for biz
    [key: string]: any;
    // ----------------------------------------------------
};

const taskChangeListeners = [] as {
    biz: string | null;
    callback: (bizId: string, status: TaskChangeType) => void;
}[];
let runNextTimer = null as any;

export const TestSync: TaskBiz = {
    runFunc: async (bizId, bizParam) => {
        console.log("Task.TestSync.runFunc", { bizId, bizParam });
        return "success";
    },
    successFunc: async (bizId, bizParam) => {
        console.log("Task.TestSync.successFunc", { bizId, bizParam });
    },
    failFunc: async (bizId, msg, bizParam) => {
        console.log("Task.TestSync.failFunc", { bizId, bizParam, msg });
    },
};
export const TestAsync: TaskBiz = {
    runFunc: async (bizId, bizParam) => {
        console.log("Task.TestAsync.runFunc", { bizId, bizParam });
        return "querying";
    },
    queryFunc(bizId, bizParam) {
        return new Promise((resolve) => {
            console.log("Task.TestAsync.queryFunc", { bizId, bizParam });
            setTimeout(() => {
                resolve(Math.random() > 0.7 ? "success" : "running");
            }, 1000);
        });
    },
    successFunc: async (bizId, bizParam) => {
        console.log("Task.TestAsync.successFunc", { bizId, bizParam });
    },
    failFunc: async (bizId, msg, bizParam) => {
        console.log("Task.TestAsync.failFunc", { bizId, bizParam, msg });
    },
};

export const taskStore = defineStore("task", {
    state() {
        return {
            isInit: false,
            bizMap: {} as Record<string, TaskBiz>,
            records: [] as TaskRecord[],
            cancelMap: {} as Record<
                string,
                {
                    expire: number;
                }
            >,
        };
    },
    actions: {
        async init() {
            await $mapi.storage.get("task", "records", []).then((records) => {
                this.records = ((records as TaskRecord[]) || []).map((record) =>
                    this.restoreRecord(record),
                );
                this.isInit = true;
                this._run(true);
            });
        },
        /**
         * Normalize a record restored from storage.
         *
         * Records are persisted mid-flight, including the transient scheduling
         * flags (runCalling / queryCalling / successCalling). Those flags are
         * only meaningful for the running session: after a restart they are all
         * stale. If runCalling stays true the record can never be picked up by
         * the scheduler again, so the task would sit in "queue" (or "running")
         * forever until the process is started by some other means. Clear the
         * flags and push an interrupted run back to the queue so it is retried.
         */
        restoreRecord(record: TaskRecord): TaskRecord {
            record.runCalling = false;
            record.queryCalling = false;
            record.successCalling = false;
            record.runAfter = 0;
            record.queryAfter = 0;
            if (record.status === "running" || record.status === "querying") {
                record.status = "queue";
            }
            return record;
        },
        async waitInit() {
            while (!this.isInit) {
                await new Promise((resolve) => setTimeout(resolve, 100));
            }
        },
        _runExecute() {
            let changed = false;
            // console.log('task._runExecute.start', JSON.stringify(this.records))
            // error record
            this.records.forEach((record) => {
                if (!this.bizMap[record.biz]) {
                    record.status = "fail";
                    record.msg = "biz not found";
                    changed = true;
                }
            });
            // console.log('task.records', JSON.stringify(this.records, null, 2))
            // request cancel
            this.records
                .filter(
                    (r) =>
                        r.status === "queue" ||
                        r.status === "running" ||
                        r.status === "querying",
                )
                .filter((r) => this.shouldCancel(r.biz, r.bizId))
                .forEach((record) => {
                    record.status = "fail";
                    record.msg = mapError("UserCancel");
                    changed = true;
                });
            // queue
            this.records
                .filter((r) => r.status === "queue")
                .filter((r) => r.runAfter <= Date.now() && !r.runCalling)
                .forEach((record) => {
                    changed = true;
                    record.status = "running";
                    record.runStart = Date.now();
                    record.runCalling = true;
                    let runCallFinish = false;
                    setTimeout(() => {
                        if (runCallFinish) {
                            return;
                        }
                        this.fireChange(record, "running");
                    }, 1000);
                    this.bizMap[record.biz]
                        .runFunc(record.bizId, record.bizParam)
                        .then((status: TaskRecordRunStatus) => {
                            runCallFinish = true;
                            switch (status) {
                                case "success":
                                    record.status = "success";
                                    break;
                                case "querying":
                                    record.queryAfter =
                                        Date.now() + record.queryInterval;
                                    record.status = "querying";
                                    break;
                                case "retry":
                                    record.status = "queue";
                                    record.runStart = 0;
                                    record.runAfter = Date.now() + 1000;
                                    break;
                            }
                        })
                        .catch((e) => {
                            runCallFinish = true;
                            record.status = "fail";
                            record.msg = mapError(e);
                            console.error("Task.RunFunc.Error", e);
                            $mapi.log
                                .error("Task.RunFunc.Error", e.toString())
                                .catch((e) => {
                                    console.error("Task.RunFunc.Error.Log", e);
                                });
                        })
                        .finally(() => {
                            record.runCalling = false;
                            this.fireChange(record, "running");
                        });
                });
            // querying
            this.records
                .filter((r) => r.status === "querying")
                .filter((r) => r.queryAfter <= Date.now() && !r.queryCalling)
                .forEach((record) => {
                    record.queryCalling = true;
                    const taskBiz = this.bizMap[record.biz];
                    taskBiz
                        .queryFunc?.(record.bizId, record.bizParam)
                        .then((status: TaskRecordQueryStatus) => {
                            switch (status) {
                                case "running":
                                    record.queryAfter =
                                        Date.now() + record.queryInterval;
                                    break;
                                case "success":
                                    record.status = "success";
                                    changed = true;
                                    break;
                                case "fail":
                                    record.status = "fail";
                                    changed = true;
                                    break;
                            }
                        })
                        .catch((e) => {
                            record.status = "fail";
                            record.msg = mapError(e);
                            changed = true;
                            console.error("Task.QueryFunc.Error", e);
                            $mapi.log
                                .error("Task.QueryFunc.Error", e.toString())
                                .catch((e) => {
                                    console.error(
                                        "Task.QueryFunc.Error.Log",
                                        e,
                                    );
                                });
                        })
                        .finally(() => {
                            record.queryCalling = false;
                        });
                });
            // expire
            this.records
                .filter(
                    (r) => r.status === "running" || r.status === "querying",
                )
                .filter((r) => Date.now() - r.runStart > r.timeout)
                .forEach((record) => {
                    record.status = "fail";
                    record.msg = mapError("ProcessTimeout");
                    changed = true;
                });
            // success
            this.records
                .filter((r) => r.status === "success")
                .filter((r) => !r.successCalling)
                .forEach((record) => {
                    record.successCalling = true;
                    changed = true;
                    this.bizMap[record.biz]
                        .successFunc(record.bizId, record.bizParam)
                        .then(() => {
                            record.status = "delete";
                        })
                        .catch((e) => {
                            console.error("Task.SuccessFunc.Error", e);
                            $mapi.log
                                .error("Task.SuccessFunc.Error", e.toString())
                                .catch((e) => {
                                    console.error(
                                        "Task.SuccessFunc.Error.Log",
                                        e,
                                    );
                                });
                            record.status = "fail";
                            record.msg = mapError(e);
                        })
                        .finally(() => {
                            if (record.status === "delete") {
                                this.fireChange(record, "success");
                            }
                            record.successCalling = false;
                        });
                });
            // fail
            this.records
                .filter((r) => r.status === "fail")
                .forEach((record) => {
                    changed = true;
                    record.status = "delete";
                    if (!this.bizMap[record.biz]) {
                        return;
                    }
                    this.bizMap[record.biz]
                        .failFunc(record.bizId, record.msg, record.bizParam)
                        .then(() => {})
                        .catch((e) => {
                            console.error("Task.FailFunc.Error", e);
                            $mapi.log
                                .error("Task.FailFunc.Error", e.toString())
                                .catch((e) => {
                                    console.error("Task.FailFunc.Error.Log", e);
                                });
                        })
                        .finally(() => {
                            this.fireChange(record, "fail");
                        });
                });
            // console.log('task._runExecute.end', JSON.stringify(this.records))
            // delete
            this.records = this.records.filter((r) => r.status !== "delete");
            // sync
            if (changed) {
                this.sync().then();
            }
            // next run
            // console.log('run', changed, JSON.stringify(this.records))
            if (this.records.length > 0) {
                this._run(changed);
            }
        },
        _run(immediate: boolean) {
            if (runNextTimer) {
                clearTimeout(runNextTimer);
                runNextTimer = null;
            }
            runNextTimer = setTimeout(
                () => {
                    runNextTimer = null;
                    try {
                        this._runExecute();
                    } catch (e) {
                        // A throw would break the single scheduling chain: the
                        // next tick would never be scheduled and every queued
                        // task would stay in "queue" forever. Log it and keep the
                        // chain alive instead.
                        console.error("Task.RunExecute.Error", e);
                        try {
                            $mapi.log
                                .error("Task.RunExecute.Error", String(e))
                                .catch(() => {});
                        } catch {
                            /* ignore */
                        }
                        if (this.records.length > 0) {
                            this._run(false);
                        }
                    }
                },
                immediate ? 0 : 1000,
            );
        },
        get(biz: string) {
            return this.bizMap[biz] || null;
        },
        register(biz: string, taskBiz: TaskBiz) {
            this.bizMap[biz] = taskBiz;
        },
        unregister(biz: string) {
            delete this.bizMap[biz];
        },
        onChange(
            biz: string | null,
            callback: (bizId: string, type: TaskChangeType) => void,
        ) {
            taskChangeListeners.push({ biz, callback });
        },
        offChange(
            biz: string | null,
            callback: (bizId: string, type: TaskChangeType) => void,
        ) {
            const index = taskChangeListeners.findIndex(
                (v) => v.biz === biz && v.callback === callback,
            );
            taskChangeListeners.splice(index, 1);
        },
        fireChange(record: Partial<TaskRecord>, type: TaskChangeType) {
            taskChangeListeners.forEach((v) => {
                if (null === v.biz || v.biz === record.biz) {
                    v.callback(record.bizId as string, type);
                }
            });
        },
        requestCancel(biz: string, bizId: string) {
            this.cancelMap[`${biz}-${bizId}`] = {
                expire: TimeUtil.timestampMS() + 60 * 60 * 1000,
            };
            this.fireChange({ biz, bizId }, "requestCancel");
            if (this.bizMap[biz]?.requestCancelFunc) {
                this.bizMap[biz]?.requestCancelFunc?.(bizId, {}).catch((e) => {
                    $mapi.log
                        .error("Task.RequestCancelFunc.Error", e.toString())
                        .then();
                });
            }
        },
        shouldCancel(biz: string, bizId: string) {
            // expire old
            for (const key in this.cancelMap) {
                if (this.cancelMap[key].expire < TimeUtil.timestampMS()) {
                    delete this.cancelMap[key];
                }
            }
            if (!!this.cancelMap[`${biz}-${bizId}`]) {
                delete this.cancelMap[`${biz}-${bizId}`];
                return true;
            }
            return false;
        },
        async dispatch(
            biz: string,
            bizId: string,
            bizParam?: any,
            param?: object,
        ) {
            await this.waitInit();
            if (!this.bizMap[biz]) {
                throw new Error("TaskBizNotFound");
            }
            param = Object.assign(
                {
                    timeout: 24 * 60 * 60 * 1000,
                    queryInterval: 5 * 1000,
                    status: "queue",
                    runStart: 0,
                },
                param,
            );
            const taskRecord = {
                id: `${biz}-${Date.now()}-${StringUtil.random(8)}`,
                status: param["status"],
                msg: "",
                biz,
                bizId,
                bizParam,
                runStart: param["runStart"],
                runAfter: 0,
                runCalling: false,
                queryAfter: 0,
                queryInterval: param["queryInterval"],
                queryCalling: false,
                successCalling: false,
                timeout: param["timeout"],
            } as TaskRecord;
            this.records.push(taskRecord);
            this._run(true);
        },
        async sync() {
            await this.waitInit();
            const savedRecords = toRaw(cloneDeep(this.records));
            savedRecords.forEach((record) => {
                // record.status = undefined
                // record.runtime = undefined
            });
            await $mapi.storage.set("task", "records", savedRecords);
        },
    },
});

export const task = taskStore(store);
task.init().then();

export const useTaskStore = () => {
    return task;
};
