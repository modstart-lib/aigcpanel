import { defineAsyncComponent } from "vue";
import { t } from "../../../../lang";
import {
    NodeFunctionCall,
    NodeRunController,
    NodeRunParam,
    NodeRunResult,
} from "../../../../module/Workflow/core/type";
import { workflowRun } from "../../common/workflow";
import { ImageToVideoRun } from "../task";
import AppIcon from "~icons/mdi/image-filter-none";

export default <NodeFunctionCall>{
    name: "ImageToVideo",
    title: t("model.img2video"),
    description: t("app.imageToVideoDesc"),
    icon: AppIcon,
    comp: defineAsyncComponent(() => import("./ImageToVideoNode.vue")),
    inputFields: [
        {
            type: "file",
            name: "Image",
            fileExtensions: ["png", "jpg", "jpeg"],
        },
        {
            type: "text",
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
        console.log("ImageToVideo run", param);
        return workflowRun(
            controller,
            param,
            async () => {
                const taskRunData = {
                    taskId: param.runData?.["taskId"] || "",
                    images: param.runInputs["Image"]
                        ? [param.runInputs["Image"]]
                        : [],
                    prompt: param.runInputs["Prompt"],
                    title: param.node.properties?.title + "-" + param.node.id,
                    imageToVideo: param.node.properties?.data?.imageToVideo,
                };
                if (
                    !taskRunData.images.length ||
                    !taskRunData.prompt ||
                    !taskRunData.imageToVideo
                ) {
                    const missing: string[] = [];
                    if (!taskRunData.images.length)
                        missing.push(t("app.imageLabel"));
                    if (!taskRunData.prompt) missing.push(t("app.promptText"));
                    if (!taskRunData.imageToVideo)
                        missing.push(t("app.imageGenerateService"));
                    throw t("workflow.paramErrorMissing", {
                        items: missing.join(", "),
                    });
                }
                return await ImageToVideoRun(taskRunData);
            },
            async (result, data) => {
                result.runOutputs["Video"] = data.video;
            },
        );
    },
    async check(node) {
        if (!node.properties?.data?.imageToVideo) {
            throw t("hint.configureImageGenerateService");
        }
        if (node.properties?.inputFields?.[0].value === "") {
            throw t("hint.inputImageParam");
        }
        if (node.properties?.inputFields?.[1].value === "") {
            throw t("hint.inputPromptParam");
        }
    },
};
