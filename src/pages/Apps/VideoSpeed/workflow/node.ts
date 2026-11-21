import { defineAsyncComponent } from "vue";
import AppIcon from "~icons/mdi/speedometer";
import { t } from "../../../../lang";
import {
    NodeFunctionCall,
    NodeRunController,
    NodeRunParam,
    NodeRunResult,
} from "../../../../module/Workflow/core/type";
import { workflowRun } from "../../common/workflow";
import { VideoSpeedRun } from "../task";

export default <NodeFunctionCall>{
    name: "VideoSpeed",
    title: t("workflow.videoSpeedTitle"),
    description: t("workflow.videoSpeedDesc"),
    icon: AppIcon,
    comp: defineAsyncComponent(() => import("./VideoSpeedNode.vue")),
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
        console.log("VideoSpeed run", param);
        return workflowRun(
            controller,
            param,
            async () => {
                const taskRunData = {
                    taskId: param.runData?.["taskId"] || "",
                    video: param.runInputs["Video"],
                    title: param.node.properties?.title + "-" + param.node.id,
                    speed: param.node.properties?.data?.speed || 1.0,
                };
                if (!taskRunData.video) {
                    throw t("error.missingVideoFile");
                }
                return await VideoSpeedRun(taskRunData);
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
