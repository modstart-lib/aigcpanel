import { TaskJobResultStepStatus } from "../../../service/TaskService";

export type TextToVideoModelConfigType = {
    prompt: string;
    textToVideo: TextToVideoParamType;
};

export type TextToVideoJobResultType = {
    // 处理步骤
    // 1 Prepare 准备
    // 2 Generate 生成视频
    // 3 End
    step: "Prepare" | "Generate" | "End";

    Prepare: {
        status: TaskJobResultStepStatus;
    };
    Generate: {
        status: TaskJobResultStepStatus;
        video?: string;
    };
};
