import { serverTextToVideo } from "../../../lib/server";
import {
    TaskRecord,
    TaskService,
    TaskType,
} from "../../../service/TaskService";
import { useServerStore } from "../../../store/modules/server";
import { TaskBiz, useTaskStore } from "../../../store/modules/task";
import { TextToVideoJobResultType, TextToVideoModelConfigType } from "./type";

import { createTaskRunResult } from "../common/lib";
import { TaskRunResult } from "../common/type";

const serverStore = useServerStore();
const taskStore = useTaskStore();

export const TextToVideoRun = async (data: {
    taskId: string;
    title: string;
    prompt: string;
    textToVideo: TextToVideoParamType;
}): Promise<{
    taskId: string;
    result: () => Promise<TaskRunResult>;
}> => {
    console.log("TextToVideo.Run", data);
    let taskId = data.taskId;
    if (!taskId) {
        const record: TaskRecord = {
            type: TaskType.System,
            biz: "TextToVideo",
            title: data.title,
            serverName: "",
            serverTitle: "",
            serverVersion: "",
            modelConfig: {
                prompt: data.prompt,
                textToVideo: data.textToVideo,
            },
            param: {},
        };
        taskId = await TaskService.submit(record);
    }
    return {
        taskId,
        result: await createTaskRunResult(taskId, (resultData, task) => {
            resultData.video = task.result?.url;
        }),
    };
};

export const TextToVideoCleaner = async (task: TaskRecord) => {
    const files: string[] = [];
    const jobResult: TextToVideoJobResultType = task.jobResult;
    if (jobResult.Generate) {
        if (jobResult.Generate.video) {
            files.push(jobResult.Generate.video);
        }
    }
    return {
        files,
    };
};

export const TextToVideo: TaskBiz = {
    runFunc: async (bizId, bizParam) => {
        console.log("TextToVideo.runFunc", { bizId, bizParam });
        const { record } = await serverStore.prepareForTask(bizId, bizParam);
        const modelConfig: TextToVideoModelConfigType = record.modelConfig;
        const jobResult: TextToVideoJobResultType = record.jobResult;

        jobResult.step = jobResult.step || "Prepare";
        jobResult.Prepare = jobResult.Prepare || { status: "queue" };
        jobResult.Generate = jobResult.Generate || { status: "queue" };

        if (jobResult.step === "Prepare") {
            console.log("TextToVideo.Prepare", jobResult);
            jobResult.Prepare.status = "running";
            await TaskService.update(bizId, {
                status: "running",
                jobResult,
            });
            taskStore.fireChange({ biz: "TextToVideo", bizId }, "running");

            jobResult.step = "Generate";
            jobResult.Prepare.status = "success";
            await TaskService.update(bizId, { jobResult });
        }

        if (jobResult.step === "Generate") {
            console.log("TextToVideo.Generate", jobResult);
            jobResult.Generate.status = "running";
            await TaskService.update(bizId, {
                jobResult,
                status: "running",
            });
            taskStore.fireChange({ biz: "TextToVideo", bizId }, "running");

            const ret = await serverTextToVideo(
                "TextToVideo",
                bizId,
                modelConfig.textToVideo,
                record.result,
                modelConfig.prompt,
                {
                    cache: false,
                },
            );
            if (ret.type === "retry") {
                return ret.type;
            }
            jobResult.Generate.video = await $mapi.file.hubSave(ret.url);
            jobResult.step = "End";
            jobResult.Generate.status = "success";
            await TaskService.update(bizId, { jobResult });
        }

        if (jobResult.step === "End") {
            console.log("TextToVideo.End", jobResult);
            return "success";
        }

        throw `TextToVideo.runFunc: unknown jobResult.step: ${jobResult.step}`;
    },
    successFunc: async (bizId, bizParam) => {
        const { record } = await serverStore.prepareForTask(bizId, bizParam);
        const jobResult: TextToVideoJobResultType = record.jobResult;
        if (jobResult.step === "End") {
            if (jobResult.Generate.video) {
                await TaskService.update(bizId, {
                    status: "success",
                    endTime: Date.now(),
                    result: {
                        url: await $mapi.file.hubSave(jobResult.Generate.video),
                    },
                });
            } else {
                $mapi.log.error(
                    "TextToVideo.successFunc: no image in jobResult.Generate",
                );
            }
        } else {
            $mapi.log.error(
                "TextToVideo.successFunc: unknown jobResult.step",
                jobResult.step,
            );
        }
    },
    failFunc: async (bizId, msg, bizParam) => {
        await TaskService.update(bizId, {
            status: "fail",
            statusMsg: msg,
            endTime: Date.now(),
        });
    },
    update: async (bizId, data, bizParam) => {
        console.log("TextToVideo.update", { bizId, data, bizParam });
    },
};
