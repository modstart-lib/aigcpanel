import { t } from "../../../lang";
import { TaskService } from "../../../service/TaskService";
import { useServerStore } from "../../../store/modules/server";
import { TaskBiz } from "../../../store/modules/task";
import { collectHubResultFiles, hubSaveResultFiles } from "../common/lib";

const serverStore = useServerStore();

/**
 * 通用模型任务（工具"通用模型"）。
 * 调用平台端 EasyServer.general：把表单参数（param）与能力名（funcName）
 * 透传给服务端，结果直接透传 stdout 返回的 json（字段名与 config.json
 * general[].result 的 name 对应，前端按 resultDef 解析展示）。
 */
export const GeneralModel: TaskBiz = {
    runFunc: async (bizId, bizParam) => {
        const { record, serverInfo } = await serverStore.prepareForTask(
            bizId,
            bizParam,
        );
        await TaskService.update(bizId, {
            status: "running",
        });
        const res = await serverStore.call(serverInfo, "general", {
            id: serverStore.generateTaskId("GeneralModel", bizId),
            result: record.result,
            param: record.modelConfig.param,
            funcName: record.modelConfig.funcName,
        });
        if (res.code) {
            throw res.msg || t("general.runFail");
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
        // 结果文件（file / files 类型字段）复制到软件自身存储（hub），
        // 避免模型服务目录删除后结果丢失；文字字段保持不变。
        const result = await hubSaveResultFiles(
            record.jobResult.data.data,
            (record.modelConfig as any)?.resultDef,
        );
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
export const GeneralModelCleaner = async (task: any) => {
    return {
        files: await collectHubResultFiles(task.result),
    };
};
