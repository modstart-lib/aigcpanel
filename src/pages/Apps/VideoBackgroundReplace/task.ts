import { ffprobeVideoInfo } from "../../../lib/ffprobe";
import {
    TaskRecord,
    TaskService,
    TaskType,
} from "../../../service/TaskService";
import { useServerStore } from "../../../store/modules/server";
import { TaskBiz, useTaskStore } from "../../../store/modules/task";

import { createTaskRunResult } from "../common/lib";
import { TaskRunResult } from "../common/type";
import {
    VideoBackgroundReplaceJobResultType,
    VideoBackgroundReplaceModelConfigType,
} from "./type";
import { videoBackgroundReplaceExecute } from "./util";

const serverStore = useServerStore();
const taskStore = useTaskStore();

export const VideoBackgroundReplaceRun = async (data: {
    taskId: string;
    title: string;
    video: string;
    image: string;
    imageMode?: "cover" | "contain";
    keyColor?: string;
    similarity?: number;
    blend?: number;
    outputWidth?: number;
    outputHeight?: number;
}): Promise<{
    taskId: string;
    result: () => Promise<TaskRunResult>;
}> => {
    console.log("VideoBackgroundReplace.Run", data);
    let taskId = data.taskId;
    if (!taskId) {
        const record: TaskRecord = {
            type: TaskType.System,
            biz: "VideoBackgroundReplace",
            title: data.title,
            serverName: "",
            serverTitle: "",
            serverVersion: "",
            modelConfig: {
                video: data.video,
                image: data.image,
                imageMode: data.imageMode || "cover",
                keyColor: data.keyColor || "#00FF00",
                similarity: data.similarity ?? 0.3,
                blend: data.blend ?? 0.1,
                outputWidth: data.outputWidth || 0,
                outputHeight: data.outputHeight || 0,
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

export const VideoBackgroundReplaceCleaner = async (task: TaskRecord) => {
    const files: string[] = [];
    const jobResult: VideoBackgroundReplaceJobResultType = task.jobResult;
    if (jobResult.Render) {
        if (jobResult.Render.file) {
            files.push(jobResult.Render.file);
        }
    }
    return {
        files,
    };
};

export const VideoBackgroundReplace: TaskBiz = {
    runFunc: async (bizId, bizParam) => {
        console.log("VideoBackgroundReplace.runFunc", { bizId, bizParam });
        const { record } = await serverStore.prepareForTask(bizId, bizParam);
        const modelConfig: VideoBackgroundReplaceModelConfigType =
            record.modelConfig;
        const jobResult: VideoBackgroundReplaceJobResultType = record.jobResult;

        jobResult.step = jobResult.step || "Prepare";
        jobResult.Prepare = jobResult.Prepare || { status: "queue" };
        jobResult.Render = jobResult.Render || { status: "queue" };

        if (jobResult.step === "Prepare") {
            console.log("VideoBackgroundReplace.Prepare", jobResult);
            jobResult.Prepare.status = "running";
            await TaskService.update(bizId, {
                status: "running",
                jobResult,
            });
            taskStore.fireChange(
                { biz: "VideoBackgroundReplace", bizId },
                "running",
            );
            const { duration, width, height, fps } = await ffprobeVideoInfo(
                modelConfig.video,
            );
            jobResult.Prepare.duration = duration;
            jobResult.Prepare.width = width;
            jobResult.Prepare.height = height;
            jobResult.Prepare.fps = fps;
            jobResult.step = "Render";
            jobResult.Prepare.status = "success";
            await TaskService.update(bizId, { jobResult });
        }

        if (jobResult.step === "Render") {
            console.log("VideoBackgroundReplace.Render", jobResult);
            jobResult.Render.status = "running";
            await TaskService.update(bizId, {
                status: "running",
                jobResult,
            });

            // 输出尺寸为 0 时跟随绿幕视频原始尺寸
            const outputWidth =
                modelConfig.outputWidth > 0
                    ? modelConfig.outputWidth
                    : jobResult.Prepare.width;
            const outputHeight =
                modelConfig.outputHeight > 0
                    ? modelConfig.outputHeight
                    : jobResult.Prepare.height;

            try {
                jobResult.Render.file = await videoBackgroundReplaceExecute(
                    modelConfig.video,
                    modelConfig.image,
                    {
                        bizId: bizId,
                        imageMode: modelConfig.imageMode || "cover",
                        keyColor: modelConfig.keyColor || "#00FF00",
                        similarity: modelConfig.similarity ?? 0.3,
                        blend: modelConfig.blend ?? 0.1,
                        outputWidth: outputWidth,
                        outputHeight: outputHeight,
                        videoWidth: jobResult.Prepare.width,
                        videoHeight: jobResult.Prepare.height,
                    },
                );
                jobResult.step = "End";
                jobResult.Render.status = "success";
                await TaskService.update(bizId, { jobResult });
                return "success";
            } catch (error) {
                console.error("VideoBackgroundReplace render error:", error);
                throw error;
            }
        }

        if (jobResult.step === "End") {
            console.log("VideoBackgroundReplace.End", jobResult);
            return "success";
        }

        throw `VideoBackgroundReplace.runFunc: unknown jobResult.step: ${jobResult.step}`;
    },
    successFunc: async (bizId, bizParam) => {
        const { record } = await serverStore.prepareForTask(bizId, bizParam);
        const jobResult: VideoBackgroundReplaceJobResultType = record.jobResult;
        if (jobResult.step === "End") {
            await TaskService.update(bizId, {
                status: "success",
                endTime: Date.now(),
                result: {
                    url: await $mapi.file.hubSave(jobResult.Render.file),
                },
            });
        } else {
            $mapi.log.error(
                "VideoBackgroundReplace.successFunc: unknown jobResult.step",
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
        console.log("VideoBackgroundReplace.update", { bizId, data, bizParam });
    },
};
