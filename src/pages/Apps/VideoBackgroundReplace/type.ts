import { TaskJobResultStepStatus } from "../../../service/TaskService";

export type VideoBackgroundReplaceModelConfigType = {
    /** 绿幕视频（含纯色背景，通常是绿色） */
    video: string;
    /** 替换后的背景图片 */
    image: string;
    /** 背景图片填充方式 */
    imageMode: "cover" | "contain";
    /** 被抠除的颜色（十六进制，默认绿色 #00FF00） */
    keyColor: string;
    /** 颜色相似度阈值 0.01 ~ 1，越大抠除范围越大 */
    similarity: number;
    /** 边缘融合过渡 0 ~ 1，用于让抠像边缘更自然 */
    blend: number;
    /** 输出宽度，0 表示跟随绿幕视频尺寸 */
    outputWidth: number;
    /** 输出高度，0 表示跟随绿幕视频尺寸 */
    outputHeight: number;
};

export type VideoBackgroundReplaceJobResultType = {
    // 处理步骤
    // 1 分析视频 Prepare
    // 2 抠像合成 Render
    step: "Prepare" | "Render" | "End";

    Prepare: {
        status: TaskJobResultStepStatus;
        duration: number;
        width: number;
        height: number;
        fps: number;
    };

    Render: {
        status: TaskJobResultStepStatus;
        file: string;
    };
};
