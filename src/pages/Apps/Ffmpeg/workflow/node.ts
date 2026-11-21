import { defineAsyncComponent } from "vue";
import { t } from "../../../../lang";
import {
    NodeFunctionCall,
    NodeRunController,
    NodeRunParam,
    NodeRunResult,
} from "../../../../module/Workflow/core/type";
import { workflowRun } from "../../common/workflow";
import { FfmpegRun } from "../task";
import AppIcon from "~icons/mdi/console";

export default <NodeFunctionCall>{
    name: "Ffmpeg",
    title: t("workflow.ffmpegTitle"),
    description: t("workflow.ffmpegDesc"),
    icon: AppIcon,
    comp: defineAsyncComponent(() => import("./FfmpegNode.vue")),
    inputFields: [
        {
            type: "file",
            name: "File1",
        },
        {
            type: "file",
            name: "File2",
        },
        {
            type: "file",
            name: "File3",
        },
        {
            type: "file",
            name: "File4",
        },
        {
            type: "file",
            name: "File5",
        },
    ],
    outputFields: [
        {
            type: "file",
            name: "Output1",
        },
        {
            type: "file",
            name: "Output2",
        },
        {
            type: "file",
            name: "Output3",
        },
        {
            type: "file",
            name: "Output4",
        },
        {
            type: "file",
            name: "Output5",
        },
    ],
    async run(
        controller: NodeRunController,
        param: NodeRunParam,
    ): Promise<NodeRunResult> {
        console.log("Ffmpeg run", param);
        return workflowRun(
            controller,
            param,
            async () => {
                const nodeData = param.node.properties?.data || {};
                const taskRunData = {
                    taskId: param.runData?.["taskId"] || "",
                    title: param.node.properties?.title + "-" + param.node.id,
                    input1: param.runInputs["File1"] || "",
                    input2: param.runInputs["File2"] || "",
                    input3: param.runInputs["File3"] || "",
                    input4: param.runInputs["File4"] || "",
                    input5: param.runInputs["File5"] || "",
                    commands: nodeData.commands || [],
                };
                return await FfmpegRun(taskRunData);
            },
            async (result, data) => {
                result.runOutputs["Output1"] = data.output1 || "";
                result.runOutputs["Output2"] = data.output2 || "";
                result.runOutputs["Output3"] = data.output3 || "";
                result.runOutputs["Output4"] = data.output4 || "";
                result.runOutputs["Output5"] = data.output5 || "";
            },
        );
    },
    async check(node) {
        if (!node.properties?.data?.commands) {
            throw t("error.ffmpegCommandRequired");
        }
    },
};
