import { defineAsyncComponent } from "vue";
import AppIcon from "~icons/mdi/fast-forward";
import { t } from "../../../../lang";
import {
    NodeFunctionCall,
    NodeRunController,
    NodeRunParam,
    NodeRunResult,
} from "../../../../module/Workflow/core/type";
import { workflowRun } from "../../common/workflow";
import { VideoSpeedPartRun } from "../task";

export default <NodeFunctionCall>{
    name: "VideoSpeedPart",
    title: t("workflow.videoSpeedPartTitle"),
    description: t("workflow.videoSpeedPartDesc"),
    icon: AppIcon,
    comp: defineAsyncComponent(() => import("./VideoSpeedPartNode.vue")),
    inputFields: [
        {
            type: "file",
            name: "Video",
            fileExtensions: ["mp4"],
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
        console.log("VideoSpeedPart run", param);
        return workflowRun(
            controller,
            param,
            async () => {
                const speed = param.node.properties?.data?.speed || 5;
                const taskRunData = {
                    taskId: param.runData?.["taskId"] || "",
                    video: param.runInputs["Video"],
                    speed: speed,
                    title: param.node.properties?.title + "-" + param.node.id,
                };
                if (!taskRunData.video) {
                    throw t("error.missingVideoFile");
                }
                return await VideoSpeedPartRun(taskRunData);
            },
            async (result, data) => {
                result.runOutputs["Video"] = data.video;
            },
        );
    },
    async check(node) {
        if (!node.properties?.data?.speed) {
            throw t("error.inputSpeedParam");
        }
        if (node.properties?.inputFields?.[0].value === "") {
            throw t("error.inputVideoParam");
        }
    },
};
