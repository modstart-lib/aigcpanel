import {
    TaskRecord,
    TaskService,
    TaskType,
} from "../../../service/TaskService";
import { useServerStore } from "../../../store/modules/server";
import { TaskBiz, useTaskStore } from "../../../store/modules/task";
import { FfmpegJobResultType, FfmpegModelConfigType } from "./type";
import { t } from "../../../lang";

import { createTaskRunResult } from "../common/lib";
import { TaskRunResult } from "../common/type";
import { ffmpegOutputSummary, findUnusableOutputs } from "./output";

const serverStore = useServerStore();
const taskStore = useTaskStore();

export const FfmpegRun = async (data: {
    taskId: string;
    title: string;
    input1: string;
    input2: string;
    input3: string;
    input4: string;
    input5: string;
    commands: string[];
}): Promise<{
    taskId: string;
    result: () => Promise<TaskRunResult>;
}> => {
    console.log("Ffmpeg.Run", data);
    let taskId = data.taskId;
    if (!taskId) {
        const record: TaskRecord = {
            type: TaskType.System,
            biz: "Ffmpeg",
            title: data.title,
            serverName: "",
            serverTitle: "",
            serverVersion: "",
            modelConfig: {
                input1: data.input1,
                input2: data.input2,
                input3: data.input3,
                input4: data.input4,
                input5: data.input5,
                commands: data.commands,
            },
            param: {},
        };
        taskId = await TaskService.submit(record);
    }
    return {
        taskId,
        result: await createTaskRunResult(taskId, (resultData, task) => {
            resultData.output1 = task.result?.output1 || "";
            resultData.output2 = task.result?.output2 || "";
            resultData.output3 = task.result?.output3 || "";
            resultData.output4 = task.result?.output4 || "";
            resultData.output5 = task.result?.output5 || "";
        }),
    };
};

// Size of a file, 0 when it is missing or cannot be read.
const outputFileSize = async (filePath: string): Promise<number> => {
    try {
        const info = await $mapi.file.stat(filePath);
        return info.size;
    } catch (e) {
        return 0;
    }
};

export const FfmpegCleaner = async (task: TaskRecord) => {
    const files: string[] = [];
    const jobResult: FfmpegJobResultType = task.jobResult;
    if (jobResult.Execute) {
        for (const key in jobResult.Prepare?.outputsMap) {
            const filePath = jobResult.Prepare?.outputsMap[key];
            if (filePath) {
                files.push(filePath);
            }
        }
    }
    return {
        files,
    };
};

