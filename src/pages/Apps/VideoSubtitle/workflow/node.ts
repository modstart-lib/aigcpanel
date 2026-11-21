import { defineAsyncComponent } from "vue";
import AppIcon from "~icons/mdi/subtitles-outline";
import { t } from "../../../../lang";
import {
    NodeFunctionCall,
    NodeRunController,
    NodeRunParam,
    NodeRunResult,
} from "../../../../module/Workflow/core/type";
import { workflowRun } from "../../common/workflow";
import { VideoSubtitleRun } from "../task";

export default <NodeFunctionCall>{
    name: "VideoSubtitle",
    title: t("workflow.videoSubtitleTitle"),
    description: t("workflow.videoSubtitleDesc"),
    icon: AppIcon,
    comp: defineAsyncComponent(() => import("./VideoSubtitleNode.vue")),
    inputFields: [
        {
            type: "file",
            name: "Video",
            fileExtensions: ["mp4"],
        },
        {
            type: "file",
            name: "Subtitle",
            fileExtensions: ["srt"],
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
        console.log("VideoSubtitle run", param);
        return workflowRun(
            controller,
            param,
            async () => {
                const taskRunData = {
                    taskId: param.runData?.["taskId"] || "",
                    video: param.runInputs["Video"],
                    subtitle: param.runInputs["Subtitle"],
                    title: param.node.properties?.title + "-" + param.node.id,
                };
                if (!taskRunData.video || !taskRunData.subtitle) {
                    const missing: string[] = [];
                    if (!taskRunData.video) missing.push(t("common.videoFile"));
                    if (!taskRunData.subtitle)
                        missing.push(t("common.subtitleFile"));
                    throw t("error.missingParams", {
                        params: missing.join(", "),
                    });
                }
                return await VideoSubtitleRun(taskRunData);
            },
            async (result, data) => {
                result.runOutputs["Video"] = data.video;
            },
        );
    },
    async check(node) {
        if (node.properties?.inputFields?.[0].value === "") {
            throw t("error.inputVideoParam");
        }
        if (node.properties?.inputFields?.[1].value === "") {
            throw t("error.inputSubtitleParam");
        }
    },
};
