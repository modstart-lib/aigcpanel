import { defineAsyncComponent } from "vue";
import AppIcon from "~icons/mdi/image-plus";
import { t } from "../../../../lang";
import {
    NodeFunctionCall,
    NodeRunController,
    NodeRunParam,
    NodeRunResult,
} from "../../../../module/Workflow/core/type";
import { workflowRun } from "../../common/workflow";
import { VideoMergeImageRun } from "../task";

export default <NodeFunctionCall>{
    name: "VideoMergeImage",
    title: t("workflow.videoMergeImageTitle"),
    description: t("workflow.videoMergeImageDesc"),
    icon: AppIcon,
    comp: defineAsyncComponent(() => import("./VideoMergeImageNode.vue")),
    inputFields: [
        {
            type: "file",
            name: "Video",
            fileExtensions: ["mp4"],
        },
        {
            type: "file",
            name: "Image",
            fileExtensions: ["jpg", "png"],
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
        console.log("VideoMergeImage run", param);
        return workflowRun(
            controller,
            param,
            async () => {
                const position = param.node.properties?.data?.position;
                const duration = param.node.properties?.data?.duration || 3;
                const animation =
                    param.node.properties?.data?.animation || "none";
                const zoomPercent =
                    param.node.properties?.data?.zoomPercent || 5;

                const taskRunData = {
                    taskId: param.runData?.["taskId"] || "",
                    video: param.runInputs["Video"],
                    image: param.runInputs["Image"],
                    title: param.node.properties?.title + "-" + param.node.id,
                    position: position,
                    duration: duration,
                    animation: animation,
                    zoomPercent: zoomPercent,
                };
                if (!taskRunData.video || !taskRunData.image) {
                    const missing: string[] = [];
                    if (!taskRunData.video) missing.push(t("common.videoFile"));
                    if (!taskRunData.image) missing.push(t("common.imageFile"));
                    throw t("error.missingParams", {
                        params: missing.join(", "),
                    });
                }
                return await VideoMergeImageRun(taskRunData);
            },
            async (result, data) => {
                result.runOutputs["Video"] = data.video;
            },
        );
    },
    async check(node) {
        if (
            !node.properties?.data?.position ||
            !node.properties?.data?.duration
        ) {
            throw t("error.inputImagePositionDuration");
        }
        if (
            node.properties?.data?.animation === "zoom" &&
            (!node.properties?.data?.zoomPercent ||
                node.properties?.data?.zoomPercent <= 0)
        ) {
            throw t("error.validZoomPercent");
        }
        if (node.properties?.inputFields?.[0].value === "") {
            throw t("error.inputVideoParam");
        }
        if (node.properties?.inputFields?.[1].value === "") {
            throw t("error.inputImageParam2");
        }
    },
};
