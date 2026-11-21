import { TaskJobResultStepStatus } from "../../../service/TaskService";

export type ImageToVideoModelConfigType = {
    images: string[];
    prompt: string;
    imageToVideo: ImageToVideoParamType;
};

export type ImageToVideoJobResultType = {
    // 处理步骤
    // 1 Prepare 准备图像
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
