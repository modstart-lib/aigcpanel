import {TimeUtil} from "../lib/util";
import {TaskChangeType, useTaskStore} from "../store/modules/task";
import {groupThrottle} from "../lib/groupThrottle";
import {t} from "../lang";

const taskStore = useTaskStore();

export type TaskBiz =
    | never
    | "SoundGenerate"
    | "SoundAsr"
    | "VideoGen"
    // sound apps
    | "LongTextTts"
    | "SubtitleTts"
    | "SoundReplace"
    // video apps
    | "TextToImage"
    | "ImageToImage"
    | "VideoGenFlow";

export type TaskJobResultStepStatus = undefined | "queue" | "pending" | "running" | "success" | "fail";

export enum TaskType {
    User = 1,
    System = 2,
}

export type TaskRecord<MODEL_CONFIG extends any = any, JOB_RESULT extends any = any> = {
    id?: number;

    biz: TaskBiz;
    type?: TaskType;

    title: string;

    status?: "queue" | "wait" | "running" | "success" | "fail" | "pause";
    statusMsg?: string;
    startTime?: number;
    endTime?: number | undefined;

    serverName: string;
    serverTitle: string;
    serverVersion: string;

    param?: any;
    jobResult?: JOB_RESULT;
    modelConfig?: MODEL_CONFIG;
    result?: {
        percent: number
    } & any;

    runtime?: TaskRuntime;
};

export type TaskRuntime = {
    [key: string]: any;
};

// deep merge two object, newData has higher priority
// if value is array, replace it directly
const mergeData = (oldData: any, newData: any) => {
    if (typeof oldData !== "object" || oldData === null) {
        return newData;
    }
    if (typeof newData !== "object" || newData === null) {
        return newData;
    }
    const result = {};
    for (const key in oldData) {
        if (key in newData) {
            if (Array.isArray(newData[key])) {
                result[key] = newData[key];
            } else if (typeof newData[key] === "object" && newData[key] !== null) {
                result[key] = mergeData(oldData[key], newData[key]);
            } else {
                result[key] = newData[key];
            }
        } else {
            result[key] = oldData[key];
        }
    }
    for (const key in newData) {
        if (!(key in oldData)) {
            result[key] = newData[key];
        }
    }
    return result;
};

type CleanerFunctionType = (record: TaskRecord) => Promise<{
    files: string[];
}>;

const cleanersMap = new Map<TaskBiz, CleanerFunctionType>();

