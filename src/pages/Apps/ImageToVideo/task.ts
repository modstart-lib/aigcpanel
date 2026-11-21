import { serverImageToVideo } from "../../../lib/server";
import {
    TaskRecord,
    TaskService,
    TaskType,
} from "../../../service/TaskService";
import { useServerStore } from "../../../store/modules/server";
import { TaskBiz, useTaskStore } from "../../../store/modules/task";
import { ImageToVideoJobResultType, ImageToVideoModelConfigType } from "./type";

import { createTaskRunResult } from "../common/lib";
import { TaskRunResult } from "../common/type";

const serverStore = useServerStore();
const taskStore = useTaskStore();

export const ImageToVideoRun = async (data: {
    taskId: string;
    title: string;
    images: string[];
    prompt: string;
    imageToVideo: ImageToVideoParamType;
}): Promise<{
    taskId: string;
    result: () => Promise<TaskRunResult>;
}> => {
    console.log("ImageToVideo.Run", data);
    let taskId = data.taskId;
    if (!taskId) {
        const record: TaskRecord = {
            type: TaskType.System,
            biz: "ImageToVideo",
            title: data.title,
            serverName: "",
            serverTitle: "",
            serverVersion: "",
            modelConfig: {
                images: data.images,
                prompt: data.prompt,
                imageToVideo: data.imageToVideo,
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

export const ImageToVideoCleaner = async (task: TaskRecord) => {
    const files: string[] = [];
    const jobResult: ImageToVideoJobResultType = task.jobResult;
    if (jobResult.Generate) {
        if (jobResult.Generate.video) {
            files.push(jobResult.Generate.video);
        }
    }
    return {
        files,
    };
};

export const ImageToVideo: TaskBiz = {
    runFunc: async (bizId, bizParam) => {
        console.log("ImageToVideo.runFunc", { bizId, bizParam });
        const { record } = await serverStore.prepareForTask(bizId, bizParam);
        const modelConfig: ImageToVideoModelConfigType = record.modelConfig;
        const jobResult: ImageToVideoJobResultType = record.jobResult;

        jobResult.step = jobResult.step || "Prepare";
        jobResult.Prepare = jobResult.Prepare || { status: "queue" };
        jobResult.Generate = jobResult.Generate || { status: "queue" };

        if (jobResult.step === "Prepare") {
            console.log("ImageToVideo.Prepare", jobResult);
            jobResult.Prepare.status = "running";
            await TaskService.update(bizId, {
                status: "running",
                jobResult,
            });
            taskStore.fireChange({ biz: "ImageToVideo", bizId }, "running");

            jobResult.step = "Generate";
            jobResult.Prepare.status = "success";
            await TaskService.update(bizId, { jobResult });
        }

        if (jobResult.step === "Generate") {
            console.log("ImageToVideo.Generate", jobResult);
            jobResult.Generate.status = "running";
            await TaskService.update(bizId, {
                jobResult,
                status: "running",
            });
            taskStore.fireChange({ biz: "ImageToVideo", bizId }, "running");

            const ret = await serverImageToVideo(
                "ImageToVideo",
                bizId,
                modelConfig.imageToVideo,
                record.result,
                modelConfig.prompt,
                modelConfig.images,
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
            console.log("ImageToVideo.End", jobResult);
            return "success";
        }

        throw `ImageToVideo.runFunc: unknown jobResult.step: ${jobResult.step}`;
    },
    successFunc: async (bizId, bizParam) => {
        const { record } = await serverStore.prepareForTask(bizId, bizParam);
        const jobResult: ImageToVideoJobResultType = record.jobResult;
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
                    "ImageToVideo.successFunc: no image in jobResult.Generate",
                );
            }
        } else {
            $mapi.log.error(
                "ImageToVideo.successFunc: unknown jobResult.step",
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
        console.log("ImageToVideo.update", { bizId, data, bizParam });
    },
};
