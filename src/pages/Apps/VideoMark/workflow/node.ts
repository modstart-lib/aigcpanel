import { defineAsyncComponent } from "vue";
import { t } from "../../../../lang";
import {
    NodeFunctionCall,
    NodeRunController,
    NodeRunParam,
    NodeRunResult,
} from "../../../../module/Workflow/core/type";
import { workflowRun } from "../../common/workflow";
import { VideoMarkRun } from "../task";
import AppIcon from "~icons/mdi/watermark";

export default <NodeFunctionCall>{
    name: "VideoMark",
    title: t("workflow.videoMarkTitle"),
    description: t("workflow.videoMarkDesc"),
    icon: AppIcon,
    comp: defineAsyncComponent(() => import("./VideoMarkNode.vue")),
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
        console.log("VideoMark run", param);
        return workflowRun(
            controller,
            param,
            async () => {
                const taskRunData = {
                    taskId: param.runData?.["taskId"] || "",
                    video: param.runInputs["Video"],
                    title: param.node.properties?.title + "-" + param.node.id,
                    borderWidth: param.node.properties?.data?.borderWidth,
                    borderColor: param.node.properties?.data?.borderColor,
                    borderOpacity: param.node.properties?.data?.borderOpacity,
                    borderRadius: param.node.properties?.data?.borderRadius,
                    borderStyle: param.node.properties?.data?.borderStyle,
                };
                if (!taskRunData.video) {
                    throw t("error.missingVideoFile");
                }
                return await VideoMarkRun(taskRunData);
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
        if (
            !node.properties?.data?.borderWidth ||
            node.properties?.data?.borderWidth < 1
        ) {
            throw t("error.validBorderWidthInput");
        }
        if (!node.properties?.data?.borderColor) {
            throw t("error.validBorderColorInput");
        }
        if (
            !node.properties?.data?.borderOpacity ||
            node.properties?.data?.borderOpacity < 0 ||
            node.properties?.data?.borderOpacity > 1
        ) {
            throw t("error.validBorderOpacityInput");
        }
        if (
            !node.properties?.data?.borderRadius ||
            node.properties?.data?.borderRadius < 0
        ) {
            throw t("error.validBorderRadiusInput");
        }
        if (
            !node.properties?.data?.borderStyle ||
            (node.properties?.data?.borderStyle !== "solid" &&
                node.properties?.data?.borderStyle !== "dashed")
        ) {
            throw t("error.validBorderStyleInput");
        }
    },
};
