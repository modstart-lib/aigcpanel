import { defineAsyncComponent } from "vue";
import { t } from "../../../../lang";
import { NodeFunctionCall, NodeRunController, NodeRunParam, NodeRunResult } from "../../../../module/Workflow/core/type";
import { workflowRun } from "../../common/workflow";
import { SoundReplaceRun } from "../task";
import SoundReplaceIcon from "./../assets/icon.svg";

export default <NodeFunctionCall>{
    name: "SoundReplace",
    title: t("voice.replace"),
    description: t("desc.videoVoiceReplace"),
    icon: SoundReplaceIcon,
    comp: defineAsyncComponent(() => import("./SoundReplaceNode.vue")),
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
        {
            type: "file",
            name: "Srt",
            fileExtensions: ["srt"],
        }
    ],
    async run(controller: NodeRunController, param: NodeRunParam): Promise<NodeRunResult> {
        console.log('SoundReplace run', param);
        return workflowRun(
            controller, param,
            async () => {
                const taskRunData = {
                    taskId: param.runData?.['taskId'] || '',
                    video: param.runInputs['Video'],
                    title: param.node.properties?.title + '-' + param.node.id,
                    soundAsr: param.node.properties?.data?.soundAsr,
                    soundGenerate: param.node.properties?.data?.soundGenerate,
                };
                if (!taskRunData.video || !taskRunData.soundAsr || !taskRunData.soundGenerate) {
                    const missing: string[] = [];
                    if (!taskRunData.video) missing.push(t("media.video"));
                    if (!taskRunData.soundAsr) missing.push(t("workflow.soundRecognitionService"));
                    if (!taskRunData.soundGenerate) missing.push(t("workflow.soundGenerationService"));
                    throw t("workflow.paramErrorMissing", {items: missing.join(", ")});
                }
                return await SoundReplaceRun(taskRunData);
            },
            async (result, data) => {
                result.runOutputs['Video'] = data.video
                result.runOutputs['Srt'] = data.srt
            }
        );
    },
    async check(node) {
        if (!node.properties?.data?.soundAsr || !node.properties?.data?.soundGenerate) {
            throw t("workflow.configureRecognitionAndGeneration");
        }
        if (node.properties?.inputFields?.[0].value === '') {
            throw t("workflow.inputVideoParam");
        }
    }
}