export const TaskService = {
    tableName() {
        return "data_task";
    },
    registerCleaner(biz: TaskBiz, cleaner: CleanerFunctionType) {
        cleanersMap.set(biz, cleaner);
    },
    decodeRecord(record: TaskRecord): TaskRecord | null {
        if (!record) {
            return null;
        }
        return {
            ...record,
            param: JSON.parse(record.param ? record.param : "{}"),
            jobResult: JSON.parse(record.jobResult ? record.jobResult : "{}"),
            modelConfig: JSON.parse(record.modelConfig ? record.modelConfig : "{}"),
            result: JSON.parse(record.result ? record.result : "{}"),
        } as TaskRecord;
    },
    encodeRecord(record: TaskRecord): TaskRecord {
        if ("param" in record) {
            record.param = JSON.stringify(record.param || {});
        }
        if ("jobResult" in record) {
            record.jobResult = JSON.stringify(record.jobResult || {});
        }
        if ("modelConfig" in record) {
            record.modelConfig = JSON.stringify(record.modelConfig || {});
        }
        if ("result" in record) {
            record.result = JSON.stringify(record.result || {});
        }
        return record;
    },
    async get(id: number | string): Promise<TaskRecord | null> {
        const record: any = await window.$mapi.db.first(
            `SELECT *
             FROM ${this.tableName()}
             WHERE id = ?`,
            [id]
        );
        return this.decodeRecord(record);
    },
    async list(biz: TaskBiz, type: TaskType = TaskType.User): Promise<TaskRecord[]> {
        const records: TaskRecord[] = await window.$mapi.db.select(
            `SELECT *
             FROM ${this.tableName()}
             WHERE biz = ?
               AND type = ?
             ORDER BY id DESC`,
            [biz, type]
        );
        return records.map(this.decodeRecord) as TaskRecord[];
    },
    async listByStatus(
        biz: TaskBiz,
        statusList: ("queue" | "wait" | "running" | "success" | "fail")[]
    ): Promise<TaskRecord[]> {
        if (!statusList || statusList.length === 0) {
            return [];
        }
        const records: TaskRecord[] = await window.$mapi.db.select(
            `SELECT *
             FROM ${this.tableName()}
             WHERE biz = ?
               AND status IN (${statusList.map(() => "?").join(",")})
             ORDER BY id DESC`,
            [biz, ...statusList]
        );
        return records.map(this.decodeRecord) as TaskRecord[];
    },
    async restoreForTask(biz: TaskBiz) {
        const records: TaskRecord[] = await window.$mapi.db.select(
            `SELECT *
             FROM ${this.tableName()}
             WHERE biz = ?
               AND (status = 'running' OR status = 'wait' OR status = 'queue')
             ORDER BY id DESC`,
            [biz]
        );
        // console.log('TaskService.restoreForTask', records.length)
        for (let record of records) {
            await taskStore.dispatch(
                record.biz,
                record.id as any,
                {},
                {
                    status: "queue",
                    runStart: record.startTime,
                    queryInterval: 5 * 1000,
                }
            );
        }
    },
    async submit(record: TaskRecord) {
        record.status = "queue";
        record.startTime = TimeUtil.timestampMS();
        const fields = [
            "biz",
            "type",
            "title",
            "status",
            "statusMsg",
            "startTime",
            "endTime",
            "serverName",
            "serverTitle",
            "serverVersion",
            "param",
            "modelConfig",
        ];
        if (!("type" in record)) {
            record.type = TaskType.User;
        }
        record = this.encodeRecord(record);
        const values = fields.map(f => record[f]);
        const valuesPlaceholder = fields.map(f => "?");
        const id = await window.$mapi.db.insert(
            `INSERT INTO ${this.tableName()} (${fields.join(",")})
             VALUES (${valuesPlaceholder.join(",")})`,
            values
        );
        await taskStore.dispatch(
            record.biz,
            id,
            {},
            {
                queryInterval: 5 * 1000,
            }
        );
        return id;
    },
    updatePercent: groupThrottle(async (id: string, percent: number) => {
        // console.log('TaskService.updatePercent', {id, percent});
        const {updates, biz} = await TaskService.update(id, {result: {percent}});
        taskStore.fireChange({
            biz: biz!, bizId: id,
        }, 'change');
    }, 3000, {
        trailing: true,
    }),
    cancelCheck: (biz: TaskBiz, bizId: string) => {
        if (taskStore.shouldCancel(biz, bizId)) {
            throw t('task.cancelled');
        }
    },
    updateDelayAndFireChange: groupThrottle(async (
        id: string,
        record: Partial<TaskRecord>,
        fireChangeType: TaskChangeType = "running",
        option?: {
            mergeResult?: boolean;
        }
    ) => {
        const {updates, biz} = await TaskService.update(id, record, option);
        taskStore.fireChange({biz: biz!, bizId: id}, fireChangeType);
    }, 1000, {
        trailing: true,
    }),
    async update(
        id: number | string,
        record: Partial<TaskRecord>,
        option?: {
            mergeResult?: boolean;
        }
    ): Promise<{
        updates: number,
        biz: string | null,
    }> {
        option = Object.assign(
            {
                mergeResult: true,
            },
            option
        );
        let recordOld: TaskRecord | null = null;
        if ("result" in record || "jobResult" in record || "startTime" in record) {
            recordOld = await this.get(id);
            if (option.mergeResult) {
                if ("result" in record) {
                    record.result = mergeData(recordOld?.result, record.result);
                }
                if ("jobResult" in record) {
                    record.jobResult = mergeData(recordOld?.jobResult, record.jobResult);
                }
            }
        }
        record = this.encodeRecord(record as TaskRecord);
        const fields = Object.keys(record);
        const values = fields.map(f => record[f]);
        const set = fields.map(f => `${f} = ?`).join(",");
        const updates = await window.$mapi.db.execute(
            `UPDATE ${this.tableName()}
             SET ${set}
             WHERE id = ?`,
            [...values, id]
        );
        return {
            updates,
            biz: recordOld ? recordOld.biz : null,
        }
    },
    async delete(record: TaskRecord) {
        const filesForClean: string[] = [];
        if (record.result) {
            // collection files from result
            for (const k in record.result) {
                if (record.result[k] && typeof record.result[k] === "string") {
                    if (await window.$mapi.file.isHubFile(record.result[k])) {
                        filesForClean.push(record.result[k]);
                    }
                }
            }
        }
        const cleaner = cleanersMap.get(record.biz);
        if (cleaner) {
            const {files} = await cleaner(record);
            if (files && files.length > 0) {
                filesForClean.push(...files);
            }
        }
        for (const file of filesForClean) {
            await window.$mapi.file.deletes(file);
        }
        await window.$mapi.db.delete(
            `DELETE
             FROM ${this.tableName()}
             WHERE id = ?`,
            [record.id]
        );
    },
    async count(
        biz: TaskBiz | null,
        startTime: number = 0,
        endTime: number = 0,
        type: TaskType = TaskType.User
    ): Promise<number> {
        let sql = `SELECT COUNT(*) as cnt
                   FROM ${this.tableName()}`;
        const params: any[] = [];
        const wheres: string[] = [];
        if (biz) {
            wheres.push("biz = ?");
            params.push(biz);
        }
        if (startTime > 0) {
            wheres.push("createdAt >= ?");
            params.push(startTime);
        }
        if (endTime > 0) {
            wheres.push("createdAt <= ?");
            params.push(endTime);
        }
        wheres.push("type = ?");
        params.push(type);
        if (wheres.length > 0) {
            sql += " WHERE " + wheres.join(" AND ");
        }
        const result = await window.$mapi.db.first(sql, params);
        return result.cnt;
    },
};