export const Ffmpeg: TaskBiz = {
    runFunc: async (bizId, bizParam) => {
        console.log("Ffmpeg.runFunc", { bizId, bizParam });
        const { record } = await serverStore.prepareForTask(bizId, bizParam);
        const modelConfig: FfmpegModelConfigType = record.modelConfig;
        const jobResult: FfmpegJobResultType = record.jobResult;

        jobResult.step = jobResult.step || "Prepare";
        jobResult.Prepare = jobResult.Prepare || { status: "queue" };
        jobResult.Execute = jobResult.Execute || { status: "queue" };

        if (jobResult.step === "Prepare") {
            console.log("Ffmpeg.Prepare", jobResult);
            jobResult.Prepare.status = "running";
            jobResult.Prepare.inputsMap = {};
            jobResult.Prepare.outputsMap = {};
            jobResult.Prepare.commands = [];
            await TaskService.update(bizId, {
                status: "running",
                jobResult,
            });
            taskStore.fireChange({ biz: "Ffmpeg", bizId }, "running");
            for (const command of modelConfig.commands) {
                let c = command.trim();
                // match {input1:ext} , extract input index and extension
                const regex = /\{(input|output)(\d+)(?::([a-zA-Z0-9]+))?}/g;
                let match;
                while ((match = regex.exec(c)) !== null) {
                    const type = match[1]; // input or output
                    const index = parseInt(match[2]); // 1-5
                    const ext = match[3] || ""; // extension
                    let filePath = "";
                    if (type === "input") {
                        filePath = (modelConfig[
                            `input${index}` as keyof FfmpegModelConfigType
                        ] || "") as string;
                        jobResult.Prepare.inputsMap[`{input${index}}`] =
                            filePath;
                    } else if (type === "output") {
                        filePath = await $mapi.file.temp(ext || "bin");
                        jobResult.Prepare.outputsMap[`{output${index}}`] =
                            filePath;
                    }
                    c = c.replace(match[0], filePath);
                }
                jobResult.Prepare.commands.push(c);
            }
            jobResult.step = "Execute";
            jobResult.Prepare.status = "success";
            await TaskService.update(bizId, { jobResult });
        }

        if (jobResult.step === "Execute") {
            console.log("Ffmpeg.Execute", jobResult);
            jobResult.Execute.status = "running";
            await TaskService.update(bizId, {
                status: "running",
                jobResult,
            });
            try {
                let execOutput = "";
                try {
                    execOutput = await $mapi.app.spawnBinary(
                        "ffmpeg",
                        jobResult.Prepare.commands,
                    );
                } catch (error) {
                    const reason = ffmpegOutputSummary(error);
                    throw new Error(
                        reason
                            ? `${t("error.ffmpegRunFailed")}: ${reason}`
                            : t("error.ffmpegRunFailed"),
                    );
                }
                // ffmpeg can exit with code 0 and still leave a missing or
                // empty file (for example when the output cannot be written),
                // which used to be reported as success.
                const unusableOutputs = await findUnusableOutputs(
                    jobResult.Prepare.outputsMap,
                    outputFileSize,
                );
                if (unusableOutputs.length > 0) {
                    const reason = ffmpegOutputSummary(execOutput);
                    throw new Error(
                        `${t("error.ffmpegOutputMissing")}: ${unusableOutputs.join(", ")}` +
                            (reason ? ` (${reason})` : ""),
                    );
                }
                jobResult.step = "End";
                jobResult.Execute.status = "success";
                await TaskService.update(bizId, { jobResult });
                return "success";
            } catch (error) {
                console.error("Ffmpeg execute error:", error);
                throw error;
            }
        }

        if (jobResult.step === "End") {
            console.log("Ffmpeg.End", jobResult);
            return "success";
        }

        throw `Ffmpeg.runFunc: unknown jobResult.step: ${jobResult.step}`;
    },
    successFunc: async (bizId, bizParam) => {
        const { record } = await serverStore.prepareForTask(bizId, bizParam);
        const jobResult: FfmpegJobResultType = record.jobResult;
        if (jobResult.step === "End") {
            const result: Record<string, string> = {};
            result.output1 = jobResult.Prepare.outputsMap["{output1}"] || "";
            result.output2 = jobResult.Prepare.outputsMap["{output2}"] || "";
            result.output3 = jobResult.Prepare.outputsMap["{output3}"] || "";
            result.output4 = jobResult.Prepare.outputsMap["{output4}"] || "";
            result.output5 = jobResult.Prepare.outputsMap["{output5}"] || "";
            if (result.output1) {
                result.output1 = await $mapi.file.hubSave(result.output1);
            }
            if (result.output2) {
                result.output2 = await $mapi.file.hubSave(result.output2);
            }
            if (result.output3) {
                result.output3 = await $mapi.file.hubSave(result.output3);
            }
            if (result.output4) {
                result.output4 = await $mapi.file.hubSave(result.output4);
            }
            if (result.output5) {
                result.output5 = await $mapi.file.hubSave(result.output5);
            }
            await TaskService.update(bizId, {
                status: "success",
                endTime: Date.now(),
                result: result,
            });
        } else {
            $mapi.log.error(
                "Ffmpeg.successFunc: unknown jobResult.step",
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
        console.log("Ffmpeg.update", { bizId, data, bizParam });
    },
};
