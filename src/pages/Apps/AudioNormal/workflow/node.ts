import { defineAsyncComponent } from "vue";
import { t } from "../../../../lang";
import {
    NodeFunctionCall,
    NodeRunController,
    NodeRunParam,
    NodeRunResult,
} from "../../../../module/Workflow/core/type";
import { workflowRun } from "../../common/workflow";
import { AudioNormalRun } from "../task";
import AppIcon from "~icons/mdi/volume-high";

export default <NodeFunctionCall>{
    name: "AudioNormal",
    title: t("workflow.audioNormalTitle"),
    description: t("workflow.audioNormalDesc"),
    icon: AppIcon,
    comp: defineAsyncComponent(() => import("./AudioNormalNode.vue")),
    inputFields: [
        {
            type: "file",
            name: "File",
            fileExtensions: ["mp4", "avi", "mov", "mp3", "wav", "flac"],
        },
    ],
    outputFields: [
        {
            type: "file",
            name: "File",
            fileExtensions: ["mp4", "mp3"],
        },
    ],
    async run(
        controller: NodeRunController,
        param: NodeRunParam,
    ): Promise<NodeRunResult> {
        console.log("AudioNormal run", param);
        return workflowRun(
            controller,
            param,
            async () => {
                const normalizationPercentage =
                    param.node.properties?.data?.normalizationPercentage || 100;
                const taskRunData = {
                    taskId: param.runData?.["taskId"] || "",
                    file: param.runInputs["File"],
                    title: param.node.properties?.title + "-" + param.node.id,
                    normalizationPercentage: normalizationPercentage,
                };
                if (!taskRunData.file) {
                    throw t("workflow.errorFileParam");
                }
                return await AudioNormalRun(taskRunData);
            },
            async (result, data) => {
                result.runOutputs["File"] = data.file;
            },
        );
    },
    async check(node) {
        if (!node.properties?.data?.normalizationPercentage) {
            throw t("workflow.errorNormalizationParam");
        }
        if (node.properties?.inputFields?.[0].value === "") {
            throw t("workflow.errorFileRequired");
        }
    },
};
