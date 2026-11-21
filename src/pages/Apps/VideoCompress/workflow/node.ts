import { defineAsyncComponent } from "vue";
import { t } from "../../../../lang";
import {
    NodeFunctionCall,
    NodeRunController,
    NodeRunParam,
    NodeRunResult,
} from "../../../../module/Workflow/core/type";
import { workflowRun } from "../../common/workflow";
import { VideoCompressRun } from "../task";
import AppIcon from "~icons/mdi/zip-box";

export default <NodeFunctionCall>{
    name: "VideoCompress",
    title: t("workflow.videoCompressTitle"),
    description: t("workflow.videoCompressDesc"),
    icon: AppIcon,
    comp: defineAsyncComponent(() => import("./VideoCompressNode.vue")),
    inputFields: [
        {
            type: "file",
            name: "Video",
            fileExtensions: ["mp4", "avi", "mov", "mkv", "wmv"],
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
        console.log("VideoCompress run", param);
        return workflowRun(
            controller,
            param,
            async () => {
                const codec = param.node.properties?.data?.codec || "libx264";
                const resolution =
                    param.node.properties?.data?.resolution || "1920x1080";
                const compressionLevel =
                    param.node.properties?.data?.compressionLevel || 50;
                const taskRunData = {
                    taskId: param.runData?.["taskId"] || "",
                    file: param.runInputs["Video"],
                    title: param.node.properties?.title + "-" + param.node.id,
                    codec: codec,
                    resolution: resolution,
                    compressionLevel: compressionLevel,
                };
                if (!taskRunData.file) {
                    throw t("workflow.errorFileParam");
                }
                return await VideoCompressRun(taskRunData);
            },
            async (result, data) => {
                result.runOutputs["Video"] = data.file;
            },
        );
    },
    async check(node) {
        if (
            !node.properties?.data?.codec ||
            !node.properties?.data?.resolution ||
            !node.properties?.data?.compressionLevel
        ) {
            throw t("workflow.errorCompressParam");
        }
        if (node.properties?.inputFields?.[0].value === "") {
            throw t("workflow.errorFileRequired");
        }
    },
};
