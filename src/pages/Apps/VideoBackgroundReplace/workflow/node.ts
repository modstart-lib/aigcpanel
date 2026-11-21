import { defineAsyncComponent } from "vue";
import { t } from "../../../../lang";
import {
    NodeFunctionCall,
    NodeRunController,
    NodeRunParam,
    NodeRunResult,
} from "../../../../module/Workflow/core/type";
import { workflowRun } from "../../common/workflow";
import { VideoBackgroundReplaceRun } from "../task";
import AppIcon from "~icons/mdi/wallpaper";

export default <NodeFunctionCall>{
    name: "VideoBackgroundReplace",
    title: t("workflow.vbrTitle"),
    description: t("workflow.vbrDesc"),
    icon: AppIcon,
    comp: defineAsyncComponent(
        () => import("./VideoBackgroundReplaceNode.vue"),
    ),
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
        console.log("VideoBackgroundReplace run", param);
        return workflowRun(
            controller,
            param,
            async () => {
                const imageMode =
                    param.node.properties?.data?.imageMode || "cover";
                const keyColor =
                    param.node.properties?.data?.keyColor || "#00FF00";
                const similarity =
                    param.node.properties?.data?.similarity ?? 0.3;
                const blend = param.node.properties?.data?.blend ?? 0.1;
                const outputWidth =
                    param.node.properties?.data?.outputWidth ?? 0;
                const outputHeight =
                    param.node.properties?.data?.outputHeight ?? 0;
                const taskRunData = {
                    taskId: param.runData?.["taskId"] || "",
                    video: param.runInputs["Video"],
                    image: param.runInputs["Image"],
                    title: param.node.properties?.title + "-" + param.node.id,
                    imageMode: imageMode,
                    keyColor: keyColor,
                    similarity: similarity,
                    blend: blend,
                    outputWidth: outputWidth,
                    outputHeight: outputHeight,
                };
                if (!taskRunData.video || !taskRunData.image) {
                    const missing: string[] = [];
                    if (!taskRunData.video)
                        missing.push(t("workflow.vbrVideo"));
                    if (!taskRunData.image)
                        missing.push(t("workflow.vbrBackgroundImage"));
                    throw t("workflow.vbrErrorMissingParams", {
                        items: missing.join(", "),
                    });
                }
                return await VideoBackgroundReplaceRun(taskRunData);
            },
            async (result, data) => {
                result.runOutputs["Video"] = data.video;
            },
        );
    },
    async check(node) {
        return undefined;
    },
};
