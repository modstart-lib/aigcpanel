/**
 * 素材文件（形象、模板里的视频）删除前的保护。
 *
 * 这类视频只是任务的输入文件：任务真正执行时才按路径去读，排队中的任务还没读过。
 * 素材记录一删就把文件带走，排队 / 执行中的任务随后会在运行时失败。
 * 所以删素材前先数一下还有多少条未完成的任务在用它，有就拒绝删除并把数量交给界面提示。
 */
import {
    QUIT_TASK_QUEUED_STATUSES,
    QUIT_TASK_RUNNING_STATUSES,
} from "./quitGuard";

/**
 * `pause`：等待用户确认后仍会继续执行的任务（工具类 App 的中间确认），
 * 用户一确认就会去读输入文件，所以同样算「未完成」。
 */
const PAUSED_TASK_STATUSES = ["pause"] as const;

export type AssetDeleteResult = {
    deleted: boolean;
    /** 仍在使用该文件的未完成任务数；删除成功时为 0 */
    inUseTasks: number;
};

/**
 * 未完成任务中，`data_task.modelConfig` 引用了该文件的条数。
 *
 * 数字人合成的输入视频记在 `modelConfig.videoTemplateUrl` 里，随任务行一起持久化；
 * 不按 `type` 过滤，工作流节点的子任务同样会读这个文件。
 */
export const countUnfinishedTasksUsing = async (
    filePath: string | undefined | null,
): Promise<number> => {
    if (!filePath) {
        return 0;
    }
    const statuses = [
        ...QUIT_TASK_RUNNING_STATUSES,
        ...QUIT_TASK_QUEUED_STATUSES,
        ...PAUSED_TASK_STATUSES,
    ];
    const row = await window.$mapi.db.first(
        `SELECT COUNT(*) AS cnt
         FROM data_task
         WHERE status IN (${statuses.map(() => "?").join(",")})
           AND modelConfig LIKE ?`,
        [...statuses, `%${filePath.replace(/\\/g, "/")}%`],
    );
    return Number(row?.cnt || 0);
};

/**
 * 删除素材文件。只删 hub 目录里的文件，避免误删用户自己的路径；
 * 文件已被移走时静默跳过，让记录本身还能删掉。
 * 删除失败（文件被播放器 / 其他进程占用）时交给 hubDelete 后台重试，
 * 避免用户完全无感地留下一个孤儿文件。
 */
export const deleteAssetFile = async (
    filePath: string | undefined | null,
): Promise<void> => {
    if (!filePath) {
        return;
    }
    const normalFile = filePath.replace(/\\/g, "/");
    try {
        if (!(await window.$mapi.file.isHubFile(normalFile))) {
            return;
        }
        await window.$mapi.file.deletes(normalFile);
    } catch (e) {
        console.error("deleteAssetFile", normalFile, e);
        try {
            await window.$mapi.file.hubDelete(normalFile);
        } catch (e2) {
            console.error("deleteAssetFile.retry", normalFile, e2);
        }
    }
};
