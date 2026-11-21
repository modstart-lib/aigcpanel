import { TaskJobResultStepStatus } from "../../../service/TaskService";

export type VideoGenFlowModelConfigType = {
    videoTemplateId: number;
    videoTemplateName: string;
    videoTemplateUrl: string;
    soundGenerate: SoundGenerateParamType;
    text: string;
};

export type VideoGenFlowJobResultType = {
    // 处理步骤
    // 1 SoundGenerate 生成配音
    // 2 VideoGen 合成视频
    step: "SoundGenerate" | "VideoGen";

    SoundGenerate: {
        status: TaskJobResultStepStatus;
        // 配音生成方式
        type: "SoundTts" | "SoundClone";
        // 已生成的配音文件（hub 路径）
        url: string;
    };
    VideoGen: {
        status: TaskJobResultStepStatus;
        // 视频合成服务返回结果
        result: ServerCallFunctionResult;
    };
};
