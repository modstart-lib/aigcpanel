import { ImgClip, MP4Clip, OffscreenSprite } from "@webav/av-cliper";
import { webavCombinator, webavWriteStream } from "../../../lib/webav";
import { TaskService } from "../../../service/TaskService";
import { applyChromaKey } from "./chroma-key";

type ChromaKeyVideoClipOption = {
    bizId: string;
    video: string;
    /** 该 clip 画布尺寸（输出画布中前景的等比居中区域） */
    canvasWidth: number;
    canvasHeight: number;
    keyColor: string;
    similarity: number;
    blend: number;
};

/**
 * 逐帧对绿幕视频做色键抠像的前端 Clip。
 *
 * 与预览使用同一套 `applyChromaKey` 算法，因此参数效果和预览一致。
 */
class ChromaKeyVideoClip {
    #cvsEl: HTMLCanvasElement;
    #ctx: CanvasRenderingContext2D;
    #mp4Clip: MP4Clip | null = null;
    #option: ChromaKeyVideoClipOption;
    #timeUs = 0;

    ready: Promise<{ width: number; height: number; duration: number }>;

    get meta() {
        return {
            width: this.#cvsEl.width,
            height: this.#cvsEl.height,
            duration: this.#timeUs,
        };
    }

    constructor(option: ChromaKeyVideoClipOption) {
        this.#option = option;
        this.#cvsEl = document.createElement("canvas");
        this.#cvsEl.width = Math.max(1, Math.round(option.canvasWidth));
        this.#cvsEl.height = Math.max(1, Math.round(option.canvasHeight));
        this.#ctx = this.#cvsEl.getContext("2d", {
            willReadFrequently: true,
        })!;
        this.ready = new Promise(async (resolve, reject) => {
            try {
                resolve(await this.init());
            } catch (e) {
                reject(e);
            }
        });
    }

    async init() {
        const stream = await $mapi.file.readStream(this.#option.video, {
            isDataPath: false,
        });
        if (!stream) {
            throw new Error("Failed to read video stream");
        }
        this.#mp4Clip = new MP4Clip(stream);
        await this.#mp4Clip.ready;
        this.#timeUs = this.#mp4Clip.meta.duration;
        return {
            width: this.#cvsEl.width,
            height: this.#cvsEl.height,
            duration: this.#timeUs,
        };
    }

    async tick(time: number): Promise<{
        state: "success" | "done";
        video?: VideoFrame;
        audio?: Float32Array[];
    }> {
        const frame = await this.#mp4Clip!.tick(time);
        TaskService.cancelCheck("VideoBackgroundReplace", this.#option.bizId);
        if (this.#timeUs > 0) {
            TaskService.updatePercent(this.#option.bizId, time / this.#timeUs);
        }
        if (!frame) {
            return { state: "done" };
        }
        if (frame.video) {
            const width = this.#cvsEl.width;
            const height = this.#cvsEl.height;
            this.#ctx.clearRect(0, 0, width, height);
            this.#ctx.drawImage(frame.video, 0, 0, width, height);
            frame.video.close();
            const imageData = this.#ctx.getImageData(0, 0, width, height);
            applyChromaKey(imageData.data, {
                keyColor: this.#option.keyColor,
                similarity: this.#option.similarity,
                blend: this.#option.blend,
            });
            this.#ctx.putImageData(imageData, 0, 0);
        }
        return {
            state: "success",
            video: new VideoFrame(this.#cvsEl, { timestamp: time }),
            audio:
                frame.audio && frame.audio.length > 0 ? frame.audio : undefined,
        };
    }

    async clone() {
        return new ChromaKeyVideoClip(this.#option) as this;
    }

    destroy() {
        this.#cvsEl.remove();
    }
}

export type VideoBackgroundReplaceExecuteConfig = {
    bizId: string;
    imageMode: "cover" | "contain";
    keyColor: string;
    similarity: number;
    blend: number;
    outputWidth: number;
    outputHeight: number;
    /** 绿幕视频原始尺寸，用于在输出画布中等比居中 */
    videoWidth: number;
    videoHeight: number;
};

/**
 * 纯前端（WebAV + Canvas）逐帧抠像并合成新背景。
 * 与预览使用同一套抠像算法与几何计算，保证所见即所得。
 */
export const videoBackgroundReplaceExecute = async (
    videoPath: string,
    imagePath: string,
    config: VideoBackgroundReplaceExecuteConfig,
): Promise<string> => {
    const outputFile = await $mapi.file.temp("mp4");

    const outputWidth = Math.max(2, Math.round(config.outputWidth));
    const outputHeight = Math.max(2, Math.round(config.outputHeight));

    // 前景（绿幕视频）在输出画布中等比居中（与预览一致）
    const videoWidth = config.videoWidth > 0 ? config.videoWidth : outputWidth;
    const videoHeight =
        config.videoHeight > 0 ? config.videoHeight : outputHeight;
    const fgRatio = Math.min(
        outputWidth / videoWidth,
        outputHeight / videoHeight,
    );
    const fgWidth = Math.max(1, Math.round(videoWidth * fgRatio));
    const fgHeight = Math.max(1, Math.round(videoHeight * fgRatio));
    const fgX = Math.round((outputWidth - fgWidth) / 2);
    const fgY = Math.round((outputHeight - fgHeight) / 2);

    // 读取背景图片流
    const imageStream = await $mapi.file.readStream(imagePath, {
        isDataPath: false,
    });
    if (!imageStream) {
        throw new Error("Failed to read image stream");
    }

    // 绿幕视频 clip（逐帧抠像）
    const videoClip = new ChromaKeyVideoClip({
        bizId: config.bizId,
        video: videoPath,
        canvasWidth: fgWidth,
        canvasHeight: fgHeight,
        keyColor: config.keyColor,
        similarity: config.similarity,
        blend: config.blend,
    });
    try {
        await videoClip.ready;
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        throw new Error(`Failed to initialize video clip: ${message}`);
    }

    // 背景图片 clip
    const imgClip = new ImgClip(imageStream);
    try {
        await imgClip.ready;
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        throw new Error(`Failed to initialize image clip: ${message}`);
    }

    // 背景图片在输出画布中的尺寸（与预览 drawImageByMode 一致）
    let imgWidth = outputWidth;
    let imgHeight = outputHeight;
    const imgAspect = imgClip.meta.width / imgClip.meta.height;
    const outputAspect = outputWidth / outputHeight;
    if (config.imageMode === "contain") {
        if (imgAspect > outputAspect) {
            imgWidth = outputWidth;
            imgHeight = imgWidth / imgAspect;
        } else {
            imgHeight = outputHeight;
            imgWidth = imgHeight * imgAspect;
        }
    } else {
        if (imgAspect > outputAspect) {
            imgHeight = outputHeight;
            imgWidth = imgHeight * imgAspect;
        } else {
            imgWidth = outputWidth;
            imgHeight = imgWidth / imgAspect;
        }
    }

    const duration = videoClip.meta.duration;

    const imgSprite = new OffscreenSprite(imgClip);
    imgSprite.rect.x = (outputWidth - imgWidth) / 2;
    imgSprite.rect.y = (outputHeight - imgHeight) / 2;
    imgSprite.rect.w = imgWidth;
    imgSprite.rect.h = imgHeight;
    imgSprite.rect.angle = 0;
    imgSprite.time = { offset: 0, duration };

    const videoSprite = new OffscreenSprite(videoClip as any);
    videoSprite.rect.x = fgX;
    videoSprite.rect.y = fgY;
    videoSprite.rect.w = fgWidth;
    videoSprite.rect.h = fgHeight;
    videoSprite.rect.angle = 0;
    videoSprite.time = { offset: 0, duration };

    const com = webavCombinator({
        width: outputWidth,
        height: outputHeight,
    });

    await com.addSprite(imgSprite);
    await com.addSprite(videoSprite);

    await webavWriteStream(outputFile, com);
    return outputFile;
};
