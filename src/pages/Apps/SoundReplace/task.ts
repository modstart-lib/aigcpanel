import { t } from "../../../lang";
import {
    ffmpegCombineVideoAudio,
    ffmpegMergeAudio,
    ffmpegVideoToAudio,
} from "../../../lib/ffmpeg";
import { ffprobeGetMediaDuration } from "../../../lib/ffprobe";
import { assertLocalFileExists } from "../../../lib/file";
import { serverSoundAsr, serverSoundGenerate } from "../../../lib/server";
import {
    subtitleGenerateRecords,
    subtitleGenerateSrtContent,
} from "../../../lib/subtitle";
import { ObjectUtil } from "../../../lib/util";
import {
    TaskRecord,
    TaskService,
    TaskType,
} from "../../../service/TaskService";
import { useServerStore } from "../../../store/modules/server";
import { TaskBiz, useTaskStore } from "../../../store/modules/task";
import { SoundReplaceJobResultType, SoundReplaceModelConfigType } from "./type";

import { createTaskRunResult } from "../common/lib";
import { TaskRunResult } from "../common/type";

const serverStore = useServerStore();
const taskStore = useTaskStore();

export const SoundReplaceRun = async (data: {
    taskId: string;
    title: string;
    video: string;
    soundAsr: SoundAsrParamType;
    soundGenerate: SoundGenerateParamType;
}): Promise<{
    taskId: string;
    result: () => Promise<TaskRunResult>;
}> => {
    console.log("SoundReplace.Run", data);
    let taskId = data.taskId;
    if (!taskId) {
        const record: TaskRecord = {
            type: TaskType.System,
            biz: "SoundReplace",
            title: data.title,
            serverName: "",
            serverTitle: "",
            serverVersion: "",
            modelConfig: {
                video: data.video,
                soundAsr: data.soundAsr,
                soundGenerate: data.soundGenerate,
            },
            param: {},
        };
        taskId = await TaskService.submit(record);
    }
    return {
        taskId,
        result: await createTaskRunResult(taskId, (resultData, task) => {
            resultData.video = task.result?.url;
            resultData.srt = task.result?.srt;
        }),
    };
};

export const SoundReplaceCleaner = async (task: TaskRecord) => {
    const files: string[] = [];
    const jobResult: SoundReplaceJobResultType = task.jobResult;
    if (jobResult.ToAudio) {
        if (jobResult.ToAudio.file) {
            files.push(jobResult.ToAudio.file);
        }
    }
    if (jobResult.SoundGenerate) {
        if (jobResult.SoundGenerate.records) {
            for (const r of jobResult.SoundGenerate.records) {
                if (r.audio) {
                    files.push(r.audio);
                }
            }
        }
    }
    if (jobResult.Combine) {
        if (jobResult.Combine.audio) {
            files.push(jobResult.Combine.audio);
        }
        if (jobResult.Combine.file) {
            files.push(jobResult.Combine.file);
        }
    }
    return {
        files,
    };
};

