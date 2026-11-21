import { defineAsyncComponent } from "vue";
import AppIcon from "~icons/mdi/magnify";
import { t } from "../../../../lang";
import {
    NodeFunctionCall,
    NodeRunController,
    NodeRunParam,
    NodeRunResult,
} from "../../../../module/Workflow/core/type";
import { workflowRun } from "../../common/workflow";
import { VideoZoomRun } from "../task";

export default <NodeFunctionCall>{
    name: "VideoZoom",
    title: t("workflow.videoZoomTitle"),
    description: t("workflow.videoZoomDesc"),
    icon: AppIcon,
    comp: defineAsyncComponent(() => import("./VideoZoomNode.vue")),
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
        console.log("VideoZoom run", param);
        return workflowRun(
            controller,
            param,
            async () => {
                const taskRunData = {
                    taskId: param.runData?.["taskId"] || "",
                    video: param.runInputs["Video"],
                    title: param.node.properties?.title + "-" + param.node.id,
                };
                if (!taskRunData.video) {
                    throw t("error.missingVideoFile");
                }
                return await VideoZoomRun(taskRunData);
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
    },
};
