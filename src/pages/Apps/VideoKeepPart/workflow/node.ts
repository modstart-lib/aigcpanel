import { defineAsyncComponent } from "vue";
import {
    NodeFunctionCall,
    NodeRunController,
    NodeRunParam,
    NodeRunResult,
} from "../../../../module/Workflow/core/type";
import { workflowRun } from "../../common/workflow";
import { VideoKeepPartRun } from "../task";
import AppIcon from "~icons/mdi/scissors-cutting";
import { t } from "../../../../lang";

export default <NodeFunctionCall>{
    name: "VideoKeepPart",
    title: t("workflow.videoKeepPartTitle"),
    description: t("workflow.videoKeepPartDesc"),
    icon: AppIcon,
    comp: defineAsyncComponent(() => import("./VideoKeepPartNode.vue")),
    inputFields: [
        {
            type: "file",
            name: "Video",
            placeholder: t("workflow.selectVideoFile"),
            fileExtensions: ["mp4", "avi", "mov", "mkv", "wmv", "flv", "webm"],
        },
    ],
    outputFields: [
        {
            type: "file",
            name: "Video",
            placeholder: t("workflow.processedVideoFile"),
        },
    ],
    async run(
        controller: NodeRunController,
        param: NodeRunParam,
    ): Promise<NodeRunResult> {
        console.log("VideoKeepPart run", param);
        return workflowRun(
            controller,
            param,
            async () => {
                const action = param.node.properties?.data?.action || "remove";
                const taskRunData = {
                    taskId: param.runData?.["taskId"] || "",
                    video: param.runInputs["Video"],
                    title: param.node.properties?.title + "-" + param.node.id,
                    action: action,
                };
                if (!taskRunData.video) {
                    throw t("error.selectVideoFile");
                }
                return await VideoKeepPartRun(taskRunData);
            },
            async (result, data) => {
                result.runOutputs["Video"] = data.video;
            },
        );
    },
    async check(node) {
        if (!node.properties?.data?.action) {
            throw new Error(t("error.selectActionType"));
        }
        if (node.properties?.inputFields?.[0].value === "") {
            throw new Error(t("error.selectVideoFile"));
        }
    },
};