export const SoundReplace: TaskBiz = {
    runFunc: async (bizId, bizParam) => {
        console.log("SoundReplace.runFunc", { bizId, bizParam });
        const { record } = await serverStore.prepareForTask(bizId, bizParam);
        const modelConfig: SoundReplaceModelConfigType = record.modelConfig;
        const jobResult: SoundReplaceJobResultType = record.jobResult;

        jobResult.step = jobResult.step || "ToAudio";
        jobResult.ToAudio = jobResult.ToAudio || { status: "queue" };
        jobResult.SoundAsr = jobResult.SoundAsr || { status: "queue" };
        jobResult.Confirm = jobResult.Confirm || { status: "queue" };
        jobResult.SoundGenerate = jobResult.SoundGenerate || {
            status: "queue",
        };
        jobResult.Combine = jobResult.Combine || { status: "queue" };
        jobResult.CombineConfirm = jobResult.CombineConfirm || {
            status: "queue",
        };

        // The source video is read again by later steps (Combine rebuilds the
        // video from it), which can happen long after submission: the user may
        // have moved or deleted the file in the meantime. Fail right away with
        // a clear message instead of a cryptic ffprobe/ffmpeg error.
        if (
            ["ToAudio", "SoundAsr", "Combine"].includes(
                jobResult.step as string,
            )
        ) {
            await assertLocalFileExists(modelConfig.video, {
                message: "error.videoSourceFileNotExists",
            });
        }

        if (jobResult.step === "ToAudio") {
            console.log("SoundReplace.ToAudio", jobResult);
            jobResult.ToAudio.status = "running";
            await TaskService.update(bizId, {
                status: "running",
                jobResult,
            });
            taskStore.fireChange({ biz: "SoundReplace", bizId }, "running");
            const output = await ffmpegVideoToAudio(modelConfig.video);
            jobResult.ToAudio.file = await $mapi.file.hubSave(output);
            jobResult.step = "SoundAsr";
            jobResult.ToAudio.status = "success";
            await TaskService.update(bizId, { jobResult });
        }

        if (jobResult.step === "SoundAsr") {
            console.log("SoundReplace.SoundAsr", jobResult);
            jobResult.SoundAsr.status = "running";
            await TaskService.update(bizId, {
                status: "running",
                jobResult,
            });
            taskStore.fireChange({ biz: "SoundReplace", bizId }, "running");
            const ret = await serverSoundAsr(
                "SoundReplace",
                bizId,
                modelConfig.soundAsr,
                jobResult.SoundAsr,
                jobResult.ToAudio.file,
            );
            console.log("SoundReplace.SoundAsr.ret", ret);
            if (ret.type === "retry") {
                return ret.type;
            }
            jobResult.SoundAsr.start = ret.start;
            jobResult.SoundAsr.end = ret.end;
            jobResult.SoundAsr.duration = await ffprobeGetMediaDuration(
                modelConfig.video,
                true,
            );
            jobResult.SoundAsr.records = ret.records;
            await TaskService.update(bizId, { jobResult });
            jobResult.step = "Confirm";
            jobResult.SoundAsr.status = "success";
            await TaskService.update(bizId, { jobResult });
        }

        if (jobResult.step === "Confirm") {
            console.log("SoundReplace.Confirm", jobResult);
            jobResult.Confirm.status = "running";
            jobResult.Confirm.records = ObjectUtil.clone(
                jobResult.SoundAsr.records,
            );
            jobResult.SoundGenerate.records = null;
            jobResult.Confirm.status = "pending";
            await TaskService.update(bizId, { jobResult });
            return "success";
        }

        if (jobResult.step === "SoundGenerate") {
            console.log("SoundReplace.SoundGenerate", jobResult);
            jobResult.Confirm.status = "success";
            jobResult.SoundGenerate.status = "running";
            if (
                !jobResult.SoundGenerate.records ||
                !jobResult.SoundGenerate.records.length
            ) {
                jobResult.SoundGenerate.records = jobResult.Confirm.records.map(
                    (item) => ({
                        ...item,
                        audio: "",
                        actualStart: 0,
                        actualEnd: 0,
                    }),
                );
            }
            await TaskService.update(bizId, {
                jobResult,
                status: "running",
            });
            taskStore.fireChange({ biz: "SoundReplace", bizId }, "running");
            while (true) {
                let taskRecord = await TaskService.get(bizId as any);
                let i = -1;
                const recordsLength =
                    taskRecord!.jobResult.SoundGenerate.records.length;
                for (i = 0; i < recordsLength; i++) {
                    if (!taskRecord!.jobResult.SoundGenerate.records[i].audio) {
                        break;
                    }
                }
                if (i < 0 || i >= recordsLength) {
                    break;
                }
                const ret = await serverSoundGenerate(
                    "SoundReplace",
                    bizId,
                    modelConfig.soundGenerate,
                    {},
                    taskRecord!.jobResult.SoundGenerate.records[i].text,
                );
                if (ret.type === "retry") {
                    return ret.type;
                }
                taskRecord = await TaskService.get(bizId as any);
                // 可能被重置了
                if (
                    recordsLength !==
                    taskRecord!.jobResult.SoundGenerate.records.length
                ) {
                    continue;
                }
                taskRecord!.jobResult.SoundGenerate.records[i].audio =
                    await $mapi.file.hubSave(ret.url);
                await TaskService.update(bizId, {
                    jobResult: {
                        SoundGenerate: {
                            records:
                                taskRecord!.jobResult.SoundGenerate.records,
                        },
                    },
                });
                jobResult.SoundGenerate.records =
                    taskRecord!.jobResult.SoundGenerate.records;
            }
            jobResult.step = "Combine";
            jobResult.SoundGenerate.status = "success";
            await TaskService.update(bizId, { jobResult });
        }

        if (jobResult.step === "Combine") {
            console.log("SoundReplace.Combine", jobResult);
            jobResult.Combine.status = "running";
            jobResult.Combine.audio = "";
            jobResult.Combine.file = "";
            await TaskService.update(bizId, {
                status: "running",
                jobResult,
            });
            taskStore.fireChange({ biz: "SoundReplace", bizId }, "running");
            const videoDurationMs = await ffprobeGetMediaDuration(
                modelConfig.video,
                true,
            );
            const filesToClean: string[] = [];
            try {
                // 创建合并后的音频文件
                const { output, cleans, mergeRecords } = await ffmpegMergeAudio(
                    jobResult.SoundGenerate.records!,
                    videoDurationMs,
                );
                filesToClean.push(...cleans);
                jobResult.Combine.audio = await $mapi.file.hubSave(output);
                jobResult.SoundGenerate.records = mergeRecords;
                await TaskService.update(bizId, { jobResult });
                // 使用合并后的音频替换视频的音频轨道
                const url = await ffmpegCombineVideoAudio(
                    modelConfig.video,
                    jobResult.Combine.audio,
                );
                jobResult.Combine.file = await $mapi.file.hubSave(url);
                jobResult.step = "CombineConfirm";
                jobResult.Combine.status = "success";
                await TaskService.update(bizId, {
                    jobResult,
                });
            } catch (error) {
                throw error;
            } finally {
                await $mapi.file.clean(filesToClean, { isDataPath: false });
            }
        }

        if (jobResult.step === "CombineConfirm") {
            // user task auto confirm
            if (record.type === TaskType.System) {
                jobResult.CombineConfirm.status = "running";
                jobResult.CombineConfirm.status = "pending";
                await TaskService.update(bizId, {
                    jobResult,
                });
                return "success";
            }
            jobResult.CombineConfirm.status = "success";
            jobResult.step = "End";
            await TaskService.update(bizId, {
                jobResult,
            });
        }

        if (jobResult.step === "End") {
            console.log("SoundReplace.End", jobResult);
            return "success";
        }

        throw `SoundReplace.runFunc: unknown jobResult.step: ${jobResult.step}`;
    },
    successFunc: async (bizId, bizParam) => {
        const { record } = await serverStore.prepareForTask(bizId, bizParam);
        const jobResult: SoundReplaceJobResultType = record.jobResult;
        if (jobResult.step === "Confirm") {
            await TaskService.update(bizId, {
                status: "pause",
                statusMsg: t("error.taskNotComplete"),
            });
        } else if (jobResult.step === "CombineConfirm") {
            await TaskService.update(bizId, {
                status: "pause",
                statusMsg: t("error.taskNotCompleteFinal"),
            });
        } else if (jobResult.step === "End") {
            const subTitleRecords = subtitleGenerateRecords(
                jobResult.SoundGenerate.records!.map((o) => {
                    return {
                        ...o,
                        start: o.actualStart!,
                        end: o.actualEnd!,
                    };
                }),
            );
            const subTitleContent = subtitleGenerateSrtContent(subTitleRecords);
            await TaskService.update(bizId, {
                status: "success",
                endTime: Date.now(),
                result: {
                    url: await $mapi.file.hubSave(jobResult.Combine.file),
                    srt: await $mapi.file.hubSaveContent(subTitleContent, {
                        ext: "srt",
                    }),
                },
            });
        } else {
            $mapi.log.error(
                "SoundReplace.successFunc: unknown jobResult.step",
                jobResult.step,
            );
        }
    },
    failFunc: async (bizId, msg, bizParam) => {
        // console.log('SoundReplace.failFunc', {bizId, bizParam, msg})
        await TaskService.update(bizId, {
            status: "fail",
            statusMsg: msg,
            endTime: Date.now(),
        });
    },
    update: async (bizId, data, bizParam) => {
        console.log("SoundReplace.update", { bizId, data, bizParam });
    },
};
