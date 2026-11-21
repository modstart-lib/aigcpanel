import { t } from "../../../lang";
import { TaskService } from "../../../service/TaskService";
import { useServerStore } from "../../../store/modules/server";
import { TaskBiz } from "../../../store/modules/task";
import { collectHubResultFiles, hubSaveResultFiles } from "../common/lib";

const serverStore = useServerStore();

/**
 * 通用 ComfyUI 任务（工具"通用ComfyUI"）。
 * 调用平台端 ComfyUIServer.general：选择 biz=general 的通用工作流，
 * 按工作流 meta.json 的 param 渲染表单后调用，结果返回 {url, files}。
 */
export const GeneralComfyUI: TaskBiz = {
    runFunc: async (bizId, bizParam) => {
        const { record, serverInfo } = await serverStore.prepareForTask(
            bizId,
            bizParam,
        );
        await TaskService.update(bizId, {
            status: "running",
        });
        const res = await serverStore.call(serverInfo, "general", {
            id: serverStore.generateTaskId("GeneralComfyUI", bizId),
            result: record.result,
            param: record.modelConfig.param,
        });
        if (res.code) {
            throw res.msg || t("general.comfyui.runFail");
        }
        switch (res.data.type) {
            case "success":
                await TaskService.update(bizId, {
                    status: "success",
                    jobResult: res,
                });
                return "success";
            case "retry":
                return "retry";
            default:
                throw `unknown res.data.type : ${res.data.type}`;
        }
    },
    successFunc: async (bizId, bizParam) => {
        const { record } = await serverStore.prepareForTask(bizId, bizParam);
        // 结果文件（url / files）复制到软件自身存储（hub），
        // 避免 ComfyUI 服务目录清理后结果丢失；文字字段保持不变。
        const result = await hubSaveResultFiles(record.jobResult.data.data);
        await TaskService.update(bizId, {
            status: "success",
            endTime: Date.now(),
            result,
        });
    },
    failFunc: async (bizId, msg, bizParam) => {
        await TaskService.update(bizId, {
            status: "fail",
            statusMsg: msg,
            endTime: Date.now(),
        });
    },
};

// 删除任务时清理已归档到 hub 的结果文件
export const GeneralComfyUICleaner = async (task: any) => {
    return {
        files: await collectHubResultFiles(task.result),
    };
};
