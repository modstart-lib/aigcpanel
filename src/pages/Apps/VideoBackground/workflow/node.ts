import { defineAsyncComponent } from "vue";
import { t } from "../../../../lang";
import {
    NodeFunctionCall,
    NodeRunController,
    NodeRunParam,
    NodeRunResult,
} from "../../../../module/Workflow/core/type";
import { workflowRun } from "../../common/workflow";
import { VideoBackgroundRun } from "../task";
import AppIcon from "~icons/mdi/image-filter-hdr";

export default <NodeFunctionCall>{
    name: "VideoBackground",
    title: t("workflow.videoBackgroundTitle"),
    description: t("workflow.videoBackgroundDesc"),
    icon: AppIcon,
    comp: defineAsyncComponent(() => import("./VideoBackgroundNode.vue")),
    inputFields: [
        {
            type: "file",
            name: "Video",
            fileExtensions: ["mp4"],
        },
        {
            type: "file",
            name: "Image",
            fileExtensions: ["jpg", "png", "jpeg"],
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
        console.log("VideoBackground run", param);
        return workflowRun(
            controller,
            param,
            async () => {
                const imageMode =
                    param.node.properties?.data?.imageMode || "cover";
                const videoX = param.node.properties?.data?.videoX || 0;
                const videoY = param.node.properties?.data?.videoY || 0;
                const videoWidth =
                    param.node.properties?.data?.videoWidth || 100;
                const videoHeight =
                    param.node.properties?.data?.videoHeight || 60;
                const outputWidth =
                    param.node.properties?.data?.outputWidth || 1920;
                const outputHeight =
                    param.node.properties?.data?.outputHeight || 1080;
                const videoBorderWidth =
                    param.node.properties?.data?.videoBorderWidth || 0;
                const videoBorderColor =
                    param.node.properties?.data?.videoBorderColor || "#FFFFFF";
                const videoBorderOpacity =
                    param.node.properties?.data?.videoBorderOpacity || 100;
                const videoBorderRadius =
                    param.node.properties?.data?.videoBorderRadius || 0;
                const taskRunData = {
                    taskId: param.runData?.["taskId"] || "",
                    video: param.runInputs["Video"],
                    image: param.runInputs["Image"],
                    title: param.node.properties?.title + "-" + param.node.id,
                    imageMode: imageMode,
                    videoX: videoX,
                    videoY: videoY,
                    videoWidth: videoWidth,
                    videoHeight: videoHeight,
                    outputWidth: outputWidth,
                    outputHeight: outputHeight,
                    videoBorderWidth: videoBorderWidth,
                    videoBorderColor: videoBorderColor,
                    videoBorderOpacity: videoBorderOpacity,
                    videoBorderRadius: videoBorderRadius,
                };
                if (!taskRunData.video || !taskRunData.image) {
                    const missing: string[] = [];
                    if (!taskRunData.video) missing.push(t("workflow.video"));
                    if (!taskRunData.image)
                        missing.push(t("workflow.backgroundImage"));
                    throw t("workflow.errorMissingParams", {
                        items: missing.join(", "),
                    });
                }
                return await VideoBackgroundRun(taskRunData);
            },
            async (result, data) => {
                result.runOutputs["Video"] = data.video;
            },
        );
    },
    async check(node) {
        if (
            !node.properties?.data?.outputWidth ||
            !node.properties?.data?.outputHeight
        ) {
            return t("workflow.errorSetImageSize");
        }
        return undefined;
    },
};
