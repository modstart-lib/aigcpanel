/**
 * 退出前的「未完成任务」口径。
 *
 * 主进程在 before-quit 里用它决定能不能退出，渲染进程用同一套口径在退出面板里
 * 说明还有多少任务没跑完，避免两边各写一份 SQL 后慢慢走偏。
 */

export type QuitTaskCount = {
    /** 正在执行的任务（含云端任务与查询中的任务） */
    running: number;
    /** 排队等待执行的任务：重启后会自动续跑，但产品上同样拦退出 */
    queued: number;
    /** 其中跑在云端模型上的任务数量（这类任务没有取消入口） */
    cloud: number;
};

export const QUIT_TASK_RUNNING_STATUSES = ["running"] as const;
/** wait 是历史数据状态，restoreForTask 仍会捞它，算作排队 */
export const QUIT_TASK_QUEUED_STATUSES = ["wait", "queue"] as const;
/**
 * 只统计用户任务（TaskType.User = 1）。
 * 工作流节点的子任务是另一批 type = 2 的行，同一份工作由 workflow_log 代表，
 * 不过滤会把一个工作流算成两个以上，也会让页面上看不见的系统任务把人卡住。
 */
export const QUIT_TASK_USER_TYPE = 1;
export const QUIT_WORKFLOW_RUNNING_STATUS = "running";

const sqlStatusList = (list: readonly string[]) =>
    list.map((status) => `'${status}'`).join(", ");

const allQuitTaskStatuses = [
    ...QUIT_TASK_RUNNING_STATUSES,
    ...QUIT_TASK_QUEUED_STATUSES,
] as readonly string[];

/**
 * data_task 的分组计数：运行中、排队、以及其中跑在云端模型上的数量。
 */
export const quitTaskCountQuery = (): { sql: string; params: any[] } => ({
    sql: `SELECT
            SUM(CASE WHEN status IN (${sqlStatusList(QUIT_TASK_RUNNING_STATUSES)}) THEN 1 ELSE 0 END) AS running,
            SUM(CASE WHEN status IN (${sqlStatusList(QUIT_TASK_QUEUED_STATUSES)}) THEN 1 ELSE 0 END) AS queued,
            SUM(CASE WHEN serverName LIKE 'Cloud%' THEN 1 ELSE 0 END) AS cloud
          FROM data_task
          WHERE type = ?
            AND status IN (${sqlStatusList(allQuitTaskStatuses)})`,
    params: [QUIT_TASK_USER_TYPE],
});

/**
 * 正在运行的工作流数量（workflow_log.status 只有 running 会被恢复，idle 是瞬时态）。
 */
export const quitWorkflowCountQuery = (): { sql: string; params: any[] } => ({
    sql: `SELECT COUNT(*) AS cnt
          FROM workflow_log
          WHERE status = '${QUIT_WORKFLOW_RUNNING_STATUS}'`,
    params: [],
});

const toCount = (value: any): number => {
    const num = Number(value);
    if (!Number.isFinite(num) || num <= 0) {
        return 0;
    }
    return Math.floor(num);
};

export const normalizeQuitTaskCount = (row: any): QuitTaskCount => ({
    running: toCount(row?.running),
    queued: toCount(row?.queued),
    cloud: toCount(row?.cloud),
});
