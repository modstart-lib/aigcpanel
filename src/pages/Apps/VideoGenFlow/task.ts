import { DataService } from "../../../service/DataService";
import { TaskService } from "../../../service/TaskService";
import { useServerStore } from "../../../store/modules/server";
import { TaskBiz } from "../../../store/modules/task";
import { VideoGenFlowJobResultType, VideoGenFlowModelConfigType } from "./type";
import { replaceSoundGenerateText } from "../../../lib/server";

const serverStore = useServerStore();

const prepareData = async (bizId: string, bizParam: any) => {
    const { record, server, serverInfo } = await serverStore.prepareForTask(
        bizId,
        bizParam,
    );
    const modelConfig: VideoGenFlowModelConfigType = record.modelConfig;
    const soundGenerateServer = await serverStore.getByNameVersion(
        modelConfig.soundGenerate.serverName,
        modelConfig.soundGenerate.serverVersion,
    );
    if (!soundGenerateServer) {
        throw new Error("soundGenerateServer not found");
    }
    const soundGenerateServerInfo =
        await serverStore.serverInfo(soundGenerateServer);
    return {
        record,
        server,
        serverInfo,
        soundGenerateServer,
        soundGenerateServerInfo,
    };
};

export const VideoGenFlow: TaskBiz = {
    runFunc: async (bizId, bizParam) => {
        // console.log('VideoGenFlow.runFunc', {bizId, bizParam})
        const { record, serverInfo, soundGenerateServerInfo } =
            await prepareData(bizId, bizParam);
        const modelConfig: VideoGenFlowModelConfigType = record.modelConfig;
        const jobResult: VideoGenFlowJobResultType = record.jobResult;
        // console.log('VideoGenFlow.runFunc.record', {record, server, soundTtsServer, soundCloneServer})
        // const videoServerInfo = await serverStore.serverInfo(server)
        // console.log('VideoGenFlow.runFunc.serverInfoc', serverInfo)
        // 初始化处理步骤：重试时从上次中断的步骤继续，避免重复生成配音。
        // runFunc 会在视频服务忙时被反复重试，如果每次都从头生成配音，
        // 会持续占用声音服务并拖垮视频合成，提交任务越多越慢。
        jobResult.step = jobResult.step || "SoundGenerate";
        jobResult.SoundGenerate = jobResult.SoundGenerate || {
            status: "queue",
            type: modelConfig.soundGenerate.type,
            url: "",
        };
        jobResult.VideoGen = jobResult.VideoGen || {
            status: "queue",
            result: null as any,
        };

        if (jobResult.step === "SoundGenerate") {
            jobResult.SoundGenerate.status = "running";
            await TaskService.update(bizId as any, {
                status: "running",
                jobResult,
            });
            let audioFilePath: string | null = null;
            if (modelConfig.soundGenerate.type === "SoundTts") {
                const res = await serverStore.call(
                    soundGenerateServerInfo,
                    "soundTts",
                    {
                        id: serverStore.generateTaskId("VideoGenFlow", bizId),
                        result: record.result,
                        param: modelConfig.soundGenerate.ttsParam,
                        text: await replaceSoundGenerateText(modelConfig.text),
                    },
                    {
                        taskIdResultKey: "soundTtsTaskId",
                    },
                );
                // console.log('VideoGenFlow.runFunc.soundTts.res', res)
                if (res.code) {
                    throw res.msg || "apiRequest videoGenFlow.soundTts fail";
                }
                switch (res.data.type) {
                    case "success":
                        audioFilePath = res.data.data.url;
                        break;
                    case "retry":
                        return "retry";
                    default:
                        throw new Error("unknown res.data.type");
                }
            } else if (modelConfig.soundGenerate.type === "SoundClone") {
                const res = await serverStore.call(
                    soundGenerateServerInfo,
                    "soundClone",
                    {
                        id: serverStore.generateTaskId("VideoGenFlow", bizId),
                        result: record.result,
                        param: modelConfig.soundGenerate.cloneParam,
                        text: await replaceSoundGenerateText(modelConfig.text),
                        promptAudio: modelConfig.soundGenerate.promptUrl,
                        promptText: modelConfig.soundGenerate.promptText,
                    },
                    {
                        taskIdResultKey: "soundCloneTaskId",
                    },
                );
                // console.log('VideoGenFlow.runFunc.soundClone.res', res)
                if (res.code) {
                    throw res.msg || "apiRequest videoGenFlow.soundClone fail";
                }
                switch (res.data.type) {
                    case "success":
                        audioFilePath = res.data.data.url;
                        break;
                    case "retry":
                        return "retry";
                    default:
                        throw new Error("unknown res.data.type");
                }
            } else {
                throw new Error("unknown soundType");
            }
            if (!audioFilePath) {
                throw new Error("soundFilePath not found");
            }
            jobResult.SoundGenerate.url =
                await DataService.saveFile(audioFilePath);
            jobResult.SoundGenerate.status = "success";
            jobResult.step = "VideoGen";
            await TaskService.update(bizId as any, {
                jobResult,
                result: {
                    url: null,
                    urlSound: jobResult.SoundGenerate.url,
                },
            });
        }

        if (jobResult.step === "VideoGen") {
            jobResult.VideoGen.status = "running";
            await TaskService.update(bizId as any, {
                status: "running",
                jobResult,
            });
            const res = await serverStore.call(
                serverInfo,
                "videoGen",
                {
                    id: serverStore.generateTaskId("VideoGenFlow", bizId),
                    result: record.result,
                    param: record.param,
                    video: modelConfig.videoTemplateUrl,
                    audio: jobResult.SoundGenerate.url,
                },
                {
                    taskIdResultKey: "videoGenTaskId",
                },
            );
            // console.log('VideoGen.runFunc.res', res)
            if (res.code) {
                throw res.msg || "apiRequest videoGenFlow fail";
            }
            switch (res.data.type) {
                case "success":
                    jobResult.VideoGen.status = "success";
                    jobResult.VideoGen.result = res;
                    await TaskService.update(bizId as any, { jobResult });
                    return "success";
                case "retry":
                    return "retry";
                default:
                    throw new Error("unknown res.data.type");
            }
        }

        throw new Error(`unknown jobResult.step: ${jobResult.step}`);
    },
    successFunc: async (bizId, bizParam) => {
        // console.log('VideoGenFlow.successFunc', {bizId, bizParam})
        const { record } = await prepareData(bizId, bizParam);
        const jobResult: VideoGenFlowJobResultType = record.jobResult;
        // console.log('VideoGenFlow.successFunc.record', {record, server, soundTtsServer, soundCloneServer})
        await TaskService.update(bizId as any, {
            status: "success",
            endTime: Date.now(),
            result: {
                url: await DataService.saveFile(
                    jobResult.VideoGen.result.data.data.url,
                ),
            },
        });
    },
    failFunc: async (bizId, msg, bizParam) => {
        // console.log('VideoGenFlow.failFunc', {bizId, bizParam, msg})
        // const {record, server, soundTtsServer, soundCloneServer} = await prepareData(bizId, bizParam)
        await TaskService.update(bizId as any, {
            status: "fail",
            statusMsg: msg,
            endTime: Date.now(),
        });
    },
};
