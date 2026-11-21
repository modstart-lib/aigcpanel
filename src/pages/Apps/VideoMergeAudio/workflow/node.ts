import { defineAsyncComponent } from "vue";
import AppIcon from "~icons/mdi/music-note-plus";
import { t } from "../../../../lang";
import {
    NodeFunctionCall,
    NodeRunController,
    NodeRunParam,
    NodeRunResult,
} from "../../../../module/Workflow/core/type";
import { workflowRun } from "../../common/workflow";
import { VideoMergeAudioRun } from "../task";

export default <NodeFunctionCall>{
    name: "VideoMergeAudio",
    title: t("workflow.videoMergeAudioTitle"),
    description: t("workflow.videoMergeAudioDesc"),
    icon: AppIcon,
    comp: defineAsyncComponent(() => import("./VideoMergeAudioNode.vue")),
    inputFields: [
        {
            type: "file",
            name: "Video",
            fileExtensions: ["mp4"],
        },
        {
            type: "file",
            name: "Audio",
            fileExtensions: ["mp3", "wav"],
        },
    ],
    outputFields: [
        {
            type: "file",
            name: "Video",
            fileExtensions: ["mp4"],
        },
    ],
    async run(
        controller: NodeRunController,
        param: NodeRunParam,
    ): Promise<NodeRunResult> {
        console.log("VideoMergeAudio run", param);
        return workflowRun(
            controller,
            param,
            async () => {
                const volume = param.node.properties?.data?.volume || 1.0;
                const loopAudio =
                    param.node.properties?.data?.loopAudio || false;
                const fadeInTime = param.node.properties?.data?.fadeInTime || 0;
                const fadeOutTime =
                    param.node.properties?.data?.fadeOutTime || 0;
                const taskRunData = {
                    taskId: param.runData?.["taskId"] || "",
                    video: param.runInputs["Video"],
                    audio: param.runInputs["Audio"],
                    title: param.node.properties?.title + "-" + param.node.id,
                    volume: volume,
                    loopAudio: loopAudio,
                    fadeInTime: fadeInTime,
                    fadeOutTime: fadeOutTime,
                };
                if (!taskRunData.video) {
                    throw t("error.videoParamError");
                }
                if (!taskRunData.audio) {
                    throw t("error.audioParamError");
                }
                return await VideoMergeAudioRun(taskRunData);
            },
            async (result, data) => {
                result.runOutputs["Video"] = data.video;
            },
        );
    },
    async check(node) {
        if (!node.properties?.data?.volume) {
            throw t("error.inputVolumeParam");
        }
        if (node.properties?.inputFields?.[0].value === "") {
            throw t("error.inputVideoParam");
        }
        if (node.properties?.inputFields?.[1].value === "") {
            throw t("error.inputAudioParam");
        }
    },
};
