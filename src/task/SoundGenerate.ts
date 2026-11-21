import { DataService } from "../service/DataService";
import { TaskService } from "../service/TaskService";
import { useServerStore } from "../store/modules/server";
import { TaskBiz } from "../store/modules/task";
import { replaceSoundGenerateText } from "../lib/server";

const serverStore = useServerStore();

export const SoundGenerate: TaskBiz = {
    runFunc: async (bizId, bizParam) => {
        // console.log('SoundClone.runFunc', {bizId, bizParam})
        const { record, server, serverInfo } = await serverStore.prepareForTask(
            bizId,
            bizParam,
        );
        // console.log('runFunc', serverInfo, record)
        await TaskService.update(bizId, {
            status: "running",
        });
        let res;
        if (record.modelConfig.type === "SoundTts") {
            // {"type":"SoundTts","ttsServerKey":"server-cosyvoice|0.6.0","ttsParam":{"speaker":"中文女","speed":1},"text":"你好"}
            res = await serverStore.call(serverInfo, "soundTts", {
                id: serverStore.generateTaskId(record.modelConfig.type, bizId),
                result: record.result,
                param: record.modelConfig.ttsParam,
                text: await replaceSoundGenerateText(record.modelConfig.text),
            });
        } else {
            res = await serverStore.call(serverInfo, "soundClone", {
                id: serverStore.generateTaskId(record.modelConfig.type, bizId),
                result: record.result,
                param: record.modelConfig.cloneParam,
                text: await replaceSoundGenerateText(record.modelConfig.text),
                promptAudio: record.modelConfig.promptUrl,
                promptText: record.modelConfig.promptText,
            });
        }
        if (res.code) {
            throw res.msg || "SoundGenerate fail";
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
                url: await DataService.saveFile(record.jobResult.data.data.url),
            },
        });
    },
    failFunc: async (bizId, msg, bizParam) => {
        // console.log('SoundClone.failFunc', {bizId, bizParam, msg})
        // const {record, server} = await prepareData(bizId, bizParam)
        await TaskService.update(bizId, {
            status: "fail",
            statusMsg: msg,
            endTime: Date.now(),
        });
    },
};
