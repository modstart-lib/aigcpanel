import { defineAsyncComponent } from "vue";
import { t } from "../../../../lang";
import {
    NodeFunctionCall,
    NodeRunController,
    NodeRunParam,
    NodeRunResult,
} from "../../../../module/Workflow/core/type";
import { workflowRun } from "../../common/workflow";
import { VideoMergeRun } from "../task";
import AppIcon from "~icons/mdi/merge";

export default <NodeFunctionCall>{
    name: "VideoMerge",
    title: t("workflow.videoMergeTitle"),
    description: t("workflow.videoMergeDesc"),
    icon: AppIcon,
    comp: defineAsyncComponent(() => import("./VideoMergeNode.vue")),
    inputFields: [
        {
            type: "files",
            name: "Videos",
            fileExtensions: ["mp4", "avi", "mov", "mkv"],
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
        console.log("VideoMerge run", param);
        return workflowRun(
            controller,
            param,
            async () => {
                const transitionEffect =
                    param.node.properties?.data?.transitionEffect || "fade";
                const transitionDuration =
                    param.node.properties?.data?.transitionDuration || 500;
                const videosRaw = param.runInputs["Videos"];
                let videos: string[];
                if (typeof videosRaw === "string") {
                    try {
                        videos = JSON.parse(videosRaw);
                    } catch {
                        videos = [videosRaw];
                    }
                } else {
                    videos = videosRaw || [];
                }
                const taskRunData = {
                    taskId: param.runData?.["taskId"] || "",
                    videos: videos,
                    title: param.node.properties?.title + "-" + param.node.id,
                    transitionEffect: transitionEffect,
                    transitionDuration: transitionDuration,
                };
                if (!taskRunData.videos || taskRunData.videos.length < 2) {
                    throw t("workflow.errorAtLeastTwoVideos");
                }
                return await VideoMergeRun(taskRunData);
            },
            async (result, data) => {
                result.runOutputs["Video"] = data.video;
            },
        );
    },
    async check(node) {
        if (!node.properties?.data?.transitionEffect) {
            throw t("workflow.errorTransitionEffect");
        }
        if (node.properties?.inputFields?.[0].value === "") {
            throw t("workflow.errorVideoParam");
        }
    },
};
