import { TaskService } from "../service/TaskService";
import { useServerStore } from "../store/modules/server";
import { TaskBiz } from "../store/modules/task";

const serverStore = useServerStore();

export const SoundAsr: TaskBiz = {
    runFunc: async (bizId, bizParam) => {
        const { record, server, serverInfo } = await serverStore.prepareForTask(
            bizId,
            bizParam,
        );
        await TaskService.update(bizId, {
            status: "running",
        });
        const res = await serverStore.call(serverInfo, "asr", {
            id: serverStore.generateTaskId("SoundAsr", bizId),
            result: record.result,
            param: record.param,
            audio: record.modelConfig.audio,
        });
        if (res.code) {
            throw res.msg || "SoundAsr run fail";
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
        await TaskService.update(bizId, {
            status: "success",
            endTime: Date.now(),
            result: {
                records: record.jobResult.data.data.records,
            },
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
