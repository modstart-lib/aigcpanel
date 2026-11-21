import { defineAsyncComponent } from "vue";
import { t } from "../../../../lang";
import {
    NodeFunctionCall,
    NodeRunController,
    NodeRunParam,
    NodeRunResult,
} from "../../../../module/Workflow/core/type";
import { workflowRun } from "../../common/workflow";
import { TextToVideoRun } from "../task";
import AppIcon from "~icons/mdi/image-text";

export default <NodeFunctionCall>{
    name: "TextToVideo",
    title: t("model.txt2video"),
    description: t("app.textToVideoDesc"),
    icon: AppIcon,
    comp: defineAsyncComponent(() => import("./TextToVideoNode.vue")),
    inputFields: [
        {
            type: "textarea",
            name: "Prompt",
        },
    ],
    outputFields: [
        {
            type: "file",
            name: "Video",
            fileExtensions: ["mp4", "mov", "webm"],
        },
    ],
    async run(
        controller: NodeRunController,
        param: NodeRunParam,
    ): Promise<NodeRunResult> {
        console.log("TextToVideo run", param);
        return workflowRun(
            controller,
            param,
            async () => {
                const taskRunData = {
                    taskId: param.runData?.["taskId"] || "",
                    prompt: param.runInputs["Prompt"],
                    title: param.node.properties?.title + "-" + param.node.id,
                    textToVideo: param.node.properties?.data?.textToVideo,
                };
                if (!taskRunData.prompt || !taskRunData.textToVideo) {
                    const missing: string[] = [];
                    if (!taskRunData.prompt) missing.push(t("app.promptText"));
                    if (!taskRunData.textToVideo)
                        missing.push(t("app.imageGenerateService"));
                    throw t("workflow.paramErrorMissing", {
                        items: missing.join(", "),
                    });
                }
                return await TextToVideoRun(taskRunData);
            },
            async (result, data) => {
                result.runOutputs["Video"] = data.video;
            },
        );
    },
    async check(node) {
        if (!node.properties?.data?.textToVideo) {
            throw t("hint.configureImageGenerateService");
        }
        if (node.properties?.inputFields?.[0].value === "") {
            throw t("hint.inputTextParam");
        }
    },
};
